// Renderização 2D: mapa pré-renderizado por sala, personagens vetoriais, iluminação, partículas.
import { RECTS, CORRIDORS, STATIONS, VENTS, SPECIAL, WORLD, CAMS, ROOM_BY_ID } from '/shared/map.js';
import { COLORS } from '/shared/cosmetics.js';
import { hatX, outfitX, accX, mascotX, skinFill, skinOver } from './cosdraw.js';

export const Q = { level: 1 };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function mix(hex, a) { const n = parseInt(hex.slice(1), 16), t = a < 0 ? 0 : 255, k = Math.abs(a); const f = v => Math.round(v + (t - v) * k); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };

// ---------- personagem: pequeno astronauta de cabeça redonda e rosto expressivo ----------
function bodyPath(c, ghost) {
  c.beginPath();
  if (ghost) { c.roundRect(-12, -28, 24, 22, [8, 8, 3, 3]); for (const x of [-8, 0, 8]) { c.moveTo(x + 5, -6); c.arc(x, -6, 5, 0, TAU); } }
  else c.roundRect(-11, -27, 22, 21, 8);
  c.moveTo(15, -32); c.arc(0, -32, 15, 0, TAU);
}
export function drawCrew(c, look, x, y, o = {}) {
  const { t = 0, moving = false, face = 1, s = 1, alpha = 1, ghost = false, dead = false, act = 0 } = o;
  const col = COLORS[look.c] || COLORS[0], dk = mix(col, -0.4);
  c.save(); c.translate(x, y); c.scale(face * s, s); c.globalAlpha = alpha;
  const bob = ghost ? Math.sin(t * 3) * 3 - 4 : moving ? Math.abs(Math.sin(t * 12)) * 2.5 : Math.sin(t * 2.2) * 0.8;
  if (!ghost) { c.fillStyle = 'rgba(0,0,0,.3)'; c.ellipse && (c.beginPath(), c.ellipse(0, 2, 15, 5, 0, 0, TAU), c.fill()); }
  if (!ghost && !dead) { const sw = moving ? Math.sin(t * 12) * 6 : 0; c.fillStyle = dk; rr(c, -9 + sw * 0.5, -9, 7, 10, 3); c.fill(); rr(c, 2 - sw * 0.5, -9, 7, 10, 3); c.fill(); }
  c.translate(0, -bob);
  // braços
  const sw2 = moving ? Math.sin(t * 12) * 0.7 : Math.sin(t * 2) * 0.08;
  for (const d of [-1, 1]) { c.save(); c.translate(d * 12, -21); c.rotate(d * 0.3 + (d > 0 ? sw2 : -sw2) - (act > 0 && d > 0 ? 1.9 : 0)); c.fillStyle = dk; c.beginPath(); c.ellipse(0, 5, 3.6, 7, 0, 0, TAU); c.fill(); c.restore(); }
  if (look.a !== 3) for (const d of [-1, 1]) { c.fillStyle = dk; c.beginPath(); c.arc(d * 15.5, -32, 4.5, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(d * 15.5 - 1, -33.5, 1.6, 0, TAU); c.fill(); }
  c.save(); bodyPath(c, ghost); c.clip();
  const g = c.createLinearGradient(-15, -47, 15, -6);
  if (look.s === 3) { g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#e7b923'); g.addColorStop(1, '#a8760b'); }
  else if (look.s === 1) { g.addColorStop(0, '#2b1f6b'); g.addColorStop(1, mix(col, -0.3)); }
  else if (look.s >= 4 && skinFill(g, look.s, col, mix)) { /* skins v1.0 */ }
  else { g.addColorStop(0, mix(col, 0.25)); g.addColorStop(1, mix(col, -0.2)); }
  c.fillStyle = g; c.fillRect(-18, -50, 36, 46);
  if (look.s === 1) { c.fillStyle = '#fff'; for (const [a, b, r] of [[-9, -40, 1], [8, -30, 1.4], [-3, -14, 1], [11, -42, .9], [-11, -24, 1.2], [4, -9, 1]]) { c.beginPath(); c.arc(a, b, r, 0, TAU); c.fill(); } }
  if (look.s === 2) { c.fillStyle = mix(col, -0.45); for (const [a, b, r] of [[-9, -38, 7], [9, -22, 8], [-4, -12, 6], [8, -42, 5]]) { c.beginPath(); c.ellipse(a, b, r, r * 0.7, 0.5, 0, TAU); c.fill(); } }
  if (look.s >= 4) skinOver(c, look.s, col, mix);
  if (look.o >= 5) outfitX(c, look.o, col);
  else if (look.o === 1) { c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = -24; i < -6; i += 6) c.fillRect(-12, i, 24, 3); }
  else if (look.o === 2) { c.fillStyle = '#1b2440'; c.beginPath(); c.moveTo(-11, -24); c.lineTo(0, -13); c.lineTo(11, -24); c.lineTo(11, -5); c.lineTo(-11, -5); c.fill(); }
  else if (look.o === 3) { c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(-1, -24, 2, 19); c.fillStyle = '#fff'; c.fillRect(-11, -26, 22, 3); }
  else if (look.o === 4) { c.fillStyle = '#f4f8ff'; c.fillRect(-12, -17, 24, 13); c.fillStyle = '#9aa8c4'; c.fillRect(-1, -17, 2, 13); }
  else { c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-12, -13, 24, 3); c.fillStyle = '#ffd23d'; c.fillRect(-2, -13, 4, 3); }
  c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(-12, -10, 24, 8);
  c.restore();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); c.arc(0, -32, 13.5, Math.PI * 1.1, Math.PI * 1.55); c.stroke();
  // rosto
  c.fillStyle = '#fdf1e0'; c.beginPath(); c.ellipse(1, -31, 11, 9, 0, 0, TAU); c.fill();
  const blink = (t % 3.7) < 0.12;
  c.fillStyle = 'rgba(255,120,150,.4)'; c.beginPath(); c.arc(-5.5, -27.5, 2, 0, TAU); c.arc(8, -27.5, 2, 0, TAU); c.fill();
  for (const ex of [-3, 6]) {
    if (dead) { c.strokeStyle = '#17203a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ex - 2, -35); c.lineTo(ex + 2, -31); c.moveTo(ex + 2, -35); c.lineTo(ex - 2, -31); c.stroke(); continue; }
    c.fillStyle = '#17203a'; c.beginPath(); c.ellipse(ex + 0.8, -32.5, 2.5, blink ? 0.5 : 3.4, 0, 0, TAU); c.fill();
    if (!blink) { c.fillStyle = '#fff'; c.beginPath(); c.arc(ex + 1.6, -33.8, 1, 0, TAU); c.fill(); }
  }
  c.strokeStyle = '#17203a'; c.lineWidth = 1.5; c.beginPath(); if (dead) { c.moveTo(-1, -25); c.lineTo(4, -25); } else c.arc(1.5, -27.8, moving ? 3.2 : 2.2, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  // acessórios
  if (look.a === 1) { c.strokeStyle = '#17203a'; c.lineWidth = 1.8; for (const ex of [-3, 6]) { c.beginPath(); c.arc(ex + 0.8, -32.5, 5, 0, TAU); c.stroke(); } c.beginPath(); c.moveTo(2.8, -32.5); c.lineTo(1.8, -32.5); c.stroke(); }
  else if (look.a === 2) { c.fillStyle = '#ff7a3d'; c.beginPath(); c.moveTo(-11, -28.5); c.lineTo(13, -28.5); c.lineTo(1, -17); c.fill(); c.fillStyle = '#ffd3b8'; for (const [a, b] of [[-5, -25], [3, -25], [-1, -21]]) { c.beginPath(); c.arc(a + 2, b, 1, 0, TAU); c.fill(); } }
  else if (look.a === 3) { c.strokeStyle = '#222b45'; c.lineWidth = 3; c.beginPath(); c.arc(0, -32, 17, Math.PI * 1.02, Math.PI * 1.98); c.stroke(); c.fillStyle = '#222b45'; for (const d of [-1, 1]) { c.beginPath(); c.arc(d * 17, -32, 5, 0, TAU); c.fill(); } c.lineWidth = 2; c.strokeStyle = '#222b45'; c.beginPath(); c.moveTo(17, -30); c.quadraticCurveTo(15, -22, 8, -23); c.stroke(); c.fillStyle = '#2de2c5'; c.beginPath(); c.arc(8, -23, 2, 0, TAU); c.fill(); }
  else if (look.a === 4) { c.fillStyle = '#ff4f6d'; rr(c, -13, -23, 26, 6, 3); c.fill(); c.fillStyle = '#fff'; for (let i = -10; i < 12; i += 7) c.fillRect(i, -23, 3, 6); c.fillStyle = '#ff4f6d'; rr(c, -14, -19, 6, 13, 3); c.fill(); }
  if (look.a >= 5) accX(c, look.a, t);
  // chapéus
  c.save(); c.translate(0, -7); const h = look.h;
  if (h === 1) { c.strokeStyle = '#8fa3c8'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -40); c.lineTo(Math.sin(t * 4) * 2, -54); c.stroke(); c.fillStyle = '#ff4f6d'; c.beginPath(); c.arc(Math.sin(t * 4) * 2, -56, 4, 0, TAU); c.fill(); }
  else if (h === 2) { c.fillStyle = '#3b6fe0'; c.beginPath(); c.arc(0, -39, 14, Math.PI, 0); c.fill(); c.fillRect(2, -41, 20, 4); c.fillStyle = '#fff'; c.fillRect(-2, -50, 4, 4); }
  else if (h === 3) { c.fillStyle = '#ffd23d'; c.beginPath(); c.moveTo(-12, -39); c.lineTo(-13, -52); c.lineTo(-6, -45); c.lineTo(0, -55); c.lineTo(6, -45); c.lineTo(13, -52); c.lineTo(12, -39); c.fill(); c.fillStyle = '#ff4f6d'; c.beginPath(); c.arc(0, -43, 2.5, 0, TAU); c.fill(); }
  else if (h === 4) { c.strokeStyle = '#fff3a0'; c.lineWidth = 3; c.shadowColor = '#ffe96b'; c.shadowBlur = 10; c.beginPath(); c.ellipse(0, -50 + Math.sin(t * 3) * 1.5, 11, 4, 0, 0, TAU); c.stroke(); c.shadowBlur = 0; }
  else if (h === 5) { c.fillStyle = '#c06bff'; c.beginPath(); c.moveTo(-9, -39); c.lineTo(0, -62); c.lineTo(9, -39); c.fill(); c.fillStyle = '#ffd23d'; c.fillRect(-6, -48, 12, 3); c.fillStyle = '#ff7ac8'; c.beginPath(); c.arc(0, -63, 3.5, 0, TAU); c.fill(); }
  else if (h >= 7) hatX(c, h, t);
  else if (h === 6) { c.fillStyle = '#4fd36b'; for (const d of [-1, 1]) { c.beginPath(); c.ellipse(d * 7, -47, 8, 4, d * -0.6, 0, TAU); c.fill(); } c.strokeStyle = '#2c8a44'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -40); c.lineTo(0, -45); c.stroke(); }
  c.restore();
  if (act > 0) { c.strokeStyle = `rgba(255,255,255,${act})`; c.lineWidth = 2; c.beginPath(); c.arc(0, -22, 24 + (1 - act) * 10, 0, TAU); c.stroke(); }
  c.restore();
  if (look.m) drawMascot(c, look.m, x - face * 36 * s, y - 34 * s + Math.sin(t * 3) * 3, t, s, face);
}
export function drawMascot(c, m, x, y, t, s = 1, face = 1) {
  c.save(); c.translate(x, y); c.scale(s, s);
  if (m === 1) { const g = c.createRadialGradient(0, 0, 1, 0, 0, 11); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#6ffcea'); g.addColorStop(1, 'rgba(45,226,197,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 11 + Math.sin(t * 5), 0, TAU); c.fill(); c.fillStyle = '#10182e'; c.beginPath(); c.arc(face * 2, 0, 2, 0, TAU); c.fill(); }
  else if (m === 2) { c.fillStyle = '#9fb3d6'; rr(c, -8, -7, 16, 13, 4); c.fill(); c.fillStyle = '#10182e'; c.fillRect(-5, -4, 10, 5); c.fillStyle = '#ffd23d'; c.fillRect(-3 + face * 1, -3, 2, 3); c.fillRect(2 + face * 1, -3, 2, 3); c.strokeStyle = '#9fb3d6'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(0, -7); c.lineTo(0, -12); c.stroke(); c.fillStyle = '#ff4f6d'; c.beginPath(); c.arc(0, -13, 2, 0, TAU); c.fill(); }
  else if (m >= 4) mascotX(c, m, t, face);
  else if (m === 3) { c.fillStyle = '#fff6ef'; c.beginPath(); c.ellipse(0, 0, 10, 8 + Math.sin(t * 4) * 0.8, 0, 0, TAU); c.fill(); c.fillStyle = '#ffb3c6'; c.beginPath(); c.arc(-5, 2, 2, 0, TAU); c.arc(5, 2, 2, 0, TAU); c.fill(); c.fillStyle = '#3a2a3f'; c.beginPath(); c.arc(-3, -1, 1.2, 0, TAU); c.arc(3, -1, 1.2, 0, TAU); c.fill(); }
  c.restore();
}

// ---------- mapa (pré-renderizado) ----------
const TH = {
  hub: ['#1d2c4d', '#223459'], mess: ['#3a3340', '#42394a'], ctl: ['#18233f', '#1d2a4a'], lab: ['#16324a', '#1a3a55'], med: ['#cfe3ea', '#c3dae3'],
  eng: ['#3b3430', '#433a35'], store: ['#2e3340', '#343a49'], comm: ['#22304a', '#283756'], sec: ['#2a2a3d', '#303045'], gen: ['#2c3a36', '#33423d'],
  ext: ['#232a38', '#2a3242'], hidden: ['#241a3a', '#2b2045'], hall: ['#2b3447', '#303a4f'],
};
const LIVE = { lights: [], tubes: [], emit: [] };
const BAKE = new Map();
function tiles(c, w, h, [a, b], s = 50) {
  c.fillStyle = a; c.fillRect(0, 0, w, h); c.fillStyle = b;
  for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) if (((x + y) / s) % 2) c.fillRect(x, y, s, s);
  c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.beginPath();
  for (let x = 0; x <= w; x += s) { c.moveTo(x, 0); c.lineTo(x, h); } for (let y = 0; y <= h; y += s) { c.moveTo(0, y); c.lineTo(w, y); } c.stroke();
}
const desk = (c, x, y, w, h, col = '#4a5a7d') => { c.fillStyle = 'rgba(0,0,0,.28)'; rr(c, x + 3, y + 6, w, h, 6); c.fill(); c.fillStyle = col; rr(c, x, y, w, h, 6); c.fill(); c.fillStyle = 'rgba(255,255,255,.14)'; rr(c, x + 2, y + 2, w - 4, h * 0.35, 4); c.fill(); };
const scr = (c, x, y, w, h, col) => { c.fillStyle = '#080d1a'; rr(c, x, y, w, h, 4); c.fill(); const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,.65)'); c.globalAlpha = 0.9; c.fillStyle = g; rr(c, x + 3, y + 3, w - 6, h - 6, 3); c.fill(); c.globalAlpha = 1; c.fillStyle = 'rgba(255,255,255,.1)'; for (let i = y + 5; i < y + h - 4; i += 4) c.fillRect(x + 3, i, w - 6, 1); };
const cyl = (c, x, y, w, h, col, glow) => { const g = c.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, mix(col, -0.45)); g.addColorStop(0.35, mix(col, 0.25)); g.addColorStop(1, mix(col, -0.5)); c.fillStyle = 'rgba(0,0,0,.3)'; rr(c, x + 3, y + 5, w, h, w / 2); c.fill(); c.fillStyle = g; rr(c, x, y, w, h, w / 3); c.fill(); if (glow) { c.fillStyle = glow; rr(c, x + w * 0.3, y + h * 0.2, w * 0.4, h * 0.6, w * 0.2); c.fill(); } };
const crate = (c, x, y, s, col = '#8a6a3f') => { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(x + 3, y + 5, s, s); c.fillStyle = col; c.fillRect(x, y, s, s); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; c.strokeRect(x + 2, y + 2, s - 4, s - 4); c.beginPath(); c.moveTo(x + 2, y + 2); c.lineTo(x + s - 2, y + s - 2); c.moveTo(x + s - 2, y + 2); c.lineTo(x + 2, y + s - 2); c.stroke(); };
const pipe = (c, x1, y1, x2, y2, col, w = 10) => { c.lineCap = 'round'; const ln = o => { c.beginPath(); c.moveTo(x1 + o, y1 + o); c.lineTo(x2 + o, y2 + o); c.stroke(); }; c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = w + 3; ln(3); c.strokeStyle = col; c.lineWidth = w; ln(0); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = w / 3; ln(-w / 4); };
const hazard = (c, x, y, w, h) => { c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.fillStyle = '#e8b923'; c.fillRect(x, y, w, h); c.fillStyle = '#1a1a1a'; for (let i = -h; i < w + h; i += 16) { c.beginPath(); c.moveTo(x + i, y + h); c.lineTo(x + i + 8, y + h); c.lineTo(x + i + 8 + h, y); c.lineTo(x + i + h, y); c.fill(); } c.restore(); };
const bed = (c, x, y) => { desk(c, x, y, 80, 46, '#e9f2f7'); c.fillStyle = '#6fb7d6'; rr(c, x + 24, y + 3, 52, 40, 5); c.fill(); c.fillStyle = '#fff'; rr(c, x + 5, y + 8, 16, 30, 6); c.fill(); };
const rack = (c, x, y, w, h, col) => { desk(c, x, y, w, h, '#2a3350'); for (let i = y + 8; i < y + h - 8; i += 14) { c.fillStyle = '#0b1226'; c.fillRect(x + 5, i, w - 10, 9); c.fillStyle = col; c.fillRect(x + 8, i + 3, 4, 3); } };
const L = (r, x, y, col) => LIVE.lights.push({ x: r.x + x, y: r.y + y, col, ph: (x * 7 + y * 3) % 6 });
const PAINT = {
  hub(c, r) { c.strokeStyle = 'rgba(45,226,197,.35)'; c.lineWidth = 4; c.beginPath(); c.arc(250, 230, 105, 0, TAU); c.stroke(); c.setLineDash([10, 12]); c.beginPath(); c.arc(250, 230, 135, 0, TAU); c.stroke(); c.setLineDash([]); cyl(c, 215, 195, 70, 70, '#2a3a63', '#2de2c5'); desk(c, 20, 40, 60, 120, '#34456d'); desk(c, 420, 240, 60, 120, '#34456d'); L(r, 50, 30, '#2de2c5'); L(r, 450, 370, '#2de2c5'); },
  mess(c, r) { for (const x of [50, 330]) for (const y of [180, 270]) { desk(c, x, y, 120, 44, '#6a5a78'); for (let i = 0; i < 3; i++) { c.fillStyle = '#3a2f46'; c.beginPath(); c.arc(x + 20 + i * 40, y - 8, 7, 0, TAU); c.arc(x + 20 + i * 40, y + 54, 7, 0, TAU); c.fill(); } } desk(c, 20, 310, 120, 36, '#8d7aa3'); desk(c, 360, 312, 120, 34, '#8d7aa3'); rack(c, 460, 120, 34, 70, '#ffb347'); c.fillStyle = '#4fd36b'; for (const x of [18, 468]) { c.beginPath(); c.arc(x, 20, 12, 0, TAU); c.fill(); } },
  ctl(c, r) { for (let i = 0; i < 5; i++) scr(c, 30 + i * 96, 8, 84, 50, ['#2de2c5', '#4aa8ff', '#ffb347', '#ff4f6d', '#6bd968'][i]); desk(c, 170, 170, 180, 90, '#2b3a63'); scr(c, 190, 178, 140, 60, '#4aa8ff'); for (const x of [30, 440]) desk(c, x, 200, 50, 120, '#34456d'); L(r, 20, 380, '#4aa8ff'); L(r, 500, 380, '#4aa8ff'); },
  lab(c, r) { for (let i = 0; i < 6; i++) { const x = 30 + i * 78; cyl(c, x, 320, 44, 80, '#4ad8ff', 'rgba(150,240,255,.8)'); LIVE.tubes.push({ x: r.x + x + 22, y: r.y + 330, h: 60 }); L(r, x + 22, 316, '#4ad8ff'); } desk(c, 30, 190, 140, 50, '#3a5a78'); desk(c, 330, 190, 160, 50, '#3a5a78'); c.fillStyle = '#7fe3ff'; for (const x of [50, 90, 130, 350, 400]) { c.beginPath(); c.arc(x, 205, 8, 0, TAU); c.fill(); } cyl(c, 440, 240, 56, 56, '#8fa3c8', '#ff4f6d'); },
  med(c, r) { c.fillStyle = 'rgba(79,211,107,.25)'; c.fillRect(205, 150, 50, 14); c.fillRect(223, 132, 14, 50); for (const [x, y] of [[250, 20], [350, 20], [20, 230], [20, 300]]) { bed(c, x, y); } scr(c, 250 + 88, 90, 54, 38, '#6bd968'); desk(c, 380, 320, 70, 40, '#9fb9c6'); L(r, 440, 20, '#6bd968'); },
  eng(c, r) { for (const x of [20, 380]) { cyl(c, x, 240, 150, 150, '#8a6a52', '#ff9f43'); pipe(c, x + 75, 240, x + 75, 190, '#a08060', 12); LIVE.emit.push({ x: r.x + x + 75, y: r.y + 230, k: 'spark' }); } pipe(c, 0, 210, 560, 210, '#6a7a8a', 12); pipe(c, 200, 20, 200, 210, '#7a6a5a', 9); hazard(c, 0, 400, 560, 20); L(r, 280, 400, '#ff9f43'); L(r, 280, 20, '#ff9f43'); },
  store(c, r) { for (let i = 0; i < 6; i++) crate(c, 30 + (i % 3) * 52, 200 + Math.floor(i / 3) * 52, 48, i % 2 ? '#8a6a3f' : '#6f8a3f'); for (let i = 0; i < 5; i++) crate(c, 330 + (i % 3) * 52, 210 + Math.floor(i / 3) * 52, 48, i % 2 ? '#3f6a8a' : '#8a6a3f'); desk(c, 200, 300, 100, 40, '#4a5a7d'); hazard(c, 0, 340, 500, 20); },
  comm(c, r) { rack(c, 20, 190, 60, 160, '#4aa8ff'); rack(c, 420, 190, 60, 160, '#6bd968'); scr(c, 150, 12, 200, 80, '#4aa8ff'); desk(c, 190, 150, 120, 44, '#34456d'); c.strokeStyle = '#8fa3c8'; c.lineWidth = 4; c.beginPath(); c.arc(430, 60, 36, Math.PI * 0.9, Math.PI * 1.9); c.stroke(); L(r, 50, 180, '#4aa8ff'); L(r, 450, 180, '#6bd968'); },
  sec(c, r) { for (let i = 0; i < 6; i++) scr(c, 40 + (i % 3) * 140, 270 + Math.floor(i / 3) * 52, 130, 46, i % 2 ? '#6bd968' : '#2de2c5'); desk(c, 160, 170, 180, 50, '#44445f'); for (let i = 0; i < 3; i++) desk(c, 450, 40 + i * 70, 40, 60, '#585878'); L(r, 20, 20, '#ff4f6d'); },
  gen(c, r) { for (const [x, y] of [[14, 130], [196, 130], [14, 215], [196, 215]]) cyl(c, x, y, 50, 70, '#5a6a64', '#ffe96b'); pipe(c, 64, 165, 196, 165, '#7a8a84', 8); LIVE.emit.push({ x: r.x + 39, y: r.y + 130, k: 'spark' }); L(r, 130, 120, '#ffe96b'); hazard(c, 0, 300, 260, 20); },
  ext(c, r) { c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; for (let i = 0; i < 300; i += 12) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 300); c.stroke(); } cyl(c, 220, 170, 50, 90, '#8fa3c8', '#4aa8ff'); crate(c, 20, 220, 46, '#5a6a8a'); crate(c, 70, 230, 34, '#8a6a3f'); hazard(c, 0, 0, 300, 10); hazard(c, 290, 0, 10, 300); L(r, 245, 160, '#4aa8ff'); },
  hidden(c, r) { c.fillStyle = 'rgba(192,107,255,.12)'; c.beginPath(); c.arc(r.w / 2, r.h / 2, 80, 0, TAU); c.fill(); desk(c, 12, 12, 30, r.h - 24, '#3a2d5f'); desk(c, r.w - 42, 12, 30, r.h - 24, '#3a2d5f'); L(r, r.w / 2, 12, '#c06bff'); },
  hall(c, r) { const v = r.h > r.w; c.fillStyle = 'rgba(232,185,35,.5)'; if (v) { c.fillRect(6, 0, 4, r.h); c.fillRect(r.w - 10, 0, 4, r.h); } else { c.fillRect(0, 6, r.w, 4); c.fillRect(0, r.h - 10, r.w, 4); } c.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 30; i < (v ? r.h : r.w) - 20; i += 60) { c.beginPath(); if (v) { c.moveTo(r.w / 2 - 8, i); c.lineTo(r.w / 2, i + 10); c.lineTo(r.w / 2 + 8, i); } else { c.moveTo(i, r.h / 2 - 8); c.lineTo(i + 10, r.h / 2); c.lineTo(i, r.h / 2 + 8); } c.fill(); } },
};
function bake(r) {
  const cv = document.createElement('canvas'); cv.width = r.w; cv.height = r.h; const c = cv.getContext('2d');
  tiles(c, r.w, r.h, TH[r.theme] || TH.hall, 50); (PAINT[r.theme] || (() => { }))(c, r);
  if (r.theme !== 'hall') { c.fillStyle = r.theme === 'med' ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.07)'; c.font = '800 34px "Baloo 2",system-ui,sans-serif'; c.textBaseline = 'bottom'; c.fillText(r.name, 16, r.h - 12); }
  BAKE.set(r.id, cv); return cv;
}
const DOORS = []; for (const k of CORRIDORS) { const hz = k.w > k.h; for (const e of [4, (hz ? k.w : k.h) - 4]) DOORS.push({ x: hz ? k.x + e : k.x, y: hz ? k.y : k.y + e, w: k.w, h: k.h, hz, o: 0 }); }

