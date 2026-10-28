'use strict';
// ===== Ultimate Chochan: juego online =====
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let SCALE = 1;

const PHYS = { grav: 2300, maxFall: 950, run: 255, sprint: 340, accG: 2600, accA: 1700, fric: 2800, jump: 740, slide: 150, wjx: 300, wjy: 680 };
const PICK_TIME = 15, PLACE_TIME = 30, RUN_TIME = 60, SCORE_TIME = 7;

const G = {
  me: null, host: false, code: null, roster: [], hostId: null,
  S: null, L: null, cache: null, cacheKey: '',
  t: 0, items: [], grid: null, movers: [], hazards: [], winds: [], shots: [],
  body: null, remote: {}, cursor: { x: W / 2, y: H / 2, rot: 0 }, rcur: {},
  clock: 0, runId: -1, phaseT: 0, deadline: 0, netT: 0, curT: 0, syncT: 0,
  shake: 0, banner: null, myIdx: 0, pending: false,
};

// ---------- Red ----------
const Net = {
  ws: null,
  connect(cb) {
    if (this.ws && this.ws.readyState === 1) return cb();
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    this.ws = ws;
    ws.onopen = cb;
    ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
    ws.onclose = () => { if (G.code) { lobbyError('Se perdió la conexión con el servidor'); resetToMenu(); } };
    ws.onerror = () => lobbyError('No se pudo conectar al servidor');
  },
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); },
};

function onMsg(m) {
  switch (m.t) {
    case 'joined':
      G.me = m.id; G.code = m.code;
      history.replaceState(null, '', '?sala=' + m.code);
      showRoom();
      break;
    case 'roster': {
      G.roster = m.players;
      const wasHost = G.host;
      G.hostId = m.host; G.host = m.host === G.me;
      if (G.host && G.S) {
        // Sacar jugadores que se fueron
        const ids = new Set(m.players.map((p) => p.id));
        G.S.players = G.S.players.filter((p) => ids.has(p.id));
        if (!wasHost) G.deadline = performance.now() / 1000 + (G.S.left || 5);
        if (G.S.players.length === 0) G.S = null; else broadcast();
      }
      renderRoom();
      break;
    }
    case 'error': lobbyError(m.msg); break;
    case 'state': applyState(m.S); break;
    case 'req': if (G.host) hostReq(m.from, m); break;
    case 'pos': G.remote[m.from] = Object.assign(G.remote[m.from] || { x: m.x, y: m.y }, m, { tx: m.x, ty: m.y }); break;
    case 'cur': G.rcur[m.from] = m; break;
  }
}

function request(m) {
  if (G.host) hostReq(G.me, m);
  else Net.send(Object.assign({ t: 'req', toHost: true }, m));
}

// ---------- Lógica del anfitrión ----------
function now() { return performance.now() / 1000; }
function broadcast() {
  if (!G.S) return;
  G.S.left = Math.max(0, G.deadline - now());
  Net.send({ t: 'state', S: G.S });
  applyState(JSON.parse(JSON.stringify(G.S)));
}
function hostStart(level) {
  const S = {
    phase: 'pick', level, round: 0, runId: 0, items: [], nextItem: 1,
    players: G.roster.map((p) => ({ id: p.id, name: p.name, char: p.char })),
    scores: {}, prev: {}, awards: {}, banner: '', winner: null,
  };
  S.players.forEach((p) => { S.scores[p.id] = 0; S.prev[p.id] = 0; });
  G.S = S;
  Net.send({ t: 'started', v: true });
  hostNewRound();
}
function weightedItem() {
  const crowded = G.S.items.length > 10;
  const pool = [];
  for (const k of ITEM_KEYS) { const w = ITEMS[k].w * (k === 'bomba' && crowded ? 3 : 1); pool.push([k, w]); }
  let r = Math.random() * pool.reduce((a, b) => a + b[1], 0);
  for (const [k, w] of pool) { r -= w; if (r <= 0) return k; }
  return 'caja';
}
function hostNewRound() {
  const S = G.S;
  S.round++;
  S.phase = 'pick';
  const n = Math.min(6, Math.max(3, S.players.length + 2));
  S.cards = [];
  for (let i = 0; i < n; i++) S.cards.push({ type: weightedItem(), by: null });
  S.hand = {}; S.placed = {}; S.status = {}; S.alf = {};
  S.players.forEach((p) => { S.hand[p.id] = null; S.placed[p.id] = false; S.status[p.id] = { dead: false, fin: false, order: 0, killer: null }; });
  G.deadline = now() + PICK_TIME;
  broadcast();
}
function hostReq(from, m) {
  const S = G.S;
  if (!S || !S.players.find((p) => p.id === from)) return;
  if (m.kind === 'pick' && S.phase === 'pick') {
    const c = S.cards[m.card];
    if (!c || c.by != null || S.hand[from]) return;
    c.by = from; S.hand[from] = c.type;
    broadcast();
  } else if (m.kind === 'place' && S.phase === 'place') {
    const type = S.hand[from];
    if (!type || S.placed[from]) return;
    const L = parseLevelCached(S.level);
    if (!canPlace(L, S.items, type, m.gx, m.gy, m.rot)) return;
    if (type === 'bomba') {
      S.items = S.items.filter((it) => !itemCells(it).some(([x, y]) => Math.abs(x - m.gx) <= 1 && Math.abs(y - m.gy) <= 1));
      S.boom = { gx: m.gx, gy: m.gy, n: (S.boom ? S.boom.n : 0) + 1 };
    } else {
      S.items.push({ id: S.nextItem++, type, gx: m.gx, gy: m.gy, rot: m.rot % rotCount(type), owner: from });
    }
    S.hand[from] = null; S.placed[from] = true;
    broadcast();
  } else if (m.kind === 'status' && S.phase === 'run' && m.run === S.runId) {
    const st = S.status[from];
    if (!st || st.dead || st.fin) return;
    if (m.alf != null && S.alf[m.alf] == null) S.alf[m.alf] = from;
    if (m.fin) { st.fin = true; st.order = 1 + Object.values(S.status).filter((s) => s.fin).length; }
    else if (m.dead) { st.dead = true; st.killer = m.killer != null ? m.killer : null; }
    broadcast();
  } else if (m.kind === 'alf' && S.phase === 'run' && S.alf[m.alf] == null) {
    S.alf[m.alf] = from;
    broadcast();
  }
}
function hostScore() {
  const S = G.S, ids = S.players.map((p) => p.id), n = ids.length;
  const fins = ids.filter((id) => S.status[id].fin).sort((a, b) => S.status[a].order - S.status[b].order);
  S.awards = {}; ids.forEach((id) => (S.awards[id] = []));
  if (n >= 2 && fins.length === n) S.banner = '¡Demasiado fácil! Nadie suma';
  else if (fins.length === 0) S.banner = '¡Nadie llegó!';
  else {
    S.banner = '';
    fins.forEach((id) => S.awards[id].push(['Meta', 10, '#2fd36b']));
    if (n >= 2 && fins.length === 1) S.awards[fins[0]].push(['Solitario', 6, '#b05cff']);
    else if (fins.length >= 2) S.awards[fins[0]].push(['Primero', 4, '#ffc414']);
    for (const pid of Object.values(S.alf)) if (S.status[pid] && S.status[pid].fin) S.awards[pid].push(['Alfajor', 4, '#c47a3a']);
    ids.forEach((id) => { const s = S.status[id]; if (s.dead && s.killer != null && s.killer !== id && S.awards[s.killer]) S.awards[s.killer].push(['Trampa', 3, '#ff4b4b']); });
  }
  ids.forEach((id) => { S.prev[id] = S.scores[id]; S.scores[id] += S.awards[id].reduce((a, b) => a + b[1], 0); });
  S.phase = 'score';
  G.deadline = now() + SCORE_TIME;
  broadcast();
}
function hostTick() {
  const S = G.S;
  if (!S || !G.host) return;
  const ids = S.players.map((p) => p.id);
  const left = G.deadline - now();
  if (S.phase === 'pick') {
    if (ids.every((id) => S.hand[id]) || left <= 0) {
      ids.forEach((id) => {
        if (!S.hand[id]) { const free = S.cards.findIndex((c) => c.by == null); if (free >= 0) { S.cards[free].by = id; S.hand[id] = S.cards[free].type; } }
      });
      S.phase = 'place'; G.deadline = now() + PLACE_TIME; broadcast();
    }
  } else if (S.phase === 'place') {
    if (ids.every((id) => S.placed[id] || !S.hand[id]) || left <= 0) {
      S.phase = 'run'; S.runId++; G.deadline = now() + 3 + RUN_TIME; broadcast();
    }
  } else if (S.phase === 'run') {
    if (ids.every((id) => S.status[id].dead || S.status[id].fin)) {
      if (!G.endAt) G.endAt = now() + 1.2;
      if (now() >= G.endAt) { G.endAt = 0; hostScore(); }
    } else if (left <= 0) {
      ids.forEach((id) => { if (!S.status[id].fin) S.status[id].dead = true; });
      hostScore();
    }
  } else if (S.phase === 'score') {
    if (left <= 0) {
      const best = ids.reduce((a, b) => (S.scores[b] > S.scores[a] ? b : a), ids[0]);
      if (S.scores[best] >= TARGET_SCORE) { S.phase = 'win'; S.winner = best; G.deadline = now() + 999; broadcast(); }
      else hostNewRound();
    }
  }
  G.syncT += STEP;
  if (G.syncT > 1) { G.syncT = 0; broadcast(); }
}

