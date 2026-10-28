'use strict';
// ===== Personajes (originales, dibujados por código) =====
const CHARS = [
  { id: 'rana', name: 'Rana', body: '#63c94f', belly: '#c8ef8a', feet: '#3f9a34' },
  { id: 'gato', name: 'Gato', body: '#ff9b3d', belly: '#ffe0b8', feet: '#d9701c' },
  { id: 'pingu', name: 'Pingüino', body: '#34466e', belly: '#f4f6ff', feet: '#ff9d2e' },
  { id: 'carpi', name: 'Carpincho', body: '#b07a4b', belly: '#d9a877', feet: '#82552f' },
];

function eye(ctx, x, y, r, blink) {
  if (blink) { ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke(); return; }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(x + r * 0.35, y, r * 0.5, 0, 7); ctx.fill();
}
function ell(ctx, x, y, rx, ry, fill, stroke = true) {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); if (stroke) ctx.stroke();
}

// x = centro, y = pies
function drawChar(ctx, ci, x, y, o = {}) {
  const c = CHARS[ci] || CHARS[0];
  const f = o.facing || 1, sx = o.sx || 1, sy = o.sy || 1, sc = o.scale || 1;
  ctx.save();
  ctx.translate(x, y); ctx.scale(f * sx * sc, sy * sc);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const fa = o.moving ? Math.sin(o.run || 0) * 5 : 0;
  const blink = o.blink;
  ell(ctx, -8 + fa, -3, 7, 4, c.feet); ell(ctx, 8 - fa, -3, 7, 4, c.feet);
  switch (c.id) {
    case 'rana':
      ell(ctx, 0, -17, 19, 15, c.body);
      ell(ctx, 3, -12, 11, 7, c.belly, false);
      ell(ctx, -6, -30, 8, 8, c.body); ell(ctx, 9, -30, 8, 8, c.body);
      eye(ctx, -6, -31, 5, blink); eye(ctx, 9, -31, 5, blink);
      ctx.beginPath(); ctx.arc(8, -20, 7, 0.2, Math.PI - 0.6); ctx.stroke();
      ctx.fillStyle = '#ff8fa3'; ctx.beginPath(); ctx.arc(15, -18, 3, 0, 7); ctx.fill();
      break;
    case 'gato':
      ctx.save(); ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-14, -10); ctx.quadraticCurveTo(-30, -14, -24, -32); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = c.body; ctx.stroke(); ctx.restore();
      ctx.fillStyle = c.body;
      ctx.beginPath(); ctx.moveTo(-13, -33); ctx.lineTo(-11, -47); ctx.lineTo(-2, -36); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, -36); ctx.lineTo(13, -47); ctx.lineTo(16, -32); ctx.closePath(); ctx.fill(); ctx.stroke();
      rrect(ctx, -17, -38, 34, 36, 14); ctx.fillStyle = c.body; ctx.fill(); ctx.stroke();
      ell(ctx, 3, -12, 11, 8, c.belly, false);
      ctx.strokeStyle = '#c45f12'; ctx.beginPath(); ctx.moveTo(-6, -37); ctx.lineTo(-6, -31); ctx.moveTo(0, -38); ctx.lineTo(0, -32); ctx.stroke(); ctx.strokeStyle = OUT;
      eye(ctx, -1, -24, 5, blink); eye(ctx, 10, -24, 5, blink);
      ctx.fillStyle = '#ff7b9c'; ctx.beginPath(); ctx.moveTo(13, -18); ctx.lineTo(18, -18); ctx.lineTo(15.5, -15); ctx.fill();
      ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(18, -16); ctx.lineTo(26, -18); ctx.moveTo(18, -14); ctx.lineTo(26, -13); ctx.stroke();
      break;
    case 'pingu':
      ctx.save(); ctx.translate(-15, -16); ctx.rotate(0.4); ell(ctx, 0, 0, 5, 10, c.body); ctx.restore();
      ell(ctx, 0, -19, 17, 19, c.body);
      ell(ctx, 4, -15, 11, 14, c.belly, false);
      eye(ctx, 2, -28, 4.5, blink); eye(ctx, 11, -28, 4.5, blink);
      ctx.fillStyle = '#ff9d2e'; ctx.beginPath(); ctx.moveTo(12, -23); ctx.lineTo(23, -20); ctx.lineTo(12, -17); ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    case 'carpi':
      ell(ctx, -8, -33, 4, 4, c.feet); ell(ctx, 1, -35, 4, 4, c.feet);
      rrect(ctx, -19, -34, 36, 32, 13); ctx.fillStyle = c.body; ctx.fill(); ctx.stroke();
      rrect(ctx, 4, -31, 19, 19, 9); ctx.fillStyle = c.belly; ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(18, -24, 1.8, 0, 7); ctx.fill();
      if (blink) { ctx.beginPath(); ctx.moveTo(-3, -25); ctx.lineTo(3, -25); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(0, -25, 3, 0, 7); ctx.fill(); ctx.beginPath(); ctx.moveTo(-4, -28); ctx.lineTo(4, -28); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(10, -16); ctx.quadraticCurveTo(14, -13, 19, -16); ctx.stroke();
      break;
  }
  ctx.restore();
}

