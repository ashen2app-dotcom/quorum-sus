// Orquestra tudo: perfil, rede, estado do jogo, entrada, HUD e loop principal.
import { net } from './net.js';
import { initRender, render, R, fx, addFx, addShake, setQuality, lowerQuality, drawCrew, toWorld } from './render.js';
import { initAudio, A, sfx, alarm } from './audio.js';
import { openTask, TASK_MIN } from './tasks.js';
import * as UI from './ui.js';
import { ROOMS, RECTS, STATIONS, VENTS, SPECIAL, CAMS, canStand, WORLD, FREEZABLE, ROOM_BY_ID } from '/shared/map.js';
import { sanitizeName } from '/shared/cosmetics.js';
import { JOB, JOBS, TEAMS, ABIL, INF_MSGS, paintJob } from '/shared/jobs.js';

const $ = id => document.getElementById(id);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const P = Object.assign({ name: '', look: { c: Math.floor(Math.random() * 24), h: 0, o: 0, a: 0, m: 0, s: 0 }, vol: { ...A.vol }, q: 1, arr: 0, device: null }, JSON.parse(localStorage.getItem('quorum.p') || '{}'));
const save = () => localStorage.setItem('quorum.p', JSON.stringify(P));
Object.assign(A.vol, P.vol); setQuality(P.q);

const S = { phase: 'menu', id: null, roster: new Map(), role: null, mates: new Set(), me: { x: SPECIAL.spawn.x, y: SPECIAL.spawn.y, alive: false, vent: -1, moving: false, face: 1 },
  players: new Map(), bodies: [], myTasks: [], sab: null, vr: 900, look: P.look, name: P.name, acting: 0, cd: [0, 0], intro: 0, tk: [0, 1], settings: { speed: 1, emergencies: 1 },
  emergUsed: 0, hideMe: true, lobby: null, onDoor: () => sfx('door'), job: null, team: null, ghostJob: null, target: null, known: new Map(), ab: { cd: {}, act: {}, us: {}, sup: 0 }, arrows: [], loc: null, probe: null, meInv: false, meShield: 0, sup: 0, supMode: false, _ej: null, cams: null, camsOn: false, view: null, introEnd: 0, bg: { x: SPECIAL.spawn.x, y: SPECIAL.spawn.y }, jobPanel: false, joy: { x: 0, y: 0 }, touch: false, xt: {}, fz: [], bank: 0, spend: 0, voted: false };
S.taskFrozen = t => { const s = STATIONS.find(q => q.id === t.id); return !!s && S.fz.some(id => ROOM_BY_ID[id]?.name === s.room); };
const frozenHit = (x, y) => { for (const id of S.fz) { const r = ROOM_BY_ID[id]; if (r && x + 12 > r.x && x - 12 < r.x + r.w && y + 12 > r.y && y - 12 < r.y + r.h) return true; } return false; };
const send = o => net.send(o);
Object.assign(S, { deadKnown: new Set(), meetPos: null, meetBody: null, emergCd: 0, bombs: [], shurs: [], protId: -1, camSel: 0, inqLeft: 0, sageWant: false, jpAb: null });
initRender($('game'));