// ---------- Estado compartido -> local ----------
const levelCache = {};
function parseLevelCached(i) { return levelCache[i] || (levelCache[i] = parseLevel(i)); }

function applyState(S) {
  const old = G.S && !G.host ? G.S : G.prevApplied;
  G.prevApplied = S;
  if (!G.host) { G.S = S; G.deadline = now() + (S.left || 0); }
  if (!G.L || G.L.idx !== S.level) { G.L = parseLevelCached(S.level); G.cacheKey = ''; }
  G.myIdx = Math.max(0, S.players.findIndex((p) => p.id === G.me));
  // Ítems: conservar estado de ejecución
  const prevSt = {}; G.items.forEach((it) => (prevSt[it.id] = it.st));
  const oldIds = new Set(G.items.map((i) => i.id));
  G.items = S.items.map((it) => Object.assign({}, it, { st: prevSt[it.id] || {} }));
  for (const it of G.items) if (!oldIds.has(it.id) && old && old.phase === 'place') { Sfx.play('place'); FX.burst(it.gx * T + 20, it.gy * T + 20, 12, ['#fff', '#e8d6b0'], 200); }
  if (S.boom && (!old || !old.boom || old.boom.n !== S.boom.n)) {
    Sfx.play('bomb'); G.shake = 14;
    FX.burst(S.boom.gx * T + 20, S.boom.gy * T + 20, 50, ['#ffd23f', '#ff7a2f', '#555', '#fff'], 500, { drag: 2 });
  }
  for (const it of G.items) if (it.type === 'alfajor') it.st.taken = S.alf && S.alf[it.id] != null;
  buildGrid();
  const phaseChanged = !old || old.phase !== S.phase || old.round !== S.round || old.runId !== S.runId;
  if (phaseChanged) enterPhase(S, old);
  if (S.phase === 'run' && G.body && S.status[G.me] && S.status[G.me].dead && G.body.alive) killMe(null, true);
  hideLobby(S.phase !== 'lobby');
}

function enterPhase(S, old) {
  G.phaseT = 0;
  if (S.phase === 'pick') { G.cursor = { x: W / 2 + (G.myIdx - 1.5) * 90, y: 560, rot: 0 }; G.pending = false; if (S.round > 1 || !old) Sfx.play('pick'); }
  if (S.phase === 'place') {
    G.cursor.x = W / 2; G.cursor.y = H / 2;
    G.cursor.rot = ITEMS[S.hand[G.me]] ? (ITEMS[S.hand[G.me]].def || 0) : 0;
    G.pending = false;
  }
  if (S.phase === 'run' && S.runId !== G.runId) {
    G.runId = S.runId; G.clock = -3; G.shots = []; G.remote = {};
    G.items.forEach((it) => (it.st = {}));
    buildGrid();
    G.body = newBody(); spawnBody(G.body, G.myIdx);
    G.lastCount = 4;
  }
  if (S.phase === 'score') { G.scoreSfx = 0; }
  if (S.phase === 'win') { Sfx.play('win'); }
}

// ---------- Construcción ----------
function canPlace(L, items, type, gx, gy, rot) {
  if (type === 'bomba') return gx >= 0 && gy >= 0 && gx < COLS && gy < ROWS;
  const occ = new Set();
  for (const it of items) for (const [x, y] of itemCells(it)) occ.add(x + ',' + y);
  for (const [a, b] of itemCellsRel(type, rot)) {
    const x = gx + a, y = gy + b;
    if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return false;
    if (L.solid[y][x] || L.oneway[y][x]) return false;
    if (L.waterY != null && y * T >= L.waterY) return false;
    if (L.isProtected(x, y)) return false;
    if (occ.has(x + ',' + y)) return false;
  }
  return true;
}
function ghostPos(type, cur) {
  const cs = itemCellsRel(type, cur.rot);
  const bw = Math.max(...cs.map((c) => c[0])) + 1, bh = Math.max(...cs.map((c) => c[1])) + 1;
  return { gx: Math.round(cur.x / T - bw / 2), gy: Math.round(cur.y / T - bh / 2) };
}