// ===== Temas de nivel =====
const THEMES = {
  terraza: {
    fill: '#c0583f', line: '#93402c', cap: '#ead6b6',
    bg(g) {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ff8a65'); gr.addColorStop(0.6, '#ffc58a'); gr.addColorStop(1, '#ffe0a8');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff1b8'; g.beginPath(); g.arc(940, 250, 90, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [x, y, s] of [[180, 120, 1], [520, 80, 0.8], [1100, 140, 1.2]]) { for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + i * 30 * s, y + (i % 2) * 8, 28 * s, 0, 7); g.fill(); } }
      const city = (col, base, hmin, hmax, wmin, seed, win) => {
        let x = -20, k = seed;
        while (x < W) { const w = wmin + hash(k, 1) * 60, h = hmin + hash(k, 2) * (hmax - hmin);
          g.fillStyle = col; g.fillRect(x, base - h, w, h + 400);
          if (win) { g.fillStyle = 'rgba(255,230,140,0.7)'; for (let wy = base - h + 14; wy < base - 10; wy += 26) for (let wx = x + 8; wx < x + w - 12; wx += 18) if (hash(wx, wy) > 0.55) g.fillRect(wx, wy, 8, 12); }
          x += w + 4; k++; }
      };
      city('#b07aa8', 470, 120, 260, 50, 3, false);
      city('#7b5aa6', 560, 80, 220, 60, 9, true);
    },
  },
  cantera: {
    fill: '#86705e', line: '#5e4c3e', cap: '#74c24e',
    bg(g) {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a1f3d'); gr.addColorStop(1, '#4a3550');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#3a2c4a';
      g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 40) g.lineTo(x, 380 + Math.sin(x * 0.013) * 60 + hash(x, 5) * 40); g.lineTo(W, H); g.fill();
      for (let i = 0; i < 18; i++) { const x = hash(i, 7) * W, y = 300 + hash(i, 8) * 300, s = 8 + hash(i, 9) * 14;
        g.fillStyle = choice(['#6be6ff', '#c58bff', '#ff8bd8']); g.globalAlpha = 0.8;
        g.beginPath(); g.moveTo(x, y - s * 2); g.lineTo(x + s, y); g.lineTo(x, y + s * 0.6); g.lineTo(x - s, y); g.closePath(); g.fill(); g.globalAlpha = 1; }
      g.fillStyle = '#1b1428';
      for (let x = 40; x < W; x += 70) { const h = 20 + hash(x, 3) * 50; g.beginPath(); g.moveTo(x - 18, 40); g.lineTo(x, 40 + h); g.lineTo(x + 18, 40); g.fill(); }
    },
  },
  muelle: {
    fill: '#b8834f', line: '#8a5c33', cap: '#d9a76a',
    bg(g) {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#5cc4ff'); gr.addColorStop(0.75, '#cdefff');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff8c4'; g.beginPath(); g.arc(200, 140, 60, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (const [x, y, s] of [[420, 110, 1], [800, 70, 1.3], [1120, 160, 0.9]]) { for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + i * 30 * s, y + (i % 2) * 8, 26 * s, 0, 7); g.fill(); } }
      g.fillStyle = '#5fae6b'; g.beginPath(); g.ellipse(1000, 560, 220, 60, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#2f8fd8'; g.fillRect(0, 555, W, H);
      g.strokeStyle = OUT; g.lineWidth = 3;
      for (let i = 0; i < 4; i++) { const x = 300 + i * 160, y = 200 + (i % 2) * 40; g.beginPath(); g.moveTo(x - 10, y); g.quadraticCurveTo(x - 5, y - 6, x, y); g.quadraticCurveTo(x + 5, y - 6, x + 10, y); g.stroke(); }
    },
  },
};