// ---------- navegação ----------
function go(id) {
  UI.show(id); A.mode = id === null ? 'game' : 'lobby';
  UI.setAnim(id === 'lobby' ? UI.drawStage : id === 'custom' ? UI.drawPrev : null);
}
const inLobby = () => S.phase === 'lobby';
const back = () => go(inLobby() ? 'lobby' : 'menu');
function openTrainPc() { // escolhe a profissão para testar
  const items = [{ id: 'r:me', label: '↺ Reviver e voltar ao início' }, { id: 'r:bots', label: '↺ Reviver os bots e limpar corpos' }];
  for (const tm of ['inn', 'neu', 'imp']) for (const j of JOBS) if (j.team === tm && !j.ghost && !j.pair) items.push({ id: 'j:' + j.id, label: `${TEAMS[tm].icon} ${j.name}${S.job === j.id ? '  ✔' : ''}` });
  UI.pickText('💻 Computador de treinamento — escolha a profissão', items, id => { if (id.startsWith('r:')) send({ t: 'trainReset', what: id.slice(2) }); else send({ t: 'trainJob', job: id.slice(2) }); });
}
function toMenu(msg) { S.training = false; $('bTrainX').classList.add('hide'); S.phase = 'menu'; S.hideMe = true; S.me.alive = false; $('hud').classList.add('hide'); closeTaskUi(); alarm(false); sessionStorage.removeItem('quorum.s'); go('menu'); msg && UI.toast(msg); }
async function enter(kind, extra = {}) {
  initAudio(); P.name = sanitizeName($('nameIn').value); $('nameIn').value = P.name; save();
  try { await net.connect(); } catch { return UI.toast('Não foi possível conectar ao servidor.'); }
  send({ t: kind, name: P.name, look: P.look, ...extra });
}
$('nameIn').value = P.name;
$('mPlay').onclick = () => enter('quick'); $('mTrain').onclick = () => enter('train');
$('bTrainX').onclick = () => { send({ t: 'leave' }); S.training = false; toMenu(); }; $('mCreate').onclick = () => enter('create'); $('mJoin').onclick = () => { initAudio(); go('join'); $('codeIn').focus(); };
$('jGo').onclick = () => { const code = $('codeIn').value.trim().toUpperCase(); code.length === 4 ? enter('join', { code }) : UI.toast('Digite o código de 4 letras.'); };
$('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('jGo').click(); });
$('codeIn').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
const openCustom = (look, onSave) => { initAudio(); UI.initCustom(look, onSave); go('custom'); };
const saveMine = look => { P.look = look; save(); inLobby() && send({ t: 'look', look, name: P.name }); sfx('ok'); back(); };
$('mCustom').onclick = $('lCustom').onclick = () => openCustom(P.look, saveMine);
$('stage').addEventListener('click', e => { // clicar no personagem abre a personalização (no seu; o dono também edita os dos bots)
  const cv = $('stage'), r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height, h = UI.STAGE.hits.find(q => x >= q.x0 && x <= q.x1 && y >= q.y0 && y <= q.y1);
  if (!h || !S.lobby) return; if (h.id === S.id) return openCustom(P.look, saveMine);
  if (S.lobby.host === S.id) { const pl = S.lobby.players.find(q => q.id === h.id); if (pl) openCustom(pl.look, look => { send({ t: 'botlook', id: h.id, look }); back(); }); }
});
$('mSettings').onclick = () => { initAudio(); UI.initSettings(P, save, applyDevice); go('settings'); };
document.querySelectorAll('[data-back]').forEach(b => b.onclick = back);
$('lJobs').onclick = () => go('jobs');
$('lLeave').onclick = () => { send({ t: 'leave' }); toMenu(); };
$('lStart').onclick = () => send({ t: 'start' });
$('mVote').onclick = () => { const to = UI.selectedVote(); if (to != null) { send({ t: 'vote', to, sup: S.supMode ? 1 : 0, spend: S.spend }); S.voted = true; S.spend = 0; S.supMode = false; $('mSup').hidden = true; UI.lockVote(); } };
$('mSup').onclick = () => { S.supMode = !S.supMode; $('mSup').classList.toggle('main', S.supMode); UI.toast(S.supMode ? 'Voto Supremo armado: o jogador escolhido será ejetado.' : 'Voto Supremo desarmado.'); };
$('mSkip').onclick = () => { send({ t: 'vote', to: 'skip', spend: S.spend }); S.voted = true; S.spend = 0; UI.lockVote(); };
const sendChat = () => { const i = $('chIn'), text = i.value.trim(); if (text) send({ t: 'chat', text }); i.value = ''; };
$('chSend').onclick = sendChat; $('chIn').onkeydown = e => { if (e.key === 'Enter') sendChat(); e.stopPropagation(); };
addEventListener('pointerdown', () => initAudio(), { once: true });
function tryPhantom(cx, cy) { // clique/toque no Phantom visível (o servidor valida visibilidade e distância)
  if (S.phase !== 'play' || !S.me.alive) return; const cv = $('game'), d = cv.width / innerWidth, [wx, wy] = toWorld(cx * d, cy * d);
  for (const [id, p] of S.players) if (p.ph && Math.hypot(p.x - wx, (p.y - 22) - wy) < 55) { send({ t: 'ab', a: 'phclick', to: id }); sfx('click'); return; }
}
$('game').addEventListener('pointerdown', e => tryPhantom(e.clientX, e.clientY));

// ---------- mensagens do servidor ----------
net.on('hello', m => { S.id = m.id; sessionStorage.setItem('quorum.s', JSON.stringify({ code: m.code, token: m.token })); });
net.on('err', m => UI.toast(m.msg));
net.on('norejoin', () => { sessionStorage.removeItem('quorum.s'); if (S.phase !== 'menu' && S.phase !== 'lobby') toMenu('Você foi removido da partida.'); });
net.on('lobby', m => {
  S.lobby = m; S.roster = new Map(m.players.map(p => [p.id, p])); UI.TAKEN.clear(); for (const p of m.players) UI.TAKEN.add(p.look.c);
  if (S.phase !== 'lobby') { S.phase = 'lobby'; S.hideMe = true; S.me.alive = false; $('hud').classList.add('hide'); closeTaskUi(); alarm(false); UI.closeMeeting(); go('lobby'); }
  UI.renderLobby(m, S.id, send, m.min);
});
function begin(m, resume) {
  S.training = !!m.train; $('bTrainX').classList.toggle('hide', !S.training);
  S.phase = 'play'; S.role = m.role; S.mates = new Set(m.mates.map(x => x[0])); S.known = new Map(m.mates); S.job = m.job; S.team = m.team; S.ghostJob = m.ghostJob; S.target = m.target; S.sup = m.sup || 0; S.jobPanel = !!m.jp; S.supMode = false; S.arrows = []; S.loc = null; S._ej = null; S.roster = new Map(m.players.map(p => [p.id, p])); S.myTasks = m.tasks.map(t => ({ ...t })); S.xt = {}; S.lover = m.lover ?? null; S.lov = null; S.lovFound = null; S.fz = []; S.bank = 0; S.spend = 0; S.voted = false; S.bombs = []; S.shurs = []; S.protId = m.pr ?? -1; S.camSel = 0; S.inqLeft = 0; S.jpAb = null; S.sageWant = false;
  Object.assign(S.me, { x: m.x, y: m.y, alive: m.alive !== false, vent: -1, moving: false }); S.players.clear(); S.bodies = []; S.deadKnown = new Set(); S.sab = null; S.emergUsed = m.emergUsed || 0; S.settings = m.settings;
  const mine = S.roster.get(S.id); S.look = mine.look; S.name = mine.name; S.hideMe = false; S.vr = 420; R.cam.x = m.x; R.cam.y = m.y; R.vis = 420;
  go(null); $('hud').classList.remove('hide'); $('sabMenu').classList.add('hide');
  const imp = S.role === 'imp'; document.querySelectorAll('#bSab,#bKill').forEach(b => b.classList.toggle('hide', !imp)); hideBig();
  if (!resume) { $('hud').classList.add('hide'); S.introEnd = performance.now() + 4300; intro(); } else S.introEnd = 0;
  hudTasks(); buildAbil();
  if (!resume && m.job === 'seguranca') setTimeout(() => UI.toast(m.pr != null ? `🛡 Você protege ${S.roster.get(m.pr)?.name || '?'}${m.ally ? ' — um IMPOSTOR: você joga com os impostores!' : '. Se ele morrer, você morre.'}` : '🛡 Escolha quem proteger (botão PROTEGER). Se o protegido morrer, você morre.', 9000), 4400);
}
net.on('start', m => begin(m, false));
net.on('resume', m => { begin(m, true); if (m.phase !== 'play') { $('hud').classList.add('hide'); S.phase = m.phase; UI.toast('Reconectado. Aguarde a próxima fase.'); } else UI.toast('Reconectado!'); });
function alliesNode(list) {
  if (!list.length) return null; const box = document.createElement('div'), h = document.createElement('div'), row = document.createElement('div'); box.className = 'allies'; h.className = 'ah'; h.textContent = list.length > 1 ? 'SEUS PARCEIROS' : 'SEU PARCEIRO'; row.className = 'ar'; box.append(h, row);
  for (const [id, job] of list) { const r = S.roster.get(id); if (!r) continue; const w = document.createElement('div'), cv = document.createElement('canvas'), n = document.createElement('b'), j = document.createElement('small'); cv.width = 140; cv.height = 170; drawCrew(cv.getContext('2d'), r.look, 70, 148, { s: 1.7 }); n.textContent = r.name; j.textContent = JOB[job].name; w.append(cv, n, j); row.append(w); }
  return box;
}
function intro() {
  const e = $('intro'), T = TEAMS[S.team], J = JOB[S.job], col = J.color === '#111419' ? '#e9f1ff' : J.color; e.innerHTML = ''; e.classList.add('on');
  const scene = (big, color, small, bar, node) => { e.innerHTML = ''; const h = document.createElement('div'); h.textContent = big; h.style.color = color; if (color === col && J.color2 && big === J.name.toUpperCase()) paintJob(h, J); h.style.textShadow = `0 0 40px ${color}`; e.append(h); if (bar) { const l = document.createElement('div'); l.className = 'ldbar'; l.append(document.createElement('i')); e.append(l); } if (small) { const s = document.createElement('small'); s.textContent = small; e.append(s); }  if (node) e.append(node); };
  scene('CARREGANDO', '#e9f1ff', 'Preparando a Estação Halcyon…', true);
  setTimeout(() => { scene(`${T.icon} ${T.name.toUpperCase()}`, T.color, ''); sfx(S.team === 'imp' ? 'sabotage' : 'click'); }, 1100);
  setTimeout(() => {
    let extra = J.desc;
    if (S.job === 'execution') extra += ` Seu alvo: ${S.roster.get(S.target)?.name || '?'}.`; scene(J.name.toUpperCase(), col, extra, false, S.team === 'imp' ? alliesNode([...S.known].filter(([i]) => i !== S.id)) : null); sfx('ok');
  }, 2300);
  setTimeout(() => { e.classList.remove('on'); if (S.phase === 'play') $('hud').classList.remove('hide'); }, 4100);
}
net.on('snap', m => {
  if (S.phase !== 'play') return;
  const [x, y, vent, ap, inv, sh] = m.you, me = S.me, d = Math.hypot(x - me.x, y - me.y); me.vent = vent; S.meInv = !!inv; S.meShield = sh; { const mr = S.roster.get(ap); if (mr) { S.look = mr.look; S.name = mr.name; } }
  { // reconciliação: compara o servidor com ONDE EU ESTAVA há 1 RTT (e não com onde estou agora); assim parar de andar não puxa o personagem de lado
    const H = S.hist || (S.hist = []), tq = performance.now() - Math.min(400, S.rtt || 80); let hx = me.x, hy = me.y; for (let i = H.length - 1; i >= 0; i--) if (H[i].t <= tq) { hx = H[i].x; hy = H[i].y; break; }
    const ex = x - hx, ey = y - hy, e = Math.hypot(ex, ey);
    if (vent >= 0 || m.xt?.pd || e > 170) { me.x = x; me.y = y; H.length = 0; } else if (e > 1.5) { const f = e > 40 ? 0.5 : 0.3; me.x += ex * f; me.y += ey * f; for (const h of H) { h.x += ex * f; h.y += ey * f; } } }
  const seen = new Set();
  for (const [id, px, py, f, mv, g, ap, iv] of m.pl) {
    seen.add(id); let p = S.players.get(id); if (!p) { p = { x: px, y: py }; S.players.set(id, p); }
    const r = S.roster.get(ap ?? id) || { name: '?', look: P.look }; Object.assign(p, { look: r.look, name: r.name, tx: px, ty: py, face: f, moving: !!mv, ghost: !!g, ph: g === 2, inv: !!iv });
  }
  for (const id of [...S.players.keys()]) if (!seen.has(id)) S.players.delete(id);
  S.bodies = m.bd.map(([id, bx, by, bg, bfx, bbag, bmc]) => ({ id, x: bx, y: by, g: !!bg, fx: bfx | 0, bag: bbag | 0, mc: bmc | 0, look: (S.roster.get(id) || { look: P.look }).look })); for (const b of S.bodies) S.deadKnown.add(b.id);
  const hadSab = S.sab; S.sab = m.sab; S.vr = m.vr; S.cd = m.cd || [0, 0]; S.tk = m.tk; S.emergCd = m.ec | 0; S.intro = m.intro; S.ab = m.ab; S.loc = m.loc; S.probe = m.probe; S.sup = m.ab.sup;
  S.bombs = (m.bm || []).map(([id, x0, y0, x, y, t, T]) => ({ id, x0, y0, x, y, t, T })); S.shurs = (m.sh || []).map(([id, x, y, a]) => ({ id, x, y, a: a / 100 })); S.xt = m.xt || {}; S.lov = S.xt.lv || null; { const nf = m.fz || []; if (nf.length !== S.fz.length) { S.fz = nf; hudTasks(); } } S.cams = m.cams || null; S.camsOn = !!m.co; $('hud').classList.toggle('incam', !!m.cams); $('camUI').classList.toggle('hide', !m.cams);
  S.arrows = buildArrows(m, vent);
  if (!!hadSab !== !!S.sab || hadSab?.k !== S.sab?.k) alarm(S.sab?.k === 'heat');
});
net.on('taskOk', m => { const t = S.myTasks.find(q => q.id === m.id); if (t) t.done = true; hudTasks(); });
net.on('fx', m => { S.deadKnown.add(m.id); const r = S.roster.get(m.id); if (!r) return; R.dying.push({ x: m.x, y: m.y, look: r.look, t: 0 }); fx(m.k, m.x, m.y, m.k === 'killg' ? '#4fd36b' : '#ff4f6d'); sfx('kill'); });
const DIED = { inq: 'O Inquisidor adivinhou a sua profissão. Você foi eliminado.', inqmiss: 'Você errou a profissão e sofreu um infarto. Agora você é um fantasma.', trap: 'Você abriu uma tarefa armadilhada e explodiu!', bomb: 'Você foi pego por uma explosão.', shuriken: 'Você foi atingido por uma shuriken.', guard: 'Seu protegido morreu e você morreu junto.', swap: 'Você trocou de profissão com um Impostor e foi eliminado.' };
net.on('died', m => { S.me.alive = false; UI.setAlive(false); closeTaskUi(); S.arrows = []; S.loc = null; buildAbil(); if (DIED[m.by]) return UI.toast(DIED[m.by], 7000); UI.toast(m.by === 'link' ? 'Seu par dos Lovers morreu e a ligação levou você junto. Agora você é um fantasma.' : S.role === 'imp' ? 'Você foi expulso. Continue como fantasma.' : 'Você foi eliminado. Agora você é um fantasma.'); });
net.on('sab', m => { sfx(m.k === 'lights' ? 'blackout' : 'sabotage'); addShake(8); });
net.on('sabPart', () => sfx('fixed'));
net.on('sabEnd', () => { sfx('fixed'); UI.toast('Sistema restaurado.'); });
net.on('meeting', m => {
  S.phase = 'meet'; S.voted = false; S.spend = 0; closeTaskUi(); alarm(false); S.sab = null; S.bodies = []; $('hud').classList.add('hide'); $('intro').classList.remove('on'); sfx(m.reason === 'body' ? 'report' : 'meeting'); addShake(6);
  UI.openMeeting(m, { roster: S.roster, alive: S.me.alive, mates: S.team === 'imp' ? S.mates : null, known: S.team === 'imp' ? S.known : null, me: S.id }); S.arrows = []; S.loc = null; S.supMode = false; S.cams = null; $('camUI').classList.add('hide'); $('hud').classList.remove('incam'); $('mSup').hidden = true; hideBig(); buildMeetAb();
});
net.on('phase', m => { S.phase = 'vote'; buildMeetAb(); UI.startVote(m.time); sfx('vote'); $('mSup').hidden = !(S.sup > 0 && S.me.alive); $('mSup').classList.remove('main'); });
net.on('voted', m => { UI.markVoted(m.id); sfx('click'); });
net.on('chat', m => UI.addChat(m, S.roster));
net.on('result', m => { S.phase = 'result'; UI.showResult(m, S.roster); });
net.on('play', () => { S.phase = 'play'; S.hideMe = false; S.view = null; UI.closeMeeting(); go(null); $('hud').classList.remove('hide'); S.players.clear(); S.hideMe = false; sfx('ok'); S._ej = null; buildAbil(); });
net.on('end', m => { S.phase = 'end'; closeTaskUi(); alarm(false); $('hud').classList.add('hide'); A.mode = null; UI.showEnd(m, S.roster, { team: S.team, job: S.job, id: S.id }); hideBig(); });
let reconnecting = false;
async function reconnect() {
  if (reconnecting || S.phase === 'menu') return; const s = JSON.parse(sessionStorage.getItem('quorum.s') || 'null'); if (!s) return toMenu('Conexão encerrada.');
  reconnecting = true; UI.toast('Conexão perdida. Reconectando…', 4000);
  for (let n = 0; n < 70; n++) { try { await net.connect(); send({ t: 'rejoin', code: s.code, token: s.token }); reconnecting = false; return; } catch { await new Promise(r => setTimeout(r, 2000)); } }
  reconnecting = false; toMenu('Não foi possível reconectar.');
}
net.on('close', reconnect);
document.addEventListener('visibilitychange', () => { if (!document.hidden && S.phase !== 'menu' && !net.open) reconnect(); });
addEventListener('online', () => { if (S.phase !== 'menu' && !net.open) reconnect(); });
{ const s = JSON.parse(sessionStorage.getItem('quorum.s') || 'null'); if (s) net.connect().then(() => send({ t: 'rejoin', code: s.code, token: s.token })).catch(() => { }); }

// ---------- entrada ----------
const keys = new Set(); let closeTask = null, lastIn = '', inT = 0, lastSendAt = 0;
const closeTaskUi = () => { closeTask?.(false); closeTask = null; };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; keys.add(e.code); if (S.phase !== 'play' || closeTask || S.intro > 0 || performance.now() < S.introEnd) return; if (S.cams) { camKey(e.code); return; }
  ({ Digit1: () => abilN(0), Digit2: () => abilN(1), Digit3: () => abilN(2), Digit4: () => abilN(3), KeyM: toggleMap, KeyE: doUse, KeyR: doReport, KeyQ: doKill, KeyV: doVent, KeyC: () => S.me.vent >= 0 && send({ t: 'vent', a: 'next' }), KeyF: () => S.role === 'imp' && $('sabMenu').classList.toggle('hide') })[e.code]?.();
});
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', () => keys.clear());
function press(el, fn) { el.addEventListener('pointerdown', e => { if (el.disabled) return; e.preventDefault(); fn(e); }); el.addEventListener('click', e => e.preventDefault()); }
press($('bUse'), () => doUse()); press($('bRep'), () => doReport()); press($('bKill'), () => doKill()); press($('bVent'), () => doVent()); press($('bSab'), () => $('sabMenu').classList.toggle('hide'));
$('sabMenu').addEventListener('pointerdown', e => { const k = e.target.dataset.s; if (k) { e.preventDefault(); send({ t: 'sabotage', k }); $('sabMenu').classList.add('hide'); } });

