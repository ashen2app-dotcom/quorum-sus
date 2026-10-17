// Telas DOM: menus, lobby, personalização, configurações, reunião e fim de partida.
import { drawCrew, setQuality } from './render.js';
import { COLORS, COLOR_NAMES, HATS, OUTFITS, ACCS, MASCOTS, SKINS } from '/shared/cosmetics.js';
export const TAKEN = new Set(); // cores ocupadas por outros jogadores (atualizado pelo lobby)
const UI_TOAST = m => toast(m);
import { sfx, setVol, A } from './audio.js';
import { JOBS, JOB, PARAMS, BOT_PARAMS, TEAMS, SETTING_LIMITS } from '/shared/jobs.js';
const $ = id => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

export function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
let tt = 0; export function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), ms); }

// ---------- animação de vitrine (lobby / personalização) ----------
let animFn = null, raf = 0;
function loop(t) { animFn && animFn(t / 1000); raf = requestAnimationFrame(loop); }
export function setAnim(fn) { animFn = fn; if (fn && !raf) raf = requestAnimationFrame(loop); if (!fn) { cancelAnimationFrame(raf); raf = 0; } }

// ---------- lobby ----------
const SET = [['impostors', 'Infiltrados', 0, 3, 1, v => v || 'Auto'], ['speed', 'Velocidade', 0.75, 1.5, 0.25, v => v + 'x'], ['vision', 'Visão', 0.5, 1.5, 0.25, v => v + 'x'],
  ['discuss', 'Tempo de discussão', 10, 120, 5, v => v + 's'], ['vote', 'Tempo de votação', 10, 120, 5, v => v + 's'], ['tasks', 'Tarefas por jogador', 1, 8, 1, v => v],
  ['killCd', 'Recarga da eliminação', 10, 45, 1, v => v + 's'], ['emergencies', 'Reuniões de emergência', 0, 3, 1, v => v], ['emergCd', 'Recarga do botão de emergência', 0, 60, 5, v => v + 's'], ['confirm', 'Revelar função do expulso', 0, 1, 1, v => (v ? 'Sim' : 'Não')]];