// ===== Niveles (32x18) =====
// # sólido  - plataforma de un sentido  S salida  G meta  ~ agua
const LEVELS = [
  { name: 'La Terraza', theme: 'terraza', map: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '..............----..............',
    '................................',
    '..........#####.............G...',
    '..S.......#####...........#####.',
    '#######...#####....###....#####.',
    '#######...#####....###....#####.',
    '#######...#####....###....#####.',
    '#######...#####....###....#####.',
    '#######...#####....###....#####.',
  ] },
  { name: 'La Cantera', theme: 'cantera', map: [
    '################################',
    '#...............................',
    '#...............................',
    '#............................G..',
    '#..........................#####',
    '#......................###.#####',
    '#......................###......',
    '#................----...........',
    '#...............................',
    '#...........###.................',
    '#...........###.................',
    '#......###......................',
    '#..S...###......................',
    '############........############',
    '############........############',
    '############........############',
    '############........############',
    '############........############',
  ] },
  { name: 'El Muelle', theme: 'muelle', map: [
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '................................',
    '............--------............',
    '................................',
    '................................',
    '.S..........................G...',
    '#####....---....##....---..#####',
    '#####...........##.........#####',
    '#####...........##.........#####',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ] },
];

function parseLevel(i) {
  const d = LEVELS[i];
  const L = { idx: i, name: d.name, theme: THEMES[d.theme], solid: [], oneway: [], waterY: null, spawn: null, goal: null };
  for (let y = 0; y < ROWS; y++) {
    L.solid.push([]); L.oneway.push([]);
    for (let x = 0; x < COLS; x++) {
      const ch = d.map[y][x];
      L.solid[y].push(ch === '#'); L.oneway[y].push(ch === '-');
      if (ch === 'S') L.spawn = { gx: x, gy: y };
      if (ch === 'G') L.goal = { gx: x, gy: y };
      if (ch === '~' && L.waterY === null) L.waterY = y * T;
    }
  }
  L.goalRect = { x: L.goal.gx * T - 6, y: L.goal.gy * T - 30, w: T + 12, h: 70 };
  L.isProtected = (gx, gy) =>
    (Math.abs(gx - L.spawn.gx) <= 1 && gy >= L.spawn.gy - 2 && gy <= L.spawn.gy) ||
    (Math.abs(gx - L.goal.gx) <= 1 && gy >= L.goal.gy - 2 && gy <= L.goal.gy);
  return L;
}

