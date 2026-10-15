// Minigames das tarefas. Cada jogo recebe (corpo, vencer, estado) e é limpo ao fechar.
import { sfx } from './audio.js';
export const TASK_MIN = { wires: 2000, code: 2200, calibrate: 1500, fuel: 3200, reboot: 2000, order: 2200 };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const SVG = (n, a) => { const e = document.createElementNS('http://www.w3.org/2000/svg', n); for (const k in a) e.setAttribute(k, a[k]); return e; };
const shake = el => { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); sfx('bad'); };

const GAMES = {
  wires(b, win) {
    const cols = ['#ff4f6d', '#ffd93d', '#4aa8ff', '#6bd968'], Lc = shuffle([0, 1, 2, 3]), Rc = shuffle([0, 1, 2, 3]);
    b.innerHTML = '<p class="hint">Ligue os fios da mesma cor.</p><svg width="360" height="250" viewBox="0 0 360 250"></svg>'; const svg = b.querySelector('svg'); let sel = -1, done = 0; const used = new Set();
    const left = [];
    for (let i = 0; i < 4; i++) {
      svg.append(SVG('rect', { x: 0, y: 22 + i * 60, width: 26, height: 26, rx: 6, fill: '#2a3556' }), SVG('rect', { x: 334, y: 22 + i * 60, width: 26, height: 26, rx: 6, fill: '#2a3556' }));
      const l = SVG('circle', { cx: 26, cy: 35 + i * 60, r: 12, fill: cols[Lc[i]], class: 'node' }), r = SVG('circle', { cx: 334, cy: 35 + i * 60, r: 12, fill: cols[Rc[i]], class: 'node' });
      l.onclick = () => { if (used.has(i)) return; sel = i; left.forEach(n => n.setAttribute('stroke', 'none')); l.setAttribute('stroke', '#fff'); l.setAttribute('stroke-width', 3); sfx('click'); };
      r.onclick = () => {
        if (sel < 0) return;
        if (Lc[sel] !== Rc[i]) { shake(svg); return; }
        svg.insertBefore(SVG('line', { x1: 38, y1: 35 + sel * 60, x2: 322, y2: 35 + i * 60, stroke: cols[Lc[sel]], 'stroke-width': 8, 'stroke-linecap': 'round' }), svg.firstChild);
        used.add(sel); left[sel].setAttribute('stroke', 'none'); sel = -1; sfx('node'); if (++done === 4) win();
      };
      left.push(l); svg.append(l, r);
    }
  },
  code(b, win, st) {
    const gen = () => Array.from({ length: 5 }, () => 1 + Math.floor(Math.random() * 9)).join('');
    b.innerHTML = '<p class="hint"></p><div class="disp"></div><div class="pad"></div>'; const hint = b.querySelector('.hint'), disp = b.querySelector('.disp'), pad = b.querySelector('.pad');
    let code = gen(), typed = '', show = true, t0 = performance.now();
    const press = d => { if (show) return; sfx('click'); typed += d; disp.textContent = typed.padEnd(5, '•').split('').join(' '); if (typed.length === 5) { if (typed === code) win(); else { shake(disp); code = gen(); typed = ''; show = true; t0 = performance.now(); } } };
    for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) { const k = document.createElement('button'); k.textContent = d; k.onclick = () => press(String(d)); pad.append(k); }
    st.key = e => { if (/^[0-9]$/.test(e.key)) press(e.key); };
    (function loop() { const el = (performance.now() - t0) / 1000; if (show) { hint.textContent = 'Memorize o código…'; disp.textContent = code.split('').join(' '); if (el > 2) { show = false; typed = ''; hint.textContent = 'Digite o código.'; disp.textContent = '• • • • •'; } } st.raf = requestAnimationFrame(loop); })();
  },
  calibrate(b, win, st) {
    b.innerHTML = '<p class="hint">Pare o indicador na zona verde — 3 vezes. <b class="n">0/3</b></p><div class="cal"><div class="zone"></div><div class="ind"></div></div><button class="big">CALIBRAR</button>';
    const zone = b.querySelector('.zone'), ind = b.querySelector('.ind'), n = b.querySelector('.n'); let x = 0, dir = 1, sp = 0.9, hits = 0, z = 0, last = performance.now();
    const nz = () => { z = 0.12 + Math.random() * 0.6; zone.style.left = z * 100 + '%'; zone.style.width = '22%'; }; nz();
    const hit = () => { if (x >= z && x <= z + 0.22) { hits++; sp *= 1.25; sfx('node'); n.textContent = hits + '/3'; if (hits >= 3) return win(); nz(); } else { shake(b.querySelector('.cal')); hits = 0; sp = 0.9; n.textContent = '0/3'; } };
    b.querySelector('.big').onclick = hit; st.key = e => { if (e.code === 'Space') hit(); };
    (function loop(t) { const dt = (t - last) / 1000; last = t; x += dir * sp * dt; if (x > 1) { x = 1; dir = -1; } if (x < 0) { x = 0; dir = 1; } ind.style.left = x * 100 + '%'; st.raf = requestAnimationFrame(loop); })(last);
  },
  fuel(b, win, st) {
    b.innerHTML = '<p class="hint">Segure o botão até encher o tanque.</p><div class="tank"><div class="fill"></div></div><button class="big">SEGURAR</button>';
    const fill = b.querySelector('.fill'), btn = b.querySelector('.big'); let v = 0, held = false, last = performance.now(), fin = false, tk = 0;
    btn.onpointerdown = () => held = true; addEventListener('pointerup', st.up = () => held = false);
    st.key = e => { if (e.code === 'Space') held = e.type === 'keydown'; };
    (function loop(t) { const dt = Math.min(0.1, (t - last) / 1000); last = t; v = Math.max(0, Math.min(1, v + (held ? dt / 3.2 : -dt / 2))); fill.style.height = v * 100 + '%'; if (held && (tk += dt) > 0.15) { sfx('step'); tk = 0; } if (v >= 1 && !fin) { fin = true; win(); } st.raf = requestAnimationFrame(loop); })(last);
  },
  reboot(b, win) { seq(b, win, shuffle([1, 2, 3, 4, 5, 6]), 'Execute os comandos em ordem crescente.', v => 'CMD ' + v); },
  order(b, win) { const vals = shuffle([12, 27, 41, 58, 76]); seq(b, win, vals, 'Ligue os módulos do menor para o maior nível.', v => `<i style="height:${v}%"></i><span>${v}%</span>`, true); },
};
function seq(b, win, items, label, fmt, bars) {
  b.innerHTML = `<p class="hint">${label}</p><div class="grid ${bars ? 'bars' : ''}"></div>`; const g = b.querySelector('.grid'), order = [...items].sort((a, c) => a - c); let i = 0;
  for (const v of items) { const k = document.createElement('button'); k.innerHTML = fmt(v); k.onclick = () => { if (v === order[i]) { k.classList.add('on'); k.disabled = true; sfx('node'); if (++i === order.length) win(); } else { shake(g); i = 0; g.querySelectorAll('button').forEach(x => { x.classList.remove('on'); x.disabled = false; }); } }; g.append(k); }
}
export function openTask(type, title, done, cancel) {
  const ov = document.getElementById('task'); ov.innerHTML = ''; ov.classList.add('on');
  const card = document.createElement('div'); card.className = 'card'; card.innerHTML = '<div class="ttl"><b></b><button class="x" aria-label="Fechar">✕</button></div><div class="body"></div>'; card.querySelector('b').textContent = title; ov.append(card);
  const st = { raf: 0 }; let closed = false;
  const kd = e => { if (e.key === 'Escape') close(false); else st.key?.(e); };
  const close = ok => { if (closed) return; closed = true; cancelAnimationFrame(st.raf); removeEventListener('keydown', kd); removeEventListener('keyup', kd); st.up && removeEventListener('pointerup', st.up); ov.classList.remove('on'); ov.innerHTML = ''; ok ? done() : cancel?.(); };
  addEventListener('keydown', kd); addEventListener('keyup', kd); card.querySelector('.x').onclick = () => close(false);
  GAMES[type](card.querySelector('.body'), () => { sfx('ok'); card.classList.add('win'); setTimeout(() => close(true), 650); }, st);
  return close;
}