let LB = null;
export const STAGE = { hits: [] };
export function renderLobby(L, myId, send, minPlayers = 4) {
  LB = L; renderJobs(L, myId, send); const host = L.host === myId; $('lCode').textContent = L.code;
  const total = L.players.length; $('lCount').textContent = `${total}/15 jogadores · mínimo ${minPlayers}`;
  const box = $('lSet'); box.innerHTML = '';
  for (const [k, label, min, max, step, fmt] of SET) {
    const w = el('div', 'set'); const b = el('b', null, fmt(L.settings[k])); w.append(el('span', null, label), b);
    const r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = L.settings[k]; r.disabled = !host;
    r.oninput = () => b.textContent = fmt(+r.value); r.onchange = () => send({ t: 'set', k, v: +r.value }); w.append(r); box.append(w);
  }
  const p = el('label', 'set'); p.append(el('span', null, 'Sala pública (aparece em JOGAR)')); const c = el('input'); c.type = 'checkbox'; c.checked = L.pub; c.disabled = !host; c.onchange = () => send({ t: 'set', k: 'pub', v: c.checked }); p.append(c); box.append(p);
  $('lStart').disabled = !host || total < minPlayers; $('lStart').textContent = host ? 'COMEÇAR' : 'AGUARDANDO O DONO';
}
export function drawStage() {
  const cv = $('stage'), c = cv.getContext('2d'), w = cv.width, h = cv.height; c.clearRect(0, 0, w, h);
  const g = c.createRadialGradient(w / 2, h, 20, w / 2, h, w * 0.6); g.addColorStop(0, 'rgba(45,226,197,.22)'); g.addColorStop(1, 'rgba(45,226,197,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  if (!LB) return; const hits = []; STAGE.hits = hits; const ps = LB.players, rows = ps.length > 8 ? 2 : 1, per = Math.ceil(ps.length / rows), t = performance.now() / 1000;
  ps.forEach((p, i) => {
    const row = Math.floor(i / per), idx = i % per, cnt = Math.min(per, ps.length - row * per), x = (w / (cnt + 1)) * (idx + 1), y = rows === 1 ? 250 : 170 + row * 150, s = rows === 1 ? 2.2 : 1.6;
    drawCrew(c, p.look, x, y + Math.max(0, Math.sin(t * 2 + i)) * -4, { t: t + i, s, alpha: p.dc ? 0.4 : 1 });
    hits.push({ id: p.id, x0: x - 30 * s, x1: x + 30 * s, y0: y - 52 * s, y1: y + 30 });
    c.fillStyle = '#e9f1ff'; c.font = '700 18px "Baloo 2",sans-serif'; c.textAlign = 'center'; c.fillText((p.id === LB.host ? '👑 ' : '') + p.name, x, y + 26);
  });
}

// ---------- personalização ----------
const ROWS = [['Chapéu', 'h', HATS], ['Roupa', 'o', OUTFITS], ['Acessório', 'a', ACCS], ['Mascote', 'm', MASCOTS], ['Skin', 's', SKINS]];
let draft = null;
export function initCustom(look, onSave) {
  draft = { ...look }; const box = $('cOpts'); box.innerHTML = '';
  const cr = el('div', 'opt'); cr.append(el('label', null, 'Cor')); const sw = el('div', 'sw');
  COLORS.forEach((col, i) => { const d = el('i'), busy = TAKEN.has(i) && i !== look.c; d.style.background = col; d.title = COLOR_NAMES[i] + (busy ? ' (em uso)' : ''); d.className = (i === draft.c ? 'on' : '') + (busy ? ' busy' : ''); d.onclick = () => { if (busy) return UI_TOAST('Essa cor já está em uso por outro jogador.'); draft.c = i; sw.querySelectorAll('i').forEach((x, j) => x.classList.toggle('on', j === i)); sfx('click'); }; sw.append(d); }); cr.append(sw); box.append(cr);
  for (const [label, k, arr] of ROWS) {
    const r = el('div', 'opt'), v = el('span', 'v', arr[draft[k]]), mk = d => { const b = el('button', null, d < 0 ? '‹' : '›'); b.onclick = () => { draft[k] = (draft[k] + d + arr.length) % arr.length; v.textContent = arr[draft[k]]; sfx('click'); }; return b; };
    r.append(el('label', null, label), mk(-1), v, mk(1)); box.append(r);
  }
  $('cSave').onclick = () => onSave({ ...draft });
}
export function drawPrev() { const cv = $('prev'), c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); if (draft) drawCrew(c, draft, 170, 250, { t: performance.now() / 1000, s: 3.2 }); }

// ---------- configurações ----------
export function initSettings(P, save, onDevice) {
  const box = $('sOpts'); box.innerHTML = '';
  for (const [k, label] of [['master', 'Volume geral'], ['music', 'Música'], ['sfx', 'Efeitos']]) {
    const w = el('div', 'set'); w.append(el('span', null, label)); const r = el('input'); r.type = 'range'; r.min = 0; r.max = 1; r.step = 0.05; r.value = A.vol[k]; r.oninput = () => { setVol(k, +r.value); P.vol = { ...A.vol }; save(); }; w.append(r); box.append(w);
  }
  const q = el('div', 'set'); q.append(el('span', null, 'Qualidade gráfica')); const s = el('select'); ['Baixa', 'Média', 'Alta'].forEach((n, i) => { const o = el('option', null, n); o.value = i; s.append(o); }); s.value = P.q; s.onchange = () => { P.q = +s.value; setQuality(P.q); save(); }; q.append(s); box.append(q);
  const ar = el('div', 'set'); ar.append(el('span', null, 'Setas de tarefas')); const sa = el('select'); ['Todas', '3 mais próximas', 'Desligadas'].forEach((n, i) => { const o = el('option', null, n); o.value = i; sa.append(o); }); sa.value = P.arr || 0; sa.onchange = () => { P.arr = +sa.value; save(); }; ar.append(sa); box.append(ar);
  const dv = el('div', 'set'); dv.append(el('span', null, 'Dispositivo')); const sd = el('select'); [['pc', 'Computador'], ['mobile', 'Celular']].forEach(([v, n]) => { const o = el('option', null, n); o.value = v; sd.append(o); }); sd.value = P.device || 'pc'; sd.onchange = () => onDevice && onDevice(sd.value); dv.append(sd); box.append(dv);
  const f = el('button', 'btn', 'TELA CHEIA'); f.onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); box.append(f);
}