function drawTerrain(g, L) {
  const th = L.theme;
  const S = (x, y) => x >= 0 && x < COLS && y >= 0 && y < ROWS ? L.solid[y][x] : (y >= ROWS);
  for (let gy = 0; gy < ROWS; gy++) for (let gx = 0; gx < COLS; gx++) {
    const x = gx * T, y = gy * T;
    if (L.solid[gy][gx]) {
      g.fillStyle = th.fill; g.fillRect(x, y, T, T);
      g.strokeStyle = th.line; g.lineWidth = 2;
      if (th === THEMES.terraza) { g.beginPath(); g.moveTo(x, y + 20); g.lineTo(x + T, y + 20); const o = gy % 2 ? 0 : 20; g.moveTo(x + o + 10, y); g.lineTo(x + o + 10, y + 20); g.moveTo(x + (o ? 10 : 30), y + 20); g.lineTo(x + (o ? 10 : 30), y + 40); g.stroke(); }
      else if (th === THEMES.cantera) { g.fillStyle = th.line; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 6 + hash(gx, gy * 3 + k) * 28, y + 6 + hash(gx * 7 + k, gy) * 28, 2 + hash(k, gx + gy) * 3, 0, 7); g.fill(); } }
      else { g.beginPath(); g.moveTo(x, y + 13); g.lineTo(x + T, y + 13); g.moveTo(x, y + 27); g.lineTo(x + T, y + 27); g.stroke(); g.fillStyle = th.line; g.fillRect(x + 4 + (gy % 2) * 26, y + 4, 3, 3); }
      if (!S(gx, gy - 1)) { g.fillStyle = th.cap; g.fillRect(x - 1, y, T + 2, 9); g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 9); g.lineTo(x + T, y + 9); g.stroke();
        if (th === THEMES.cantera) { g.fillStyle = th.cap; for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(x + 7 + k * 13, y + 9, 4, 0, Math.PI); g.fill(); } } }
      g.strokeStyle = OUT; g.lineWidth = 4; g.beginPath();
      if (!S(gx, gy - 1)) { g.moveTo(x, y); g.lineTo(x + T, y); }
      if (!S(gx, gy + 1)) { g.moveTo(x, y + T); g.lineTo(x + T, y + T); }
      if (!S(gx - 1, gy)) { g.moveTo(x, y); g.lineTo(x, y + T); }
      if (!S(gx + 1, gy)) { g.moveTo(x + T, y); g.lineTo(x + T, y + T); }
      g.stroke();
    } else if (L.oneway[gy][gx]) {
      g.strokeStyle = OUT; g.lineWidth = 3;
      g.fillStyle = '#8a5c33'; g.fillRect(x + 6, y + 12, 5, 16); g.fillRect(x + T - 11, y + 12, 5, 16);
      g.strokeRect(x + 6, y + 12, 5, 16); g.strokeRect(x + T - 11, y + 12, 5, 16);
      g.fillStyle = '#e0a95e'; g.fillRect(x, y, T, 12); g.beginPath(); g.moveTo(x, y); g.lineTo(x + T, y); g.moveTo(x, y + 12); g.lineTo(x + T, y + 12); g.stroke();
      g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + T - 1, y + 2); g.lineTo(x + T - 1, y + 10); g.stroke();
    }
  }
}

// ===== Ítems =====
// rm (modo de rotación): none | shape | dir | axis | flip
const ITEMS = {
  caja: { name: 'Caja', cells: [[0, 0]], rm: 'none', w: 3 },
  tablon: { name: 'Tablón', cells: [[0, 0], [1, 0]], rm: 'shape', w: 3 },
  viga: { name: 'Viga', cells: [[0, 0], [1, 0], [2, 0]], rm: 'shape', w: 3 },
  ele: { name: 'Bloque L', cells: [[0, 0], [0, 1], [1, 1]], rm: 'shape', w: 2 },
  hielo: { name: 'Hielo', cells: [[0, 0], [1, 0]], rm: 'shape', w: 2 },
  miel: { name: 'Miel', cells: [[0, 0], [1, 0]], rm: 'shape', w: 1.5 },
  pinchos: { name: 'Pinchos', cells: [[0, 0]], rm: 'dir', w: 3 },
  sierra: { name: 'Sierra', cells: [[0, 0], [1, 0], [0, 1], [1, 1]], rm: 'none', w: 2 },
  canon: { name: 'Cañón', cells: [[0, 0]], rm: 'dir', def: 1, w: 2.5 },
  resorte: { name: 'Resorte', cells: [[0, 0]], rm: 'none', w: 2 },
  movil: { name: 'Plataforma móvil', cells: [[0, 0], [1, 0]], rm: 'axis', w: 2 },
  cinta: { name: 'Cinta', cells: [[0, 0], [1, 0], [2, 0]], rm: 'flip', w: 1.5 },
  fragil: { name: 'Tablas flojas', cells: [[0, 0], [1, 0]], rm: 'shape', w: 2 },
  ventilador: { name: 'Ventilador', cells: [[0, 0]], rm: 'dir', w: 1.5 },
  llamas: { name: 'Lanzallamas', cells: [[0, 0]], rm: 'dir', def: 1, w: 2 },
  bomba: { name: 'Bomba', cells: [[0, 0]], rm: 'none', w: 1.2 },
  alfajor: { name: 'Alfajor', cells: [[0, 0]], rm: 'none', w: 0.8 },
};
const ITEM_KEYS = Object.keys(ITEMS);

