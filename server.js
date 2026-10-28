'use strict';
// Servidor de Ultimate Chochan: sirve los archivos estáticos y hace de relay
// WebSocket entre los jugadores de cada sala. La lógica de la ronda la lleva
// el anfitrión (host) de la sala desde su navegador.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
const PUBLIC = new Set(['index.html', 'style.css']);

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const rel = path.normalize(p).replace(/^[/\\]+/, '');
  const ok = PUBLIC.has(rel) || /^js[/\\][\w-]+\.js$/.test(rel);
  if (!ok) { res.writeHead(404); return res.end('404'); }
  fs.readFile(path.join(ROOT, rel), (err, data) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });
const rooms = new Map(); // code -> { code, host, clients: Map(id -> ws), started }
let nextId = 1;

function code() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}
function send(ws, m) { if (ws.readyState === 1) ws.send(JSON.stringify(m)); }
function roster(room) {
  return [...room.clients.values()].map((w) => ({ id: w.id, name: w.name, char: w.char }));
}
function broadcastRoster(room) {
  const m = { t: 'roster', players: roster(room), host: room.host };
  for (const w of room.clients.values()) send(w, m);
}
function leave(ws) {
  const room = rooms.get(ws.room);
  if (!room) return;
  room.clients.delete(ws.id);
  ws.room = null;
  if (room.clients.size === 0) { rooms.delete(room.code); return; }
  if (room.host === ws.id) room.host = room.clients.keys().next().value;
  broadcastRoster(room);
}

wss.on('connection', (ws) => {
  ws.id = nextId++;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = rooms.get(ws.room);
    switch (m.t) {
      case 'create': {
        if (room) leave(ws);
        const r = { code: code(), host: ws.id, clients: new Map(), started: false };
        rooms.set(r.code, r);
        ws.room = r.code; ws.name = String(m.name || 'Jugador').slice(0, 14); ws.char = m.char | 0;
        r.clients.set(ws.id, ws);
        send(ws, { t: 'joined', code: r.code, id: ws.id });
        broadcastRoster(r);
        break;
      }
      case 'join': {
        const r = rooms.get(String(m.code || '').toUpperCase());
        if (!r) return send(ws, { t: 'error', msg: 'No existe esa sala' });
        if (r.clients.size >= 4) return send(ws, { t: 'error', msg: 'La sala está llena (máx. 4)' });
        if (r.started) return send(ws, { t: 'error', msg: 'La partida ya empezó' });
        if (room) leave(ws);
        ws.room = r.code; ws.name = String(m.name || 'Jugador').slice(0, 14); ws.char = m.char | 0;
        r.clients.set(ws.id, ws);
        send(ws, { t: 'joined', code: r.code, id: ws.id });
        broadcastRoster(r);
        break;
      }
      case 'char':
        if (!room) return;
        ws.char = m.char | 0;
        broadcastRoster(room);
        break;
      case 'started':
        if (room && room.host === ws.id) room.started = !!m.v;
        break;
      case 'leave':
        leave(ws);
        break;
      default: {
        // Relay: a todos los demás de la sala (o solo al host si m.toHost)
        if (!room) return;
        m.from = ws.id;
        const s = JSON.stringify(m);
        for (const w of room.clients.values()) {
          if (w === ws) continue;
          if (m.toHost && w.id !== room.host) continue;
          if (w.readyState === 1) w.send(s);
        }
      }
    }
  });
  ws.on('close', () => leave(ws));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 20000);

server.listen(PORT, () => console.log(`Ultimate Chochan en http://localhost:${PORT}`));