// ---------- reunião ----------
const M = { sel: null, voted: false, phase: 'meet', cards: new Map(), ctx: null, t0: 0, dur: 1, iv: 0 };
export function openMeeting(m, ctx) {
  Object.assign(M, { sel: null, voted: false, phase: 'meet', ctx, t0: performance.now(), dur: m.time * 1000 }); M.cards.clear();
  $('eject').classList.remove('on'); $('chLog').innerHTML = ''; show('meeting');
  const by = ctx.roster.get(m.by)?.name || '?'; $('mTitle').textContent = m.reason === 'body' ? `${by} encontrou um corpo!` : `${by} chamou uma reunião de emergência`;
  const list = $('mList'); list.innerHTML = '';
  for (const [id, p] of ctx.roster) {
    const dead = !m.alive.includes(id), card = el('div', 'card2' + (dead ? ' dead' : '')), cv = el('canvas'); cv.width = 100; cv.height = 124;
    drawCrew(cv.getContext('2d'), p.look, 50, 118, { s: 1.4, ghost: dead, alpha: dead ? 0.6 : 1, dead });
    card.append(cv, el('div', 'nm', p.name), el('div', 'vs')); if (ctx.mates && ctx.mates.has(id) && id !== ctx.me) card.append(el('span', 'chip ally', 'ALIADO')); if (m.off && m.off.includes(id)) card.append(el('span', 'chip off', 'OFFLINE')); else if (m.gone && m.gone.includes(id)) card.append(el('span', 'chip off', 'SAIU'));
    card.onclick = () => { if (M.phase !== 'vote' || dead || M.voted || !ctx.alive) return; M.sel = id; M.cards.forEach(c => c.classList.remove('sel')); card.classList.add('sel'); $('mVote').disabled = false; sfx('click'); };
    M.cards.set(id, card); list.append(card);
  }
  $('mVote').disabled = true; $('mSkip').disabled = true;
  $('mNote').textContent = ctx.alive ? 'Discussão: converse e levante suspeitas.' : 'Você é um fantasma: lê o chat dos vivos, mas só outros fantasmas leem o seu.';
  clearInterval(M.iv); M.iv = setInterval(() => { $('mBar').style.transform = `scaleX(${Math.max(0, 1 - (performance.now() - M.t0) / M.dur)})`; }, 100);
}
export function startVote(time) {
  M.phase = 'vote'; M.t0 = performance.now(); M.dur = time * 1000; $('mTitle').textContent = 'Quem é o infiltrado? Vote!';
  const can = M.ctx.alive && !M.voted; $('mSkip').disabled = !can; $('mNote').textContent = can ? 'Selecione um jogador e confirme, ou pule o voto.' : '';
}
export function lockVote() { M.voted = true; $('mVote').disabled = true; $('mSkip').disabled = true; $('mNote').textContent = 'Voto registrado. Aguardando os demais…'; }
export const selectedVote = () => M.sel;
export function markVoted(id) { const c = M.cards.get(id); if (c && !c.querySelector('.chip.voted')) c.append(el('span', 'chip voted', '✓')); }
export function addChat(m, roster) {
  const p = roster.get(m.id), l = $('chLog'), row = el('p', m.dead ? 'ghost' : ''); const b = el('b', null, (p?.name || '?') + ':'); b.style.color = COLORS[p?.look.c] || '#fff'; row.append(b, document.createTextNode(m.text)); l.append(row); l.scrollTop = l.scrollHeight; if (l.children.length > 80) l.firstChild.remove();
}
export function showResult(m, roster) {
  M.phase = 'result'; $('mVote').disabled = true; $('mSkip').disabled = true; $('mTitle').textContent = 'Resultado da votação'; M.t0 = performance.now(); M.dur = m.time * 1000;
  for (const [tid, voters] of Object.entries(m.votes)) { const vs = M.cards.get(+tid)?.querySelector('.vs'); voters.forEach(v => { const d = el('i'); d.style.background = COLORS[roster.get(v)?.look.c] || '#fff'; vs?.append(d); }); }
  $('mNote').textContent = m.skip.length ? `Votos pulados: ${m.skip.length}` : '';
  setTimeout(() => ejectScene(m, roster), 2200);
}
let ejRaf = 0, ejIv = 0, ejTo = 0;
function ejectScene(m, roster) {
  const e = $('eject'), p = roster.get(m.ejected); cancelAnimationFrame(ejRaf); clearInterval(ejIv); clearTimeout(ejTo); e.innerHTML = ''; e.classList.add('on');
  const cv = el('canvas'); cv.width = innerWidth; cv.height = innerHeight; e.append(cv); const box = el('div', 'etext'); e.append(box); const c = cv.getContext('2d'), W = cv.width, H = cv.height;
  const stars = Array.from({ length: 110 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 1.3 }));
  const lines = p ? [`${p.name} foi ejetado${m.supreme ? ' pelo Voto Supremo' : ''}.`, m.imp === null ? '' : (m.imp ? 'Era um infiltrado.' : 'Não era um infiltrado.'), m.left != null ? `Restam ${m.left} infiltrado(s).` : ''] : ['Ninguém foi ejetado.', 'Empate ou votos pulados.', ''];
  const full = lines.filter(Boolean).join('\n'), t0 = performance.now(); let typed = 0; sfx(p ? 'eject' : 'click');
  (function frame(now) {
    const t = (now - t0) / 1000; c.fillStyle = '#03050f'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff';
    for (const s of stars) { s.x -= 55 * s.z / 60; if (s.x < 0) s.x = W; c.globalAlpha = 0.35 + 0.1 * s.z; c.fillRect(s.x, s.y, s.z * 1.7, s.z * 1.7); } c.globalAlpha = 1;
    if (p && t < 3.6) { const k = t / 3.6, x = -90 + k * (W + 180), y = H * 0.4 + Math.sin(k * 5) * H * 0.07, sc = Math.min(W, H) / 250 * (1 - k * 0.4);
      c.fillStyle = 'rgba(180,220,255,.25)'; for (let i = 1; i < 9; i++) { c.beginPath(); c.arc(x - i * 26 * sc, y - 10 * sc + Math.sin(t * 9 + i) * 6, Math.max(1, 5 * sc - i * 0.4), 0, 6.3); c.fill(); }
      c.save(); c.translate(x, y); c.rotate(t * 5); c.scale(sc, sc); drawCrew(c, p.look, 0, 22, { t, ghost: false }); c.restore(); }
    ejRaf = requestAnimationFrame(frame);
  })(t0);
  ejTo = setTimeout(() => { ejIv = setInterval(() => { box.textContent = full.slice(0, ++typed); if (typed >= full.length) clearInterval(ejIv); }, 45); }, 1100);
}
export function closeMeeting() { clearInterval(M.iv); cancelAnimationFrame(ejRaf); clearInterval(ejIv); clearTimeout(ejTo); $('eject').classList.remove('on'); }