// ---------- Colisiones ----------
function buildGrid() {
  const L = G.L; if (!L) return;
  const grid = [];
  for (let y = 0; y < ROWS; y++) {
    grid.push([]);
    for (let x = 0; x < COLS; x++) {
      if (L.solid[y][x]) grid[y].push({ x: x * T, y: y * T, w: T, h: T, kind: 'solid' });
      else if (L.oneway[y][x]) grid[y].push({ x: x * T, y: y * T, w: T, h: 12, kind: 'solid', oneWay: true });
      else grid[y].push(null);
    }
  }
  G.movers = [];
  for (const it of G.items) {
    const put = (o) => { for (const [x, y] of itemCells(it)) if (grid[y] && x >= 0 && x < COLS) grid[y][x] = Object.assign({ x: x * T, y: y * T, w: T, h: T, item: it }, o); };
    switch (it.type) {
      case 'caja': case 'tablon': case 'viga': case 'ele': case 'canon': case 'ventilador': case 'llamas': put({ kind: 'solid' }); break;
      case 'hielo': put({ kind: 'ice' }); break;
      case 'miel': put({ kind: 'honey' }); break;
      case 'fragil': put({ kind: 'fragil' }); break;
      case 'cinta': put({ kind: 'conv', speed: it.rot % 2 ? -150 : 150 }); break;
      case 'resorte': grid[it.gy][it.gx] = { x: it.gx * T + 2, y: it.gy * T + 14, w: 36, h: 26, kind: 'spring', item: it }; break;
      case 'movil': {
        if (!it.st.rect) it.st.rect = { x: it.gx * T, y: it.gy * T + 9, w: 80, h: 22, kind: 'solid', mover: true, dx: 0, dy: 0 };
        G.movers.push(it.st.rect); break;
      }
    }
  }
  G.grid = grid;
  // Alcance de viento y llamas
  for (const it of G.items) {
    if (it.type === 'ventilador') it.st.reach = reach(it, 6);
    if (it.type === 'llamas') it.st.reach = reach(it, 3);
  }
}
function cellAt(gx, gy) {
  if (!G.grid || gy < 0 || gy >= ROWS || gx < 0 || gx >= COLS) return null;
  const c = G.grid[gy][gx];
  if (!c || (c.item && c.item.st.gone)) return null;
  return c;
}
function reach(it, max) {
  const [dx, dy] = DIRS[it.rot % 4];
  let n = 0;
  for (let i = 1; i <= max; i++) {
    const c = cellAt(it.gx + dx * i, it.gy + dy * i);
    if (c && !c.oneWay) break;
    if (it.gx + dx * i < 0 || it.gx + dx * i >= COLS || it.gy + dy * i < -2 || it.gy + dy * i >= ROWS) break;
    n = i;
  }
  return n;
}
function beamRect(it, n, thick) {
  const [dx, dy] = DIRS[it.rot % 4];
  const cx = it.gx * T + T / 2 + dx * (T / 2 + n * T / 2), cy = it.gy * T + T / 2 + dy * (T / 2 + n * T / 2);
  const w = dx ? n * T : thick, h = dy ? n * T : thick;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function solidsNear(b) {
  const out = [];
  const x0 = Math.floor((b.x - 4) / T), x1 = Math.floor((b.x + b.w + 4) / T);
  const y0 = Math.floor((b.y - 4) / T), y1 = Math.floor((b.y + b.h + 4) / T);
  for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) { const c = cellAt(gx, gy); if (c) out.push(c); }
  for (const m of G.movers) out.push(m);
  return out;
}

// ---------- Ítems en ejecución ----------
function updateItems(dt) {
  const c = G.clock + 3;
  G.hazards = []; G.winds = [];
  const feet = [];
  if (G.body && G.body.alive && !G.body.fin) feet.push(G.body);
  for (const id in G.remote) { const r = G.remote[id]; if (r.al && !r.fn && r.run === G.runId) feet.push({ x: r.x, y: r.y, w: 24, h: 32 }); }
  for (const it of G.items) {
    const st = it.st, x = it.gx * T, y = it.gy * T;
    switch (it.type) {
      case 'pinchos': G.hazards.push({ x: x + 5, y: y + 5, w: 30, h: 30, owner: it.owner }); break;
      case 'sierra': G.hazards.push({ cx: x + T, cy: y + T, r: 33, owner: it.owner }); break;
      case 'movil': {
        const r = st.rect, ph = Math.sin(c / 3.4 * Math.PI * 2) * 100;
        const nx = it.rot % 2 ? x : x + ph, ny = it.rot % 2 ? y + 9 + ph : y + 9;
        r.dx = nx - r.x; r.dy = ny - r.y; r.x = nx; r.y = ny; st.x = nx; st.y = ny;
        break;
      }
      case 'canon': {
        const k = Math.floor(c / 2.6);
        if (st.k == null) st.k = k;
        if (k !== st.k) {
          st.k = k; st.recoil = 1;
          const [dx, dy] = DIRS[it.rot % 4];
          G.shots.push({ x: x + 20 + dx * 26, y: y + 20 + dy * 26, vx: dx * 330, vy: dy * 330, owner: it.owner });
          if (G.S.phase === 'run') Sfx.play('cannon');
        }
        st.recoil = Math.max(0, (st.recoil || 0) - dt * 4);
        break;
      }
      case 'resorte': st.squash = Math.max(0, (st.squash || 0) - dt * 5); break;
      case 'fragil': {
        if (st.gone) {
          st.back = (st.back || 0) - dt;
          if (st.back <= 0 && !feet.some((b) => ov(b, { x, y, w: 80, h: 40 }))) { st.gone = false; st.trig = 0; }
        } else if (st.trig > 0) {
          st.trig -= dt;
          if (st.trig <= 0) { st.gone = true; st.back = 2.5; Sfx.play('crumble'); FX.burst(x + 40, y + 20, 14, ['#e2c08a', '#a07a45'], 180, { g: 900 }); }
        } else if (feet.some((b) => Math.abs(b.y + b.h - y) < 3 && b.x + b.w > x && b.x < x + 80 && it.rot % 2 === 0)) st.trig = 0.45;
        else if (it.rot % 2 === 1 && feet.some((b) => Math.abs(b.y + b.h - y) < 3 && b.x + b.w > x && b.x < x + 40)) st.trig = 0.45;
        break;
      }
      case 'ventilador': if (st.reach > 0) G.winds.push({ r: beamRect(it, st.reach, T), dir: it.rot % 4 }); break;
      case 'llamas': {
        const p = c % 3;
        st.warn = p > 1.3 && p < 1.8; st.on = p >= 1.8;
        if (st.on && st.reach > 0) G.hazards.push(Object.assign(beamRect(it, st.reach, 24), { owner: it.owner, flame: it }));
        break;
      }
    }
  }
  for (const s of G.shots) {
    s.x += s.vx * dt; s.y += s.vy * dt;
    const cl = cellAt(Math.floor(s.x / T), Math.floor(s.y / T));
    if ((cl && !cl.oneWay) || G.movers.some((m) => circleRect(s.x, s.y, 6, m)) || s.x < -20 || s.x > W + 20 || s.y < -60 || s.y > H + 20) { s.dead = true; FX.burst(s.x, s.y, 6, ['#555', '#999'], 120); }
    G.hazards.push({ cx: s.x, cy: s.y, r: 9, owner: s.owner });
  }
  G.shots = G.shots.filter((s) => !s.dead);
}