// ---------- ações contextuais ----------
function nearAction() {
  const me = S.me; if (S.phase !== 'play' || me.vent >= 0) return null; const pc = !!S.xt.pc; // possuindo: tarefas/conserto/câmeras indisponíveis; emergência e duto valem pelo corpo do possuído
  if (me.alive && S.sab && !pc) {
    const k = S.sab.k, fix = (id, pt) => dist(me, pt) < 90 && { label: 'REPARAR', run: () => { S.acting = 1; sfx('click'); setTimeout(() => dist(S.me, pt) < 110 && send({ t: 'fix', id }), 1000); } };
    if (k === 'lights') { const f = fix('lights', SPECIAL.lights); if (f) return f; }
    if (k === 'comms') { const f = fix('comms', SPECIAL.comms); if (f) return f; }
    if (k === 'heat') { for (const [i, id, pt] of [[0, 'A', SPECIAL.heatA], [1, 'B', SPECIAL.heatB]]) if (!S.sab.fixed[i]) { const f = fix(id, pt); if (f) return f; } }
  }
  let best = null, bd = 90;
  if (!pc && me.alive && S.xt.lt && dist(me, { x: S.xt.lt[0], y: S.xt.lt[1] }) < 90) return { label: 'ISQUEIRO', run: () => send({ t: 'ab', a: 'lighter' }) };
  for (const t of pc ? [] : S.myTasks) if (!t.done && !S.taskFrozen(t)) { const s = STATIONS.find(q => q.id === t.id), d = dist(me, s); if (d < bd) { bd = d; best = { label: 'TAREFA', run: () => startTask(t) }; } }
  if (best) return best;
  if (!pc && me.alive && !S.cams && dist(me, SPECIAL.camConsole) < 90) return { label: 'CÂMERAS', run: () => send({ t: 'ab', a: 'cam' }) };
  if (S.training && dist(me, SPECIAL.trainPc) < 110) return { label: 'COMPUTADOR', run: openTrainPc };
  if (me.alive && dist(me, SPECIAL.emergency) < 100 && S.emergUsed < S.settings.emergencies && S.sab?.k !== 'heat') return S.emergCd > 0 ? { label: `EMERG. ${S.emergCd}s`, off: true, run() { } } : { label: 'EMERGÊNCIA', run: () => { S.emergUsed++; send({ t: 'emergency' }); } };
  return null;
}
function startTask(t) {
  const t0 = Date.now(); send({ t: 'taskStart', id: t.id }); sfx('click');
  closeTask = openTask(t.type, t.name, () => { closeTask = null; setTimeout(() => send({ t: 'taskDone', id: t.id }), Math.max(0, TASK_MIN[t.type] - (Date.now() - t0)) + 80); }, () => { closeTask = null; });
}
const doUse = () => nearAction()?.run();
const bodyNear = () => S.me.alive && S.bodies.some(b => dist(S.me, b) < 150);
const doReport = () => bodyNear() && send({ t: 'report' });
const canKillNow = () => S.role === 'imp' || (S.job === 'jackpot' && S.xt.jp?.[0] === 'kill' && S.me.alive);
function killTarget() { let b = null, bd = 95; for (const [id, p] of S.players) if (!p.ghost && id !== S.id && !S.mates.has(id) && dist(S.me, p) < bd) { b = id; bd = dist(S.me, p); } return b; }
const doKill = () => { if (canKillNow() && S.me.alive && !S.cd[0] && killTarget() != null) send({ t: 'kill' }); };
const ventNear = () => VENTS.some(v => dist(S.me, v) < 80);
const canVent = () => S.team === 'imp' || S.job === 'engenheiro';
function doVent() { if (!canVent() || !S.me.alive || S.xt.pd) return; if (S.me.vent >= 0) { send({ t: 'vent', a: 'out' }); sfx('vent'); } else if (ventNear()) { send({ t: 'vent', a: 'in' }); sfx('vent'); } }

