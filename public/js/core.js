'use strict';
// ===== Constantes y utilidades =====
const W = 1280, H = 720, T = 40, COLS = 32, ROWS = 18;
const STEP = 1 / 60;
const TARGET_SCORE = 50;
const PCOL = ['#ff4b4b', '#3a8dff', '#ffc414', '#2fd36b'];
const OUT = '#2a1b12';
const FONT = '"Lilita One", "Arial Black", sans-serif';
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rand(a, b + 1));
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const ov = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function circleRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x, b.x + b.w), ny = clamp(cy, b.y, b.y + b.h);
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function txt(ctx, s, x, y, size, color = '#fff', align = 'center', stroke = OUT, lw) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (stroke) {
    ctx.lineWidth = lw || Math.max(3, size * 0.2);
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// ===== Input: teclado (2 jugadores) + joysticks =====
const Input = {
  keys: {}, cur: {}, prev: {},
  KB: {
    kb1: { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], jump: ['Space'], action: ['ShiftLeft', 'KeyQ'], start: ['Escape'] },
    kb2: { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'], jump: ['Enter', 'NumpadEnter', 'Numpad0'], action: ['ShiftRight', 'Numpad1', 'ControlRight'], start: ['Escape'] },
  },
  init() {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      this.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'Tab'].includes(e.code)) e.preventDefault();
      Sfx.init();
      if (e.code === 'KeyM' && !e.repeat) Sfx.muted = !Sfx.muted;
      if (e.code === 'KeyF' && !e.repeat) {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    addEventListener('pointerdown', () => Sfx.init());
  },
  poll() {
    this.prev = this.cur;
    const cur = {};
    for (const id in this.KB) {
      const m = this.KB[id], s = {};
      for (const b in m) s[b] = m[b].some((k) => this.keys[k]);
      s.ax = (s.right ? 1 : 0) - (s.left ? 1 : 0);
      s.ay = (s.down ? 1 : 0) - (s.up ? 1 : 0);
      s.kb = true;
      cur[id] = s;
    }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp) continue;
      const b = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (Math.abs(ax) < 0.25) ax = 0;
      if (Math.abs(ay) < 0.25) ay = 0;
      if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
      cur['gp' + gp.index] = {
        left: ax < -0.4, right: ax > 0.4, up: ay < -0.5, down: ay > 0.5,
        jump: b(0), action: b(2) || b(1) || b(4) || b(5), start: b(9), ax, ay, kb: false,
      };
    }
    this.cur = cur;
  },
  held(d, b) { const s = this.cur[d]; return !!(s && s[b]); },
  pressed(d, b) { const s = this.cur[d], p = this.prev[d]; return !!(s && s[b] && !(p && p[b])); },
  axis(d) { const s = this.cur[d]; return s ? [s.ax, s.ay] : [0, 0]; },
  isKB(d) { return d === 'kb1' || d === 'kb2'; },
  // Online: un solo jugador local, cualquier dispositivo lo controla
  h(b) { return this.devices().some((d) => this.held(d, b)); },
  p(b) { return this.devices().some((d) => this.pressed(d, b)); },
  ax() {
    let x = 0, y = 0;
    for (const d of this.devices()) {
      const s = this.cur[d];
      if (Math.abs(s.ax) > Math.abs(x)) x = s.ax;
      if (Math.abs(s.ay) > Math.abs(y)) y = s.ay;
    }
    return [x, y];
  },
  devices() { return Object.keys(this.cur); },
  anyPressed(b) { return this.devices().find((d) => this.pressed(d, b)); },
  label(d) {
    if (d === 'kb1') return 'Teclado WASD';
    if (d === 'kb2') return 'Teclado Flechas';
    return 'Joystick ' + (parseInt(d.slice(2)) + 1);
  },
};

// ===== Audio sintetizado (sin archivos) =====
const Sfx = {
  ctx: null, master: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
    } catch (e) { this.ctx = null; }
  },
  tone(freq, dur, type = 'square', vol = 0.3, slide = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.3, freq = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },
  play(n) {
    switch (n) {
      case 'jump': this.tone(330, 0.14, 'square', 0.12, 330); break;
      case 'land': this.noise(0.06, 0.12, 600); break;
      case 'die': this.tone(500, 0.35, 'sawtooth', 0.18, -420); this.noise(0.25, 0.2, 900); break;
      case 'pick': this.tone(660, 0.08, 'triangle', 0.25); this.tone(990, 0.12, 'triangle', 0.25, 0, 0.07); break;
      case 'place': this.tone(220, 0.08, 'square', 0.18, -60); this.noise(0.08, 0.2, 1500); break;
      case 'rotate': this.tone(520, 0.05, 'triangle', 0.15); break;
      case 'bad': this.tone(140, 0.15, 'square', 0.15); break;
      case 'beep': this.tone(440, 0.15, 'square', 0.18); break;
      case 'go': this.tone(880, 0.3, 'square', 0.2); break;
      case 'finish': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.25, 0, i * 0.08)); break;
      case 'bomb': this.noise(0.6, 0.5, 500); this.tone(90, 0.5, 'sine', 0.4, -50); break;
      case 'cannon': this.noise(0.12, 0.25, 800); this.tone(120, 0.1, 'square', 0.12, -40); break;
      case 'spring': this.tone(200, 0.25, 'sine', 0.3, 600); break;
      case 'crumble': this.noise(0.2, 0.2, 700); break;
      case 'select': this.tone(600, 0.06, 'square', 0.12); break;
      case 'coin': this.tone(988, 0.08, 'square', 0.15); this.tone(1318, 0.2, 'square', 0.15, 0, 0.08); break;
      case 'score': this.tone(700, 0.08, 'triangle', 0.2, 200); break;
      case 'win': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.15, 0, i * 0.12)); break;
    }
  },
};

// ===== Partículas =====
const FX = {
  list: [],
  add(o) {
    this.list.push(Object.assign({ vx: 0, vy: 0, g: 0, life: 0.6, t: 0, size: 6, color: '#fff', shape: 'c', drag: 0, rot: 0, vr: 0 }, o));
  },
  burst(x, y, n, color, spd = 250, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(spd * 0.3, spd);
      this.add(Object.assign({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, size: rand(3, 8),
        color: Array.isArray(color) ? choice(color) : color, life: rand(0.4, 0.9),
      }, o));
    }
  },
  confetti(x, y, n = 40) {
    this.burst(x, y, n, ['#ff4b4b', '#3a8dff', '#ffc414', '#2fd36b', '#ff7be5', '#fff'], 520,
      { g: 700, drag: 1.5, shape: 'r', vr: 10, life: 1.6, size: 10 });
  },
  update(dt) {
    for (const p of this.list) {
      p.t += dt; p.vy += p.g * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    this.list = this.list.filter((p) => p.t < p.life);
  },
  draw(ctx) {
    for (const p of this.list) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, k * 1.5);
      ctx.fillStyle = p.color;
      if (p.shape === 'c') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, 7); ctx.fill();
      } else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  },
};
