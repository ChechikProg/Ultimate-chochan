// Servidor de Ultimate Chochan para Cloudflare Workers.
// Los archivos del juego (public/) los sirve Cloudflare directo. Cada sala es un
// Durable Object: un mini servidor que vive cerca del jugador que la creó y hace
// de relay WebSocket entre los jugadores. La lógica de la ronda la lleva el host.
import { DurableObject } from 'cloudflare:workers';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const randomCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');

// Ubica la sala en la región más cercana a quien la crea
function locationHint(cf) {
  if (!cf) return undefined;
  const lon = Number(cf.longitude) || 0;
  switch (cf.continent) {
    case 'SA': return 'sam';
    case 'NA': return lon < -100 ? 'wnam' : 'enam';
    case 'EU': return lon > 20 ? 'eeur' : 'weur';
    case 'AS': return lon < 60 ? 'me' : 'apac';
    case 'OC': return 'oc';
    case 'AF': return 'afr';
  }
  return undefined;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== '/ws') return env.ASSETS.fetch(req);
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Se esperaba un WebSocket', { status: 426 });

    const join = (url.searchParams.get('join') || '').toUpperCase();
    if (join) {
      if (!/^[A-Z]{4}$/.test(join)) return new Response('Código inválido', { status: 400 });
      const stub = env.ROOMS.get(env.ROOMS.idFromName(join));
      return stub.fetch(new Request(`https://sala/ws?code=${join}`, req));
    }
    const hint = locationHint(req.cf);
    for (let i = 0; i < 6; i++) {
      const code = randomCode();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code), hint ? { locationHint: hint } : undefined);
      const res = await stub.fetch(new Request(`https://sala/ws?code=${code}&create=1`, req));
      if (res.status !== 409) return res;
    }
    return new Response('No hay salas libres, probá de nuevo', { status: 503 });
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.meta = null;
  }

  // El estado se guarda en storage + en cada socket para sobrevivir a la hibernación
  async loadMeta() {
    if (!this.meta) this.meta = (await this.ctx.storage.get('meta')) || { code: null, host: null, started: false, nextId: 1 };
    return this.meta;
  }
  async saveMeta() { await this.ctx.storage.put('meta', this.meta); }

  players(except) {
    const out = [];
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      const a = ws.deserializeAttachment();
      if (a && a.id) out.push({ ws, a });
    }
    return out;
  }
  send(ws, m) { try { ws.send(typeof m === 'string' ? m : JSON.stringify(m)); } catch (e) { /* socket cerrado */ } }
  broadcastRoster(except) {
    const list = this.players(except);
    const m = JSON.stringify({ t: 'roster', players: list.map(({ a }) => ({ id: a.id, name: a.name, char: a.char })), host: this.meta.host });
    for (const { ws } of list) this.send(ws, m);
  }
  fail(ws, msg) {
    this.send(ws, { t: 'error', msg });
    try { ws.close(1000, 'error'); } catch (e) { /* ya cerrado */ }
  }

  async fetch(req) {
    const url = new URL(req.url);
    const create = url.searchParams.get('create') === '1';
    await this.loadMeta();
    if (create) {
      if (this.players().length > 0) return new Response('Ocupada', { status: 409 });
      this.meta = { code: url.searchParams.get('code'), host: null, started: false, nextId: 1 };
      await this.saveMeta();
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id: 0, mode: create ? 'create' : 'join' });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let m;
    try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const meta = await this.loadMeta();
    const me = ws.deserializeAttachment() || { id: 0 };
    const name = () => String(m.name || 'Jugador').slice(0, 14);

    switch (m.t) {
      case 'create': {
        if (me.id || me.mode !== 'create') return;
        const id = meta.nextId++;
        meta.host = id;
        await this.saveMeta();
        ws.serializeAttachment({ id, name: name(), char: m.char | 0 });
        this.send(ws, { t: 'joined', code: meta.code, id });
        this.broadcastRoster();
        return;
      }
      case 'join': {
        if (me.id) return;
        const others = this.players(ws);
        if (others.length === 0) return this.fail(ws, 'No existe esa sala');
        if (others.length >= 4) return this.fail(ws, 'La sala está llena (máx. 4)');
        if (meta.started) return this.fail(ws, 'La partida ya empezó');
        const id = meta.nextId++;
        await this.saveMeta();
        ws.serializeAttachment({ id, name: name(), char: m.char | 0 });
        this.send(ws, { t: 'joined', code: meta.code, id });
        this.broadcastRoster();
        return;
      }
      case 'char':
        if (!me.id) return;
        ws.serializeAttachment(Object.assign(me, { char: m.char | 0 }));
        this.broadcastRoster();
        return;
      case 'started':
        if (me.id && meta.host === me.id) { meta.started = !!m.v; await this.saveMeta(); }
        return;
      case 'leave':
        await this.leave(ws);
        try { ws.close(1000, 'leave'); } catch (e) { /* ya cerrado */ }
        return;
      default: {
        // Relay a los demás de la sala (o solo al host si m.toHost)
        if (!me.id) return;
        m.from = me.id;
        const s = JSON.stringify(m);
        for (const { ws: w, a } of this.players(ws)) {
          if (m.toHost && a.id !== meta.host) continue;
          this.send(w, s);
        }
      }
    }
  }

  async leave(ws) {
    const me = ws.deserializeAttachment();
    if (!me || !me.id) return;
    ws.serializeAttachment({ id: 0 });
    const meta = await this.loadMeta();
    const rest = this.players(ws);
    if (rest.length === 0) {
      this.meta = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    if (meta.host === me.id) meta.host = rest[0].a.id;
    await this.saveMeta();
    this.broadcastRoster(ws);
  }

  async webSocketClose(ws, code) {
    await this.leave(ws);
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye'); } catch (e) { /* ya cerrado */ }
  }
  async webSocketError(ws) { await this.leave(ws); }
}
