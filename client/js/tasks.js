// Minigames das tarefas. Cada jogo recebe (corpo, vencer, estado) e é limpo ao fechar.
import { sfx } from './audio.js';
export const TASK_MIN = { wires: 2000, code: 2200, calibrate: 1500, fuel: 3200, reboot: 2000, order: 2200, simon: 3500, memory: 3500, sliders: 2500, spot: 2500, pump: 4000, swipe: 2000 };
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
    st.key = e => { if (e.type === 'keydown' && /^[0-9]$/.test(e.key)) press(e.key); };
    (function loop() { const el = (performance.now() - t0) / 1000; if (show) { hint.textContent = 'Memorize o código…'; disp.textContent = code.split('').join(' '); if (el > 2) { show = false; typed = ''; hint.textContent = 'Digite o código.'; disp.textContent = '• • • • •'; } } st.raf = requestAnimationFrame(loop); })();
  },
  calibrate(b, win, st) {
    b.innerHTML = '<p class="hint">Pare o indicador na zona verde — 3 vezes. <b class="n">0/3</b></p><div class="cal"><div class="zone"></div><div class="ind"></div></div><button class="big">CALIBRAR</button>';
    const zone = b.querySelector('.zone'), ind = b.querySelector('.ind'), n = b.querySelector('.n'); let x = 0, dir = 1, sp = 0.9, hits = 0, z = 0, last = performance.now();
    const nz = () => { z = 0.12 + Math.random() * 0.6; zone.style.left = z * 100 + '%'; zone.style.width = '22%'; }; nz();
    const hit = () => { if (x >= z && x <= z + 0.22) { hits++; sp *= 1.25; sfx('node'); n.textContent = hits + '/3'; if (hits >= 3) return win(); nz(); } else { shake(b.querySelector('.cal')); hits = 0; sp = 0.9; n.textContent = '0/3'; } };
    b.querySelector('.big').onclick = hit; st.key = e => { if (e.type === 'keydown' && !e.repeat && e.code === 'Space') { e.preventDefault(); hit(); } };
    (function loop(t) { const dt = (t - last) / 1000; last = t; x += dir * sp * dt; if (x > 1) { x = 1; dir = -1; } if (x < 0) { x = 0; dir = 1; } ind.style.left = x * 100 + '%'; st.raf = requestAnimationFrame(loop); })(last);
  },
  fuel(b, win, st) {
    b.innerHTML = '<p class="hint">Segure o botão até encher o tanque.</p><div class="tank"><div class="fill"></div></div><button class="big">SEGURAR</button>';
    const fill = b.querySelector('.fill'), btn = b.querySelector('.big'); let v = 0, held = false, last = performance.now(), fin = false, tk = 0;
    btn.onpointerdown = () => held = true; addEventListener('pointerup', st.up = () => held = false); addEventListener('pointercancel', st.up);
    st.wantUp = true; st.key = e => { if (e.code === 'Space') held = e.type === 'keydown'; };
    (function loop(t) { const dt = Math.min(0.1, (t - last) / 1000); last = t; v = Math.max(0, Math.min(1, v + (held ? dt / 3.2 : -dt / 2))); fill.style.height = v * 100 + '%'; if (held && (tk += dt) > 0.15) { sfx('step'); tk = 0; } if (v >= 1 && !fin) { fin = true; win(); } st.raf = requestAnimationFrame(loop); })(last);
  },

  // ---- v1.0: novas tarefas ----
  simon(b, win, st) { // sequência: repita a ordem das luzes (5 passos)
    const cols = ['#ff4f6d', '#ffd93d', '#4aa8ff', '#6bd968']; b.innerHTML = '<p class="hint"></p><div class="pads"></div>'; const hint = b.querySelector('.hint'), pads = b.querySelector('.pads');
    let seqv = [], pos = 0, lock = true, alive = true; const pd = cols.map((c, i) => { const k = document.createElement('button'); k.style.setProperty('--c', c); k.onclick = () => press(i); pads.append(k); return k; });
    const flash = (i, ms = 380) => { pd[i].classList.add('lit'); sfx('node'); return new Promise(r => setTimeout(() => { pd[i].classList.remove('lit'); setTimeout(r, 140); }, ms)); };
    const play = async () => { lock = true; pos = 0; seqv = Array.from({ length: 5 }, () => Math.floor(Math.random() * 4)); hint.textContent = 'Observe a sequência…'; await new Promise(r => setTimeout(r, 500)); for (const i of seqv) { if (!alive) return; await flash(i); } lock = false; hint.textContent = 'Sua vez: repita a sequência.'; };
    const press = i => { if (lock) return; flash(i, 160); if (i !== seqv[pos]) { shake(pads); play(); return; } if (++pos === seqv.length) { lock = true; win(); } };
    st.stop = () => { alive = false; }; play();
  },
  memory(b, win) { // combinação: encontre os 6 pares
    const sy = shuffle(['⚗', '☢', '⚙', '✦', '☄', '❄']); const cards = shuffle([...sy, ...sy]); b.innerHTML = '<p class="hint">Encontre todos os pares. <b class="n">0/6</b></p><div class="mem"></div>'; const g = b.querySelector('.mem'), n = b.querySelector('.n'); let open = [], found = 0, busy = false;
    cards.forEach(s => { const k = document.createElement('button'); k.textContent = '?'; k.onclick = () => { if (busy || k.classList.contains('on') || open.includes(k)) return; k.textContent = s; k.classList.add('on'); sfx('click'); open.push(k); if (open.length === 2) { const [a, c] = open; open = []; if (a.textContent === c.textContent) { a.classList.add('ok'); c.classList.add('ok'); sfx('node'); n.textContent = ++found + '/6'; if (found === 6) win(); } else { busy = true; sfx('bad'); setTimeout(() => { for (const x of [a, c]) { x.textContent = '?'; x.classList.remove('on'); } busy = false; }, 650); } } }; g.append(k); });
  },
  sliders(b, win) { // ajuste três controles até a marca
    b.innerHTML = '<p class="hint">Alinhe cada controle com a marca verde.</p><div class="slid"></div><button class="big">CONFIRMAR</button>'; const box = b.querySelector('.slid'), rows = [];
    for (let i = 0; i < 3; i++) { const tg = 15 + Math.floor(Math.random() * 70), w = document.createElement('div'); w.className = 'srow'; w.innerHTML = `<i class="mk" style="left:${tg}%"></i><input type="range" min="0" max="100" value="${Math.random() < 0.5 ? 3 : 97}">`; const inp = w.querySelector('input'); inp.oninput = () => { w.classList.toggle('good', Math.abs(+inp.value - tg) <= 5); }; box.append(w); rows.push({ inp, tg }); }
    b.querySelector('.big').onclick = () => { if (rows.every(r => Math.abs(+r.inp.value - r.tg) <= 5)) win(); else shake(box); };
  },
  spot(b, win) { // observação: ache o símbolo diferente (3 rodadas)
    const pairs = [['O', 'Q'], ['I', 'l'], ['E', 'F'], ['8', 'B'], ['M', 'N'], ['5', 'S']]; let round = 0;
    b.innerHTML = '<p class="hint"></p><div class="spotg"></div>'; const hint = b.querySelector('.hint'), g = b.querySelector('.spotg');
    const next = () => { hint.textContent = `Toque no símbolo diferente — rodada ${round + 1}/3`; g.innerHTML = ''; const [a, c] = pairs[Math.floor(Math.random() * pairs.length)], odd = Math.floor(Math.random() * 25); for (let i = 0; i < 25; i++) { const k = document.createElement('button'); k.textContent = i === odd ? c : a; k.onclick = () => { if (i === odd) { sfx('node'); if (++round === 3) win(); else next(); } else { shake(g); round = 0; next(); } }; g.append(k); } };
    next();
  },
  pump(b, win, st) { // várias etapas: ligar → pressurizar na zona verde → travar
    b.innerHTML = '<p class="hint"></p><div class="pgauge"><div class="pzone"></div><div class="pfill"></div></div><button class="big"></button>'; const hint = b.querySelector('.hint'), fill = b.querySelector('.pfill'), zone = b.querySelector('.pzone'), btn = b.querySelector('.big');
    let stage = 0, v = 0, inZ = 0, last = performance.now(); const z0 = 0.55, z1 = 0.8; zone.style.bottom = z0 * 100 + '%'; zone.style.height = (z1 - z0) * 100 + '%';
    const label = () => { hint.textContent = ['Etapa 1/3: ligue o reator.', 'Etapa 2/3: bombeie e mantenha a pressão na zona verde por 1,5 s.', 'Etapa 3/3: trave a válvula.'][stage]; btn.textContent = ['LIGAR', 'BOMBEAR', 'TRAVAR'][stage]; }; label();
    btn.onclick = () => { if (stage === 0) { stage = 1; sfx('node'); label(); } else if (stage === 1) { v = Math.min(1, v + 0.09); sfx('click'); } else { if (v >= z0 && v <= z1) win(); else { shake(b.querySelector('.pgauge')); stage = 1; inZ = 0; label(); } } };
    (function loop(t) { const dt = Math.min(0.1, (t - last) / 1000); last = t; if (stage === 1) { v = Math.max(0, v - dt * 0.22); if (v >= z0 && v <= z1) { inZ += dt; if (inZ >= 1.5) { stage = 2; sfx('node'); label(); } } else inZ = 0; } fill.style.height = v * 100 + '%'; st.raf = requestAnimationFrame(loop); })(last);
  },
  swipe(b, win) { // interação com objeto: deslize o cartão na velocidade certa
    b.innerHTML = '<p class="hint">Deslize o cartão da esquerda para a direita, nem rápido nem devagar.</p><div class="swp"><div class="track"></div><div class="card2s">▤</div></div><p class="hint msg"></p>'; const box = b.querySelector('.swp'), cd = b.querySelector('.card2s'), msg = b.querySelector('.msg'); let t0 = 0, drag = false, sx = 0;
    const W = () => box.clientWidth - cd.offsetWidth; cd.style.left = '0px';
    cd.onpointerdown = e => { drag = true; sx = e.clientX; t0 = performance.now(); cd.setPointerCapture(e.pointerId); msg.textContent = ''; };
    cd.onpointermove = e => { if (!drag) return; cd.style.left = Math.max(0, Math.min(W(), e.clientX - sx)) + 'px'; };
    const end = () => { if (!drag) return; drag = false; const x = parseFloat(cd.style.left) || 0, dt = performance.now() - t0; cd.style.left = '0px'; if (x < W() - 4) { msg.textContent = 'Deslize até o fim.'; shake(box); } else if (dt < 450) { msg.textContent = 'Rápido demais!'; shake(box); } else if (dt > 1500) { msg.textContent = 'Devagar demais!'; shake(box); } else win(); };
    cd.onpointerup = end; cd.onpointercancel = end;
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
  const kd = e => { if (e.key === 'Escape') close(false); else if (e.type === 'keydown' || st.wantUp) st.key?.(e); };
  const close = ok => { if (closed) return; closed = true; cancelAnimationFrame(st.raf); removeEventListener('keydown', kd); removeEventListener('keyup', kd); st.stop?.(); if (st.up) { removeEventListener('pointerup', st.up); removeEventListener('pointercancel', st.up); } ov.classList.remove('on'); ov.innerHTML = ''; ok ? done() : cancel?.(); };
  addEventListener('keydown', kd); addEventListener('keyup', kd); card.querySelector('.x').onclick = () => close(false);
  GAMES[type](card.querySelector('.body'), () => { sfx('ok'); card.classList.add('win'); setTimeout(() => close(true), 650); }, st);
  return close;
}