// ---------- partículas ----------
const P = [];
function part(x, y, vx, vy, life, size, col, g = 0) { const cap = [80, 200, 400][Q.level]; if (P.length < cap) P.push({ x, y, vx, vy, life, max: life, size, col, g }); }
export const R = { zm: 0, cam: { x: SPECIAL.spawn.x, y: SPECIAL.spawn.y }, zoomKick: 0, shake: 0, flash: 0, vis: 420, dying: [], t: 0 };
export function addShake(v) { R.shake = Math.max(R.shake, v); }
export function fx(kind, x, y, col = '#fff') {
  if (kind === 'kill') { R.flash = 0.5; addShake(10); R.zoomKick = 1; for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, s = 80 + Math.random() * 220; part(x, y - 20, Math.cos(a) * s, Math.sin(a) * s, 0.7, 3 + Math.random() * 4, col, 200); } }
  if (kind === 'killg') { R.flash = 0.25; addShake(6); for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, s = 40 + Math.random() * 140; part(x, y - 20, Math.cos(a) * s, Math.sin(a) * s - 40, 1.2, 3 + Math.random() * 5, '#4fd36b', -30); } }
  if (kind === 'confetti') for (let i = 0; i < 6; i++) part(x + Math.random() * 600, y, (Math.random() - 0.5) * 80, 120 + Math.random() * 160, 3, 5, ['#2de2c5', '#ffb347', '#ff4f6d', '#6bd968'][i % 4], 30);
  if (kind === 'dust') part(x, y, (Math.random() - 0.5) * 20, -10, 0.5, 3, 'rgba(255,255,255,.3)');
}