// ---------- profissões (configuração do host) ----------
let jtab = 'inn';
export function renderJobs(L, myId, send) {
  const host = L.host === myId, tabs = $('jTabs'), body = $('jBody'); tabs.innerHTML = ''; body.innerHTML = ''; if (!host && jtab === 'bots') jtab = 'inn';
  for (const [k, label] of [['inn', '🔵 Inocentes'], ['neu', '🟣 Neutros'], ['imp', '🔴 Impostores'], ['rules', '⚙ Regras'], ['bots', '🤖 Bots']].filter(([k]) => k !== 'bots' || host)) { const b = el('button', 'btn' + (jtab === k ? ' main' : ''), label); b.onclick = () => { jtab = k; renderJobs(L, myId, send); }; tabs.append(b); }
  const slider = (label, k, min, max, step, fmt) => { const w = el('div', 'set'), b = el('b', null, fmt(L.settings[k])); w.append(el('span', null, label), b); const r = el('input'); r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = L.settings[k]; r.disabled = !host; r.oninput = () => b.textContent = fmt(+r.value); r.onchange = () => send({ t: 'set', k, v: +r.value }); w.append(r); return w; };
  if (jtab === 'bots') {
    const g = el('div', 'jrow'); g.style.gridColumn = '1/3';
    g.append(el('small', null, 'Bots entram na partida como jogadores normais (mesmas regras, profissões e recargas) e o nome não os identifica. O total de jogadores respeita o limite de 15.'),
      slider('Bots', 'bot_on', 0, 1, 1, v => (v ? 'Ativado' : 'Desativado')), slider('Quantidade de bots', 'bot_n', 0, 14, 1, v => v),
      el('small', null, `Bots efetivos nesta sala: ${L.bots || 0} (limitado pelas vagas livres)`));
    const ta = el('textarea'); ta.rows = 3; ta.placeholder = 'Nomes dos bots, separados por vírgula ou linha (ex.: Ashen, Shadow, Nexus). Vazio = nomes automáticos.'; ta.value = L.botNames || ''; ta.disabled = !host; ta.maxLength = 600; ta.onchange = () => send({ t: 'botnames', text: ta.value }); g.append(ta); body.append(g);
    let last = ''; for (const p of BOT_PARAMS) { if (p.k === 'bot_on' || p.k === 'bot_n') continue; if (p.grp !== last) { body.append(el('div', 'jgrp', p.grp.toUpperCase())); last = p.grp; } const r = el('div', 'jrow'); r.append(slider(p.label, p.k, p.min, p.max, p.step, v => v)); body.append(r); }
    return;
  }
  if (jtab === 'rules') {
    const g = el('div', 'jrow'); g.style.gridColumn = '1/3'; g.append(el('small', null, 'Quantidade de neutros e de impostores. Impostores em “Auto” segue 1/2/3 por tamanho da sala.'), slider('Neutros na partida', 'neutrals', 0, 4, 1, v => v), slider('Impostores (0 = Auto)', 'impostors', 0, 3, 1, v => v || 'Auto')); body.append(g);
    let last = ''; for (const p of PARAMS) { if (p.grp !== last) { body.append(el('div', 'jgrp', p.grp.toUpperCase())); last = p.grp; } const r = el('div', 'jrow'); r.append(slider(p.label, p.k, p.min, p.max, p.step, v => v)); body.append(r); }
    return;
  }
  for (const j of JOBS.filter(x => x.team === jtab)) {
    const row = el('div', 'jrow'), nm = el('b', null, j.name + (j.id === 'mentalista' ? ' ⚫' : '')); nm.style.color = j.color === '#111419' ? '#e9f1ff' : j.color;
    row.append(nm, el('small', null, j.desc + (j.ghost ? ' (só recebida após morrer)' : '')), slider(j.ghost ? 'Chance ao morrer' : 'Chance de aparecer', 'w_' + j.id, 0, 100, 5, v => v + '%'));
    if (j.id !== 'tripulante') row.append(slider('Máximo de jogadores', 'm_' + j.id, 0, SETTING_LIMITS['m_' + j.id][1], 1, v => v)); body.append(row);
  }
}
// ---------- seleção de jogador / mensagem / painel ----------
const lockPick = p => { p.style.pointerEvents = 'none'; clearTimeout(lockPick.t); lockPick.t = setTimeout(() => { p.style.pointerEvents = ''; }, 450); }; // evita o 'clique fantasma' do toque que abriu o seletor
export function pick(title, items, cb) {
  const p = $('pick'), l = $('pkL'); $('pkT').textContent = title; l.innerHTML = '';
  for (const it of items) {
    const b = el('button', 'pk' + (it.dead ? ' dead' : '')), cv = el('canvas'); cv.width = 44; cv.height = 52;
    drawCrew(cv.getContext('2d'), it.look, 22, 46, { s: 0.9, ghost: !!it.dead, dead: !!it.dead, alpha: it.dead ? 0.6 : 1 });
    b.append(cv, el('span', null, (it.dead ? '✕ ' : '') + it.name + (it.note ? ' — ' + it.note : '')));
    if (cb && !it.dead) b.onclick = () => { p.classList.remove('on'); sfx('click'); cb(it.id); }; else b.disabled = true;
    l.append(b);
  }
  $('pkX').onclick = () => p.classList.remove('on'); lockPick(p); p.classList.add('on');
}
export function pickText(title, opts, cb) {
  const p = $('pick'), l = $('pkL'); $('pkT').textContent = title; l.innerHTML = '';
  for (const o of opts) { const b = el('button', 'pk', o.label); b.onclick = () => { p.classList.remove('on'); sfx('click'); cb(o.id); }; l.append(b); }
  $('pkX').onclick = () => p.classList.remove('on'); lockPick(p); p.classList.add('on');
}