function itemCellsRel(type, rot) {
  const d = ITEMS[type];
  let cs = d.cells;
  if (d.rm === 'shape') {
    for (let k = 0; k < (rot % 4); k++) cs = cs.map(([x, y]) => [-y, x]);
    const mx = Math.min(...cs.map((c) => c[0])), my = Math.min(...cs.map((c) => c[1]));
    cs = cs.map(([x, y]) => [x - mx, y - my]);
  }
  return cs;
}
function itemCells(it) { return itemCellsRel(it.type, it.rot).map(([x, y]) => [it.gx + x, it.gy + y]); }
function rotCount(type) { const rm = ITEMS[type].rm; return rm === 'dir' || rm === 'shape' ? 4 : rm === 'axis' || rm === 'flip' ? 2 : 1; }

function blockCells(ctx, cells, fill, deco) {
  const set = new Set(cells.map((c) => c[0] + ',' + c[1]));
  for (const [gx, gy] of cells) { const x = gx * T, y = gy * T; ctx.fillStyle = fill; ctx.fillRect(x, y, T, T); if (deco) deco(ctx, x, y, gx, gy, !set.has(gx + ',' + (gy - 1))); }
  ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath();
  for (const [gx, gy] of cells) {
    const x = gx * T, y = gy * T;
    if (!set.has(gx + ',' + (gy - 1))) { ctx.moveTo(x, y); ctx.lineTo(x + T, y); }
    if (!set.has(gx + ',' + (gy + 1))) { ctx.moveTo(x, y + T); ctx.lineTo(x + T, y + T); }
    if (!set.has((gx - 1) + ',' + gy)) { ctx.moveTo(x, y); ctx.lineTo(x, y + T); }
    if (!set.has((gx + 1) + ',' + gy)) { ctx.moveTo(x + T, y); ctx.lineTo(x + T, y + T); }
  }
  ctx.stroke();
}

