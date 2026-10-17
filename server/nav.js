// Navegação dos bots: grade de 40px sobre o mapa + A* com suavização por linha de visão.
import { canStand, WORLD } from '../shared/map.js';
const C = 40, GW = Math.ceil(WORLD.w / C), GH = Math.ceil(WORLD.h / C), N = GW * GH;
const OK = new Uint8Array(N);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) OK[j * GW + i] = canStand(i * C + C / 2, j * C + C / 2, 15) ? 1 : 0;
const cellOf = (x, y) => [Math.max(0, Math.min(GW - 1, Math.floor(x / C))), Math.max(0, Math.min(GH - 1, Math.floor(y / C)))];
function snap(x, y) {
  const [i, j] = cellOf(x, y); if (OK[j * GW + i]) return [i, j];
  for (let r = 1; r < 14; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const a = i + di, b = j + dj;
    if (a >= 0 && b >= 0 && a < GW && b < GH && OK[b * GW + a]) return [a, b];
  }
  return null;
}
export function los(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 10);
  for (let k = 1; k <= n; k++) { const t = k / n; if (!canStand(ax + (bx - ax) * t, ay + (by - ay) * t, 14)) return false; }
  return true;
}
class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { let i = this.k.length; this.k.push(key); this.v.push(val); while (i > 0) { const p = (i - 1) >> 1; if (this.k[p] <= key) break; this.k[i] = this.k[p]; this.v[i] = this.v[p]; i = p; } this.k[i] = key; this.v[i] = val; }
  pop() {
    const rv = this.v[0], lk = this.k.pop(), lv = this.v.pop(), n = this.k.length;
    if (n > 0) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && this.k[c + 1] < this.k[c]) c++; if (this.k[c] >= lk) break; this.k[i] = this.k[c]; this.v[i] = this.v[c]; i = c; } this.k[i] = lk; this.v[i] = lv; }
    return rv;
  }
}
const D8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
// Retorna lista de pontos {x,y} do caminho (já suavizada) ou null se não houver caminho.
// blk (opcional): retângulos congelados que devem ser tratados como paredes.
export function findPath(x0, y0, x1, y1, blk) {
  const inB = (i, j) => { if (!blk || !blk.length) return false; const x = i * C + C / 2, y = j * C + C / 2; for (const r of blk) if (x + 14 > r.x && x - 14 < r.x + r.w && y + 14 > r.y && y - 14 < r.y + r.h) return true; return false; };
  const s = snap(x0, y0), g = snap(x1, y1); if (!s || !g) return null; if (inB(g[0], g[1])) return null;
  const si = s[1] * GW + s[0], gi = g[1] * GW + g[0], gs = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), closed = new Uint8Array(N), h = new Heap();
  const hf = (i, j) => { const dx = Math.abs(i - g[0]), dy = Math.abs(j - g[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  gs[si] = 0; h.push(hf(s[0], s[1]), si); let found = false;
  while (h.size) {
    const cur = h.pop(); if (closed[cur]) continue; closed[cur] = 1; if (cur === gi) { found = true; break; }
    const ci = cur % GW, cj = (cur / GW) | 0;
    for (const [dx, dy, w] of D8) {
      const a = ci + dx, b = cj + dy; if (a < 0 || b < 0 || a >= GW || b >= GH) continue; const ni = b * GW + a; if (!OK[ni] || closed[ni] || inB(a, b)) continue;
      if (dx && dy && (!OK[cj * GW + a] || !OK[b * GW + ci])) continue; // sem cortar quina
      const ng = gs[cur] + w; if (ng < gs[ni]) { gs[ni] = ng; prev[ni] = cur; h.push(ng + hf(a, b), ni); }
    }
  }
  if (!found) return null;
  const cells = []; for (let c = gi; c !== -1; c = prev[c]) cells.push(c); cells.reverse();
  const pts = cells.map(c => ({ x: (c % GW) * C + C / 2, y: ((c / GW) | 0) * C + C / 2 }));
  if (canStand(x1, y1, 14)) pts[pts.length - 1] = { x: x1, y: y1 };
  const out = []; let a = { x: x0, y: y0 }, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(a.x, a.y, pts[j].x, pts[j].y)) j--; out.push(pts[j]); a = pts[j]; i = j + 1; }
  return out;
}