// ---------- HUD ----------
const mini = $('mini'), mc = mini.getContext('2d'), ms = mini.width / WORLD.w;
const miniBase = document.createElement('canvas'); miniBase.width = mini.width; miniBase.height = mini.height;
{ const c = miniBase.getContext('2d'); c.fillStyle = '#0a1226'; c.fillRect(0, 0, 999, 999); c.fillStyle = '#3d5385'; for (const r of RECTS) c.fillRect(r.x * ms, r.y * ms, r.w * ms, r.h * ms); }
function hudTasks() {
  const ul = $('hList'); ul.innerHTML = ''; for (const t of S.myTasks) { const li = document.createElement('li'); li.className = t.done ? 'd' : S.taskFrozen(t) ? 'fz' : ''; const a = document.createElement('span'), b = document.createElement('small'); a.textContent = t.name; b.textContent = t.room; li.append(a, b); ul.append(li); }
}
// v1.5: painel privado dos Lovers (só aparece para quem tem a profissão; atualiza apenas quando o texto muda)
function updLov() {
  const b = $('hLov'), lv = S.job === 'lovers' && S.me.alive && S.phase === 'play' ? S.lov : null; b.classList.toggle('hide', !lv); if (!lv) return;
  const st = lv[6] ? `impostor revelado: ${S.roster.get(lv[7])?.name || '?'}` : lv[5] ? 'DESCOBRIR liberado!' : 'terminem as tarefas para liberar a descoberta';
  const txt = `💗 Par: ${S.roster.get(lv[0])?.name || '?'} · você ${lv[1]}/${lv[2]} · par ${lv[3]}/${lv[4]} · ${st}`; if (b._t !== txt) { b._t = txt; b.textContent = txt; }
}
let hudT = 0;
function hud(dt) {
  if ((hudT -= dt) > 0) return; hudT = 0.1; const sab = S.sab, imp = S.role === 'imp', me = S.me;
  $('hBar').style.width = (S.tk[1] ? (S.tk[0] / S.tk[1]) * 100 : 0) + '%'; $('hCap').textContent = `Progresso da equipe: ${S.tk[0]}/${S.tk[1]} tarefas`;
  setObj(me); updLov();
  const sb = $('hSab'); sb.classList.toggle('hide', !sab);
  if (sab) sb.textContent = sab.k === 'lights' ? 'APAGÃO — restaure a energia nos Geradores' : sab.k === 'comms' ? 'COMUNICAÇÃO INTERROMPIDA — vá a Comunicações' : `SUPERAQUECIMENTO ${sab.t}s — repare em Engenharia e Sala de Controle`;
  $('mapOff').style.display = sab?.k === 'comms' ? 'flex' : 'none';
  const act = nearAction(), u = $('bUse'); u.disabled = !act || act.off || !!closeTask; u.firstChild.textContent = act ? act.label : 'USAR'; u.classList.toggle('rdy', !!act);
  const rep = $('bRep'); rep.disabled = !bodyNear(); rep.classList.toggle('rdy', bodyNear());
  const jk = S.job === 'jackpot' && S.xt.jp?.[0] === 'kill' && me.alive; $('bKill').classList.toggle('hide', !(imp || jk));
  if (imp || jk) {
    const tg = killTarget() != null, k = $('bKill'); k.disabled = !me.alive || S.cd[0] > 0 || !tg; k.classList.toggle('rdy', !k.disabled); k.querySelector('small').textContent = S.cd[0] ? `${S.cd[0]}s` : 'Q';
    if (imp) { const sbn = $('bSab'); sbn.disabled = !me.alive || !!sab || S.cd[1] > 0; sbn.querySelector('small').textContent = S.cd[1] ? `${S.cd[1]}s` : 'F'; }
  }
  $('bNext').classList.toggle('hide', !(me.vent >= 0)); updAbil(me); if (!$('bigmap').classList.contains('hide')) drawBig();
  mc.drawImage(miniBase, 0, 0);
  if (sab?.k !== 'comms') { mc.fillStyle = '#ffe066'; for (const id of S.fz) { const r = ROOM_BY_ID[id]; mc.fillStyle = 'rgba(170,235,255,.6)'; mc.fillRect(r.x * ms, r.y * ms, r.w * ms, r.h * ms); } mc.fillStyle = '#ffe066'; for (const t of S.myTasks) if (!t.done && !S.taskFrozen(t)) { const s = STATIONS.find(q => q.id === t.id); mc.fillRect(s.x * ms - 2, s.y * ms - 2, 4, 4); } mc.fillStyle = '#fff'; mc.beginPath(); mc.arc(me.x * ms, me.y * ms, 3.5, 0, 6.3); mc.fill(); if (S.loc) { mc.fillStyle = '#ffd23d'; mc.beginPath(); mc.arc(S.loc[0] * ms, S.loc[1] * ms, 4.5, 0, 6.3); mc.fill(); } }
}

// ---------- loop ----------
const WAY = ROOMS.map(r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })); let wi = 0, footT = 0, last = performance.now();
function update(dt) {
  const me = S.me;
  if (S.phase === 'play') { S.hideMe = false; S.view = null; }
  else { // vitrine: a câmera passeia pela estação sem tocar no estado real do jogador (vivo/morto, posição)
    const bg = S.bg, w = WAY[wi], dx = w.x - bg.x, dy = w.y - bg.y, d = Math.hypot(dx, dy); if (d < 30) wi = (wi + 1) % WAY.length; else { bg.x += dx / d * 150 * dt; bg.y += dy / d * 150 * dt; }
    S.view = bg; S.vr = 900; S.hideMe = true; S.players.clear(); S.bodies = []; S.myTasks = S.phase === 'menu' || S.phase === 'lobby' ? [] : S.myTasks; S.sab = null; S.arrows = [];
    A.tension += (0 - A.tension) * dt; return;
  }
  let ix = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0), iy = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
  if (S.joy.x || S.joy.y) { ix = S.joy.x; iy = S.joy.y; }
  if (closeTask || S.intro > 0 || me.vent >= 0 || S.cams || S.xt.pd || performance.now() < S.introEnd) ix = iy = 0; // possuído: sem comandos de movimento
  if (ix || iy) { const a = Math.round(Math.atan2(iy, ix) / (Math.PI / 8)) * (Math.PI / 8); ix = +Math.cos(a).toFixed(2); iy = +Math.sin(a).toFixed(2); } // 16 direções: movimento estável e poucas mensagens
  const key = ix + ',' + iy, nowT = performance.now(); inT -= dt; if (inT <= 0 || (key !== lastIn && ((!ix && !iy) || nowT - lastSendAt > 60))) { send({ t: 'input', x: ix, y: iy }); lastIn = key; lastSendAt = nowT; inT = 0.25; }
  const l = Math.hypot(ix, iy); me.moving = l > 0;
  if (l) {
    const k = (190 * S.settings.speed * (S.ab?.act?.samrush > 0 ? (S.settings.sam_speed || 1) : 1) * (S.ab?.mul || 1) * dt) / l, dx = ix * k, dy = iy * k; if (dx) me.face = dx > 0 ? 1 : -1;
    if (!me.alive && !(S.ghostJob === 'phantom')) { me.x = Math.max(20, Math.min(WORLD.w - 20, me.x + dx)); me.y = Math.max(20, Math.min(WORLD.h - 20, me.y + dy)); }
    else { const ph = S.ab?.act?.phase > 0, ok = (x, y) => !frozenHit(x, y) && (ph ? x > 20 && y > 20 && x < WORLD.w - 20 && y < WORLD.h - 20 : canStand(x, y)); if (ok(me.x + dx, me.y)) me.x += dx; if (ok(me.x, me.y + dy)) me.y += dy; }
    if (me.alive && (footT -= dt) <= 0) { sfx('step'); footT = 0.3; }
  }
  if (S.phase === 'play') { const nt = performance.now(), H = S.hist || (S.hist = []); H.push({ t: nt, x: me.x, y: me.y }); while (H.length && H[0].t < nt - 1500) H.shift(); }
  for (const p of S.players.values()) { const k = 1 - Math.exp(-dt * 22); p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; }
  S.acting = Math.max(0, S.acting - dt * 1.2);
  A.tension += ((S.sab ? 0.85 : S.bodies.length ? 0.6 : 0.15) - A.tension) * Math.min(1, dt * 0.8);
  hud(dt);
}
function frame(now) { const raw = now - last, dt = Math.min(0.05, raw / 1000); last = now;
  if (raw < 250) { S._ema = (S._ema || 16) * 0.95 + raw * 0.05; if (S.phase === 'play' && S._ema > 30 && ++S._slow > 150) { S._slow = 0; S._ema = 16; lowerQuality(); } else if (S._ema <= 30) S._slow = 0; } // qualidade adaptativa: se o aparelho não aguenta, reduz a resolução sozinho
  update(dt); touchUi(); render(S, dt); requestAnimationFrame(frame); }