// ---------- Jugador local ----------
function newBody() { return { x: 0, y: 0, w: 24, h: 32, vx: 0, vy: 0, f: 1, gr: false, gref: null, coy: 0, jb: 0, wall: 0, wj: 0, cut: false, drop: 0, alive: true, fin: false, run: 0, sx: 1, sy: 1, blink: 0, alf: null }; }
function spawnBody(b, idx) {
  const L = G.L;
  b.x = L.spawn.gx * T + T / 2 - b.w / 2 + (idx - 1.5) * 10;
  b.y = (L.spawn.gy + 1) * T - b.h;
  b.f = 1;
}
function killMe(killer, silentNet) {
  const b = G.body; if (!b || !b.alive || b.fin) return;
  b.alive = false;
  const col = CHARS[myChar()].body;
  FX.burst(b.x + 12, b.y + 16, 26, [col, '#fff', OUT], 380, { drag: 2 });
  Sfx.play('die'); G.shake = 10;
  if (!silentNet) request({ kind: 'status', run: G.runId, dead: true, killer });
}
function myChar() { const p = G.S && G.S.players.find((q) => q.id === G.me); return p ? p.char : 0; }

function updateBody(dt) {
  const b = G.body, S = G.S;
  if (!b || !b.alive || b.fin) return;
  const frozen = G.clock < 0;
  const [ax, ay] = Input.ax();
  const mx = frozen ? 0 : ax;
  const kind = b.gr && b.gref ? b.gref.kind : null;
  const sprint = Input.h('action');
  let maxV = sprint ? PHYS.sprint : PHYS.run;
  let acc = b.gr ? PHYS.accG : PHYS.accA, fric = b.gr ? PHYS.fric : 500;
  if (kind === 'honey') maxV *= 0.45;
  if (kind === 'ice') { acc *= 0.22; fric = 220; }
  if (b.wj > 0) { b.wj -= dt; acc *= 0.25; }
  if (mx) { if (b.vx * mx < 0 && kind !== 'ice') acc *= 1.7; b.vx = approach(b.vx, mx * maxV, acc * dt); b.f = mx > 0 ? 1 : -1; }
  else b.vx = approach(b.vx, 0, fric * dt);
  if (!frozen && (Input.p('jump') || Input.p('up'))) b.jb = 0.13; else b.jb -= dt;
  const jumpHeld = Input.h('jump') || Input.h('up');
  b.coy = b.gr ? 0.1 : b.coy - dt;
  if (ay > 0.5 && Input.p('down')) b.drop = 0.25;
  b.drop -= dt;
  if (b.jb > 0) {
    if (b.coy > 0) {
      b.vy = -PHYS.jump * (kind === 'honey' ? 0.68 : 1); b.jb = 0; b.coy = 0; b.gr = false; b.cut = true;
      b.sx = 0.75; b.sy = 1.3; Sfx.play('jump'); FX.burst(b.x + 12, b.y + b.h, 6, '#fff', 90);
    } else if (b.wall) {
      b.vy = -PHYS.wjy; b.vx = -b.wall * PHYS.wjx; b.f = -b.wall; b.wj = 0.16; b.jb = 0; b.cut = true;
      b.sx = 0.75; b.sy = 1.3; Sfx.play('jump');
    }
  }
  if (!jumpHeld && b.cut && b.vy < 0) { b.vy *= 0.45; b.cut = false; }
  if (b.vy >= 0) b.cut = false;
  b.vy += PHYS.grav * dt;
  if (!b.gr && b.wall && mx === b.wall && b.vy > PHYS.slide) { b.vy = PHYS.slide; if (Math.random() < 0.3) FX.add({ x: b.x + (b.wall > 0 ? b.w : 0), y: b.y + 26, vy: -30, size: 3, life: 0.3 }); }
  b.vy = Math.min(b.vy, PHYS.maxFall);
  // viento y arrastre de superficie: se suman al movimiento en X para que choquen con las paredes
  let carry = 0;
  for (const w of G.winds) if (ov(b, w.r)) {
    if (w.dir === 0) { b.vy = Math.max(b.vy - 4300 * dt, -460); }
    else if (w.dir === 2) b.vy += 2000 * dt;
    else carry += (w.dir === 1 ? 1 : -1) * 200 * dt;
  }
  if (b.gr && b.gref) {
    if (b.gref.kind === 'conv') carry += b.gref.speed * dt;
    if (b.gref.mover) { carry += b.gref.dx; b.y += b.gref.dy; }
  }
  // empujes de plataformas móviles
  for (const m of G.movers) if (ov(b, m) && m !== b.gref) {
    const pl = b.x + b.w - m.x, pr = m.x + m.w - b.x, pu = b.y + b.h - m.y, pd = m.y + m.h - b.y;
    const mn = Math.min(pl, pr, pu, pd);
    if (mn === pu) { b.y = m.y - b.h; } else if (mn === pd) b.y = m.y + m.h; else if (mn === pl) b.x = m.x - b.w; else b.x = m.x + m.w;
  }
  // mover X
  const px = b.x;
  b.x += b.vx * dt + carry;
  for (const s of solidsNear(b)) {
    if (s.oneWay || !ov(b, s)) continue;
    const sdx = s.dx || 0;
    if (px + b.w <= s.x - sdx + 2) { b.x = s.x - b.w; if (b.vx > 0) b.vx = 0; }
    else if (px >= s.x + s.w - sdx - 2) { b.x = s.x + s.w; if (b.vx < 0) b.vx = 0; }
    else if (Math.min(b.y + b.h, s.y + s.h) - Math.max(b.y, s.y) > 4) {
      // ya estaba adentro (p. ej. empujado por una plataforma móvil): sacarlo por el lado más cercano
      b.x = b.x + b.w / 2 < s.x + s.w / 2 ? s.x - b.w : s.x + s.w;
      b.vx = 0;
    }
  }
  if (b.x < 0) { b.x = 0; b.vx = 0; }
  if (b.x + b.w > W) { b.x = W - b.w; b.vx = 0; }
  // mover Y
  const py = b.y, vyBefore = b.vy;
  b.y += b.vy * dt;
  b.gr = false; b.gref = null;
  for (const s of solidsNear(b)) {
    if (!ov(b, s)) continue;
    const sdy = s.dy || 0;
    if (py + b.h <= s.y - sdy + 4 + Math.abs(sdy) && b.vy >= 0) {
      if (s.oneWay && b.drop > 0) continue;
      b.y = s.y - b.h;
      if (s.kind === 'spring') {
        b.vy = -1080; b.cut = false; s.item.st.squash = 1; b.sx = 0.7; b.sy = 1.4; Sfx.play('spring');
      } else {
        if (vyBefore > 350) { b.sx = 1.3; b.sy = 0.75; Sfx.play('land'); FX.burst(b.x + 12, b.y + b.h, 5, '#fff', 80); }
        b.vy = 0; b.gr = true; b.gref = s;
      }
    } else if (!s.oneWay && py >= s.y + s.h - sdy - 4) {
      b.y = s.y + s.h; if (b.vy < 0) b.vy = 0;
    }
  }
  // paredes
  b.wall = 0;
  if (!b.gr) {
    const probe = (x) => solidsNear(b).some((s) => !s.oneWay && s.kind !== 'spring' && ov({ x, y: b.y + 4, w: 2, h: b.h - 8 }, s));
    if (probe(b.x - 2)) b.wall = -1; else if (probe(b.x + b.w)) b.wall = 1;
  }
  // animación
  b.sx = lerp(b.sx, 1, 0.2); b.sy = lerp(b.sy, 1, 0.2);
  if (b.gr && Math.abs(b.vx) > 20) { b.run += dt * Math.abs(b.vx) / 14; if (Math.random() < 0.08) FX.add({ x: b.x + 12, y: b.y + b.h, vx: -b.vx * 0.1, vy: -20, size: 4, life: 0.35, color: 'rgba(255,255,255,0.8)' }); }
  if (frozen) return;
  // muerte por caída / agua
  if (b.y > H + 40) return killMe(null);
  if (G.L.waterY != null && b.y + b.h > G.L.waterY + 10) { FX.burst(b.x + 12, G.L.waterY, 20, ['#bfe9ff', '#fff'], 300, { g: 900 }); return killMe(null); }
  // peligros
  const hb = { x: b.x + 4, y: b.y + 5, w: b.w - 8, h: b.h - 7 };
  for (const h of G.hazards) {
    const hit = h.r ? circleRect(h.cx, h.cy, h.r, hb) : ov(hb, h);
    if (hit) return killMe(h.owner);
  }
  // alfajor
  for (const it of G.items) if (it.type === 'alfajor' && !it.st.taken && b.alf == null && ov(b, { x: it.gx * T + 6, y: it.gy * T + 6, w: 28, h: 28 })) {
    b.alf = it.id; it.st.taken = true; Sfx.play('coin');
    request({ kind: 'alf', alf: it.id });
  }
  // meta
  if (ov(b, G.L.goalRect)) {
    b.fin = true; Sfx.play('finish'); FX.confetti(b.x + 12, b.y);
    request({ kind: 'status', run: G.runId, fin: true });
  }
}