// Dibuja un ítem. it: {type,gx,gy,rot,st}. t = tiempo
function drawItem(ctx, it, t) {
  const st = it.st || {};
  const x = it.gx * T, y = it.gy * T, cx = x + T / 2, cy = y + T / 2;
  const dir = it.rot % 4;
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (it.type) {
    case 'caja':
      blockCells(ctx, itemCells(it), '#d99a4e', (c, x, y) => { c.strokeStyle = '#a8692c'; c.lineWidth = 3; c.strokeRect(x + 6, y + 6, 28, 28); c.beginPath(); c.moveTo(x + 7, y + 7); c.lineTo(x + 33, y + 33); c.stroke(); });
      break;
    case 'tablon':
      blockCells(ctx, itemCells(it), '#c98a4a', (c, x, y) => { c.strokeStyle = '#9a6330'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 14); c.lineTo(x + T, y + 14); c.moveTo(x, y + 27); c.lineTo(x + T, y + 27); c.stroke(); c.fillStyle = OUT; c.fillRect(x + 6, y + 6, 3, 3); c.fillRect(x + 31, y + 31, 3, 3); });
      break;
    case 'viga':
      blockCells(ctx, itemCells(it), '#8fa3b8', (c, x, y) => { c.fillStyle = '#6f8399'; c.fillRect(x, y + 30, T, 10); c.fillStyle = '#c8d4e0'; c.fillRect(x, y + 3, T, 5); c.fillStyle = OUT; c.beginPath(); c.arc(x + 8, y + 20, 2.5, 0, 7); c.arc(x + 32, y + 20, 2.5, 0, 7); c.fill(); });
      break;
    case 'ele':
      blockCells(ctx, itemCells(it), '#5fb3e8', (c, x, y) => { c.fillStyle = '#8fd0f7'; c.fillRect(x + 4, y + 4, 32, 6); c.fillStyle = '#3d8fc4'; c.fillRect(x + 4, y + 30, 32, 6); });
      break;
    case 'hielo':
      blockCells(ctx, itemCells(it), '#bfeeff', (c, x, y) => { c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 8, y + 30); c.lineTo(x + 20, y + 10); c.moveTo(x + 22, y + 32); c.lineTo(x + 30, y + 18); c.stroke(); });
      break;
    case 'miel':
      blockCells(ctx, itemCells(it), '#c98a4a', (c, x, y, gx, gy, top) => { if (top) { c.fillStyle = '#ffb21e'; c.fillRect(x, y, T, 12); c.beginPath(); c.arc(x + 12, y + 12, 5, 0, Math.PI); c.arc(x + 30, y + 13, 4, 0, Math.PI); c.fill(); } });
      break;
    case 'pinchos': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir * Math.PI / 2);
      ctx.fillStyle = '#7d8590'; rrect(ctx, -19, 10, 38, 10, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e8edf2';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-18 + i * 12.6, 10); ctx.lineTo(-11.7 + i * 12.6, -18); ctx.lineTo(-5.4 + i * 12.6, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.restore(); break;
    }
    case 'sierra': {
      const sx = x + T, sy = y + T, a = t * 9;
      ctx.fillStyle = '#5a5f66'; ctx.fillRect(sx - 4, sy, 8, T - 4); ctx.strokeRect(sx - 4, sy, 8, T - 4);
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(a);
      ctx.fillStyle = '#d6dde4'; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const r = i % 2 ? 30 : 38, an = i / 24 * Math.PI * 2; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9aa4ae'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e04a3a'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
      ctx.restore(); break;
    }
    case 'canon': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((dir - 1) * Math.PI / 2);
      const k = st.recoil || 0;
      ctx.fillStyle = '#3b3b48'; rrect(ctx, 2 - k * 6, -9, 20, 18, 4); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#5a5a6e'; rrect(ctx, x + 3, y + 3, 34, 34, 8); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill(); ctx.stroke();
      break;
    }
    case 'resorte': {
      const k = st.squash || 0;
      ctx.fillStyle = '#5a5f66'; ctx.fillRect(x + 4, y + 32, 32, 8); ctx.strokeRect(x + 4, y + 32, 32, 8);
      const top = y + 14 + k * 10;
      ctx.strokeStyle = '#9aa4ae'; ctx.lineWidth = 4; ctx.beginPath();
      for (let i = 0; i <= 4; i++) { const yy = lerp(y + 32, top + 6, i / 4); ctx.lineTo(i % 2 ? x + 28 : x + 12, yy); }
      ctx.stroke(); ctx.strokeStyle = OUT; ctx.lineWidth = 3;
      ctx.fillStyle = '#ff4b4b'; rrect(ctx, x + 2, top, 36, 9, 4); ctx.fill(); ctx.stroke();
      break;
    }
    case 'movil': {
      const px = st.x != null ? st.x : x, py = st.y != null ? st.y : y;
      ctx.fillStyle = '#e85d75'; rrect(ctx, px, py, 80, 22, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) ctx.fillRect(px + 8 + i * 18, py + 6, 9, 10);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px + 40, py + 11, 4, 0, 7); ctx.fill();
      break;
    }
    case 'cinta': {
      const d = it.rot % 2 ? -1 : 1;
      ctx.fillStyle = '#44464f'; rrect(ctx, x, y + 4, 120, 32, 14); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#9aa4ae';
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 20 + i * 40, y + 20, 8, 0, 7); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#ffd23f';
      const off = ((t * 60 * d) % 30 + 30) % 30;
      ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y + 4, 108, 8); ctx.clip();
      for (let i = -1; i < 5; i++) { const ax = x + 4 + i * 30 + off; ctx.beginPath(); ctx.moveTo(ax, y + 5); ctx.lineTo(ax + 8 * d, y + 8); ctx.lineTo(ax, y + 11); ctx.fill(); }
      ctx.restore(); break;
    }
    case 'fragil': {
      if (st.gone) { ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(42,27,18,0.4)'; ctx.strokeRect(x + 2, y + 2, 76, 36); ctx.setLineDash([]); break; }
      const sh = st.trig > 0 ? rand(-2, 2) : 0;
      ctx.save(); ctx.translate(sh, 0);
      blockCells(ctx, itemCells(it), '#e2c08a', (c, x, y) => { c.strokeStyle = '#a07a45'; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 6, y + 8); c.lineTo(x + 16, y + 20); c.lineTo(x + 10, y + 32); c.moveTo(x + 28, y + 6); c.lineTo(x + 24, y + 18); c.lineTo(x + 34, y + 26); c.stroke(); });
      ctx.restore(); break;
    }
    case 'ventilador': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir * Math.PI / 2);
      ctx.fillStyle = '#4aa3df'; rrect(ctx, -19, -6, 38, 25, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#dfe6ec'; const s = Math.abs(Math.sin(t * 30));
      ctx.beginPath(); ctx.ellipse(-8, -10, 8 * s + 2, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(8, -10, 8 * (1 - s) + 2, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(0, -10, 3, 0, 7); ctx.fill();
      ctx.restore(); break;
    }
    case 'llamas': {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((dir - 1) * Math.PI / 2);
      ctx.fillStyle = '#c0392b'; rrect(ctx, -18, -16, 30, 32, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7d8590'; rrect(ctx, 10, -8, 10, 16, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = st.warn ? '#ffd23f' : '#ffe9a8'; ctx.beginPath(); ctx.arc(-3, 0, 6, 0, 7); ctx.fill(); ctx.stroke();
      ctx.restore(); break;
    }
    case 'bomba':
      ctx.fillStyle = '#2e2e38'; ctx.beginPath(); ctx.arc(cx, cy + 3, 15, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7d8590'; ctx.fillRect(cx - 5, cy - 16, 10, 7); ctx.strokeRect(cx - 5, cy - 16, 10, 7);
      ctx.beginPath(); ctx.moveTo(cx, cy - 16); ctx.quadraticCurveTo(cx + 6, cy - 24, cx + 12, cy - 20); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(cx + 13, cy - 20, 3 + Math.sin(t * 20) * 1.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 6, cy - 3, 3, 0, 7); ctx.fill();
      break;
    case 'alfajor': {
      if (st.taken) break;
      const b = Math.sin(t * 4) * 3;
      ctx.fillStyle = '#6b3d1f'; rrect(ctx, cx - 14, cy - 4 + b, 28, 12, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff4dc'; ctx.fillRect(cx - 13, cy - 6 + b, 26, 4);
      ctx.fillStyle = '#6b3d1f'; rrect(ctx, cx - 14, cy - 14 + b, 28, 10, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(cx - 8, cy - 12 + b, 6, 2);
      break;
    }
  }
}

function drawGoal(ctx, L, t) {
  const x = L.goal.gx * T + T / 2, y = (L.goal.gy + 1) * T;
  ctx.lineWidth = 3; ctx.strokeStyle = OUT;
  ctx.fillStyle = '#7b4a2a'; rrect(ctx, x - 16, y - 12, 32, 12, 3); ctx.fill(); ctx.stroke();
  const b = Math.sin(t * 3) * 2;
  ctx.fillStyle = '#ffcf33';
  ctx.beginPath(); ctx.moveTo(x - 6, y - 12); ctx.lineTo(x - 4, y - 24 + b); ctx.lineTo(x + 4, y - 24 + b); ctx.lineTo(x + 6, y - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 16, y - 50 + b); ctx.quadraticCurveTo(x - 14, y - 24 + b, x, y - 24 + b); ctx.quadraticCurveTo(x + 14, y - 24 + b, x + 16, y - 50 + b); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - 17, y - 42 + b, 6, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 17, y - 42 + b, 6, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
  ctx.fillStyle = '#fff8c4'; ctx.fillRect(x - 10, y - 46 + b, 4, 12);
  const s = (Math.sin(t * 5) + 1) / 2;
  ctx.fillStyle = `rgba(255,255,255,${s})`; ctx.beginPath(); ctx.arc(x + 12, y - 54 + b, 3, 0, 7); ctx.fill();
}