// ---------- fim ----------
const WIN = { crew: ['EQUIPE VENCEU', '#2de2c5', 'rgba(20,90,80,.8)'], imp: ['IMPOSTORES VENCERAM', '#ff4f6d', 'rgba(110,15,40,.8)'], joker: ['JOKER VENCEU', '#c3c9d6', 'rgba(70,74,90,.85)'], exec: ['EXECUTION VENCEU', '#ff8a1f', 'rgba(120,60,10,.85)'],
  congelador: ['CONGELADOR VENCEU', '#7DF9FF', 'rgba(20,80,100,.85)'], parinomo: ['PARINOMO VENCEU', '#FFA500', 'rgba(120,60,0,.85)'], virus: ['VÍRUS VENCEU', '#22A447', 'rgba(10,70,30,.85)'], phantom: ['PHANTOM VENCEU', '#FFFFFF', 'rgba(70,74,90,.85)'] };
export function showEnd(m, roster, me) {
  const [title, col, bg] = WIN[m.winner] || WIN.crew, t = $('eTitle'); t.textContent = title; t.style.color = col; t.style.textShadow = `0 0 40px ${col}`;
  $('eReason').textContent = m.reason; const l = $('eList'); l.innerHTML = '';
  for (const [id, role, alive, job] of m.roles) { const p = roster.get(id), J = JOB[job], d = el('div', role === 'imp' ? 'imp' : '', `${p?.name || '?'} · `); const s = el('b', null, J?.name || '?'); s.style.color = J?.color === '#111419' ? '#e9f1ff' : J?.color; d.append(s, document.createTextNode(alive ? '' : ' ☠')); l.append(d); }
  $('end').style.background = `radial-gradient(circle,${bg},rgba(4,8,18,.96))`; show('end');
  const won = m.winner === 'crew' ? me.team !== 'imp' && !['joker', 'execution'].includes(me.job) : m.winner === 'imp' ? me.team === 'imp' : m.winner === 'joker' ? me.job === 'joker' : me.job === 'execution';
  sfx(won ? 'win' : 'lose');
}