// ---------- Bucle ----------
function update(dt) {
  Input.poll();
  G.t += dt; G.phaseT += dt;
  G.shake = Math.max(0, G.shake - dt * 30);
  FX.update(dt);
  const S = G.S;
  if (G.host) hostTick();
  if (!S || S.phase === 'lobby') return;
  const myHand = S.hand ? S.hand[G.me] : null;
  if (S.phase === 'pick' || S.phase === 'place') {
    const [ax, ay] = Input.ax();
    G.cursor.x = clamp(G.cursor.x + ax * 720 * dt, 0, W);
    G.cursor.y = clamp(G.cursor.y + ay * 720 * dt, 0, H);
    if (S.phase === 'pick' && !myHand && !G.pending && Input.p('jump')) {
      const i = cardRects(S).findIndex((r, k) => !S.cards[k].by && G.cursor.x > r.x && G.cursor.x < r.x + r.w && G.cursor.y > r.y && G.cursor.y < r.y + r.h);
      if (i >= 0) { request({ kind: 'pick', card: i }); Sfx.play('pick'); G.pending = true; setTimeout(() => (G.pending = false), 600); }
    }
    if (S.phase === 'place' && myHand && !S.placed[G.me]) {
      if (Input.p('action') && rotCount(myHand) > 1) { G.cursor.rot = (G.cursor.rot + 1) % rotCount(myHand); Sfx.play('rotate'); }
      if (Input.p('jump') && !G.pending) {
        const gp = ghostPos(myHand, G.cursor);
        if (canPlace(G.L, S.items, myHand, gp.gx, gp.gy, G.cursor.rot)) { request({ kind: 'place', gx: gp.gx, gy: gp.gy, rot: G.cursor.rot }); G.pending = true; setTimeout(() => (G.pending = false), 600); }
        else Sfx.play('bad');
      }
    }
    G.curT += dt;
    if (G.curT > 0.066) { G.curT = 0; Net.send({ t: 'cur', x: Math.round(G.cursor.x), y: Math.round(G.cursor.y), rot: G.cursor.rot }); }
  }
  if (S.phase === 'run') {
    const prevClock = G.clock;
    G.clock += dt;
    if (prevClock < 0) { const n = Math.ceil(-G.clock); if (n !== G.lastCount) { G.lastCount = n; Sfx.play(n > 0 ? 'beep' : 'go'); } }
    updateItems(dt);
    updateBody(dt);
    for (const id in G.remote) { const r = G.remote[id]; r.x = lerp(r.x, r.tx, 0.35); r.y = lerp(r.y, r.ty, 0.35); }
    G.netT += dt;
    if (G.netT > 0.05 && G.body) {
      G.netT = 0; const b = G.body;
      Net.send({ t: 'pos', run: G.runId, x: Math.round(b.x), y: Math.round(b.y), f: b.f, mv: b.gr && Math.abs(b.vx) > 20 ? 1 : 0, rn: +b.run.toFixed(2), al: b.alive ? 1 : 0, fn: b.fin ? 1 : 0, alf: b.alf != null ? 1 : 0 });
    }
  } else {
    for (const it of G.items) if (it.type === 'movil' && it.st.rect) { it.st.rect.x = it.st.x = it.gx * T; it.st.rect.y = it.st.y = it.gy * T + 9; }
  }
  if (S.phase === 'score') {
    const reveal = Math.floor((G.phaseT - 0.8) / 0.4);
    if (reveal >= 0 && reveal !== G.scoreSfx && reveal < 8) { G.scoreSfx = reveal; if (S.players.some((p) => S.awards[p.id] && S.awards[p.id][reveal])) Sfx.play('score'); }
  }
  if (S.phase === 'win') {
    if (Math.random() < 0.15) FX.confetti(rand(100, W - 100), -10, 6);
    if (G.host && G.phaseT > 2 && Input.p('jump')) { S.phase = 'lobby'; S.items = []; Net.send({ t: 'started', v: false }); broadcast(); }
  }
}

// ---------- Render ----------
function cardRects(S) {
  const n = S.cards.length, cw = 130, ch = 150, gap = 24, tot = n * cw + (n - 1) * gap, x0 = (W - tot) / 2;
  return S.cards.map((c, i) => ({ x: x0 + i * (cw + gap), y: 230, w: cw, h: ch }));
}
function drawItemIcon(type, cx, cy, maxW, maxH, rot = 0) {
  const cs = itemCellsRel(type, rot);
  const bw = (Math.max(...cs.map((c) => c[0])) + 1) * T, bh = (Math.max(...cs.map((c) => c[1])) + 1) * T;
  const s = Math.min(1.3, maxW / bw, maxH / bh);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-bw / 2, -bh / 2);
  drawItem(ctx, { type, gx: 0, gy: 0, rot: rot || ITEMS[type].def || 0, st: {} }, G.t);
  ctx.restore();
}
function ensureCache() {
  const key = (G.L ? G.L.idx : 0) + ':' + SCALE;
  if (G.cacheKey === key) return;
  const L = G.L || parseLevelCached(0);
  const c = document.createElement('canvas');
  c.width = Math.round(W * SCALE); c.height = Math.round(H * SCALE);
  const g = c.getContext('2d'); g.scale(SCALE, SCALE);
  L.theme.bg(g); drawTerrain(g, L);
  G.cache = c; G.cacheKey = key;
}
function playerById(id) { return G.S && G.S.players.find((p) => p.id === id); }
function colorOf(id) { const i = G.S ? G.S.players.findIndex((p) => p.id === id) : 0; return PCOL[Math.max(0, i) % 4]; }