// ---------- efeitos v1.0 ----------
function drawBag(c, x, y, t) { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x, y + 6, 22, 8, 0, 0, TAU); c.fill(); c.fillStyle = '#5b4a3a'; c.beginPath(); c.moveTo(x - 20, y + 4); c.quadraticCurveTo(x - 24, y - 22, x - 5, y - 26); c.lineTo(x + 5, y - 26); c.quadraticCurveTo(x + 24, y - 22, x + 20, y + 4); c.quadraticCurveTo(x, y + 12, x - 20, y + 4); c.fill(); c.strokeStyle = '#2e241a'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#2e241a'; c.fillRect(x - 6, y - 27, 12, 4); c.strokeStyle = '#7a6650'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x - 10, y - 12); c.lineTo(x + 8, y - 4); c.stroke(); }
function drawCry(c, x, y, t) { const b = Math.sin(t * 3) * 2; c.fillStyle = '#e5202e'; c.beginPath(); c.arc(x, y + b, 13, 0, TAU); c.fill(); c.strokeStyle = '#7a0a14'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 5, y - 3 + b, 3, 0, TAU); c.arc(x + 5, y - 3 + b, 3, 0, TAU); c.fill(); c.fillStyle = '#1a0508'; c.beginPath(); c.arc(x - 5, y - 2 + b, 1.4, 0, TAU); c.arc(x + 5, y - 2 + b, 1.4, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(x, y + 9 + b, 4.5, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); c.fillStyle = '#7fd4ff'; for (const d of [-1, 1]) { const k = (t * 1.4 + (d > 0 ? 0.5 : 0)) % 1; c.beginPath(); c.ellipse(x + d * 6, y + b + k * 14, 1.8, 2.8, 0, 0, TAU); c.fill(); } }
function drawSlash(c, x, y, id = 0) { // vários cortes cruzando o corpo (posições fixas por vítima)
  c.lineCap = 'round'; for (let i = 0; i < 6; i++) { const s = Math.sin((id + 1) * 12.9898 + i * 78.233) * 43758.5453, f = s - Math.floor(s), a = -0.9 + i * 0.35 + f * 0.25, cx = x + (i - 2.5) * 8 + (f - 0.5) * 8, cy = y - 8 + ((i % 2) ? 6 : -6), len = 24 + f * 12, dx = Math.cos(a) * len, dy = Math.sin(a) * len;
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(cx - dx, cy - dy); c.lineTo(cx + dx, cy + dy); c.stroke(); c.strokeStyle = 'rgba(229,32,46,.95)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(cx - dx + 3, cy - dy + 3); c.lineTo(cx + dx + 3, cy + dy + 3); c.stroke(); }
  c.lineCap = 'butt'; }
function drawFrozen(c, r, t, label) { c.fillStyle = 'rgba(170,235,255,.5)'; c.fillRect(r.x, r.y, r.w, r.h); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.strokeRect(r.x + 4, r.y + 4, r.w - 8, r.h - 8); c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 9; i++) { const px = r.x + ((i * 137) % r.w), py = r.y + ((i * 91) % r.h); c.moveTo(px - 14, py); c.lineTo(px + 14, py); c.moveTo(px, py - 14); c.lineTo(px, py + 14); c.moveTo(px - 10, py - 10); c.lineTo(px + 10, py + 10); c.moveTo(px + 10, py - 10); c.lineTo(px - 10, py + 10); } c.stroke(); c.fillStyle = '#eaffff'; c.font = '800 26px "Baloo 2",sans-serif'; c.textAlign = 'center'; c.fillText('❄ ' + label + ' congelada', r.x + r.w / 2, r.y + r.h / 2); }
function drawSelected(c, r, t, label) { c.setLineDash([16, 10]); c.lineDashOffset = -t * 20; c.strokeStyle = '#7DF9FF'; c.lineWidth = 5; c.strokeRect(r.x + 6, r.y + 6, r.w - 12, r.h - 12); c.setLineDash([]); c.fillStyle = 'rgba(125,249,255,.12)'; c.fillRect(r.x, r.y, r.w, r.h); c.fillStyle = '#7DF9FF'; c.font = '800 22px "Baloo 2",sans-serif'; c.textAlign = 'center'; c.fillText('selecionada: ' + label, r.x + r.w / 2, r.y + 34); }
function drawLighter(c, x, y, t) { const p = 0.5 + 0.5 * Math.sin(t * 6); c.fillStyle = `rgba(255,170,40,${0.2 + p * 0.25})`; c.beginPath(); c.arc(x, y, 26 + p * 6, 0, TAU); c.fill(); c.fillStyle = '#c9ccd6'; rr(c, x - 7, y - 4, 14, 20, 3); c.fill(); c.fillStyle = '#7a8094'; c.fillRect(x - 7, y + 4, 14, 3); c.fillStyle = '#ffb347'; c.beginPath(); c.ellipse(x, y - 9, 3.5, 6 + p * 2, 0, 0, TAU); c.fill(); c.fillStyle = '#fff3a0'; c.beginPath(); c.ellipse(x, y - 8, 1.6, 3, 0, 0, TAU); c.fill(); }
// ---------- câmera / luz ----------
const lc = document.createElement('canvas'), lx = lc.getContext('2d');
let cvs, ctx, W = 0, H = 0, zoom = 1;
export function initRender(canvas) { cvs = canvas; ctx = canvas.getContext('2d'); resize(); addEventListener('resize', resize); }
function resize() { const d = Math.min(devicePixelRatio || 1, [1, 1.25, 1.5][Q.level]); W = cvs.width = Math.floor(innerWidth * d); H = cvs.height = Math.floor(innerHeight * d); const s = [0.35, 0.5, 0.7][Q.level]; lc.width = Math.ceil(W * s); lc.height = Math.ceil(H * s); }
export function setQuality(l) { Q.level = l; if (cvs) resize(); }
export function toWorld(sx, sy) { return [(sx - W / 2) / zoom + R.cam.x, (sy - H / 2) / zoom + R.cam.y]; }
export function toScreen(x, y) { return [(x - R.cam.x) * zoom + W / 2, (y - R.cam.y) * zoom + H / 2]; }