// ---------- profissões: habilidades, painel e mapa grande ----------
const effJob = () => (S.me.alive ? S.job : S.ghostJob);
const nearP = r => { let b = null, bd = r; for (const p of S.players.values()) if (!p.ghost && dist(S.me, p) < bd) { b = p; bd = dist(S.me, p); } return b; };
function buildAbil() {
  const box = $('abil'); box.innerHTML = '';
  (ABIL[effJob()] || []).filter(([id]) => id !== 'lawsave' && id !== 'inq').forEach(([id, label], i) => { const b = document.createElement('button'); b.dataset.id = id; b.dataset.k = i + 1; if (label.length > 8) b.classList.add('long'); b.append(document.createTextNode(label)); const sm = document.createElement('small'); sm.textContent = i + 1; b.append(sm); press(b, () => useAbility(id)); box.append(b); });
}
function buildMeetAb() {
  const box = $('mAb'); box.innerHTML = '';
  if (S.job === 'mentalista' && S.jobPanel && S.me.alive) { const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'PROFISSÕES'; b.onclick = () => send({ t: 'ab', a: 'jobpanel' }); box.append(b); }
  if (S.job === 'advogado' && S.me.alive) {
    const max = S.settings.law_max, can = S.phase === 'vote' && !S.voted, info = document.createElement('span'); info.id = 'lawInfo'; info.textContent = `Guardados: ${S.bank}/${max} · usando agora: ${S.spend}`; box.append(info);
    const mk = (txt, fn, dis) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = txt; b.disabled = dis; b.onclick = fn; box.append(b); };
    mk('−', () => { S.spend = Math.max(0, S.spend - 1); buildMeetAb(); }, !can || S.spend <= 0); mk('+', () => { S.spend = Math.min(S.bank, S.spend + 1); buildMeetAb(); }, !can || S.spend >= S.bank);
    mk('GUARDAR VOTO', () => send({ t: 'ab', a: 'lawsave' }), !can || S.bank >= max);
  }
  if (S.job === 'lovers' && S.me.alive) { const lv = S.lov, info = document.createElement('span'); info.textContent = `💗 Par: ${S.roster.get(S.lover)?.name || '?'}${S.lovFound != null ? ` · impostor: ${S.roster.get(S.lovFound)?.name || '?'}` : ''}`; box.append(info); }
  for (const [id, label] of ABIL[effJob()] || []) if (id === 'panel' || id === 'infmsg' || id === 'lovfind' || id === 'inq' || id === 'sage') { const b = document.createElement('button'); b.className = 'btn'; b.textContent = id === 'inq' ? `${label} (${S.inqLeft})` : label; if (id === 'inq') b.disabled = !(S.inqLeft > 0) || !S.me.alive; press(b, () => useAbility(id)); box.append(b); }
}
function updAbil(me) {
  const ab = S.ab, v = $('bVent'), cv = canVent() && me.alive; v.classList.toggle('hide', !cv);
  if (cv) { const vc = ab.cd.vent | 0; v.disabled = vc > 0 || (me.vent < 0 && !ventNear()); v.firstChild.textContent = me.vent >= 0 ? 'SAIR' : 'DUTO'; v.querySelector('small').textContent = vc ? vc + 's' : 'V'; }
  if (S._ej !== effJob()) { S._ej = effJob(); buildAbil(); }
  for (const b of $('abil').children) {
    const id = b.dataset.id, cd = ab.cd[id] | 0, act = ab.act[id] | 0, tg = nearP(95); let dis = cd > 0, txt = cd ? cd + 's' : b.dataset.k;
    if (id === 'rjinv') { dis = dis || !(ab.us.rj > 0) || !tg; if (!cd) txt = 'x' + (ab.us.rj | 0); }
    if (id === 'zoom' && act > 0) { dis = false; txt = act + 's'; }
    if (id === 'phase') { dis = cd > 0 || act > 0; if (act > 0) txt = act + 's'; }
    if (id === 'rewind') { dis = cd > 0 || !(ab.us.tl > 0); if (!cd) txt = 'x' + (ab.us.tl | 0); }
    if (id === 'freeze') { dis = cd > 0; if (!cd) txt = (S.xt.sel || []).length + '/' + S.settings.frz_n; }
    if (id === 'fuel') { dis = cd > 0 || !tg || !!(S.xt.pf && S.xt.pf[0] >= S.xt.pf[1]); if (!cd) txt = (S.xt.pf?.[0] ?? 0) + '/' + (S.xt.pf?.[1] ?? 0); }
    if (id === 'ignite') { dis = !S.xt.hl; txt = S.xt.hl ? '!' : '—'; }
    if (id === 'infect') { dis = cd > 0 || !tg || !!(S.xt.vi && S.xt.vi[0] >= S.xt.vi[1]); if (!cd) txt = (S.xt.vi?.[0] ?? 0) + '/' + (S.xt.vi?.[1] ?? 0); }
    if (id === 'explode') { dis = !(S.xt.vi && S.xt.vi[1] > 0 && S.xt.vi[0] >= S.xt.vi[1]); txt = dis ? '—' : '!'; }
    if (id === 'bag') { dis = cd > 0 || !bodyNear() || S.xt.carry > 0; }
    if (id === 'drop') { dis = !(S.xt.carry > 0); txt = S.xt.carry > 0 ? S.xt.carry + 's' : '—'; }
    if (id === 'mcarry') dis = cd > 0 || !bodyNear() || S.xt.carry > 0;
    if (id === 'mdrop') { dis = !(S.xt.carry > 0); txt = S.xt.carry > 0 ? S.xt.carry + 's' : '—'; }
    if (id === 'revive') { dis = cd > 0 || !(ab.us.med > 0) || !(S.xt.carry > 0 || bodyNear()); if (!cd) txt = 'x' + (ab.us.med | 0); }
    if (id === 'lovfind') { const lv = S.lov; dis = !(lv && lv[5] === 1); txt = !lv ? '—' : lv[6] === 1 ? '✓' : lv[5] === 1 ? '!' : '—'; if (lv && lv[6] === 1) dis = false; }
    if (id === 'trap') { const tr = S.xt.tr || []; dis = cd > 0 || !nearStation(110) || tr.length >= S.settings.trap_max; if (!cd) txt = tr.length + '/' + S.settings.trap_max; }
    if (id === 'poss') { dis = cd > 0 || !!S.xt.pc; if (S.xt.pc) txt = S.xt.pc[1] + 's'; }
    if (id === 'clean') { dis = cd > 0 || !bodyNear() || S.xt.cl > 0; if (S.xt.cl > 0) txt = S.xt.cl + 's'; }
    if (id === 'swap') { dis = cd > 0 || !(ab.us.swp > 0) || !nearP(180); if (!cd) txt = 'x' + (ab.us.swp | 0); }
    if (id === 'protect') { const pr = S.xt.pr; dis = !(pr && pr[0] < 0); txt = dis ? '✓' : pr[3] + 's'; }
    if (id === 'jpinfo') txt = { kill: 'ASS', speed: 'VEL', shield: 'ESC' }[S.xt.jp?.[0]] || '—';
    if (id === 'cam' && (S.job === 'hacker' || S.job === 'seguranca')) { dis = !!S.cams || S.sab?.k === 'comms'; txt = dis ? '—' : b.dataset.k; }
    if (id === 'investigate') dis = dis || !bodyNear(); if (id === 'skill' || id === 'probe') dis = dis || !tg; if (id === 'remoteFix') dis = dis || !S.sab || (S.job === 'hacker' && S.sab.k !== 'comms'); if (id === 'probe') dis = dis || !!S.probe;
    if (id === 'panel') { dis = !(ab.us.panel > 0); txt = 'x' + (ab.us.panel | 0); } if (id === 'infmsg') { dis = !(ab.us.inf > 0); txt = 'x' + (ab.us.inf | 0); }
    if ((id === 'morph' || id === 'invis') && act > 0) { dis = false; txt = act + 's'; } if (id === 'locate' && act > 0) txt = act + 's';
    if (b.disabled !== dis) { b.disabled = dis; b.classList.toggle('rdy', !dis); } const sm = b._sm || (b._sm = b.querySelector('small')); if (sm.textContent !== String(txt)) sm.textContent = txt;
  }
}
const abilN = i => { const b = $('abil').children[i]; if (b && !b.disabled) useAbility(b.dataset.id); };
const nearStation = r => STATIONS.find(s => dist(S.me, s) < r);
function useAbility(id) {
  const ph = S.phase; if (ph !== 'play' && !((id === 'panel' || id === 'infmsg' || id === 'lovfind' || id === 'inq' || id === 'sage' || id === 'jpinfo') && (ph === 'meet' || ph === 'vote'))) return;
  const all = [...S.roster].map(([i, r]) => ({ id: i, name: r.name, look: r.look, dead: S.deadKnown.has(i) })), others = all.filter(x => x.id !== S.id);
  if (id === 'inq') return startInq();
  if (id === 'trap') { const st = nearStation(110); return st ? send({ t: 'ab', a: 'trap', id: st.id }) : UI.toast('Aproxime-se de uma estação de tarefa.'); }
  if (id === 'poss') { const c = others.filter(o => !S.mates.has(o.id) && !o.dead); return c.length ? UI.pick('Possuir quem? (de qualquer lugar do mapa)', c, to => send({ t: 'ab', a: 'poss', to })) : UI.toast('Ninguém para possuir.'); }
  if (id === 'swap') { const c = others.filter(o => S.players.get(o.id) && !S.players.get(o.id).ghost && dist(S.me, S.players.get(o.id)) < 180); return c.length ? UI.pick('Trocar de profissão com quem?', c, to => send({ t: 'ab', a: 'swap', to })) : UI.toast('Ninguém ao alcance para trocar.'); }
  if (id === 'protect') return UI.pick('Proteger quem? (se ele morrer, você morre)', others.filter(o => !o.dead), to => send({ t: 'ab', a: 'protect', to }));
  if (id === 'bomb') { const R0 = S.settings.bmb_range || 320; let tg = null, bd = R0; for (const [i, p] of S.players) if (!p.ghost && i !== S.id && !S.mates.has(i) && dist(S.me, p) < bd) { tg = p; bd = dist(S.me, p); } return send({ t: 'ab', a: 'bomb', x: tg ? tg.x : S.me.x + S.me.face * R0 * 0.7, y: tg ? tg.y : S.me.y }); } // arremessa na direção do alvo mais próximo (ou para a frente)
  if (id === 'shuriken') { let tg = null, bd = S.settings.nin_range || 450; for (const [i, p] of S.players) if (!p.ghost && i !== S.id && !S.mates.has(i) && dist(S.me, p) < bd) { tg = p; bd = dist(S.me, p); } const ang = tg ? Math.atan2(tg.y - S.me.y, tg.x - S.me.x) : (S.me.face > 0 ? 0 : Math.PI); return send({ t: 'ab', a: 'shuriken', ang }); }
  if (id === 'sage') { S.sageWant = true; return send({ t: 'ab', a: 'sage' }); }
  if (id === 'freeze') { const sel = S.xt.sel || []; return UI.pickText(`Congelar qual área? (${sel.length}/${S.settings.frz_n})`, FREEZABLE.filter(i => !S.fz.includes(i)).map(i => ({ id: i, label: (sel.includes(i) ? '❄ ' : '') + ROOM_BY_ID[i].name })), room => send({ t: 'ab', a: 'freeze', room })); }
  if (id === 'locate') return UI.pick('Rastrear quem?', others, to => send({ t: 'ab', a: 'locate', to }));
  if (id === 'shield') return UI.pick('Proteger quem?', all, to => send({ t: 'ab', a: 'shield', to }));
  if (id === 'morph') return S.ab.act.morph > 0 ? send({ t: 'ab', a: 'morph' }) : UI.pick('Transformar-se em quem?', others, to => send({ t: 'ab', a: 'morph', to }));
  if (id === 'infmsg') return UI.pick('Enviar mensagem para…', others, to => UI.pickText('Qual mensagem?', INF_MSGS.map(([k, l]) => ({ id: k, label: l })), kind => send({ t: 'ab', a: 'infmsg', to, kind })));
  send({ t: 'ab', a: id }); sfx('click');
}
function setObj(me) {
  const o = $('hObj'), j = JOB[S.job]; const b = document.createElement('b'); b.textContent = j.name; paintJob(b, j);
  let rest = !me.alive ? ' — fantasma' + (S.ghostJob ? ` (${JOB[S.ghostJob].name})` : '') : S.team === 'imp' ? ' — elimine sem ser descoberto' + (S.job === 'samurai' ? ` · armadura ${S.xt.arm > 0 ? 'PRONTA' : 'usada'}` : S.job === 'dexter' && S.xt.carry > 0 ? ` · carregando saco ${S.xt.carry}s` : '') : S.job === 'joker' ? ' — faça-os votar em você' : S.job === 'execution' ? ` — ejete ${S.roster.get(S.target)?.name || 'o alvo'}` : S.job === 'congelador' ? ` — congeladas ${S.fz.length}/${S.settings.frz_win} · selecionadas ${(S.xt.sel || []).length}/${S.settings.frz_n}` : S.job === 'parinomo' ? (S.xt.hl ? ' — incendeie a nave!' : S.xt.pf && S.xt.pf[0] >= S.xt.pf[1] ? ' — ache o isqueiro' : ` — abastecidos ${S.xt.pf?.[0] ?? 0}/${S.xt.pf?.[1] ?? 0}`) : S.job === 'virus' ? (S.xt.vi && S.xt.vi[0] >= S.xt.vi[1] ? ' — EXPLODA!' : ` — infectados ${S.xt.vi?.[0] ?? 0}/${S.xt.vi?.[1] ?? 0}`) : S.job === 'medico' ? ' — leve corpos à Enfermaria e ressuscite' + (S.xt.carry > 0 ? ` · carregando ${S.xt.carry}s` : '') : S.job === 'lovers' ? ` — termine as tarefas junto de ${S.roster.get(S.lover)?.name || 'seu par'}` : S.team === 'neu' ? '' : ` — suas tarefas ${S.myTasks.filter(t => t.done).length}/${S.myTasks.filter(t => t.done || !S.taskFrozen(t)).length}`;
  if (S.xt.pd) rest += ' · ⚠ POSSUÍDO: você não controla o personagem';
  if (S.xt.pc) rest += ` · POSSUINDO ${S.roster.get(S.xt.pc[0])?.name || '?'} (${S.xt.pc[1]}s) — mova, ELIMINE, REPORTE, use o DUTO e SABOTE pelo corpo dele (tarefas indisponíveis)`;
  if (S.job === 'sabotador' && S.xt.tr) rest += ` · bombas ativas ${S.xt.tr.length}/${S.settings.trap_max}`;
  if (S.job === 'faxineiro' && S.xt.cl > 0) rest += ` · limpando… ${S.xt.cl}s (fique perto)`;
  if (S.job === 'seguranca' && S.xt.pr) rest += S.xt.pr[0] < 0 ? ` · escolha quem proteger (${S.xt.pr[3]}s)` : ` · protegendo ${S.roster.get(S.xt.pr[0])?.name || '?'}${S.xt.pr[1] ? '' : ' (morto)'}${S.xt.pr[2] ? ' · joga com os impostores' : ''}`;
  if (S.job === 'jackpot' && S.xt.jp) rest += ` · roleta: ${{ kill: 'ASSASSINO', speed: 'VELOCIDADE', shield: 'ESCUDO DO ANJO' }[S.xt.jp[0]] || '?'}`;
  if (S.xt.ph) rest += S.xt.ph[2] ? ' · profissão perdida' : S.xt.ph[0] ? ` · VISÍVEL por ${S.xt.ph[1]}s (evite ser clicado)` : ` · invisível por mais ${S.xt.ph[1]}s`;
  if (S.probe) rest += ` · sondando ${Math.round(S.probe[1] * 100)}%`; { const key = j.name + '|' + rest; if (o._k === key) return; o._k = key; o.textContent = ''; o.append(b, document.createTextNode(rest)); }
}
const big = $('bigmap'), bc = big.getContext('2d'), bs = big.width / WORLD.w;
const showBig = on => { big.classList.toggle('hide', !on); $('bigX').classList.toggle('hide', !on); if (on) drawBig(); };
function hideBig() { $('bigmap').classList.add('hide'); $('bigX').classList.add('hide'); }
const toggleMap = () => { if (S.phase === 'play') showBig(big.classList.contains('hide')); };
$('bigX').onclick = e => { e.stopPropagation(); showBig(false); }; big.onclick = () => showBig(false);
function drawBig() {
  const inM = S.phase !== 'play', pos = inM ? (S.meetPos || S.me) : S.me, t = performance.now() / 1000;
  bc.fillStyle = '#0a1226'; bc.fillRect(0, 0, big.width, big.height); bc.fillStyle = '#3d5385'; for (const r of RECTS) bc.fillRect(r.x * bs, r.y * bs, r.w * bs, r.h * bs);
  bc.textAlign = 'center'; bc.font = '700 13px sans-serif';
  if (!inM && S.sab?.k === 'comms') { bc.fillStyle = '#ff4f6d'; bc.font = '800 34px sans-serif'; bc.fillText('SEM SINAL', big.width / 2, big.height / 2); return; }
  bc.fillStyle = '#dfe9ff'; for (const r of ROOMS) bc.fillText(r.name, (r.x + r.w / 2) * bs, (r.y + r.h / 2) * bs);
  for (const id of S.fz) { const r = ROOM_BY_ID[id]; bc.fillStyle = 'rgba(170,235,255,.55)'; bc.fillRect(r.x * bs, r.y * bs, r.w * bs, r.h * bs); }
  bc.fillStyle = '#ffe066'; for (const t2 of S.myTasks) if (!t2.done && !S.taskFrozen(t2)) { const s = STATIONS.find(q => q.id === t2.id); bc.beginPath(); bc.arc(s.x * bs, s.y * bs, 5, 0, 6.3); bc.fill(); }
  if (!inM && S.loc) { bc.strokeStyle = '#ffd23d'; bc.lineWidth = 3; bc.beginPath(); bc.arc(S.loc[0] * bs, S.loc[1] * bs, 11, 0, 6.3); bc.stroke(); bc.fillStyle = '#ffd23d'; bc.fillText(S.roster.get(S.loc[2])?.name || '?', S.loc[0] * bs, S.loc[1] * bs - 16); }
  if (inM && S.meetBody) { const x = S.meetBody.x * bs, y = S.meetBody.y * bs; bc.strokeStyle = '#ff4f6d'; bc.lineWidth = 4; bc.beginPath(); bc.moveTo(x - 8, y - 8); bc.lineTo(x + 8, y + 8); bc.moveTo(x + 8, y - 8); bc.lineTo(x - 8, y + 8); bc.stroke(); bc.fillStyle = '#ff4f6d'; bc.font = '800 14px sans-serif'; bc.fillText('Corpo encontrado', x, y - 14); }
  const px = pos.x * bs, py = pos.y * bs; if (inM) { bc.strokeStyle = 'rgba(255,255,255,.75)'; bc.lineWidth = 3; bc.beginPath(); bc.arc(px, py, 11 + 5 * Math.sin(t * 4), 0, 6.3); bc.stroke(); }
  bc.fillStyle = '#fff'; bc.beginPath(); bc.arc(px, py, 6, 0, 6.3); bc.fill(); if (inM) { bc.font = '800 15px sans-serif'; bc.fillText('Você parou aqui', px, py - 22); }
}
S.nameColor = p => (p.me ? JOB[S.job]?.color : S.known.has(p.id) ? JOB[S.known.get(p.id)].color : null);
S.tagOf = p => (!p.me && S.known.has(p.id) ? JOB[S.known.get(p.id)].name : null);
// ---------- setas indicadoras e câmeras ----------
function buildArrows(m, vent) {
  const out = m.ar.map(([x, y]) => ({ x, y, col: '#ff7ac8' })); // corpo do Barulhento
  if (m.loc) out.push({ x: m.loc[0], y: m.loc[1], col: '#ffd23d' });
  if (P.arr !== 2 && !m.cams) { // azuis: tarefas pendentes
    let ts = S.myTasks.filter(t => !t.done && !S.taskFrozen(t)).map(t => STATIONS.find(s => s.id === t.id)); if (P.arr === 1) ts = ts.sort((a, b) => dist(S.me, a) - dist(S.me, b)).slice(0, 3);
    for (const s of ts) out.push({ x: s.x, y: s.y, col: '#4aa8ff', edge: true, s: 0.8 });
  }
  if (m.sab) { // vermelhas: onde consertar a sabotagem
    const k = m.sab.k, pts = k === 'lights' ? [SPECIAL.lights] : k === 'comms' ? [SPECIAL.comms] : [!m.sab.fixed[0] && SPECIAL.heatA, !m.sab.fixed[1] && SPECIAL.heatB].filter(Boolean);
    for (const p of pts) out.push({ x: p.x, y: p.y, col: '#ff3b52', edge: true });
  }
  if (vent >= 0 && m.vd) for (const ang of m.vd) out.push({ ang, col: '#ff3b52', s: 0.9 }); // dentro do duto: direção dos outros
  return out;
}
function camKey(code) { if (/^Digit[0-4]$/.test(code)) { S.camSel = +code.slice(5); return; } if (['KeyE', 'Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) send({ t: 'ab', a: 'camOff' }); }
$('cExit').onclick = () => send({ t: 'ab', a: 'camOff' });
document.querySelectorAll('#camUI [data-c]').forEach(b => { b.onclick = () => { S.camSel = +b.dataset.c; sfx('click'); }; });
net.on('camOff', () => { S.cams = null; $('camUI').classList.add('hide'); $('hud').classList.remove('incam'); UI.toast('Câmeras fora do ar.'); });
// ---------- animação de morte e controles de toque (celular) ----------
net.on('kanim', m => { const k = m.k != null ? S.roster.get(m.k)?.look : null, v = S.roster.get(m.v)?.look; if (v) UI.killScene(k || null, v, m.r); });
const autoDev = matchMedia('(pointer: coarse)').matches ? 'mobile' : 'pc';
function applyDevice(dev, persist = true) { if (persist) { P.device = dev; save(); } S.touch = dev === 'mobile'; document.body.classList.toggle('touch', S.touch); document.body.classList.toggle('pc', !S.touch); }
applyDevice(P.device || autoDev, false);
document.querySelectorAll('[data-dev]').forEach(b => { if (b.dataset.dev === autoDev) b.textContent += '  (recomendado)'; b.onclick = () => { applyDevice(b.dataset.dev); if (b.dataset.dev === 'mobile' && !P.qSet) { P.q = 0; P.qSet = 1; setQuality(0); save(); } go('menu'); }; });
const zone = $('joyZone'), jbase = $('joyBase'), jknob = $('joyKnob'); let jp = null, jo = { x: 0, y: 0 };
function moveJoy(e) {
  let dx = e.clientX - jo.x, dy = e.clientY - jo.y; const R = 56, l = Math.hypot(dx, dy) || 1; if (l > R) { dx = dx / l * R; dy = dy / l * R; }
  jknob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; const m = Math.hypot(dx, dy) / R; S.joy = m < 0.22 ? { x: 0, y: 0 } : { x: dx / Math.hypot(dx, dy), y: dy / Math.hypot(dx, dy) };
}
function endJoy(e) { if (e.pointerId !== jp) return; jp = null; S.joy = { x: 0, y: 0 }; jbase.style.display = 'none'; jknob.style.transform = 'translate(-50%,-50%)'; }
zone.addEventListener('pointerdown', e => { tryPhantom(e.clientX, e.clientY); if (jp !== null) return; jp = e.pointerId; try { zone.setPointerCapture(jp); } catch { } jo = { x: e.clientX, y: e.clientY }; jbase.style.display = 'block'; jbase.style.left = jo.x + 'px'; jbase.style.top = jo.y + 'px'; moveJoy(e); });
zone.addEventListener('pointermove', e => { if (e.pointerId === jp) moveJoy(e); });
zone.addEventListener('pointerup', endJoy); zone.addEventListener('pointercancel', endJoy);
zone.addEventListener('lostpointercapture', endJoy); addEventListener('blur', () => { if (jp !== null) endJoy({ pointerId: jp }); }); document.addEventListener('visibilitychange', () => { if (document.hidden && jp !== null) endJoy({ pointerId: jp }); });
addEventListener('contextmenu', e => { if (S.touch) e.preventDefault(); });
let lastJoyShow = null, lastIngame = null;
function touchUi() {
  if (S.phase !== 'play' && !big.classList.contains('hide')) drawBig();
  const show = S.touch && S.phase === 'play' && !closeTask && !S.cams && performance.now() >= S.introEnd;
  if (show !== lastJoyShow) { lastJoyShow = show; zone.classList.toggle('hide', !show); if (!show && jp !== null) endJoy({ pointerId: jp }); }
  const ing = S.phase === 'play'; if (ing !== lastIngame) { lastIngame = ing; document.body.classList.toggle('ingame', ing); }
}
$('bFull').onclick = () => { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen)?.call(d); screen.orientation?.lock?.('landscape').catch(() => { }); };
press($('bNext'), () => send({ t: 'vent', a: 'next' }));
$('mapbox').onclick = () => toggleMap(); $('hTasks').onclick = () => $('hTasks').classList.toggle('open');
// ---------- mapa durante a votação, mortos conhecidos ----------
net.on('meeting', m => { for (const id of m.dead) S.deadKnown.add(id); S.meetPos = { x: S.me.x, y: S.me.y }; S.meetBody = m.bpos ? { x: m.bpos[0], y: m.bpos[1] } : null; UI.meetScene(m, S.roster); });
net.on('result', m => { if (m.ejected != null) S.deadKnown.add(m.ejected); for (const id of m.also || []) { S.deadKnown.add(id); UI.toast(`Voto Supremo duplo: ${S.roster.get(id)?.name || '?'} também foi ejetado!`, 6000); } big.classList.add('hide'); });
for (const t of ['panel', 'jobpanel']) net.on(t, m => m.list.forEach(r => { if (!r[r.length - 1]) S.deadKnown.add(r[0]); }));
$('mMap').onclick = () => showBig(big.classList.contains('hide'));
setInterval(() => { if (net.open) send({ t: 'ping', ts: performance.now() }); }, 2000);
net.on('pong', m => { const r = performance.now() - m.ts; S.rtt = S.rtt ? S.rtt * 0.7 + r * 0.3 : r; });
net.on('hint', m => UI.toast(m.text, 7000));
net.on('bank', m => { S.bank = m.n; if (m.saved) { S.voted = true; UI.lockVote(); UI.toast('Voto guardado para as próximas reuniões!'); sfx('ok'); } if (S.phase === 'meet' || S.phase === 'vote') buildMeetAb(); });
net.on('frozen', m => { S.fz = m.list; hudTasks(); UI.toast('❄ Áreas congeladas: ' + m.list.map(i => ROOM_BY_ID[i].name).join(', '), 7000); sfx('blackout'); });
net.on('tasks', m => { S.myTasks = m.list.map(t => ({ ...t })); hudTasks(); });
net.on('phlost', () => { S.ghostJob = null; S._ej = null; buildAbil(); UI.toast('Você foi descoberto e perdeu a profissão de Phantom!', 6000); });
net.on('revive', () => { S.me.alive = true; S.ghostJob = null; S._ej = null; buildAbil(); UI.toast('Você foi ressuscitado! Mesma profissão, mesma equipe.', 5000); sfx('ok'); });
net.on('rvfx', m => { S.deadKnown.delete(m.id); fx('revive', m.x, m.y, '#6bd968'); sfx('fixed'); });
net.on('lovunlock', () => { UI.toast('💗 Vocês dois terminaram as tarefas! Use DESCOBRIR para revelar um impostor vivo.', 8000); sfx('ok'); });
net.on('lovfound', m => { S.lovFound = m.id; S.known.set(m.id, 'impostor'); UI.toast(`💗 Informação dos Lovers (privada): ${S.roster.get(m.id)?.name || '?'} é IMPOSTOR.`, 12000); sfx('ok'); });
net.on('rewind', m => { R.flash = 0.7; addShake(6); sfx('vent'); for (const [id, x, y] of m.ps) if (id === S.id) { S.me.x = x; S.me.y = y; R.cam.x = x; R.cam.y = y; } for (const id of m.rev) { S.deadKnown.delete(id); } S.bodies = S.bodies.filter(b => !m.rev.includes(b.id)); S.players.clear(); });
net.on('unlock', () => { S.jobPanel = true; UI.toast('Painel de profissões desbloqueado! Abra-o durante as reuniões.', 6000); sfx('ok'); });
net.on('jobpanel', m => UI.pick('Painel de profissões', m.list.map(([id, job, al]) => ({ id, name: S.roster.get(id)?.name || '?', look: S.roster.get(id)?.look || P.look, note: `${JOB[job].name} · ${al ? 'VIVO' : 'MORTO'}`, dead: !al })), null));
net.on('panel', m => UI.pick('Painel do Cientista', m.list.map(([id, al]) => ({ id, name: S.roster.get(id)?.name || '?', look: S.roster.get(id)?.look || P.look, note: al ? 'VIVO' : 'MORTO', dead: !al })), null));
net.on('reveal', m => { for (const [id, j] of m.list) S.known.set(id, j); UI.toast(m.all ? 'Todas as profissões foram reveladas!' : `Descoberto: ${S.roster.get(m.list[0][0])?.name} é ${JOB[m.list[0][1]].name}.`, 6000); sfx('ok'); });
net.on('shield', m => { UI.toast(`Um Anjo protege você por ${m.dur}s!`, 5000); sfx('fixed'); });
net.on('infmsg', m => { UI.toast(m.text, 8000); sfx('report'); });
net.on('ghost', m => { S.ghostJob = m.job; S._ej = null; buildAbil(); UI.toast(`Você recebeu a profissão: ${JOB[m.job].name}.`, 5000); });
net.on('sup', m => { S.sup = m.left; if (m.fresh) UI.toast('Voto Supremo desbloqueado! Use-o na votação.', 5000); });

// ---------- v2.0: mensagens das novas profissões ----------
function startInq() { // Inquisidor: alvo → profissão → confirmação (a interface nunca revela a profissão certa)
  if (!(S.inqLeft > 0)) return UI.toast('Sem tentativas nesta reunião.');
  const items = [...S.roster].filter(([i]) => i !== S.id && !S.deadKnown.has(i)).map(([i, r]) => ({ id: i, name: r.name, look: r.look }));
  UI.pick('Quem você quer atacar?', items, to => {
    const nm = S.roster.get(to)?.name || '?';
    UI.pickText(`Qual é a profissão de ${nm}?`, JOBS.filter(j => !j.ghost).map(j => ({ id: j.id, label: j.name })).sort((a, b) => a.label.localeCompare(b.label, 'pt')), job =>
      UI.pickText(`Confirmar: ${nm} é ${JOB[job].name}? Se errar, VOCÊ morre.`, [{ id: 'y', label: '☠ CONFIRMAR' }, { id: 'n', label: 'Cancelar' }], c => { if (c === 'y') send({ t: 'ab', a: 'inq', to, job }); }));
  });
}
net.on('inq', m => { S.inqLeft = m.left; if (S.phase === 'meet' || S.phase === 'vote') buildMeetAb(); });
net.on('inqfx', m => { UI.inqScene(m, S.roster); });
net.on('mdead', m => { S.deadKnown.add(m.id); UI.markDead(m.id); if (m.id === S.id) { S.me.alive = false; UI.setAlive(false); } });
net.on('jobchg', m => { S.job = m.job; S.target = m.target; S.sup = m.sup || 0; S.jobPanel = !!m.jp; S._ej = null; S.supMode = false; S.xt = {}; buildAbil(); if (S.phase === 'meet' || S.phase === 'vote') buildMeetAb(); UI.toast(`Sua profissão agora é: ${JOB[m.job].name}.`, 7000); sfx('ok'); });
net.on('matejob', m => { S.known.set(m.id, m.job); });
net.on('ally', m => { S.mates.add(m.id); S.known.set(m.id, m.job); UI.toast(`🛡 ${S.roster.get(m.id)?.name || '?'} é o Segurança e protege um impostor: ele joga com vocês.`, 9000); sfx('ok'); });
net.on('prot', m => { S.protId = m.id; UI.toast(`🛡 Você protege ${S.roster.get(m.id)?.name || '?'}${m.ally ? ' — um IMPOSTOR: agora você joga com os impostores!' : '.'} Se ele morrer, você morre.`, 9000); });
net.on('jproll', m => { S.jpAb = m.ab; UI.roulette(m.ab, !!m.again, m.round); });
net.on('possOn', m => { UI.toast(`Você possuiu ${S.roster.get(m.id)?.name || '?'} por ${m.dur}s. Mova-se, ELIMINE, REPORTE, use o DUTO e SABOTE pelo corpo dele.`, 6000); sfx('sabotage'); addShake(6); });
net.on('possd', () => { UI.toast('⚠ Você foi possuído! Não consegue controlar o seu personagem.', 6000); sfx('blackout'); addShake(10); });
net.on('possEnd', () => { UI.toast('A possessão terminou.', 3500); sfx('fixed'); });
net.on('boom', m => { addFx({ k: 'boom', x: m.x, y: m.y, r: m.r, dur: 0.8 }); addShake(Math.max(4, 14 - Math.hypot(m.x - S.me.x, m.y - S.me.y) / 80)); R.flash = Math.max(R.flash, 0.4); sfx('boom'); });
net.on('bombOn', () => { sfx('shur'); });
net.on('bombsOff', () => { S.bombs = []; });
net.on('shur', () => { sfx('shur'); });
net.on('cleaned', m => { fx('dust', m.x, m.y); for (let i = 0; i < 10; i++) fx('dust', m.x + (Math.random() - 0.5) * 40, m.y); S.deadKnown.add(m.id); });
net.on('sageon', () => { UI.toast('📖 Painel do Sábio desbloqueado: agora ele mostra quais profissões continuam vivas.', 7000); sfx('ok'); });
function showSage() {
  const m = S.sage; if (!m) return;
  UI.pickInfo('Painel do Sábio', [m.unl ? 'Profissões presentes e se ainda têm jogadores vivos:' : 'Profissões presentes na partida (conclua as tarefas para ver quais seguem vivas):', ...m.list.map(r => `${JOB[r[0]]?.name || r[0]}${m.unl ? (r[1] ? ' — VIVA ✔' : ' — sem vivos ✕') : ''}`)], 'sage');
}
net.on('sage', m => { S.sage = m; if (S.sageWant || $('pkT').dataset.k === 'sage' && $('pick').classList.contains('on')) { S.sageWant = false; showSage(); } });
requestAnimationFrame(frame);
go('menu');
if (!P.device) go('device');