function drawWorld() {
  ensureCache();
  ctx.drawImage(G.cache, 0, 0, W, H);
  const L = G.L || parseLevelCached(0);
  drawGoal(ctx, L, G.t);
  // llamas y viento
  for (const it of G.items) {
    if (it.type === 'llamas' && it.st.on && it.st.reach > 0) {
      const r = beamRect(it, it.st.reach, 24);
      ctx.fillStyle = '#ff7a2f'; rrect(ctx, r.x, r.y, r.w, r.h, 10); ctx.fill();
      ctx.fillStyle = '#ffd23f'; rrect(ctx, r.x + 5, r.y + 5, Math.max(4, r.w - 10), Math.max(4, r.h - 10), 6); ctx.fill();
      if (Math.random() < 0.5) FX.add({ x: rand(r.x, r.x + r.w), y: rand(r.y, r.y + r.h), vy: -60, size: 5, life: 0.3, color: '#ffb02e' });
    }
    if (it.type === 'ventilador' && it.st.reach > 0) {
      const r = beamRect(it, it.st.reach, T); ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      const d = DIRS[it.rot % 4];
      for (let i = 0; i < 4; i++) {
        const k = ((G.t * 2 + i / 4) % 1);
        const x = r.x + (d[0] ? (d[0] > 0 ? k : 1 - k) * r.w : (i + 0.5) * r.w / 4), y = r.y + (d[1] ? (d[1] > 0 ? k : 1 - k) * r.h : (i + 0.5) * r.h / 4);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - d[0] * 14, y - d[1] * 14); ctx.stroke();
      }
    }
  }
  for (const it of G.items) drawItem(ctx, it, G.t);
  for (const s of G.shots) { ctx.fillStyle = '#2e2e38'; ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, 7); ctx.fill(); ctx.stroke(); }
}
function drawPlayers() {
  const S = G.S; if (!S) return;
  S.players.forEach((p, i) => {
    let x, y, f = 1, mv = false, rn = 0, sx = 1, sy = 1, al = true, fn = false, alf = false;
    if (p.id === G.me) {
      const b = G.body; if (!b) return;
      x = b.x + 12; y = b.y + b.h; f = b.f; mv = b.gr && Math.abs(b.vx) > 20; rn = b.run; sx = b.sx; sy = b.sy; al = b.alive; fn = b.fin; alf = b.alf != null;
    } else {
      const r = G.remote[p.id];
      if (!r || r.run !== G.runId) { if (G.clock > -2.5) return; x = G.L.spawn.gx * T + T / 2 + (i - 1.5) * 10; y = (G.L.spawn.gy + 1) * T; }
      else { x = r.x + 12; y = r.y + 32; f = r.f; mv = !!r.mv; rn = r.rn; al = !!r.al; fn = !!r.fn; alf = !!r.alf; }
    }
    if (!al || fn) return;
    drawChar(ctx, p.char, x, y, { facing: f, moving: mv, run: rn, sx, sy, blink: (G.t + i) % 3.2 < 0.12 });
    if (alf) { ctx.fillStyle = '#6b3d1f'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rrect(ctx, x - 9, y - 62, 18, 10, 4); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = PCOL[i % 4]; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 7, y - 50); ctx.lineTo(x + 7, y - 50); ctx.lineTo(x, y - 42); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (p.id === G.me) txt(ctx, 'VOS', x, y - 58, 13, PCOL[i % 4]);
  });
}
function drawHUD() {
  const S = G.S;
  S.players.forEach((p, i) => {
    const x = 16 + i * 170, y = 12;
    ctx.fillStyle = 'rgba(255,248,232,0.92)'; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
    rrect(ctx, x, y, 158, 46, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PCOL[i % 4]; rrect(ctx, x, y, 12, 46, 6); ctx.fill();
    drawChar(ctx, p.char, x + 36, y + 44, { scale: 0.75 });
    txt(ctx, p.name, x + 60, y + 15, 15, OUT, 'left', null);
    txt(ctx, (S.scores[p.id] || 0) + ' pts', x + 60, y + 34, 17, PCOL[i % 4], 'left', OUT, 3);
    const st = S.status && S.status[p.id];
    if (S.phase === 'run' && st) {
      if (st.fin) txt(ctx, '✔', x + 140, y + 23, 24, '#2fd36b');
      else if (st.dead) txt(ctx, '✖', x + 140, y + 23, 24, '#ff4b4b');
    }
    if ((S.phase === 'pick' && S.hand[p.id]) || (S.phase === 'place' && S.placed[p.id])) txt(ctx, '✔', x + 140, y + 23, 24, '#2fd36b');
  });
  const left = Math.max(0, G.deadline - now());
  if (S.phase !== 'score' && S.phase !== 'win') {
    const show = S.phase === 'run' ? (G.clock > 0 && left < 15) : true;
    if (show) txt(ctx, Math.ceil(left) + '', W - 50, 36, 34, left < 5 ? '#ff4b4b' : '#fff');
  }
  txt(ctx, 'Ronda ' + S.round + ' · Meta ' + TARGET_SCORE + ' pts', W - 100, H - 18, 15, '#fff', 'center', OUT, 3);
}
function drawPick() {
  const S = G.S;
  ctx.fillStyle = 'rgba(20,12,30,0.55)'; ctx.fillRect(0, 0, W, H);
  txt(ctx, '¡ELEGÍ UN ÍTEM!', W / 2, 150, 54, '#ffd23f');
  // caja
  ctx.lineWidth = 4; ctx.strokeStyle = OUT;
  ctx.fillStyle = '#b5713a'; rrect(ctx, W / 2 - 260, 430, 520, 150, 14); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#8c5427'; for (let i = 0; i < 3; i++) ctx.fillRect(W / 2 - 250, 460 + i * 40, 500, 8);
  ctx.save(); ctx.translate(W / 2 - 270, 430); ctx.rotate(-0.12); ctx.fillStyle = '#c98349'; rrect(ctx, 0, -40, 540, 40, 10); ctx.fill(); ctx.stroke(); ctx.restore();
  txt(ctx, 'CAJA CHOCHAN', W / 2, 520, 34, '#ffe9b8');
  cardRects(S).forEach((r, i) => {
    const c = S.cards[i], bob = Math.sin(G.t * 3 + i) * 4;
    if (c.by != null && S.phase === 'pick') {
      ctx.globalAlpha = 0.45;
    }
    ctx.fillStyle = '#fff4dc'; ctx.strokeStyle = c.by != null ? colorOf(c.by) : OUT; ctx.lineWidth = c.by != null ? 6 : 4;
    rrect(ctx, r.x, r.y + bob, r.w, r.h, 14); ctx.fill(); ctx.stroke();
    drawItemIcon(c.type, r.x + r.w / 2, r.y + 62 + bob, 96, 84);
    txt(ctx, ITEMS[c.type].name, r.x + r.w / 2, r.y + r.h - 20 + bob, ITEMS[c.type].name.length > 12 ? 13 : 17, OUT, 'center', null);
    ctx.globalAlpha = 1;
    if (c.by != null) { const p = playerById(c.by); if (p) drawChar(ctx, p.char, r.x + r.w - 14, r.y + 26 + bob, { scale: 0.6 }); }
  });
  drawCursors();
}
function drawCursorAt(x, y, col, label) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = col; ctx.strokeStyle = OUT; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 30); ctx.lineTo(17, 27); ctx.lineTo(12, 18); ctx.lineTo(21, 17); ctx.closePath(); ctx.fill(); ctx.stroke();
  txt(ctx, label, 14, 42, 14, col);
  ctx.restore();
}
function drawCursors() {
  const S = G.S;
  S.players.forEach((p, i) => {
    if (p.id === G.me) return;
    const c = G.rcur[p.id]; if (!c) return;
    if (S.phase === 'place' && S.hand[p.id] && !S.placed[p.id]) drawGhost(S.hand[p.id], c, false, 0.45);
    drawCursorAt(c.x, c.y, PCOL[i % 4], p.name);
  });
  const me = S.hand && S.hand[G.me];
  if (S.phase === 'place' && me && !S.placed[G.me]) drawGhost(me, G.cursor, true, 0.85);
  drawCursorAt(G.cursor.x, G.cursor.y, PCOL[G.myIdx % 4], 'VOS');
}
function drawGhost(type, cur, mine, alpha) {
  const gp = ghostPos(type, cur);
  const ok = canPlace(G.L, G.S.items, type, gp.gx, gp.gy, cur.rot);
  const it = { type, gx: gp.gx, gy: gp.gy, rot: cur.rot, st: {} };
  if (type === 'ventilador' || type === 'llamas') {
    it.st.reach = reach(it, type === 'ventilador' ? 6 : 3);
    if (it.st.reach > 0) { const r = beamRect(it, it.st.reach, type === 'llamas' ? 24 : T); ctx.fillStyle = type === 'llamas' ? 'rgba(255,122,47,0.35)' : 'rgba(255,255,255,0.3)'; ctx.fillRect(r.x, r.y, r.w, r.h); }
  }
  if (type === 'movil') {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 3;
    const x = gp.gx * T, y = gp.gy * T + 9;
    if (cur.rot % 2) ctx.strokeRect(x, y - 100, 80, 222); else ctx.strokeRect(x - 100, y, 280, 22);
    ctx.setLineDash([]);
  }
  if (type === 'bomba') { ctx.fillStyle = 'rgba(255,75,75,0.25)'; ctx.fillRect((gp.gx - 1) * T, (gp.gy - 1) * T, 3 * T, 3 * T); }
  if (type === 'canon') {
    const d = DIRS[cur.rot % 4]; ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.setLineDash([6, 8]); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(gp.gx * T + 20, gp.gy * T + 20); ctx.lineTo(gp.gx * T + 20 + d[0] * 400, gp.gy * T + 20 + d[1] * 400); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.globalAlpha = alpha; drawItem(ctx, it, G.t); ctx.globalAlpha = 1;
  if (!ok && mine) { ctx.fillStyle = 'rgba(255,40,40,0.35)'; for (const [x, y] of itemCells(it)) ctx.fillRect(x * T, y * T, T, T); }
}
function drawProtected() {
  const L = G.L; ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
  for (const p of [L.spawn, L.goal]) ctx.strokeRect((p.gx - 1) * T, (p.gy - 2) * T, 3 * T, 3 * T);
  ctx.setLineDash([]);
}
function drawScore() {
  const S = G.S;
  ctx.fillStyle = 'rgba(20,12,30,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff4dc'; ctx.strokeStyle = OUT; ctx.lineWidth = 5;
  rrect(ctx, 140, 110, 1000, 140 + S.players.length * 100, 24); ctx.fill(); ctx.stroke();
  txt(ctx, S.banner || 'PUNTAJE', W / 2, 160, 42, S.banner ? '#ff7a2f' : '#ffd23f');
  const bx = 330, bw = 720, k = bw / TARGET_SCORE;
  S.players.forEach((p, i) => {
    const y = 230 + i * 100;
    drawChar(ctx, p.char, 200, y + 30, { scale: 1.1 });
    txt(ctx, p.name, 240, y - 10, 18, OUT, 'left', null);
    ctx.fillStyle = '#e6d7b8'; rrect(ctx, bx, y, bw, 36, 8); ctx.fill();
    let x = bx;
    const prev = S.prev[p.id] || 0;
    ctx.fillStyle = PCOL[i % 4]; ctx.fillRect(x, y, Math.min(bw, prev * k), 36); x += prev * k;
    (S.awards[p.id] || []).forEach((a, j) => {
      const tt = clamp((G.phaseT - 0.8 - j * 0.4) / 0.35, 0, 1);
      if (tt <= 0) return;
      const w = Math.min(a[1] * k * tt, bx + bw - x);
      ctx.fillStyle = a[2]; ctx.fillRect(x, y, Math.max(0, w), 36);
      txt(ctx, a[0] + ' +' + a[1], x + a[1] * k / 2, y - 12, 13, a[2], 'center', OUT, 3);
      x += a[1] * k;
    });
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; rrect(ctx, bx, y, bw, 36, 8); ctx.stroke();
    txt(ctx, String(S.scores[p.id]), bx + bw + 40, y + 18, 26, '#fff');
  });
  ctx.fillStyle = '#ff4b4b'; ctx.fillRect(bx + bw - 3, 215, 6, S.players.length * 100);
  txt(ctx, 'META', bx + bw, 205, 16, '#ff4b4b');
}
function drawWin() {
  const S = G.S, p = playerById(S.winner);
  ctx.fillStyle = 'rgba(20,12,30,0.55)'; ctx.fillRect(0, 0, W, H);
  if (p) {
    const b = Math.abs(Math.sin(G.t * 4)) * 40;
    drawChar(ctx, p.char, W / 2, 470 - b, { scale: 4, sy: 1 + (b < 5 ? -0.1 : 0.05), blink: G.t % 2 < 0.1 });
    txt(ctx, '¡GANÓ ' + p.name.toUpperCase() + '!', W / 2, 160, 72, '#ffd23f');
  }
  txt(ctx, G.host ? 'Presioná SALTO para volver a la sala' : 'Esperando al anfitrión…', W / 2, 620, 26, '#fff');
}
function drawLobbyBg() {
  ensureCache();
  ctx.drawImage(G.cache, 0, 0, W, H);
  drawGoal(ctx, parseLevelCached(0), G.t);
  for (let i = 0; i < 4; i++) {
    const x = ((G.t * 120 + i * 330) % (W + 200)) - 100;
    const y = 520 - Math.abs(Math.sin(G.t * 5 + i)) * 30;
    drawChar(ctx, i, x, y, { moving: true, run: G.t * 15 + i, blink: (G.t + i) % 3 < 0.1 });
  }
}
function render() {
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const S = G.S;
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
  if (!S || S.phase === 'lobby') { drawLobbyBg(); FX.draw(ctx); return; }
  drawWorld();
  if (S.phase === 'place') drawProtected();
  if (S.phase === 'run' || S.phase === 'score') drawPlayers();
  FX.draw(ctx);
  if (G.L.waterY != null) {
    const wy = G.L.waterY;
    ctx.fillStyle = 'rgba(47,143,216,0.85)'; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, wy + 6 + Math.sin(x * 0.03 + G.t * 3) * 5);
    ctx.lineTo(W, H); ctx.fill();
    ctx.strokeStyle = '#d6f1ff'; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, wy + 6 + Math.sin(x * 0.03 + G.t * 3) * 5);
    ctx.stroke();
  }
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  if (S.phase === 'pick') drawPick();
  if (S.phase === 'place') {
    drawCursors();
    const mine = S.hand[G.me];
    txt(ctx, S.placed[G.me] ? 'Esperando a los demás…' : mine ? '¡A CONSTRUIR!' : 'Sin ítem esta ronda', W / 2, 92, 40, '#ffd23f');
    if (mine && !S.placed[G.me]) txt(ctx, 'SALTO: colocar' + (rotCount(mine) > 1 ? ' · ACCIÓN: rotar' : ''), W / 2, 130, 18, '#fff');
  }
  if (S.phase === 'run') {
    if (G.clock < 0) txt(ctx, String(Math.ceil(-G.clock)), W / 2, H / 2 - 40, 120, '#ffd23f');
    else if (G.clock < 0.7) txt(ctx, '¡YA!', W / 2, H / 2 - 40, 120 + G.clock * 60, '#2fd36b');
    const b = G.body;
    if (b && !b.alive) txt(ctx, '¡Uy! Esperá la próxima ronda', W / 2, 110, 28, '#fff');
    if (b && b.fin) txt(ctx, '¡LLEGASTE!', W / 2, 110, 40, '#2fd36b');
  }
  if (S.phase === 'score') drawScore();
  if (S.phase === 'win') { drawWin(); FX.draw(ctx); }
  drawHUD();
}