export function render(S, dt) {
  R.t += dt; if (S.cams) return renderCams(S); const t = R.t, me = S.me;
  zoom = clamp(H / (S.touch ? 560 : 760), 0.5, 1.7) * (1 + R.zoomKick * 0.05); R.zoomKick = Math.max(0, R.zoomKick - dt * 3);
  R.zm += ((S.ab?.act?.zoom > 0 && S.phase === 'play' ? 1 : 0) - R.zm) * Math.min(1, dt * 4); // zoom do Policial/Red John: mostra o mapa inteiro
  if (R.zm > 0.001) zoom += (Math.min(zoom, Math.min(W / WORLD.w, H / WORLD.h) * 0.96) - zoom) * R.zm;
  const base = S.view || me, vpos = R.zm > 0.001 ? { x: base.x + (WORLD.w / 2 - base.x) * R.zm, y: base.y + (WORLD.h / 2 - base.y) * R.zm } : base, k = 1 - Math.exp(-6 * dt); R.cam.x += (vpos.x - R.cam.x) * k; R.cam.y += (vpos.y - R.cam.y) * k;
  const vw = W / zoom / 2, vh = H / zoom / 2;
  R.cam.x = vw * 2 >= WORLD.w ? WORLD.w / 2 : clamp(R.cam.x, vw, WORLD.w - vw); R.cam.y = vh * 2 >= WORLD.h ? WORLD.h / 2 : clamp(R.cam.y, vh, WORLD.h - vh);
  R.shake = Math.max(0, R.shake - dt * 22);
  const sx = (Math.random() - 0.5) * R.shake, sy = (Math.random() - 0.5) * R.shake;
  const vx0 = R.cam.x - vw - 40, vx1 = R.cam.x + vw + 40, vy0 = R.cam.y - vh - 40, vy1 = R.cam.y + vh + 40;
  const vis = (x, y, w = 0, h = 0) => x + w > vx0 && x < vx1 && y + h > vy0 && y < vy1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#060a16'; ctx.fillRect(0, 0, W, H);
  ctx.setTransform(zoom, 0, 0, zoom, W / 2 - R.cam.x * zoom + sx, H / 2 - R.cam.y * zoom + sy);
  // estrelas de fundo
  ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 70; i++) { const x = (i * 977) % WORLD.w, y = (i * 613) % WORLD.h; if (vis(x, y)) ctx.fillRect(x, y, 2, 2); }
  // paredes e pisos
  ctx.fillStyle = '#0d1426'; for (const r of RECTS) if (vis(r.x - 20, r.y - 20, r.w + 40, r.h + 40)) { ctx.fillRect(r.x - 18, r.y - 18, r.w + 36, r.h + 36); }
  ctx.fillStyle = '#4b5d86'; for (const r of RECTS) if (vis(r.x - 20, r.y - 20, r.w + 40, r.h + 40)) { ctx.fillRect(r.x - 18, r.y - 18, r.w + 36, 6); ctx.fillRect(r.x - 18, r.y + r.h + 12, r.w + 36, 6); }
  for (const r of RECTS) if (vis(r.x, r.y, r.w, r.h)) ctx.drawImage(BAKE.get(r.id) || bake(r), r.x, r.y);
  // luzes ambientes
  const sabL = S.sab?.k === 'lights', flick = sabL ? (Math.sin(t * 30) > 0.2 ? 0.2 : 1) : 1;
  for (const l of LIVE.lights) if (vis(l.x - 20, l.y - 20, 40, 40)) { const a = (0.5 + 0.5 * Math.sin(t * 2 + l.ph)) * flick; ctx.fillStyle = l.col; ctx.globalAlpha = 0.25 + a * 0.5; ctx.beginPath(); ctx.arc(l.x, l.y, 6, 0, TAU); ctx.fill(); ctx.globalAlpha = 0.08 * a; ctx.beginPath(); ctx.arc(l.x, l.y, 34, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  for (const tb of LIVE.tubes) if (vis(tb.x - 30, tb.y - 10, 60, 80)) { ctx.fillStyle = 'rgba(220,250,255,.7)'; for (let i = 0; i < 3; i++) { const p = (t * 0.4 + i / 3 + tb.x * 0.013) % 1; ctx.beginPath(); ctx.arc(tb.x + Math.sin(t * 2 + i) * 6, tb.y + tb.h - p * tb.h, 2 + i, 0, TAU); ctx.fill(); } }
  for (const e of LIVE.emit) if (vis(e.x - 30, e.y - 30, 60, 60) && Math.random() < dt * 3) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2; part(e.x, e.y, Math.cos(a) * 140, Math.sin(a) * 140, 0.5, 2.5, '#ffd36b', 300); }
  // portas
  const actors = [me, ...S.players.values()];
  for (const d of DOORS) if (vis(d.x - 30, d.y - 30, d.w + 60, d.h + 60)) {
    let m = 1e9; const cx = d.hz ? d.x : d.x + d.w / 2, cy = d.hz ? d.y + d.h / 2 : d.y; for (const a of actors) m = Math.min(m, Math.hypot(a.x - cx, a.y - cy));
    const tgt = clamp(1 - (m - 70) / 110, 0, 1), was = d.o; d.o += (tgt - d.o) * Math.min(1, dt * 10); if (was < 0.5 && d.o >= 0.5 && Math.hypot(me.x - cx, me.y - cy) < 500) S.onDoor?.();
    ctx.fillStyle = '#7d8fb8'; const g = (1 - d.o);
    if (d.hz) { const hh = (d.h / 2) * g; ctx.fillRect(d.x - 7, d.y, 14, hh); ctx.fillRect(d.x - 7, d.y + d.h - hh, 14, hh); }
    else { const ww = (d.w / 2) * g; ctx.fillRect(d.x, d.y - 7, ww, 14); ctx.fillRect(d.x + d.w - ww, d.y - 7, ww, 14); }
    ctx.fillStyle = d.o > 0.4 ? '#6bd968' : '#ff4f6d'; ctx.beginPath(); ctx.arc(cx, d.hz ? d.y - 6 : d.y - 12, 3, 0, TAU); ctx.fill();
  }
  // ventilações, estações e pontos especiais
  for (const v of VENTS) if (vis(v.x - 30, v.y - 30, 60, 60)) { ctx.fillStyle = '#10182e'; rr(ctx, v.x - 24, v.y - 14, 48, 28, 5); ctx.fill(); ctx.strokeStyle = '#586a94'; ctx.lineWidth = 2; for (let i = -16; i <= 16; i += 8) { ctx.beginPath(); ctx.moveTo(v.x + i, v.y - 12); ctx.lineTo(v.x + i, v.y + 12); ctx.stroke(); } }
  for (const c of CAMS) { // câmeras de segurança nas paredes (LED vermelho quando alguém assiste)
    const x = c.x, y = c.y; if (!vis(x - 30, y - 30, 60, 60)) continue;
    ctx.fillStyle = '#1b2440'; rr(ctx, x - 9, y - 5, 18, 12, 4); ctx.fill(); ctx.fillStyle = '#8fa3c8'; ctx.beginPath(); ctx.arc(x, y + 2, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b1226'; ctx.beginPath(); ctx.arc(x, y + 3, 3, 0, TAU); ctx.fill();
    ctx.fillStyle = S.camsOn ? '#ff3b52' : '#6bd968'; ctx.globalAlpha = S.camsOn ? (Math.sin(t * 8) > 0 ? 1 : 0.25) : 0.35 + 0.25 * Math.sin(t * 2); ctx.beginPath(); ctx.arc(x + 8, y - 5, 2.4, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  { const cs = SPECIAL.camConsole; if (vis(cs.x - 40, cs.y - 50, 80, 80)) { ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(ctx, cs.x - 24, cs.y - 6, 52, 30, 6); ctx.fill(); ctx.fillStyle = '#44445f'; rr(ctx, cs.x - 26, cs.y - 10, 52, 30, 6); ctx.fill(); ctx.fillStyle = '#080d1a'; rr(ctx, cs.x - 21, cs.y - 36, 42, 26, 4); ctx.fill(); ctx.fillStyle = '#ff4f6d'; ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 3); rr(ctx, cs.x - 18, cs.y - 33, 36, 20, 3); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CAM', cs.x, cs.y - 19); } }
  const mine = S.myTasks;
  for (const s of STATIONS) if (vis(s.x - 40, s.y - 60, 80, 90)) {
    const tk = mine.find(q => q.id === s.id), on = tk && !tk.done && !S.taskFrozen?.(tk);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; rr(ctx, s.x - 22, s.y - 8, 48, 30, 6); ctx.fill(); ctx.fillStyle = '#3a4a70'; rr(ctx, s.x - 24, s.y - 12, 48, 30, 6); ctx.fill();
    const col = { wires: '#ffb347', code: '#2de2c5', calibrate: '#4aa8ff', fuel: '#ff7ac8', reboot: '#6bd968', order: '#c06bff', simon: '#ffd93d', memory: '#ff7a3d', sliders: '#7dffb0', spot: '#9ad1ff', pump: '#ff6a6a', swipe: '#e0e0ff' }[s.type];
    ctx.fillStyle = '#080d1a'; rr(ctx, s.x - 19, s.y - 30, 38, 22, 4); ctx.fill(); ctx.globalAlpha = on ? 0.9 : tk ? 0.35 : 0.6; ctx.fillStyle = col; rr(ctx, s.x - 16, s.y - 27, 32, 16, 3); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#10182e'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(tk?.done ? '✓' : { wires: '≋', code: '#', calibrate: '◎', fuel: '▲', reboot: '↻', order: '≡', simon: '◆', memory: '▦', sliders: '⇅', spot: '◉', pump: '⚙', swipe: '▭' }[s.type], s.x, s.y - 14);
    if (on) { const p = 0.5 + 0.5 * Math.sin(t * 4); ctx.strokeStyle = `rgba(255,224,102,${0.4 + p * 0.5})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y - 4, 34 + p * 6, 0, TAU); ctx.stroke(); ctx.fillStyle = '#ffe066'; ctx.beginPath(); const by = s.y - 56 + Math.sin(t * 5) * 4; ctx.moveTo(s.x - 7, by - 8); ctx.lineTo(s.x + 7, by - 8); ctx.lineTo(s.x, by); ctx.fill(); }
  }
  const sp = (p, col, label, on) => { if (!vis(p.x - 40, p.y - 40, 80, 80)) return; const a = on ? 0.5 + 0.5 * Math.sin(t * 8) : 0.35; ctx.fillStyle = '#10182e'; ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, TAU); ctx.fill(); ctx.fillStyle = col; ctx.globalAlpha = 0.5 + a * 0.5; ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; if (on) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(p.x, p.y, 28 + a * 8, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } };
  sp(SPECIAL.emergency, '#ff4f6d', '', false);
  if (S.sab) { const k2 = S.sab.k; if (k2 === 'lights') sp(SPECIAL.lights, '#ffe66b', '', true); if (k2 === 'comms') sp(SPECIAL.comms, '#4aa8ff', '', true); if (k2 === 'heat') { sp(SPECIAL.heatA, S.sab.fixed[0] ? '#6bd968' : '#ff4f6d', '', !S.sab.fixed[0]); sp(SPECIAL.heatB, S.sab.fixed[1] ? '#6bd968' : '#ff4f6d', '', !S.sab.fixed[1]); } }
  // corpos
  for (const b of S.bodies) if (vis(b.x - 40, b.y - 60, 80, 80)) {
    const p = 0.5 + 0.5 * Math.sin(t * 5); ctx.fillStyle = b.g ? `rgba(79,211,107,${0.2 + p * 0.25})` : `rgba(255,79,109,${0.15 + p * 0.2})`; ctx.beginPath(); ctx.ellipse(b.x, b.y, 34 + p * 6, 14 + p * 3, 0, 0, TAU); ctx.fill();
    if (b.bag) { ctx.globalAlpha = b.bag === 2 ? 0.45 : 1; drawBag(ctx, b.x, b.y, t); ctx.globalAlpha = 1; continue; }
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(1.35); drawCrew(ctx, b.look, 0, 14, { t, dead: true, s: 1 }); ctx.restore();
    if (b.fx === 1) drawCry(ctx, b.x + 4, b.y - 34, t); else if (b.fx === 2) drawSlash(ctx, b.x, b.y, b.id);
  }
  for (const id of S.fz || []) { const r = ROOM_BY_ID[id]; if (r && vis(r.x, r.y, r.w, r.h)) drawFrozen(ctx, r, t, r.name); }
  if (S.xt?.sel) for (const id of S.xt.sel) { const r = ROOM_BY_ID[id]; if (r && vis(r.x, r.y, r.w, r.h)) drawSelected(ctx, r, t, r.name); }
  if (S.xt?.lt && vis(S.xt.lt[0] - 40, S.xt.lt[1] - 40, 80, 80)) drawLighter(ctx, S.xt.lt[0], S.xt.lt[1], t);
  // jogadores
  const list = [...S.players.values()]; if (!S.hideMe) list.push({ ...me, id: 'me', look: S.look, name: S.name, moving: me.moving, face: me.face, ghost: !me.alive, me: true }); list.sort((a, b) => a.y - b.y);
  for (const p of list) {
    if (!vis(p.x - 50, p.y - 90, 100, 120) || (p.me && me.vent >= 0)) continue;
    drawCrew(ctx, p.look, p.x, p.y, { t: t + (typeof p.id === 'number' ? p.id : 0), moving: p.moving, face: p.face, ghost: p.ghost, alpha: p.ph ? 0.4 + 0.12 * Math.sin(t * 5) : p.ghost ? 0.5 : (p.inv || (p.me && S.meInv) || (p.me && S.ab?.act?.phase > 0)) ? 0.35 : 1, act: p.me ? S.acting : 0 });
    if (p.ph) { ctx.strokeStyle = `rgba(255,255,255,${0.35 + 0.3 * Math.sin(t * 6)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y - 22, 34, 0, TAU); ctx.stroke(); }
    if (!p.me && S.xt?.pids?.includes(p.id)) { ctx.fillStyle = '#ffa500'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 82); ctx.quadraticCurveTo(p.x + 7, p.y - 72, p.x, p.y - 66); ctx.quadraticCurveTo(p.x - 7, p.y - 72, p.x, p.y - 82); ctx.fill(); }
    if (!p.me && S.xt?.vids?.includes(p.id)) { ctx.fillStyle = '#22A447'; ctx.beginPath(); ctx.arc(p.x, p.y - 74, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#b6ffc9'; ctx.beginPath(); ctx.arc(p.x - 2, p.y - 76, 1.8, 0, TAU); ctx.fill(); }
    if (p.me && S.xt?.arm > 0 && me.alive) { ctx.strokeStyle = 'rgba(190,210,255,.95)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y - 20, 34, 0, TAU); ctx.stroke(); }
    if (p.me && S.meShield > 0) { ctx.strokeStyle = 'rgba(255,228,77,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y - 20, 30 + Math.sin(t * 6) * 2, 0, TAU); ctx.stroke(); }
    if (p.moving && !p.ghost && Math.random() < dt * 6) fx('dust', p.x, p.y);
  }
  for (let i = R.dying.length - 1; i >= 0; i--) { const d = R.dying[i]; d.t += dt; if (d.t > 0.7) { R.dying.splice(i, 1); continue; } const k3 = d.t / 0.7; ctx.save(); ctx.translate(d.x, d.y - 20); ctx.rotate(k3 * 9); ctx.globalAlpha = 1 - k3; drawCrew(ctx, d.look, 0, 20, { t, s: 1 - k3 * 0.7 }); ctx.restore(); }
  // partículas
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life -= dt; if (p.life <= 0) { P.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + p.life / p.max * 0.5), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // iluminação (campo de visão)
  if (!S.hideMe && me.alive && R.zm < 0.5) {
    const target = S.vr || 420; R.vis += (target - R.vis) * Math.min(1, dt * (target < R.vis ? 5 : 2));
    const s = lc.width / W, [mx, my] = toScreen(vpos.x, vpos.y - 20), rad = R.vis * zoom * s * (sabL ? 0.9 + Math.random() * 0.15 : 1);
    lx.globalCompositeOperation = 'source-over'; lx.fillStyle = 'rgba(3,5,14,.965)'; lx.fillRect(0, 0, lc.width, lc.height);
    lx.globalCompositeOperation = 'destination-out'; const g = lx.createRadialGradient(mx * s, my * s, rad * 0.3, mx * s, my * s, rad); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.75, 'rgba(0,0,0,.85)'); g.addColorStop(1, 'rgba(0,0,0,0)'); lx.fillStyle = g; lx.beginPath(); lx.arc(mx * s, my * s, rad, 0, TAU); lx.fill();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(lc, 0, 0, W, H);
  } else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(40,60,140,.10)'; ctx.fillRect(0, 0, W, H); }
  // nomes
  ctx.setTransform(zoom, 0, 0, zoom, W / 2 - R.cam.x * zoom + sx, H / 2 - R.cam.y * zoom + sy); ctx.textAlign = 'center'; ctx.font = '700 13px "Baloo 2",system-ui,sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(5,8,20,.85)';
  for (const p of list) { if (p.me && me.vent >= 0) continue; const col = S.nameColor?.(p) || '#fff', tag = S.tagOf?.(p), nm = (p.name || '') + (tag ? ' · ' + tag : ''); ctx.strokeStyle = col === '#111419' ? 'rgba(255,255,255,.95)' : 'rgba(5,8,20,.85)'; ctx.fillStyle = col; ctx.strokeText(nm, p.x, p.y - 72); ctx.fillText(nm, p.x, p.y - 72); }
  // efeitos de tela
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (const a of S.arrows || []) {
    if (a.ang !== undefined) { // seta só de direção (ex.: dentro do duto)
      ctx.fillStyle = a.col; ctx.strokeStyle = 'rgba(5,8,20,.9)'; ctx.lineWidth = 3; ctx.save(); ctx.translate(W / 2 + Math.cos(a.ang) * (W / 2 - 58), H / 2 + Math.sin(a.ang) * (H / 2 - 58)); ctx.rotate(a.ang); ctx.scale(a.s || 1, a.s || 1);
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); continue;
    }
    const [ax, ay] = toScreen(a.x, a.y), m = 46, on = ax > m && ax < W - m && ay > m && ay < H - m; ctx.fillStyle = a.col; ctx.strokeStyle = 'rgba(5,8,20,.9)'; ctx.lineWidth = 3;
    if (on) { if (a.edge) continue; const by = ay - 40 + Math.sin(R.t * 5) * 5; ctx.beginPath(); ctx.moveTo(ax - 10, by - 12); ctx.lineTo(ax + 10, by - 12); ctx.lineTo(ax, by); ctx.closePath(); ctx.stroke(); ctx.fill(); }
    else { const ang = Math.atan2(ay - H / 2, ax - W / 2); ctx.save(); ctx.translate(Math.max(m, Math.min(W - m, ax)), Math.max(m, Math.min(H - m, ay))); ctx.rotate(ang); ctx.scale(a.s || 1, a.s || 1); ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -13); ctx.lineTo(-4, 0); ctx.lineTo(-10, 13); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); }
  }
  if (S.sab?.k === 'heat') { const a = 0.18 + 0.14 * Math.sin(t * 6), g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85); g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, `rgba(255,40,60,${a + 0.2})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (S.sab?.k === 'comms') { ctx.fillStyle = 'rgba(120,180,255,.05)'; for (let i = 0; i < 6; i++) ctx.fillRect(0, Math.random() * H, W, 2); }
  if (R.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${R.flash})`; ctx.fillRect(0, 0, W, H); R.flash = Math.max(0, R.flash - dt * 2.5); }
}

// ---------- monitor das câmeras de segurança (4 imagens ao mesmo tempo) ----------
const FB = { c: 0, h: 0, o: 0, a: 0, m: 0, s: 0 };
function renderCams(S) {
  const t = R.t; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#02060a'; ctx.fillRect(0, 0, W, H);
  const gap = 14, bar = 76, cw = (W - gap * 3) / 2, ch = (H - gap * 3 - bar) / 2, z = Math.min(cw, ch) / 600;
  CAMS.forEach((c, i) => {
    const cx = gap + (i % 2) * (cw + gap), cy = gap + Math.floor(i / 2) * (ch + gap), feed = S.cams[i] || [[], []];
    ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, cw, ch); ctx.clip(); ctx.fillStyle = '#060a16'; ctx.fillRect(cx, cy, cw, ch);
    ctx.translate(cx + cw / 2 - c.vx * z, cy + ch / 2 - c.vy * z); ctx.scale(z, z);
    const x0 = c.vx - cw / 2 / z - 40, x1 = c.vx + cw / 2 / z + 40, y0 = c.vy - ch / 2 / z - 40, y1 = c.vy + ch / 2 / z + 40, hit = r => r.x + r.w + 20 > x0 && r.x - 20 < x1 && r.y + r.h + 20 > y0 && r.y - 20 < y1;
    ctx.fillStyle = '#0d1426'; for (const r of RECTS) if (hit(r)) ctx.fillRect(r.x - 18, r.y - 18, r.w + 36, r.h + 36);
    for (const r of RECTS) if (hit(r)) ctx.drawImage(BAKE.get(r.id) || bake(r), r.x, r.y);
    for (const b of feed[1]) { ctx.save(); ctx.translate(b[1], b[2]); ctx.rotate(1.35); drawCrew(ctx, (S.roster.get(b[0]) || { look: FB }).look, 0, 14, { t, dead: true }); ctx.restore(); }
    for (const p of feed[0].slice().sort((a, b) => a[2] - b[2])) drawCrew(ctx, (S.roster.get(p[5]) || S.roster.get(p[0]) || { look: FB }).look, p[1], p[2], { t: t + p[0], moving: !!p[4], face: p[3] });
    ctx.restore();
    ctx.fillStyle = 'rgba(30,90,50,.16)'; ctx.fillRect(cx, cy, cw, ch); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let y = cy; y < cy + ch; y += 4) ctx.fillRect(cx, y, cw, 2);
    ctx.strokeStyle = '#2a4a3a'; ctx.lineWidth = 2; ctx.strokeRect(cx, cy, cw, ch);
    ctx.font = '800 18px "Baloo 2",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#e9f1ff'; ctx.fillText(`CAM ${i + 1} · ${c.name}`, cx + 14, cy + 28);
    if (Math.sin(t * 4 + i) > 0) { ctx.fillStyle = '#ff3b52'; ctx.beginPath(); ctx.arc(cx + cw - 22, cy + 22, 7, 0, TAU); ctx.fill(); }
  });
}