// ---------- animação de morte (assassino avança, golpe, vítima cai) ----------
let kRaf = 0;
export function killScene(kLook, vLook, role) {
  document.getElementById('killc')?.remove(); cancelAnimationFrame(kRaf);
  const cv = document.createElement('canvas'); cv.id = 'killc'; cv.width = innerWidth; cv.height = innerHeight; document.body.append(cv);
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, sc = Math.min(W, H) / 150, t0 = performance.now(), DUR = 2.6, STRIKE = 0.55, gy = H * 0.74, vx = W * 0.62, victim = role === 'victim'; sfx('kill');
  (function frame(now) {
    const t = (now - t0) / 1000; if (t > DUR) { cv.remove(); return; }
    cv.style.opacity = t > DUR - 0.45 ? (DUR - t) / 0.45 : 1;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = '#05030a'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W / 2, H * 0.6, 10, W / 2, H * 0.6, Math.max(W, H) * 0.7); g.addColorStop(0, 'rgba(170,20,45,.55)'); g.addColorStop(1, 'rgba(5,3,10,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 2; for (let i = 0; i < 26; i++) { const a = i * 0.2418 + t * 0.35; c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * Math.max(W, H) * 0.14, H * 0.6 + Math.sin(a) * Math.max(W, H) * 0.14); c.lineTo(W / 2 + Math.cos(a) * Math.max(W, H), H * 0.6 + Math.sin(a) * Math.max(W, H)); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(0, gy, W, H - gy);
    const hit = t > STRIKE, k = hit ? Math.min(1, (t - STRIKE) / 0.7) : 0; c.save(); if (t > STRIKE && t < STRIKE + 0.35) c.translate((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
    c.save(); c.translate(vx + k * 26 * sc * 0.4, gy); c.rotate(k * 1.5); c.scale(sc, sc); drawCrew(c, vLook, 0, 0, { t, face: -1, dead: hit }); c.restore();
    if (kLook) { const e = Math.min(1, t / STRIKE), ease = 1 - Math.pow(1 - e, 3), kx = -W * 0.15 + (W * 0.44 + W * 0.15) * ease; c.save(); c.translate(kx, gy); c.rotate(t > STRIKE && t < STRIKE + 0.25 ? 0.22 : 0); c.scale(sc, sc); drawCrew(c, kLook, 0, 0, { t, face: 1, moving: t < STRIKE }); c.restore(); }
    if (t > STRIKE && t < STRIKE + 0.45) { // golpe estilizado (sem gore): riscos de luz e estrela
      const p = Math.min(1, (t - STRIKE) / 0.16), a = 1 - Math.max(0, (t - STRIKE - 0.16) / 0.29); c.save(); c.globalAlpha = a; c.shadowColor = '#fff'; c.shadowBlur = 24; c.strokeStyle = '#fff'; c.lineCap = 'round';
      for (let i = 0; i < 3; i++) { c.lineWidth = (7 - i * 2) * sc * 0.35; c.beginPath(); c.moveTo(vx - 34 * sc + i * 10 * sc, gy - 58 * sc); c.lineTo(vx - 34 * sc + i * 10 * sc + 52 * sc * p, gy - 58 * sc + 52 * sc * p); c.stroke(); }
      c.shadowBlur = 0; c.fillStyle = '#ffd23d'; for (let i = 0; i < 10; i++) { const an = i * 0.628, r = (14 + 60 * (t - STRIKE) * 2) * sc * 0.6; c.beginPath(); c.arc(vx + Math.cos(an) * r, gy - 26 * sc + Math.sin(an) * r, 3 * sc * 0.35, 0, 6.3); c.fill(); } c.restore();
    }
    c.restore();
    if (t > STRIKE + 0.2 && t < STRIKE + 0.28) { c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(0, 0, W, H); }
    if (t < 0.1) { c.fillStyle = `rgba(255,255,255,${0.7 - t * 7})`; c.fillRect(0, 0, W, H); }
    if (victim && t > 1.35) { const a = Math.min(1, (t - 1.35) / 0.35); c.globalAlpha = a; c.fillStyle = '#ff4f6d'; c.textAlign = 'center'; c.font = `800 ${Math.max(28, Math.min(W, H) / 8)}px "Baloo 2",system-ui,sans-serif`; c.shadowColor = '#000'; c.shadowBlur = 14; c.fillText('VOCÊ FOI ELIMINADO', W / 2, H * 0.26); c.globalAlpha = 1; c.shadowBlur = 0; }
    kRaf = requestAnimationFrame(frame);
  })(t0);
}

// ---------- cenas de reunião: report de corpo / botão de emergência ----------
let mRaf = 0;
export function meetScene(m, roster) {
  document.getElementById('meetc')?.remove(); cancelAnimationFrame(mRaf);
  const cv = document.createElement('canvas'); cv.id = 'meetc'; cv.width = innerWidth; cv.height = innerHeight; document.body.append(cv);
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, sc = Math.min(W, H) / 150, t0 = performance.now(), DUR = 2.4, body = m.reason === 'body', gy = H * 0.76, by = roster.get(m.by), vic = body ? roster.get(m.body) : null;
  const FB = { c: 0, h: 0, o: 0, a: 0, m: 0, s: 0 }, ease = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3); sfx(body ? 'report' : 'meeting');
  (function frame(now) {
    const t = (now - t0) / 1000; if (t > DUR) { cv.remove(); return; }
    cv.style.opacity = t > DUR - 0.45 ? (DUR - t) / 0.45 : 1; c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = body ? '#12060a' : '#0a0710'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(255,40,60,${0.3 + 0.22 * Math.sin(t * 13)})`); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, gy, W, H - gy);
    const walk = ease(t / 0.75), rx = -W * 0.12 + (W * (body ? 0.38 : 0.36) + W * 0.12) * walk, arrived = t > 0.75;
    let sx = 0, sy = 0; if ((!body && t > 0.9 && t < 1.25) || (body && t > 0.75 && t < 1.0)) { sx = (Math.random() - 0.5) * 14; sy = (Math.random() - 0.5) * 14; } c.save(); c.translate(sx, sy);
    if (body) {
      c.save(); c.translate(W * 0.62, gy); c.rotate(1.5); c.scale(sc, sc); drawCrew(c, vic?.look || FB, 0, 0, { t, dead: true, face: -1 }); c.restore();
      c.save(); c.translate(rx, gy); c.scale(sc, sc); drawCrew(c, by?.look || FB, 0, 0, { t, moving: !arrived, face: 1, act: arrived ? 0.001 : 0 }); c.restore();
      if (arrived) { c.fillStyle = '#ffd23d'; c.font = `800 ${34 * sc * 0.6}px "Baloo 2",sans-serif`; c.textAlign = 'center'; for (let i = 0; i < 3; i++) c.fillText('!', rx + 34 * sc + i * 15 * sc * 0.6, gy - 52 * sc - i * 7 * sc * 0.4 + Math.sin(t * 9 + i) * 6 * sc * 0.4); }
    } else {
      const bx = W * 0.6, press = t > 0.9 ? Math.min(1, (t - 0.9) / 0.12) : 0;
      c.fillStyle = '#1f2640'; c.fillRect(bx - 36 * sc, gy - 22 * sc, 72 * sc, 22 * sc); c.fillStyle = '#323c66'; c.fillRect(bx - 36 * sc, gy - 22 * sc, 72 * sc, 4 * sc);
      c.fillStyle = '#c91f3d'; c.beginPath(); c.ellipse(bx, gy - 22 * sc, 26 * sc, 5 * sc, 0, 0, 6.3); c.fill();
      const h = (17 - 11 * press) * sc; c.fillStyle = press ? '#ff6b86' : '#ff2f4f'; c.beginPath(); c.ellipse(bx, gy - 24 * sc, 23 * sc, h, 0, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(bx - 8 * sc, gy - 24 * sc - h * 0.55, 7 * sc, 3 * sc, 0, 0, 6.3); c.fill();
      if (t > 0.9) for (let i = 0; i < 3; i++) { const k = (t - 0.9 - i * 0.14) / 0.7; if (k > 0 && k < 1) { c.strokeStyle = `rgba(255,70,90,${1 - k})`; c.lineWidth = 5; c.beginPath(); c.ellipse(bx, gy - 24 * sc, 30 * sc + k * 110 * sc, 12 * sc + k * 40 * sc, 0, 0, 6.3); c.stroke(); } }
      c.save(); c.translate(rx, gy); c.scale(sc, sc); drawCrew(c, by?.look || FB, 0, 0, { t, moving: !arrived, face: 1, act: arrived ? 0.001 : 0 }); c.restore();
    }
    c.restore();
    const tt = t < 0.25 ? 2.6 - t / 0.25 * 1.6 : 1, a = Math.min(1, t / 0.2); c.save(); c.globalAlpha = a; c.translate(W / 2, H * 0.2); c.scale(tt, tt); c.textAlign = 'center'; c.lineJoin = 'round';
    c.font = `800 ${Math.max(26, Math.min(W / 14, H / 6))}px "Baloo 2",system-ui,sans-serif`; c.lineWidth = 10; c.strokeStyle = '#000'; const title = body ? 'CORPO ENCONTRADO!' : 'REUNIÃO DE EMERGÊNCIA'; const fit = Math.min(1, W * 0.9 / Math.max(1, c.measureText(title).width * tt)); c.scale(fit, fit); c.strokeText(title, 0, 0); c.fillStyle = body ? '#ff4f6d' : (Math.sin(t * 16) > 0 ? '#ff4f6d' : '#ffd23d'); c.fillText(title, 0, 0); c.restore();
    if (t > 0.6 && by) { c.globalAlpha = Math.min(1, (t - 0.6) / 0.3); c.fillStyle = '#e9f1ff'; c.textAlign = 'center'; c.font = `700 ${Math.max(16, Math.min(W / 30, H / 14))}px "Baloo 2",system-ui,sans-serif`; c.fillText(body ? `${by.name} reportou${vic ? ' ' + vic.name : ''}` : `${by.name} apertou o botão`, W / 2, H * 0.2 + Math.max(28, H / 12)); c.globalAlpha = 1; }
    if (t < 0.1) { c.fillStyle = `rgba(255,255,255,${0.7 - t * 7})`; c.fillRect(0, 0, W, H); }
    if (!body && t > 0.92 && t < 1.02) { c.fillStyle = 'rgba(255,60,80,.45)'; c.fillRect(0, 0, W, H); }
    mRaf = requestAnimationFrame(frame);
  })(t0);
}