// ---------- Lobby (DOM) ----------
const $ = (id) => document.getElementById(id);
let myCharSel = 0;
function lobbyError(msg) { $('err').textContent = msg || ''; }
function hideLobby(h) { $('lobby').style.display = h ? 'none' : 'flex'; }
function resetToMenu() {
  G.code = null; G.S = null; G.host = false; G.items = []; G.prevApplied = null; G.L = null; G.cacheKey = '';
  $('step1').style.display = 'block'; $('step2').style.display = 'none'; hideLobby(false);
}
function showRoom() { $('step1').style.display = 'none'; $('step2').style.display = 'block'; lobbyError(''); renderRoom(); }
function renderRoom() {
  if (!G.code) return;
  $('roomCode').textContent = G.code;
  const list = $('players'); list.innerHTML = '';
  G.roster.forEach((p, i) => {
    const d = document.createElement('div'); d.className = 'pl';
    const cv = document.createElement('canvas'); cv.width = 80; cv.height = 80;
    const g = cv.getContext('2d'); drawChar(g, p.char, 40, 70, { scale: 1.5 });
    d.appendChild(cv);
    const s = document.createElement('span'); s.textContent = p.name + (p.id === G.hostId ? ' ★' : '') + (p.id === G.me ? ' (vos)' : '');
    s.style.color = PCOL[i % 4]; d.appendChild(s); list.appendChild(d);
  });
  $('hostBox').style.display = G.host ? 'block' : 'none';
  $('waitHost').style.display = G.host ? 'none' : 'block';
}
function buildCharPicker(el) {
  el.innerHTML = '';
  CHARS.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'ch' + (i === myCharSel ? ' sel' : ''); b.type = 'button';
    const cv = document.createElement('canvas'); cv.width = 70; cv.height = 70;
    drawChar(cv.getContext('2d'), i, 35, 62, { scale: 1.3 });
    b.appendChild(cv); const s = document.createElement('div'); s.textContent = c.name; b.appendChild(s);
    b.onclick = () => { myCharSel = i; localStorage.setItem('uc_char', i); buildCharPicker($('chars')); if (G.code) { Net.send({ t: 'char', char: i }); buildCharPicker($('chars2')); } };
    el.appendChild(b);
  });
}
function myName() { const n = $('name').value.trim() || 'Jugador'; localStorage.setItem('uc_name', n); return n; }
function setupLobby() {
  try { $('name').value = localStorage.getItem('uc_name') || ''; myCharSel = +(localStorage.getItem('uc_char') || 0) % 4; } catch (e) {}
  const q = new URLSearchParams(location.search).get('sala');
  if (q) $('code').value = q.toUpperCase();
  buildCharPicker($('chars'));
  $('create').onclick = () => { Sfx.init(); lobbyError('Conectando…'); Net.connect(() => Net.send({ t: 'create', name: myName(), char: myCharSel })); };
  $('join').onclick = () => {
    Sfx.init();
    const c = $('code').value.trim().toUpperCase();
    if (c.length !== 4) return lobbyError('El código tiene 4 letras');
    lobbyError('Conectando…'); Net.connect(() => Net.send({ t: 'join', code: c, name: myName(), char: myCharSel }));
  };
  $('leave').onclick = () => { Net.send({ t: 'leave' }); history.replaceState(null, '', location.pathname); resetToMenu(); };
  $('copy').onclick = () => { const url = location.origin + location.pathname + '?sala=' + G.code; navigator.clipboard && navigator.clipboard.writeText(url); $('copy').textContent = '¡Copiado!'; setTimeout(() => ($('copy').textContent = 'Copiar link'), 1500); };
  const lv = $('levels');
  LEVELS.forEach((l, i) => { const o = document.createElement('option'); o.value = i; o.textContent = l.name; lv.appendChild(o); });
  $('start').onclick = () => { if (G.host) hostStart(+lv.value); };
  const obs = new MutationObserver(() => { if ($('step2').style.display === 'block') buildCharPicker($('chars2')); });
  obs.observe($('step2'), { attributes: true });
}

// ---------- Arranque ----------
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const cw = Math.floor(W * s), ch = Math.floor(H * s);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  SCALE = (cw * dpr) / W;
  G.cacheKey = '';
}
let last = performance.now(), acc = 0;
function frame(t) {
  let dt = (t - last) / 1000; last = t;
  if (dt > 0.1) dt = 0.1;
  acc += dt;
  while (acc >= STEP) { update(STEP); acc -= STEP; }
  render();
  requestAnimationFrame(frame);
}
Input.init();
setupLobby();
addEventListener('resize', resize);
resize();
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { G.cacheKey = ''; buildCharPicker($('chars')); });
requestAnimationFrame(frame);
