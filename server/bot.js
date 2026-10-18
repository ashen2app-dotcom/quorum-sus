// Bot inteligente. Recebe EXATAMENTE as mesmas mensagens que um cliente humano (snapshots limitados pela visão,
// avisos, chat…) e age pelas mesmas mensagens (input, kill, vote, ab…), então as regras/recargas são as do jogador.
// Nunca lê o estado de outros jogadores no servidor: tudo o que "sabe" vem de percepção, habilidades ou chat.
import { STATIONS, SPECIAL, VENTS, ROOMS, TASK_MIN, FREEZABLE, ROOM_BY_ID, roomAt } from '../shared/map.js';
import { JOB, JOBS, colorTone } from '../shared/jobs.js';
import { COLOR_NAMES } from '../shared/cosmetics.js';
import { findPath } from './nav.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const roll = p => Math.random() < p;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const KILL_R = 95, REPORT_R = 150, PH_R = 230;
const STN = Object.fromEntries(STATIONS.map(s => [s.id, s]));
const roomName = (x, y) => roomAt(x, y)?.name || 'um corredor';
const CENTERS = ROOMS.filter(r => !r.hidden).map(r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2, name: r.name }));
const PREP = { 'Sala Central': 'na', 'Refeitório': 'no', 'Sala de Controle': 'na', 'Laboratório': 'no', 'Enfermaria': 'na', 'Engenharia': 'na', 'Armazém': 'no', 'Comunicações': 'nas', 'Segurança': 'na', 'Geradores': 'nos', 'Área Externa': 'na', 'Arquivo Secreto': 'no', 'Cabine de Manutenção': 'na' };
const inR = n => (n === 'um corredor' ? 'num corredor' : `${PREP[n] || 'na'} ${n}`);
const via = n => (n === 'um corredor' ? 'por um corredor' : `${({ no: 'pelo', na: 'pela', nas: 'pelas', nos: 'pelos' })[PREP[n] || 'na']} ${n}`);
const JOB_BY_NAME = Object.fromEntries(JOBS.map(j => [j.name.toLowerCase(), j]));
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
// apelidos aceitos no chat (já sem acento): "time lord", "timelord", "ghost inc"...
const JOB_ALIAS = { 'time lord': 'timelord', timelord: 'timelord', 'ghost inc': 'ghostinc', ghostinc: 'ghostinc', fantasma: 'ghostinc', 'red john': 'redjohn', redjohn: 'redjohn', doutor: 'medico', medica: 'medico', medico: 'medico', lover: 'lovers', lovers: 'lovers', casal: 'lovers', vibora: 'vibora', virus: 'virus', policia: 'policial', cop: 'policial', sheriff: 'xerife' };
const CLAIM_JOBS = JOBS.filter(j => j.team !== 'imp').map(j => [norm(j.name), j.id]).concat(Object.entries(JOB_ALIAS)).sort((a, b) => b[0].length - a[0].length);
const CLAIM_RE = new RegExp('\\b(?:eu\\s+)?(?:sou|era|to de|tô de|minha (?:profissao|funcao|classe) e)\\s+(?:o\\s+|a\\s+|um\\s+|uma\\s+|do\\s+|da\\s+)?(' + CLAIM_JOBS.map(x => x[0].replace(/ /g, '\\s+')).join('|') + ')\\b');
const cname = i => (COLOR_NAMES[i] || '').toLowerCase();

export class Bot {
  constructor(room, p) {
    Object.assign(this, { room, p, clock: 0, job: null, ghostJob: null, team: null, target: null, mates: new Set(), roster: new Map(), tasks: [], pos: { x: p.x, y: p.y },
      vis: new Map(), prevVis: new Map(), seen: new Map(), bodies: new Map(), deadKnown: new Set(), meetDead: new Set(), hiddenDead: new Set(), known: new Map(), susp: new Map(), why: new Map(), heat: new Map(),
      ab: { cd: {}, act: {}, us: {}, sup: 0 }, sab: null, cdKill: 99, sabCd: 99, vr: 420, tk: [0, 1], loc: null, goal: null, path: null, pi: 0, repath: 0, pause: 0, work: null, lastIn: '', stuckT: 0, stuckP: { x: p.x, y: p.y },
      phase: 'play', mtg: null, mtgAlive: new Set(), chatQ: [], voted: false, voteAt: 0, supLeft: 0, jp: false, lastKillAt: -99, meetEnd: 0, abT: 0, danger: null, ventUntil: 0, watching: false, watchUntil: 0,
      lastRoom: '', ended: false, nextPanel: 40, camLed: 0, accusedBy: new Set(), pendKill: null, panelDone: false, deathBy: null, killerJob: null, mtgStart: 0, lastGoalPick: 0, gameT0: 0, usedEmerg: 0, ghostT: 0, comp: new Map(), replies: 0, lastReplyAt: -99, said: new Set(), claims: new Map(), heatBy: new Map(), pushes: new Map(), roomClaim: new Map(), jokerSus: new Map(), execSus: new Map(), liars: new Set(), trusted: new Set(), lastSend: -99 });
    Object.assign(this, { xt: {}, fz: [], bank: 0, lastRewindAt: -99,
      lover: null, killerAp: null, revInfo: null, tlKnown: false, medKnown: false, guess: new Map(), skipPush: new Map(), votePush: new Map(), badGoal: new Map(), fact: new Set(), revSeen: new Set(), ec: 0, stuckN: 0, wiggle: 0, medPlan: null, bodySeenFx: new Map(), revealedLover: null });
    this.trait = { chatty: rnd(0.7, 1.3), brave: rnd(0.6, 1.4), curious: rnd(0.6, 1.4) };
  }
  c(k) { return this.room.settings[k]; }
  pc(k) { return this.room.settings[k] / 100; }
  get imp() { return this.team === 'imp'; }
  eff() { return this.p.alive ? this.job : this.ghostJob; }
  nm(id) { return this.roster.get(id)?.name || '?'; }
  act(m) { this.room.handle(this.p, m); }
  input(x, y) { const k = x.toFixed(1) + ',' + y.toFixed(1); if (k === this.lastIn) return; this.lastIn = k; this.act({ t: 'input', x, y }); }
  stop() { this.input(0, 0); }

  // ================= mensagens recebidas (só memória; nenhuma ação aqui) =================
  onMsg(m) {
    switch (m.t) {
      case 'start': case 'resume': this.init(m); break;
      case 'snap': this.onSnap(m); break;
      case 'taskOk': { const t = this.tasks.find(x => x.id === m.id); if (t) t.done = true; break; }
      case 'fx': this.onKillFx(m); break;
      case 'died': this.deathBy = m.by; this.deathRoom = this.lastRoom; break;
      case 'ghost': this.ghostJob = m.job; break;
      case 'meeting': this.onMeeting(m); break;
      case 'phase': if (m.p === 'vote') { this.phase = 'vote'; this.voteDur = m.time; this.voteAt = this.clock + Math.min(m.time - 2.5, rnd(0.12, 0.65) * m.time * (0.6 + this.c('bot_react') / 3)); } break;
      case 'chat': this.hear(m); break;
      case 'result': this.onResult(m); break;
      case 'play': this.onPlay(); break;
      case 'hint': this.onHint(m.text); break;
      case 'panel': this.onPanel(m.list); break;
      case 'jobpanel': for (const [id, job, al] of m.list) { this.known.set(id, job); if (!al) this.deadKnown.add(id); } this.jpDone = true; if (this.room.phase !== 'play') this.queueMentClaim(); break;
      case 'reveal': for (const [id, job] of m.list) this.known.set(id, job); break;
      case 'unlock': this.jp = true; break;
      case 'sup': this.supLeft = m.left; break;
      case 'infmsg': this.onInf(m.text); break;
      case 'camOff': this.watching = false; break;
      case 'tasks': this.tasks = m.list.map(t => ({ ...t })); break;
      case 'bank': this.bank = m.n; break;
      case 'rewind': this.onRewind(m); break;
      case 'rvfx': this.onReviveSeen(m.id, true); break;
      case 'revive': this.onRevived(); break;
      case 'kanim': this.killerAp = m.k; break;
      case 'lovfound': this.onLovFound(m.id); break;
      case 'lovunlock': this.lovReady = true; break;
      case 'phlost': this.ghostJob = null; break;
      case 'frozen': this.fz = m.list || []; this.path = null; break;
      case 'end': this.ended = true; break;
    }
  }
  init(m) {
    this.job = m.job; this.team = m.team; this.ghostJob = m.ghostJob; this.target = m.target; this.supLeft = m.sup || 0; this.jp = !!m.jp; this.lover = m.lover ?? null;
    this.mates = new Set(m.mates.map(x => x[0])); for (const [id, j] of m.mates) this.known.set(id, j);
    this.roster = new Map(m.players.map(q => [q.id, q])); this.tasks = m.tasks.map(t => ({ ...t })); this.pos = { x: m.x, y: m.y }; this.gameT0 = this.clock;
  }
  sus(id, d, why) {
    if (id === this.p.id || id === this.lover || this.mates.has(id) || this.deadKnown.has(id) || !this.roster.has(id)) return;
    const v = clamp((this.susp.get(id) ?? 20) + d * (0.45 + this.pc('bot_sus')), 0, 100); this.susp.set(id, v); if (why && d > 0) this.why.set(id, why);
  }
  onSnap(m) {
    const me = this.p; this.pos = { x: m.you[0], y: m.you[1] }; this.sab = m.sab; this.ec = m.ec | 0; this.tk = m.tk; this.ab = m.ab; this.vr = m.vr == null ? 3000 : m.vr; this.loc = m.loc; this.intro = m.intro;
    if (m.cd) { this.cdKill = m.cd[0]; this.sabCd = m.cd[1]; } this.lastRoom = roomName(this.pos.x, this.pos.y);
    const cur = new Map(); for (const [id, x, y, face, mv, gh, ap, inv] of m.pl) cur.set(id, { id, x, y, mv: !!mv, ghost: !!gh, ph: gh === 2, ap, inv: !!inv });
    this.xt = m.xt || {}; this.fz = m.fz || [];
    const look = Math.min(this.vr, 420);
    if (me.alive && me.vent < 0 && !this.watching) {
      for (const [id, o] of this.prevVis) if (!cur.has(id) && !o.ghost && dist(o, this.pos) < look * 0.75) { if (VENTS.some(v => dist(v, o) < 70)) this.sus(id, 45, 'vent'); else if (roll(0.7)) { this.sus(id, 14, 'sumiu'); if (!(this.sab?.k === 'lights')) this.deduce(id, 'espectro', 0.45); } }
      const aps = new Map(); for (const o of cur.values()) { const k = o.ap ?? o.id; if (aps.has(k)) { this.sus(o.id, 12, 'duplo'); this.sus(aps.get(k), 12, 'duplo'); } aps.set(k, o.id); }
      for (const [id, o] of cur) { const pv = this.prevVis.get(id); if (pv && pv.ap !== o.ap && dist(o, this.pos) < 380) { this.sus(id, 40, 'transformou'); this.deduce(id, 'metamorfo', 0.95, { from: pv.ap, to: o.ap }); } }
    }
    this.vis = cur; this.prevVis = cur; for (const [id, o] of cur) this.seen.set(id, { x: o.x, y: o.y, t: this.clock });
    { const arr = [...cur.values()].filter(o => !o.ghost); for (const a of arr) for (const b of arr) if (a !== b && dist(a, b) < 220) this.comp.set(b.id, { id: a.id, t: this.clock }); } // quem estava com quem
    const seenB = new Set();
    for (const [id, x, y, g, fxk, bag, mc] of m.bd) {
      seenB.add(id); const b = this.bodies.get(id); if (!b) this.onBody(id, x, y, false, { g, fxk, bag }); else { b.t = this.clock; b.remote = false; }
      if (mc) { this.medKnown = true; for (const o of cur.values()) if (!o.ghost && dist(o, { x, y }) < 90) this.deduce(o.id, 'medico', 0.8); } // corpo sendo arrastado: quem está colado nele é o Médico
    }
    for (const [id, o] of cur) if (!o.ghost && this.deadKnown.has(id) && id !== this.p.id) this.onReviveSeen(id, false); // vi vivo quem eu sabia que estava morto
    for (const [id, b] of [...this.bodies]) if (!seenB.has(id) && !b.remote && !b.cam && me.alive && dist(b, this.pos) < look * 0.7) { this.bodies.delete(id); this.hiddenDead.add(id); for (const o of cur.values()) if (dist(o, b) < 350) this.sus(o.id, 18, 'near'); }
    const arrowIds = new Set();
    for (const [ax, ay] of m.ar) { const key = 'a' + ax + '_' + ay; arrowIds.add(key); if (![...this.bodies.values()].some(b => dist(b, { x: ax, y: ay }) < 90)) this.bodies.set(key, { id: key, x: ax, y: ay, remote: true, t: this.clock, reactAt: this.clock + this.c('bot_react') * rnd(0.4, 1.1) }); }
    for (const [id, b] of [...this.bodies]) if (b.remote && String(id).startsWith('a') && !arrowIds.has(id)) this.bodies.delete(id);
    if (m.cams) this.onCams(m.cams);
    if (m.co && this.camLedNear()) this.camLed = this.clock;
  }
  camLedNear() { return [[1500, 650], [980, 930], [2000, 930], [2000, 1530]].some(([x, y]) => dist({ x, y }, this.pos) < 380); }
  onBody(id, x, y, viaCam, info) {
    if (info) { if (info.fxk === 1) this.killerJob = JOB.redjohn; else if (info.fxk === 2) this.killerJob = JOB.samurai; if (info.bag) this.deduce(null, 'dexter', 0.7); if (info.g) this.deduce(null, 'vibora', 0.5); }
    const b = { id, x, y, t: this.clock, first: this.clock, rep: false, cam: !!viaCam, vib: !!(info && info.g), reactAt: this.clock + this.c('bot_react') * rnd(0.4, 1.1) }; this.bodies.set(id, b); this.deadKnown.add(id); this.hiddenDead.delete(id);
    for (const [pid, o] of this.seen) if (pid !== id && this.clock - o.t < 12 && dist(o, b) < 380) this.sus(pid, (dist(o, b) < 200 ? 28 : 16) * (this.clock - o.t < 3 ? 1 : 0.6), 'near');
    if (this.loc && dist({ x: this.loc[0], y: this.loc[1] }, b) < 450) this.sus(this.loc[2], 18, 'near');
    const cp = this.comp.get(id); if (cp && cp.id !== this.p.id && this.clock - cp.t < 90) this.sus(cp.id, 32, 'last');
    if (this.imp && this.clock - this.lastKillAt < 4) b.mine = true;
  }
  onCams(cams) {
    for (const [pl, bd] of cams) { for (const e of pl) this.seen.set(e[0], { x: e[1], y: e[2], t: this.clock }); for (const [id, x, y] of bd) if (!this.bodies.has(id) && !this.meetDead.has(id)) this.onBody(id, x, y, true); }
  }
  onKillFx(m) {
    this.deadKnown.add(m.id); const at = { x: m.x, y: m.y }, near = [...this.vis.values()].filter(o => !o.ghost && o.id !== m.id && dist(o, at) < 230);
    for (const o of near) this.sus(o.id, near.length === 1 ? 85 : 45, 'kill');
    if (!this.imp && this.p.alive && dist(at, this.pos) < 420 && near.length) this.danger = { from: near[0], until: this.clock + 7 };
    if (!this.imp && this.p.alive && !this.bodies.size && m.k === 'killg') this.hiddenDead.add(m.id);
    if (!this.imp && this.p.alive && m.k === 'killg' && near.length) this.deduce(near[0].id, 'vibora', 0.6);
  }
  onMeeting(m) {
    Object.assign(this, { phase: 'meet', mtg: m, voted: false, mtgAlive: new Set(m.alive), panelDone: false, mtgStart: this.clock, goal: null, path: null, work: null, watching: false, ventUntil: 0, pendKill: null, danger: null, replies: 0, said: new Set() });
    for (const d of m.dead) { this.deadKnown.add(d); this.meetDead.add(d); this.hiddenDead.delete(d); } this.bodies.clear(); this.accusedBy.clear(); this.heat.clear(); this.heatBy.clear(); this.pushes.clear(); this.roomClaim.clear(); this.skipPush.clear(); this.votePush.clear();
    this.chatQ = this.p.alive ? this.compose(m) : [];
  }
  onPlay() { Object.assign(this, { phase: 'play', mtg: null, goal: null, path: null, work: null, lastIn: '', meetEnd: this.clock, sab: null, danger: null, watching: false }); this.bodies.clear(); for (const [id, v] of this.susp) this.susp.set(id, v + (20 - v) * 0.2); }
  onResult(m) {
    if (m.ejected != null) { this.deadKnown.add(m.ejected); this.meetDead.add(m.ejected); const vs = m.votes[m.ejected] || []; for (const v of vs) { if (m.imp === false) this.sus(v, 10, 'accused'); else if (m.imp === true) this.sus(v, -14); } if (m.imp === true) this.known.set(m.ejected, 'impostor'); }
  }
  onHint(text) { const t = /cor (?:de quem matou é )?(\w+)/.exec(text || ''); if (t) this.applyTone(t[1].replace(/\W/g, '')); }
  applyTone(tone) { for (const [id, r] of this.roster) if (id !== this.p.id && !this.deadKnown.has(id)) { if (colorTone(r.look.c) === tone) this.sus(id, 38, 'tone'); else this.sus(id, -6); } this.toneHint = tone; }
  onInf(text) {
    const t = /tem cor (\w+)/.exec(text), j = /era ([^.]+)\./.exec(text), w = /fui morto em ([^.]+)\./.exec(text);
    if (t) this.applyTone(t[1]); if (j) this.killerJob = JOB_BY_NAME[j[1].trim().toLowerCase()] || null;
    if (w) { const room = ROOMS.find(r => r.name === w[1].trim()); if (room) { const c = { x: room.x + room.w / 2, y: room.y + room.h / 2 }; for (const [id, o] of this.seen) if (this.clock - o.t < 70 && dist(o, c) < 420) this.sus(id, 12, 'near'); } }
  }
  onPanel(list) {
    for (const [id, al] of list) if (!al) { this.deadKnown.add(id); if (!this.meetDead.has(id) && !this.bodies.has(id)) this.hiddenDead.add(id); }
    const dead = list.filter(([id, al]) => !al && id !== this.p.id).map(([id]) => this.nm(id)); if (this.job === 'cientista' && this.room.phase !== 'play' && dead.length) { this.chatQ.push({ at: this.clock + rnd(1.4, 3), text: `Sou cientista, olhei o painel: mortos ${dead.slice(0, 4).join(', ')}.`.slice(0, 140) }); this.chatQ.sort((a, b) => a.at - b.at); }
  }
  // ================= v1.5: consciência de profissões, ressurreição e vínculos =================
  // Registra uma dedução baseada no que o bot VIU (nunca em dados secretos). id=null: fato do mundo (ex.: corpo de Víbora).
  deduce(id, job, conf, ex) {
    if (id == null) { this.fact.add(job); return; }
    if (id === this.p.id || id === this.lover || this.mates.has(id) || !this.roster.has(id) || this.deadKnown.has(id)) return;
    const g = this.guess.get(id); if (g && g.conf >= conf) return; this.guess.set(id, { job, conf, t: this.clock, ex });
    if (JOB[job]?.team === 'imp') this.sus(id, 28 * conf, job === 'metamorfo' ? 'transformou' : undefined); else if (JOB[job]?.team === 'inn') this.sus(id, -10 * conf);
    if (job === 'medico') this.medKnown = true;
  }
  onRewind(m) {
    this.path = null; this.goal = null; this.pause = 0.6; this.tlKnown = true; this.bodies.clear();
    for (const id of m.rev || []) this.onReviveSeen(id, true);
  }
  // Alguém que eu dava como morto apareceu vivo (Médico ou Time Lord): atualiza o que sei e fica ciente de que existe quem ressuscite.
  onReviveSeen(id, sure) {
    if (id === this.p.id) return; const was = this.deadKnown.has(id);
    this.deadKnown.delete(id); this.meetDead.delete(id); this.hiddenDead.delete(id); this.bodies.delete(id);
    if (was || sure) { this.revSeen.add(id); if (!this.tlKnown) this.medKnown = true; }
  }
  // Fui ressuscitado: lembro quem me matou (a cena de morte me mostrou) e corro para contar.
  onRevived() {
    this.deadKnown.delete(this.p.id); this.deathBy = null; this.ghostJob = null; this.work = null; this.goal = null; this.path = null; this.pause = rnd(0.5, 1.1); this.chatQ = [];
    this.revInfo = { ap: this.killerAp, room: this.deathRoom, at: this.clock }; this.killerAp = null;
    if (this.revInfo.ap != null && this.revInfo.ap !== this.p.id && !this.imp && this.ec === 0 && this.usedEmerg < this.room.settings.emergencies && roll(0.8)) this.setGoal({ k: 'emerg', x: SPECIAL.emergency.x, y: SPECIAL.emergency.y + 30, r: 80, pr: 89 });
  }
  onLovFound(id) { this.revealedLover = id; this.known.set(id, 'impostor'); this.sus(id, 70, 'lover'); this.fact.add('lovfound'); if (this.room.phase === 'meet' || this.room.phase === 'vote') { this.chatQ.push({ at: this.clock + rnd(1, 2.2), text: `Descobri uma informação confiável: ${this.nm(id)} é impostor!`.slice(0, 140) }); this.chatQ.sort((a, b) => a.at - b.at); } }
  // Existe alguém que possa trazer mortos de volta? Se sim, não vale correr para reportar cada corpo.
  reviverPossible() {
    if (this.tlKnown || this.medKnown) return true;
    return [...this.claims].some(([id, c]) => (c.job === 'timelord' || c.job === 'medico') && !this.deadKnown.has(id) && this.trusted.has(id));
  }
  // O corpo ainda deve esperar antes de ser reportado? (só inocentes comuns; Médico e Time Lord usam a própria habilidade)
  waitForRevive(b) {
    if (this.imp || this.job === 'medico' || !this.reviverPossible() || (this.danger && this.clock < this.danger.until)) return false;
    const age = this.clock - (b.first ?? b.t); b.wait ??= rnd(9, 20) * (0.7 + this.trait.brave * 0.3); return age < b.wait;
  }
  bodyReady(b) {
    if (this.clock < b.reactAt) return false;
    if (this.job === 'timelord' && this.ab.cd.rewind <= 0 && this.ab.us.tl > 0 && this.clock - (b.first ?? b.t) < this.c('tl_rew') - 2) return false; // Time Lord: primeiro tenta voltar o tempo
    if (this.job === 'medico' && this.medWants(b)) return false;
    return !this.waitForRevive(b);
  }
  medWants(b) { return this.p.alive && this.ab.us.med > 0 && !(this.ab.cd.revive > 0) && !b.vib && !b.cam && !b.remote && !this.fz.includes('enfermaria') && !this.meetDead.has(b.id); }
  // Médico: pega o corpo, leva até a Enfermaria e ressuscita (tudo pelas mesmas mensagens de um jogador).
  medicTick(use) {
    if (!this.p.alive || (this.danger && this.clock < this.danger.until)) return;
    if (this.xt.carry > 0) { this.setGoal({ k: 'mrevive', x: 480, y: 960, r: 70, pr: 96 }); return; }
    if (!(this.ab.us.med > 0) || this.ab.cd.revive > 0 || !roll(0.3 + use * 0.6)) return;
    const b = [...this.bodies.values()].filter(q => !q.rep && this.medWants(q) && dist(q, this.pos) < 900).sort((a, c) => dist(a, this.pos) - dist(c, this.pos))[0];
    if (b) this.setGoal({ k: 'mcarry', x: b.x, y: b.y, r: 70, pr: 95, bid: b.id });
  }
  loversTick() { const lv = this.xt.lv; if (lv && lv[5] === 1 && lv[6] !== 1 && roll(0.7)) this.act({ t: 'ab', a: 'lovfind' }); }

  hear(m) {
    this.said.add(String(m.text).toLowerCase().replace(/^[^:]{1,14}:\s*/, ''));
    if (m.id === this.p.id) return; const text = String(m.text).toLowerCase(), myName = (this.roster.get(this.p.id)?.name || '').toLowerCase();
    const accuse = /(sus|suspeit|matou|impostor|mentiu|mente|mentira|vent|duto|sumiu|perto do corpo|votem|votar|vota |foi o|foi a|culpa|estranh)/.test(text), defend = /(inocente|limpo|confio|n[aã]o foi|n[aã]o fui|tava|estava|fazendo task)/.test(text);
    const trust = 1 - (this.susp.get(m.id) ?? 20) / 130, mentioned = [];
    for (const [id, r] of this.roster) {
      if (id === m.id || !text.includes(r.name.toLowerCase())) continue; mentioned.push(id);
      if (accuse) { (this.heatBy.get(id) || this.heatBy.set(id, new Set()).get(id)).add(m.id); this.sus(id, 13 * trust, 'accused'); }
      else if (defend) this.sus(id, -5 * trust);
    }
    if (this.p.alive && (this.room.phase === 'meet' || this.room.phase === 'vote')) {
      this.keywords(m.id, text, mentioned, trust);
      const claim = this.parseClaim(text); if (claim) this.onClaim(m.id, claim, text, mentioned);
      this.trackPush(m.id, accuse, mentioned); this.checkRoomClaim(m.id, text, mentioned); this.jokerTells(m.id, text);
      this.respond(m, text, mentioned, myName.length > 1 && text.includes(myName), accuse);
    }
  }
  // Palavras-chave que o bot entende e decide seguir (ou não) conforme confia em quem falou.
  keywords(sp, text, mentioned, trust) {
    const t = norm(text);
    if (/\b(skip|skipa|skipar|skipem|pula|pulem|pular|pulo|vamos pular|ninguem vota|nao votem|ng vota|sem voto|voto em branco)\b/.test(t) && !/\bnao (vou|vamos) (pular|skipar)\b/.test(t)) this.skipPush.set(sp, this.clock);
    if (/\b(vota|votem|votar|vamos votar|vamos de|bora votar|ejeta|ejetem|mandem)\b/.test(t)) for (const id of mentioned) if (id !== sp) (this.votePush.get(id) || this.votePush.set(id, new Map()).get(id)).set(sp, this.clock);
    // quem diz "fulano me matou" (ressuscitado) tem palavra forte; "fui ressuscitado" também conta como pista de que existe quem reviva
    if (/(me matou|me mataram|foi (?:o|a) .{1,14} que me matou|fui morto|fui ressuscit|fui revivid|me reviveram|me ressuscitaram|voltei (?:a|da) vida)/.test(t)) {
      this.revSeen.add(sp); if (!this.tlKnown) this.medKnown = true;
      for (const id of mentioned) if (id !== sp && /(me matou|me mataram|que me matou)/.test(t)) { this.sus(id, 50 * trust, 'victimsaid'); (this.heatBy.get(id) || this.heatBy.set(id, new Set()).get(id)).add(sp); }
    }
  }
  skipWeight() { let w = 0; for (const [id] of this.skipPush) { if (this.deadKnown.has(id) || id === this.p.id) continue; w += this.trusted.has(id) ? 1.6 : this.discredited(id) ? 0 : 1; } return w; }
  voteWeight(id) { let w = 0; for (const [sp] of this.votePush.get(id) || []) { if (this.deadKnown.has(sp)) continue; w += this.trusted.has(sp) ? 1.5 : this.discredited(sp) ? 0 : 0.6; } return w; }
  discredited(id) { return this.liars.has(id) || (this.execSus.get(id) || 0) >= 30 || (this.jokerSus.get(id) || 0) >= 40 || (this.susp.get(id) ?? 20) >= 78; }
  heatOf(id) { let n = 0; for (const sp of this.heatBy.get(id) || []) if (!this.discredited(sp)) n++; return n; }
  chat(text, prob = 1) {
    const talk = this.pc('bot_talk'); if (!this.p.alive || this.chatQ.length >= 3 || this.replies >= 3 + Math.round(talk * 5) || !roll(Math.min(1, prob * (0.45 + talk)))) return;
    this.replies++; this.chatQ.push({ at: this.clock + rnd(1.5, 3.8) + text.length * 0.03, text: text.slice(0, 140), reply: -1 }); this.chatQ.sort((a, b) => a.at - b.at);
  }
  parseClaim(t) { const m = CLAIM_RE.exec(norm(t)); if (!m) return null; const w = m[1].replace(/\s+/g, ' '); const f = CLAIM_JOBS.find(x => x[0] === w); return f ? f[1] : null; }
  // Alguém disse "sou <profissão>": confere contra o que o bot sabe e decide se confia (e o que muda no voto).
  onClaim(P, job, text, mentioned) {
    if (P === this.p.id || this.deadKnown.has(P)) return; const jn = JOB[job]?.name || job, uniq = job !== 'tripulante' && job !== 'lovers' && this.room.settings['m_' + job] <= 1, prev = this.claims.get(P), gs = this.guess.get(P);
    if (job === 'lovers') { if (this.job === 'lovers') { if (P === this.lover) return; this.liars.add(P); this.sus(P, 60, 'mentira'); this.chat(`O ${this.nm(P)} não é Lovers, o meu par é outro.`, 0.7); return; } if ([...this.claims].filter(([id, c]) => c.job === 'lovers' && id !== P && !this.deadKnown.has(id)).length >= 2) { this.sus(P, 25, 'mentira'); return; } }
    if (gs && gs.conf >= 0.9 && gs.job !== job && JOB[gs.job]?.team === 'imp') { this.liars.add(P); this.sus(P, 55, 'mentira'); this.chat(`Mentira, ${this.nm(P)}! Eu vi você agindo como ${JOB[gs.job].name}, não como ${jn}.`, 0.9); return; }
    if (prev && prev.job !== job) this.sus(P, 30, 'mentira');
    if (uniq && this.job === job && this.p.alive) { this.liars.add(P); this.sus(P, 70, 'mentira'); this.revealed = true; this.chat(pick([`Mentira! Quem é ${jn} sou eu. O ${this.nm(P)} tá mentindo.`, `O ${this.nm(P)} não é ${jn}, eu que sou!`]), 0.9); return; }
    const dup = uniq ? [...this.claims].find(([id, c]) => id !== P && c.job === job && !this.deadKnown.has(id)) : null;
    this.claims.set(P, { job, t: this.clock });
    if (dup) { this.sus(P, 22, 'mentira'); this.sus(dup[0], 22, 'mentira'); this.chat(`Dois dizendo que são ${jn}? ${this.nm(P)} e ${this.nm(dup[0])}, um de vocês tá mentindo.`, 0.7); return; }
    if (this.imp && this.mates.has(P)) return;
    const afterAccuse = [...this.heatBy.values()].some(sp => sp.size) && this.heatOf(P) > 0, verified = gs && gs.job === job ? 0.35 : (job === 'medico' || job === 'timelord') && this.revSeen.size ? 0.1 : 0;
    let p = clamp(0.5 - ((this.susp.get(P) ?? 20) - 20) / 100 - (this.discredited(P) ? 0.4 : 0) - (afterAccuse ? 0.15 : 0) - (this.trusted.size >= 3 ? 0.1 : 0) + verified + (this.pc('bot_skill') - 0.5) * 0.2, 0.05, 0.9); if (this.imp) p = Math.min(p, 0.3);
    if (mentioned.includes(this.p.id) && /(impostor|joker|execution|suspeit|matou|votem|vota)/.test(text)) p = 0; // quem me acusa não ganha minha confiança
    if (roll(p)) {
      this.trusted.add(P); this.sus(P, -18);
      const bad = /(impostor|joker|execution|suspeit|sus\b|matou|votem|vota)/.test(text), good = /(inocente|limpo|confi)/.test(text);
      for (const id of mentioned) if (id !== P) { if (bad) { this.sus(id, 42, 'claim'); (this.heatBy.get(id) || this.heatBy.set(id, new Set()).get(id)).add(P); } else if (good) this.sus(id, -25); }
      const t = /cor (quente|fria|escura|clara)/.exec(text); if (t && job === 'detetive') this.applyTone(t[1]);
      this.chat(pick([`Confio no ${this.nm(P)}, ele disse ser ${jn}.`, `Se o ${this.nm(P)} é ${jn} mesmo, vamos seguir o que ele falou.`, `Tá bom, ${this.nm(P)}, acredito em você.`]), 0.6);
    } else {
      this.sus(P, 14, 'claim'); if (roll(0.35)) this.jokerSus.set(P, (this.jokerSus.get(P) || 0) + 15);
      this.chat(pick([`Hmm, será que o ${this.nm(P)} é ${jn} mesmo? Alguém confirma?`, `Não acredito no ${this.nm(P)}. Quem garante que ele é ${jn}?`, `${this.nm(P)} falando que é ${jn}... pode ser Joker ou impostor mentindo.`]), 0.6);
    }
  }
  // Quem insiste no mesmo alvo sem prova pode ser Execution.
  trackPush(sp, accuse, ids) {
    if (!accuse) return; const pm = this.pushes.get(sp) || this.pushes.set(sp, new Map()).get(sp);
    for (const t of ids) { if (t === sp) continue; const n = (pm.get(t) || 0) + 1; pm.set(t, n); if (n === 2 && !this.known.has(t) && this.evidence(t) < 55) { this.execSus.set(sp, (this.execSus.get(sp) || 0) + 32); this.chat(t === this.p.id ? `${this.nm(sp)} só insiste em mim... será que é o Execution?` : `O ${this.nm(sp)} só insiste no ${this.nm(t)}, será que é Execution?`, 0.4); } }
  }
  // "Eu tava na <sala>" contra o que o bot viu / contra o que a pessoa já disse.
  checkRoomClaim(sp, text, mentioned) {
    if (sp === this.p.id || mentioned.length || !/\b(tava|estava|fiquei|passei|estive|vim)\b/.test(text)) return; const r = ROOMS.find(q => text.includes(q.name.toLowerCase())); if (!r) return;
    const prev = this.roomClaim.get(sp); if (prev && prev !== r.name) { this.sus(sp, 22, 'mentira'); this.jokerSus.set(sp, (this.jokerSus.get(sp) || 0) + 12); } this.roomClaim.set(sp, r.name);
    const sn = this.seen.get(sp); if (sn && this.mtgStart - sn.t < 45 && roomAt(sn.x, sn.y) && roomName(sn.x, sn.y) !== r.name) { this.sus(sp, 32, 'mentira'); this.chat(`Mentira, ${this.nm(sp)}, eu te vi ${inR(roomName(sn.x, sn.y))} agora há pouco.`, 0.7); }
  }
  // Quem pede para ser votado provavelmente é Joker: não vale a pena ejetar.
  jokerTells(sp, text) {
    if (sp === this.p.id || !/(votem em mim|vota em mim|votar em mim|podem me (votar|ejetar)|me vot|me ejet)/.test(text)) return;
    this.jokerSus.set(sp, (this.jokerSus.get(sp) || 0) + 60); this.chat(`Quem pede pra ser votado parece Joker. Melhor não votar no ${this.nm(sp)}.`, 0.6);
  }
  queueMentClaim() {
    const bad = [...this.known].filter(([id, j]) => id !== this.p.id && JOB[j].team !== 'inn' && !this.deadKnown.has(id)); if (!bad.length) return;
    const lines = bad.slice(0, 3).map(([id, j]) => `${this.nm(id)} é ${JOB[j].name}`).join(', '), first = bad.find(([, j]) => j !== 'joker') || bad[0];
    this.revealed = true; this.chatQ.push({ at: this.clock + rnd(1.2, 2.6), text: `Terminei as tasks, sou Mentalista. ${lines}. Votem no ${this.nm(first[0])}!`.slice(0, 140) }); this.chatQ.sort((a, b) => a.at - b.at);
  }
  // Intenção da mensagem (português informal) e resposta natural, com atraso, limite por reunião e personalidade da profissão.
  intentOf(t0) {
    const t = norm(t0), has = re => re.test(t);
    if (has(/\b(bot|robo|ia|inteligencia artificial|computador|maquina)\b/)) return 'bot';
    if (has(/(ressuscit|reviv|voltou a vida|time ?lord|medico|doutor|trouxe de volta)/)) return 'revive';
    if (has(/(qual|que)\b.*\b(profiss|funcao|role|cargo|papel|classe)/) || has(/\b(voce|vc|tu)\s+e\s+(o\s+|a\s+)?(detetive|xerife|cientista|engenheiro|juiz|mentalista|localizador|barulhento|policial|hacker|medico|advogado)/)) return 'job';
    if (has(/\b(quem morreu|quem era o corpo|de quem e o corpo|quem e o corpo|quem foi o morto|quem foi que morreu)\b/)) return 'whoDead';
    if (has(/\b(onde|aonde|em que sala|que sala)\b/)) return 'where';
    if (has(/(skip|skipa|skipar|pula|pular|pulo|ninguem vota|nao votem|sem voto)/)) return 'skip';
    if (has(/(vota|votem|votar|vamos votar|vamos tirar|ejeta|ejetar|ejetem|mandar embora|bora votar|vamos de)/)) return 'vote';
    if (has(/(quem (foi|matou|viu|sabe|achou)|alguem (viu|sabe|tem)|ninguem (viu|sabe)|viu algo|viu alguma|tem (alguma )?(pista|info|prova))/) || has(/\b(voce|vc|tu)\b.*\b(viu|sabe)\b/)) return 'info';
    if (has(/(confia em mim|podem confiar|pode confiar|confiem em mim|sou inocente|eu sou limpo)/)) return 'trust';
    if (has(/\b(concordo|verdade|exato|isso mesmo|tambem acho|apoio|faz sentido)\b/)) return 'agree';
    if (has(/\b(discordo|nao concordo|nada a ver|mentira|falso|duvido|nao acredito)\b/)) return 'disagree';
    if (has(/\b(oi|ola|eae|e ai|salve|fala|opa|hey|boa noite|bom dia|boa tarde|tudo bem|blz|beleza)\b/)) return 'greet';
    if (has(/\?/)) return 'question';
    return 'generic';
  }
  respond(m, text, mentioned, toMe, accuse) {
    const talk = this.pc('bot_talk'), cap = 1 + Math.round(talk * 5), me = this.p.id;
    if (this.replies >= (toMe ? cap + 4 : cap) || (this.chatQ.length >= 3 && !toMe)) return; if (this.clock - this.lastReplyAt < 2.5) return;
    const intent = this.intentOf(text), others = mentioned.filter(i => i !== me), accusedMe = toMe && accuse, pron = /\b(voc[eê]s?|vcs?|tu|todos|pessoal|galera|gente|alguém|alguem)\b/.test(text);
    let p;
    if (accusedMe) p = 1;
    else if (toMe) p = 0.96 + 0.04 * talk;
    else if (others.length) p = intent === 'vote' || accuse ? 0.12 + 0.35 * talk : 0; // fala com/sobre outro jogador
    else if (intent === 'greet') p = 0.08 + 0.3 * talk; else if (['where', 'info', 'bot', 'job', 'whoDead', 'revive', 'trust'].includes(intent)) p = 0.12 + 0.4 * talk; // pergunta para a sala toda
    else if (intent === 'vote') return; // "votar em quem?" não gera cadeia de respostas
    else if (intent === 'skip') p = pron ? 0.1 + 0.2 * talk : 0.04; else p = intent === 'question' ? 0 : 0.03;
    if (!roll(p)) return;
    const text2 = this.replyText(m, !toMe && others.length && (accuse || intent === 'vote') ? 'vote' : intent, others, accusedMe, toMe); if (!text2) return;
    const at = this.clock + rnd(1.3, 3.4) + text2.length * 0.03; this.replies++; this.lastReplyAt = at; this.chatQ.push({ at, text: text2.slice(0, 140), reply: m.id }); this.chatQ.sort((a, b) => a.at - b.at);
  }
  replyText(m, intent, others, accusedMe, toMe) {
    const me = this.p.id, J = this.job, imp = this.imp, from = this.nm(m.id), room = this.lastRoom || 'um corredor', lieRoom = pick(CENTERS).name, pre = (toMe || roll(0.3)) && roll(0.6) ? from + ': ' : '';
    const top = this.topSuspect(), reason = id => ({ near: 'estava perto do corpo', vent: 'sumiu perto de um duto', sumiu: 'sumiu do nada na minha frente', duplo: 'apareceu duplicado', transformou: 'mudou de aparência', kill: 'eu vi matando', tone: 'tem a cor da pista', accused: 'já tem gente desconfiando dele', last: 'foi o último que vi com a vítima' })[this.why.get(id)] || 'age de forma estranha';
    if (accusedMe && !imp && ['xerife', 'juiz', 'cientista', 'detetive', 'mentalista', 'localizador', 'engenheiro'].includes(J) && roll(0.45)) { this.revealed = true; return `Calma, eu sou ${JOB[J].name}! Tava ${inR(room)} fazendo task.`; }
    if (accusedMe) { const o = this.lieTarget(m.id); return ((imp || J === 'joker') ? pick([`Eu? Tava ${inR(lieRoom)} fazendo task. E o ${o}?`, `Que absurdo! Não fui eu, olha o ${o}.`, `Sem prova não vale, ${from}.`]) : pick([`Não fui eu! Eu tava ${inR(room)} fazendo task.`, `Eu? Tava ${inR(room)} o tempo todo.`, `Calma, ${from}, eu tava ${inR(room)}.`])); }
    switch (intent) {
      case 'bot': return pick([`Bot? kkkk claro que não, tô só jogando.`, `Haha que? Sou gente, ${from}.`, `Que ideia, eu tô aqui jogando normal.`]);
      case 'job': return this.revealed && J !== 'tripulante' ? pre + `Sim, sou ${JOB[J].name}.` : pre + pick([`Sou só tripulante, tava fazendo task.`, `Tripulante normal, nada de especial.`, `Prefiro não falar de função agora.`]);
      case 'where': return pre + (imp ? pick([`Tava ${inR(lieRoom)} fazendo task.`, `Passei ${via(lieRoom)} e vim pra cá.`]) : J === 'joker' ? pick([`Sei lá, andando por aí. E você?`, `Na ${lieRoom}, acho. Ninguém me viu?`]) : pick([`Tava ${inR(room)}, fazendo task.`, `Passei ${via(room)} agora há pouco.`, `Fiquei ${inR(room)}, não vi ninguém estranho.`]));
      case 'info': {
        if (J === 'detetive' && this.toneHint) return pre + `Tenho uma pista: a cor de quem matou é ${this.toneHint}.`;
        if (imp) { const o = this.lieTarget(m.id); return pre + pick([`Vi o ${o} sozinho perto de lá.`, `Não vi nada, mas o ${o} tava estranho.`, `Só passei por lá, não vi nada.`]); }
        if (top && top.v >= 32) return pre + pick([`Só desconfio do ${this.nm(top.id)}: ${reason(top.id)}.`, `O ${this.nm(top.id)} ${reason(top.id)}.`]);
        return pre + pick([`Não vi nada, infelizmente.`, `Sem informação aqui, e vocês?`, `Não sei de nada ainda.`]);
      }
      case 'vote': {
        const x = others[0]; if (x == null) return pre + pick([`Votar em quem?`, `Em quem? Tem alguma prova?`]); const n = this.nm(x), e = this.evidence(x) + this.heatOf(x) * 8;
        if (J === 'execution') return x === this.target ? pick([`Concordo, voto no ${n} também!`, `Isso, vamos de ${n}.`]) : pick([`Hmm, eu desconfio mais do ${this.nm(this.target ?? x)}.`, `Será? Eu acho o ${this.nm(this.target ?? x)} mais suspeito.`]);
        if (imp) return this.mates.has(x) ? pick([`Calma, sem prova não dá pra votar no ${n}.`, `O ${n} tava comigo, não acho justo.`]) : pick([`Concordo, o ${n} tava estranho.`, `Boa, também voto no ${n}.`, `Faz sentido, vamos no ${n}.`]);
        if (J === 'joker') return pick([`Eu votaria no ${n} também. Ou em mim, sei lá.`, `Hmm, não sei, ${n} pode ser.`]);
        return e >= 38 ? pick([`Concordo, o ${n} ${reason(x)}.`, `Também desconfio do ${n}, ${reason(x)}.`]) : pick([`Por que o ${n}? Tem alguma prova?`, `Não tenho certeza do ${n}, o que você viu?`]);
      }
      case 'skip': return pre + (top && top.v >= 40 && !imp ? `Eu não vou pular, voto no ${this.nm(top.id)}.` : this.trusted.has(m.id) || (this.susp.get(m.id) ?? 20) < 35 ? pick([`Se ninguém tem prova, eu pulo junto.`, `Ok, ${from}, vou pular também.`]) : pick([`Pular não ajuda se tiver impostor vivo...`, `Só pulo se ninguém tiver nada mesmo.`]));
      case 'revive': return pre + (this.reviverPossible() ? pick([`Se tem quem ressuscite, melhor não ter pressa pra reportar corpo.`, `Já vi gente voltar, então tem Médico ou Time Lord por aqui.`]) : pick([`Ninguém voltou ainda que eu tenha visto.`, `Não vi ninguém ressuscitar, mas pode ter.`]));
      case 'whoDead': { const d = [...this.meetDead].map(i => this.nm(i)); return pre + (d.length ? `Acho que foi o ${d[d.length - 1]}.` : pick([`Não sei quem foi.`, `Não vi o corpo direito.`])); }
      case 'trust': return pre + (this.discredited(m.id) || (this.susp.get(m.id) ?? 20) > 50 ? pick([`Confiar só com prova, ${from}.`, `Hmm, vou ficar de olho em você.`]) : pick([`Tá bom, por enquanto confio.`, `Beleza, ${from}, confio.`]));
      case 'agree': return toMe ? pre + pick([`Pois é.`, `Isso aí.`]) : null;
      case 'disagree': return toMe ? pre + pick([`Então me convença com fatos.`, `Tá, mas qual a sua prova?`]) : null;
      case 'greet': return pick([`Oi!`, `E aí, ${from}.`, `Fala aí!`, `Opa, tudo certo?`]);
      case 'question': return pre + pick([`Boa pergunta, não sei.`, `Não vi nada, e você?`, `Hmm, tô tentando entender também.`]);
      default: return toMe ? pre + pick([`Fala, tô ouvindo.`, `Pode explicar melhor?`, `Tô de olho em todo mundo.`, `Concordo.`]) : null;
    }
  }

  // ================= decisão =================
  tick(dt) {
    this.clock += dt; if (this.ended || this.room.phase === 'end' || this.room.phase === 'lobby') return;
    const ph = this.room.phase; if (ph === 'play') this.playTick(dt); else if (ph === 'meet') this.meetTick(dt); else if (ph === 'vote') { this.meetTick(dt); this.voteTick(); }
  }
  playTick(dt) {
    const p = this.p; if (this.room.intro > 0) return;
    if (this.pendKill && this.clock - this.pendKill.at > 0.3) { const pk = this.pendKill; this.pendKill = null; if (this.cdKill > 5) this.afterKill(pk); }
    if (this.watching) return this.camTick();
    if (p.vent >= 0) return this.ventTick();
    if (this.pause > 0) { this.pause -= dt; this.stop(); return; }
    if (this.hold > this.clock) { this.stop(); return; }
    if (this.work) return this.workTick();
    if (this.clock - this.abT > 0.5) { this.abT = this.clock; this.abilityTick(); }
    this.react();
    if (!this.goal || this.goalDone()) this.pickGoal();
    this.runGoal(); this.moveAlong();
  }
  // ---- reações de alta prioridade ----
  react() {
    const p = this.p, imp = this.imp;
    if (p.alive && this.sab && (!imp || roll(0.01))) { const g = this.fixGoal(); if (g && (!imp || this.sab.k !== 'heat')) this.setGoal(g); }
    if (p.alive) {
      const b = this.nearestBody();
      if (b && this.bodyReady(b)) {
        if (!imp) this.setGoal({ k: 'report', x: b.x, y: b.y, r: 105, pr: 90, bid: b.id });
        else if (!b.mine && roll(0.002 + this.pc('bot_lie') * 0.01)) this.setGoal({ k: 'report', x: b.x, y: b.y, r: 105, pr: 90, bid: b.id });
        else if (b.mine && !b.decided) { b.decided = true; const alone = this.witnesses(-1) === 0; if (alone && roll(0.1 * this.pc('bot_lie'))) this.setGoal({ k: 'report', x: b.x, y: b.y, r: 105, pr: 90, bid: b.id }); }
      }
      if (!imp && this.danger && this.clock < this.danger.until && !(this.job === 'xerife' && this.ab.cd.skill <= 0)) this.setGoal(this.fleeGoal(this.danger.from, 85));
      if (!imp && this.p.alive && this.emergencyWanted()) this.setGoal({ k: 'emerg', x: SPECIAL.emergency.x, y: SPECIAL.emergency.y + 30, r: 80, pr: 70 });
    }
  }
  nearestBody() { let best = null, bd = 1e9; for (const b of this.bodies.values()) { if (b.rep) continue; const d = dist(b, this.pos); if (d < bd) { bd = d; best = b; } } return best; }
  emergencyWanted() {
    if (this.usedEmerg >= this.room.settings.emergencies || this.clock - this.meetEnd < 25) return false;
    if (this.hiddenDead.size && this.clock - this.meetEnd > 20 && roll(0.05)) return true;
    const top = this.topSuspect(); return !!top && top.v > 92 && roll(0.01);
  }
  fixGoal() {
    const s = this.sab; if (!s) return null; const pts = s.k === 'lights' ? [['lights', SPECIAL.lights]] : s.k === 'comms' ? [['comms', SPECIAL.comms]] : [['A', SPECIAL.heatA, 0], ['B', SPECIAL.heatB, 1]].filter(q => !s.fixed[q[2]]);
    if (!pts.length) return null; pts.sort((a, b) => dist(a[1], this.pos) - dist(b[1], this.pos));
    const [id, pt] = pts[0]; if (this.job === 'engenheiro' && this.ab.cd.remoteFix <= 0) return null;
    return { k: 'fix', x: pt.x, y: pt.y, r: 70, pr: 80, id };
  }
  fleeGoal(from, pr) {
    let best = null, bs = -1; for (const c of CENTERS) { const d = dist(c, from) - dist(c, this.pos) * 0.3 + (this.crowd(c) * 120) + rnd(0, 200); if (d > bs) { bs = d; best = c; } }
    return { k: 'flee', x: best.x + rnd(-60, 60), y: best.y + rnd(-60, 60), r: 70, pr, until: this.clock + 9 };
  }
  crowd(c) { let n = 0; for (const [id, o] of this.seen) if (this.clock - o.t < 20 && dist(o, c) < 350) n++; return n; }
  witnesses(excl) {
    const R = this.sab?.k === 'lights' ? 175 : 430; let n = 0;
    for (const o of this.vis.values()) if (!o.ghost && o.id !== excl && !this.mates.has(o.id) && dist(o, this.pos) < R) n++; return n;
  }
  topSuspect(filter) {
    let best = null; for (const [id, v] of this.susp) { if (this.deadKnown.has(id) || id === this.p.id || this.mates.has(id) || (filter && !filter(id))) continue; if (!best || v > best.v) best = { id, v }; } return best;
  }
  // ---- metas ----
  setGoal(g) {
    const cg = this.goal; if (cg && !this.goalDone()) { if (cg.pr > g.pr) return false; if (cg.k === g.k && cg.id === g.id && cg.bid === g.bid) return true; }
    this.goal = { ...g, t0: this.clock }; this.path = null; this.pi = 0; this.repath = 0; return true;
  }
  goalDone() { const g = this.goal; return !g || g.done || (g.until && this.clock > g.until); }
  pickGoal() {
    const p = this.p, J = this.eff(); this.lastGoalPick = this.clock;
    if (p.alive && this.team === 'neu') { const g = this.neutralGoal(); if (g) return void this.setGoal(g); }
    if (p.alive && this.imp) { const g = this.impGoal(); if (g) return void this.setGoal(g); }
    if (p.alive && (J === 'xerife' || J === 'mentalista' || J === 'policial')) { const t = this.topSuspect(id => !this.known.has(id) || JOB[this.known.get(id)].team !== 'inn'); if (t && t.v > 55 && p.alive && roll(0.6)) return void this.setGoal({ k: 'follow', id: t.id, r: 140, pr: 35, until: this.clock + rnd(10, 22) }); }
    const pend = this.tasks.filter(t => !t.done && this.taskOpen(t) && !(this.badGoal.get('task|' + t.id) > this.clock)), task = this.pc('bot_task');
    if (pend.length && roll(task)) { const t = this.chooseTask(pend); return void this.setGoal({ k: 'task', id: t.id, x: STN[t.id].x, y: STN[t.id].y + 34, r: 50, pr: 40 }); }
    if (p.alive && roll(this.pc('bot_follow') * 0.5)) { const o = this.someoneRecent(); if (o) return void this.setGoal({ k: 'follow', id: o, r: 160, pr: 30, until: this.clock + rnd(6, 16) }); }
    if (p.alive && !this.imp && roll(this.pc('bot_cam') * 0.1)) return void this.setGoal({ k: 'cam', x: SPECIAL.camConsole.x, y: SPECIAL.camConsole.y + 30, r: 60, pr: 25 });
    this.setGoal(this.wanderGoal());
  }
  taskOpen(t) { return !this.fz.some(id => ROOM_BY_ID[id]?.name === t.room); }
  aggr() { const a = this.pc('bot_aggr'); return this.job === 'samurai' ? clamp(a + (this.xt.arm > 0 ? 0.18 : -0.18), 0, 1) : a; }
  chooseTask(pend) { const w = pend.map(t => 1 / (dist(STN[t.id], this.pos) + 250) / (1 + 0.6 * this.crowd(STN[t.id]))); let r = Math.random() * w.reduce((a, b) => a + b, 0); for (let i = 0; i < pend.length; i++) { r -= w[i]; if (r <= 0) return pend[i]; } return pend[0]; }
  someoneRecent() { const a = [...this.seen].filter(([id, o]) => this.clock - o.t < 15 && !this.deadKnown.has(id)); return a.length ? pick(a)[0] : null; }
  wanderGoal() { const c = [...CENTERS].sort((a, b) => (this.crowd(a) + Math.random() * 2) - (this.crowd(b) + Math.random() * 2))[0]; return { k: 'wander', x: c.x + rnd(-110, 110), y: c.y + rnd(-90, 90), r: 60, pr: 10 }; }
  neutralGoal() {
    if (this.job === 'execution' && this.target != null && !this.deadKnown.has(this.target)) { const s = this.seen.get(this.target); if (s && roll(0.8)) return { k: 'follow', id: this.target, r: 150, pr: 35, until: this.clock + rnd(12, 25) }; }
    if (this.job === 'parinomo' || this.job === 'virus') { const g = this.fuelVirGoal(); if (g) return g; }
    if (this.job === 'joker') { const r = roll(0.5), o = this.someoneRecent(); if (o && r) return { k: 'follow', id: o, r: 90, pr: 35, until: this.clock + rnd(8, 18) }; const b = [...this.bodies.values()][0]; if (b) return { k: 'wander', x: b.x, y: b.y, r: 120, pr: 35 }; }
    return null;
  }
  fuelVirGoal() {
    const x = this.xt, pa = this.job === 'parinomo', prog = pa ? x.pf : x.vi, done = pa ? new Set(x.pids || []) : new Set(x.vids || []);
    if (!prog) return null;
    if (pa && prog[1] > 0 && prog[0] >= prog[1]) { // todos abastecidos: procurar o isqueiro
      if (x.hl) return null;
      if (x.lt) return { k: 'lighter', x: x.lt[0], y: x.lt[1], r: 55, pr: 70 };
      if (x.ls) { const c = pick(CENTERS); return { k: 'wander', x: c.x + rnd(-110, 110), y: c.y + rnd(-90, 90), r: 80, pr: 50 }; }
      return null;
    }
    if (!pa && prog[1] > 0 && prog[0] >= prog[1]) return null; // pronto para explodir
    const cand = [...this.seen].filter(([id, o]) => !done.has(id) && !this.deadKnown.has(id) && !o.ghost && this.clock - o.t < 20).sort((a, c) => dist(a[1], this.pos) - dist(c[1], this.pos))[0];
    if (cand) return { k: 'follow', id: cand[0], r: 70, pr: 60, until: this.clock + rnd(8, 16) };
    const c = pick(CENTERS); return { k: 'wander', x: c.x + rnd(-110, 110), y: c.y + rnd(-90, 90), r: 80, pr: 20 };
  }
  impGoal() {
    const ready = this.cdKill === 0 && this.clock - this.gameT0 > 14 && this.clock - this.meetEnd > 8, prey = ready ? this.preyCandidate() : null;
    if (prey && roll(0.25 + this.aggr() * 0.7)) return { k: 'hunt', id: prey.id, r: 70, pr: 60, until: this.clock + 14 };
    if (ready && roll(this.aggr() * 0.6)) { const t = this.isolatedTarget(); if (t) return { k: 'seek', x: t.x, y: t.y, r: 120, pr: 45 }; }
    if (!this.ab.cd.vent && roll(0.05 * this.aggr())) { const v = VENTS.filter(q => dist(q, this.pos) < 500).sort((a, b) => dist(a, this.pos) - dist(b, this.pos))[0]; if (v) return { k: 'vent', x: v.x, y: v.y + 8, r: 50, pr: 55 }; }
    const pend = this.tasks.filter(t => !t.done && this.taskOpen(t)); if (pend.length && roll(0.6)) { const t = this.chooseTask(pend); return { k: 'task', id: t.id, x: STN[t.id].x, y: STN[t.id].y + 34, r: 50, pr: 40, fake: true }; }
    return null;
  }
  preyCandidate() { let best = null, bd = 1e9; for (const o of this.vis.values()) { if (o.ghost || this.mates.has(o.id)) continue; const d = dist(o, this.pos); if (d < bd && this.witnesses(o.id) <= (roll(this.pc('bot_err') * 0.4) ? 1 : 0)) { bd = d; best = o; } } return best; }
  isolatedTarget() { let best = null, bs = 1e9; for (const [id, o] of this.seen) { if (this.mates.has(id) || this.deadKnown.has(id) || this.clock - o.t > 25) continue; let near = 0; for (const [id2, o2] of this.seen) if (id2 !== id && !this.mates.has(id2) && this.clock - o2.t < 25 && dist(o, o2) < 400) near++; const s = near * 400 + dist(o, this.pos) * 0.3; if (s < bs) { bs = s; best = o; } } return best; }
  runGoal() {
    const g = this.goal; if (!g || g.done) return;
    if (g.k === 'follow' || g.k === 'hunt') {
      const o = this.vis.get(g.id) || this.seen.get(g.id); if (!o || this.clock - (o.t ?? this.clock) > 12) { g.done = true; return; } g.x = o.x; g.y = o.y; g.dyn = true;
      if (g.k === 'hunt') { const t = this.vis.get(g.id); if (t) { const d = dist(t, this.pos); if (d < KILL_R - 12 && this.nearestIs(t)) { if (this.cdKill === 0 && this.witnesses(t.id) <= (this.sabKillTol())) { this.doKill(t); g.done = true; } else if (this.cdKill > 0) g.done = true; } } }
    }
    if (g.k === 'task' && this.p.alive && !g.fake && this.tasks.find(t => t.id === g.id)?.done) g.done = true;
  }
  sabKillTol() { return roll(this.pc('bot_err') * 0.3) ? 1 : 0; }
  nearestIs(t) { const d = dist(t, this.pos); for (const o of this.vis.values()) if (o.id !== t.id && !o.ghost && !this.mates.has(o.id) && dist(o, this.pos) < d + 8) return false; return true; }
  moveAlong() {
    const g = this.goal; if (!g || g.done) { this.stop(); return; }
    const d = Math.hypot(g.x - this.pos.x, g.y - this.pos.y); if (d < (g.r ?? 55)) { this.arrive(); return; }
    if (this.ab?.act?.phase > 0) { this.input((g.x - this.pos.x) / (d || 1), (g.y - this.pos.y) / (d || 1)); return; } // Ghost Inc: atravessa em linha reta
    if (!this.path || (g.dyn && this.clock > this.repath)) { this.path = findPath(this.pos.x, this.pos.y, g.x, g.y, this.fz.length ? this.fz.map(id => ROOM_BY_ID[id]) : null); this.pi = 0; this.repath = this.clock + 0.9; if (!this.path || !this.path.length) { g.done = true; this.badGoal.set(g.k + '|' + (g.id ?? Math.round(g.x / 100) + ',' + Math.round(g.y / 100)), this.clock + 30); this.stop(); return; } }
    let w = this.path[this.pi]; while (w && Math.hypot(w.x - this.pos.x, w.y - this.pos.y) < 24 && this.pi < this.path.length - 1) { this.pi++; w = this.path[this.pi]; if (roll(0.05 * this.pc('bot_wait') * this.trait.brave)) { this.pause = rnd(0.4, 1.4); } }
    if (!w) return;
    if (this.clock < this.wiggle) { this.input(Math.cos(this.wigDir), Math.sin(this.wigDir)); return; } // destravar: anda para um lado aleatório por instantes
    if (this.clock - this.stuckT > 1.4) {
      if (Math.hypot(this.pos.x - this.stuckP.x, this.pos.y - this.stuckP.y) < 8 && this.lastIn !== '0.0,0.0') {
        this.path = null; this.stuckN++;
        if (this.stuckN >= 2) { this.wiggle = this.clock + 0.45; this.wigDir = rnd(0, Math.PI * 2); }
        if (this.stuckN >= 4) { this.badGoal.set(this.goal.k + '|' + (this.goal.id ?? Math.round(this.goal.x / 100) + ',' + Math.round(this.goal.y / 100)), this.clock + 45); this.goal.done = true; this.stuckN = 0; this.stop(); }
      } else this.stuckN = 0;
      this.stuckT = this.clock; this.stuckP = { ...this.pos };
    }
    const dx = w.x - this.pos.x, dy = w.y - this.pos.y, l = Math.hypot(dx, dy) || 1; this.input(dx / l, dy / l);
  }
  arrive() {
    const g = this.goal; this.stop();
    switch (g.k) {
      case 'task': this.startWork(g.id, g.fake); g.done = true; break;
      case 'report': { const b = this.bodies.get(g.bid); g.done = true; if (!b) break; if (this.eff() === 'detetive') this.act({ t: 'ab', a: 'investigate' }); this.act({ t: 'report' }); b.rep = true; break; }
      case 'fix': this.act({ t: 'fix', id: g.id }); this.pause = rnd(0.3, 0.9); g.done = true; break;
      case 'emerg': if (this.ec === 0) { this.act({ t: 'emergency' }); this.usedEmerg++; } g.done = true; break;
      case 'cam': this.act({ t: 'ab', a: 'cam' }); this.watching = true; this.watchUntil = this.clock + rnd(6, 11); g.done = true; break;
      case 'lighter': this.act({ t: 'ab', a: 'lighter' }); g.done = true; break;
      case 'drop': this.act({ t: 'ab', a: 'drop' }); g.done = true; break;
      case 'mcarry': this.act({ t: 'ab', a: 'mcarry' }); g.done = true; this.pause = rnd(0.2, 0.5); break;
      case 'mrevive': this.act({ t: 'ab', a: 'revive' }); g.done = true; this.pause = rnd(0.6, 1.2); break;
      case 'vent': this.act({ t: 'vent', a: 'in' }); this.ventUntil = this.clock + rnd(2, 5); g.done = true; break;
      case 'wander': case 'seek': case 'flee': g.done = true; this.pause = roll(this.pc('bot_wait')) ? rnd(0.3, 1.6) : 0; break;
      default: break;
    }
  }
  startWork(id, fake) {
    const t = this.tasks.find(x => x.id === id && !x.done); if (!t) return; this.act({ t: 'taskStart', id });
    this.work = { id, fake, until: this.clock + TASK_MIN[t.type] / 1000 + 0.35 + rnd(0.5, 2.8) * (1.6 - this.pc('bot_skill')) };
  }
  urgent() { if (!this.p.alive) return false; const b = this.nearestBody(); if (b && this.bodyReady(b) && !this.imp) return true; return !this.imp && !!this.sab && roll(0.1); }
  workTick() {
    this.stop(); if (this.urgent()) { this.work = null; return; }
    if (this.clock < this.work.until) return; const w = this.work; this.work = null;
    if (roll(this.pc('bot_err') * 0.25)) return; // erro humano: desistiu no meio
    this.act({ t: 'taskDone', id: w.id });
  }
  ventTick() {
    this.stop(); if (this.clock < this.ventUntil) return;
    if ([...this.vis.values()].some(o => !o.ghost && !this.mates.has(o.id) && dist(o, this.pos) < 160) && this.clock < this.ventUntil + 7) return;
    if (roll(0.35)) { this.act({ t: 'vent', a: 'next' }); this.ventUntil = this.clock + rnd(1, 2.5); return; }
    this.act({ t: 'vent', a: 'out' }); this.pause = rnd(0.4, 1); this.goal = null;
  }
  camTick() {
    this.stop(); const hb = [...this.bodies.values()].find(b => !b.rep && b.cam);
    if (hb || this.clock > this.watchUntil) { this.act({ t: 'ab', a: 'camOff' }); this.watching = false; if (hb) this.setGoal({ k: 'report', x: hb.x, y: hb.y, r: 105, pr: 90, bid: hb.id }); }
  }
  doKill(t) { this.act({ t: 'kill' }); this.lastKillAt = this.clock; this.pendKill = { id: t.id, at: this.clock, x: t.x, y: t.y }; }
  afterKill(pk) {
    const wit = this.witnesses(-1), J = this.job; this.stop();
    if (J === 'espectro' && wit > 0 && !(this.ab.cd.invis > 0) && !(this.ab.act.invis > 0)) this.act({ t: 'ab', a: 'invis' });
    if (J === 'metamorfo' && (wit > 0 || roll(0.4)) && !(this.ab.cd.morph > 0)) { const c = [...this.seen].filter(([id, o]) => !this.mates.has(id) && !this.deadKnown.has(id) && id !== this.p.id && this.clock - o.t < 40 && dist(o, pk) > 500); const to = (c.length ? pick(c) : pick([...this.seen].filter(([id]) => !this.mates.has(id) && !this.deadKnown.has(id))) || [null])[0]; if (to != null) this.act({ t: 'ab', a: 'morph', to }); }
    const v = VENTS.filter(q => dist(q, this.pos) < 230).sort((a, b) => dist(a, this.pos) - dist(b, this.pos))[0];
    if (v && wit === 0 && J !== 'vibora' && roll(0.55)) this.setGoal({ k: 'vent', x: v.x, y: v.y + 8, r: 50, pr: 88 });
    else this.setGoal(this.fleeGoal(pk, 86)), J === 'vibora' && (this.goal.until = this.clock + 3);
  }

  // ---- habilidades por profissão (sempre via mensagens do jogo; recargas/usos conferidos pelo servidor) ----
  abilityTick() {
    const p = this.p, J = this.eff(), use = this.pc('bot_abil'), ab = this.ab;
    switch (J) {
      case 'engenheiro': if (p.alive && this.sab && !(ab.cd.remoteFix > 0) && roll(0.4 + use * 0.5)) this.act({ t: 'ab', a: 'remoteFix' }); break;
      case 'cientista': if (p.alive && ab.us.panel > 1 && this.clock > this.nextPanel && roll(use * 0.3)) { this.act({ t: 'ab', a: 'panel' }); this.nextPanel = this.clock + rnd(60, 120); } break;
      case 'xerife': this.shootCheck(); break;
      case 'mentalista': this.shootCheck(); this.locateSuspect(use); this.probeCheck(use); break;
      case 'localizador': this.locateSuspect(use); break;
      case 'anjo': this.angelTick(use); break;
      case 'redjohn': this.rjCheck(use); this.zoomTick(use); break;
      case 'policial': this.shootCheck(); this.zoomTick(use); break;
      case 'hacker': this.hackTick(use); break;
      case 'ghostinc': this.ghostTick(use); break;
      case 'timelord': this.rewindTick(use); break;
      case 'congelador': this.freezeTick(use); break;
      case 'parinomo': this.paTick(); break;
      case 'virus': this.virTick(); break;
      case 'dexter': this.dexTick(use); break;
      case 'medico': this.medicTick(use); break;
      case 'lovers': this.loversTick(); break;
      case 'metamorfo': case 'espectro': case 'impostor': case 'vibora': case 'samurai': break;
    }
    if (p.alive) this.phClickTick(use);
    if (p.alive && this.imp) this.impSab();
    if (p.alive && this.job === 'espectro' && !(ab.cd.invis > 0) && !(ab.act.invis > 0) && this.cdKill === 0 && roll(use * 0.25)) { const pr = this.preyCandidate(); if (pr && dist(pr, this.pos) < 450) this.act({ t: 'ab', a: 'invis' }); }
  }
  // ---------- v1.0: habilidades das novas profissões (usam só informação que o bot recebeu) ----------
  nearVis(r, pred = () => true) { let best = null, bd = r; for (const o of this.vis.values()) { if (o.ghost || !pred(o)) continue; const d = dist(o, this.pos); if (d < bd) { best = o; bd = d; } } return best; }
  rjCheck(use) {
    if (!this.p.alive || this.ab.cd.rjinv > 0 || !(this.ab.us.rj > 0) || this.p.vent >= 0 || !roll(0.3 + use * 0.5)) return;
    const o = this.nearVis(KILL_R - 12, q => !this.mates.has(q.id) && !this.known.has(q.id)); if (o) this.act({ t: 'ab', a: 'rjinv' });
  }
  zoomTick(use) {
    if (!this.p.alive || this.ab.cd.zoom > 0 || this.ab.act.zoom > 0 || !roll(use * 0.04)) return;
    if (this.imp && !(this.cdKill === 0 && !this.nearVis(500))) return; this.act({ t: 'ab', a: 'zoom' }); // impostor: só quando procura presa
  }
  hackTick(use) {
    if (!this.p.alive) return;
    if (this.sab?.k === 'comms' && !(this.ab.cd.remoteFix > 0)) { this.act({ t: 'ab', a: 'remoteFix' }); return; }
    if (!this.watching && !this.sab && this.room.phase === 'play' && this.p.vent < 0 && roll(use * 0.05)) { this.act({ t: 'ab', a: 'cam' }); this.watching = true; this.watchUntil = this.clock + rnd(5, 9); }
  }
  ghostTick(use) {
    const g = this.goal; if (!this.p.alive || !g || g.done || this.ab.cd.phase > 0 || this.ab.act.phase > 0 || !this.path || !roll(use * 0.7)) return;
    const d = dist(g, this.pos); if (d > 520 || d < 150) return; let len = 0, a = this.pos; for (let i = this.pi; i < this.path.length; i++) { len += dist(a, this.path[i]); a = this.path[i]; }
    if (len > d * 2.1 || (this.danger && roll(0.5))) this.act({ t: 'ab', a: 'phase' });
  }
  rewindTick(use) {
    if (!this.p.alive || this.ab.cd.rewind > 0 || !(this.ab.us.tl > 0) || !roll(0.3 + use * 0.5)) return;
    const win = this.c('tl_rew') - 2, b = [...this.bodies.values()].find(q => !q.rep && !q.remote && !q.cam && this.clock - (q.first ?? q.t) < win && this.clock - (q.first ?? q.t) > 0.5);
    if (b) { this.act({ t: 'ab', a: 'rewind' }); this.lastRewindAt = this.clock; this.bodies.clear(); }
  }
  freezeTick(use) {
    const sel = this.xt.sel || []; if (!this.p.alive || this.ab.cd.freeze > 0 || sel.length >= this.c('frz_n') || !roll(0.1 + use * 0.25)) return;
    const cand = FREEZABLE.filter(id => !this.fz.includes(id) && !sel.includes(id)); if (!cand.length) return;
    const score = id => { const r = ROOM_BY_ID[id]; let n = 0; for (const o of this.seen.values()) if (this.clock - o.t < 40 && o.x > r.x && o.x < r.x + r.w && o.y > r.y && o.y < r.y + r.h) n++; return n + Math.random() * 1.5; };
    cand.sort((a, c) => score(c) - score(a)); this.act({ t: 'ab', a: 'freeze', room: cand[0] });
  }
  paTick() {
    const x = this.xt, p = this.p; if (!p.alive) return;
    if (x.hl) { this.act({ t: 'ab', a: 'ignite' }); return; }
    if (x.pf && x.pf[1] > 0 && x.pf[0] >= x.pf[1]) { if (x.lt && dist({ x: x.lt[0], y: x.lt[1] }, this.pos) < 95) this.act({ t: 'ab', a: 'lighter' }); return; }
    if (this.ab.cd.fuel > 0) return; const o = this.nearVis(KILL_R - 12, q => !(x.pids || []).includes(q.id)); if (o) this.act({ t: 'ab', a: 'fuel' });
  }
  virTick() {
    const x = this.xt, p = this.p; if (!p.alive || !x.vi) return;
    if (x.vi[1] > 0 && x.vi[0] >= x.vi[1]) { if (roll(0.7)) this.act({ t: 'ab', a: 'explode' }); return; }
    if (this.ab.cd.infect > 0) return; const o = this.nearVis(KILL_R - 12, q => !(x.vids || []).includes(q.id)); if (o) this.act({ t: 'ab', a: 'infect' });
  }
  dexTick(use) {
    const p = this.p; if (!p.alive) return;
    if (this.xt.carry > 0) {
      if (!this.goal || this.goal.k !== 'drop') { const hid = ROOMS.filter(r => r.hidden || r.id === 'externa' || r.id === 'geradores'), r = pick(hid); this.setGoal({ k: 'drop', x: r.x + r.w / 2, y: r.y + r.h / 2, r: 70, pr: 85, until: this.clock + 25 }); }
      if (this.xt.carry <= 3) this.act({ t: 'ab', a: 'drop' }); return;
    }
    if (this.ab.cd.bag > 0 || !roll(0.4 + use * 0.5)) return;
    const b = [...this.bodies.values()].find(q => !q.rep && dist(q, this.pos) < REPORT_R - 25); if (!b) return;
    if (this.nearVis(450, q => !this.mates.has(q.id) && !q.ghost)) return; // há testemunhas: não arrisca
    this.act({ t: 'ab', a: 'bag' }); this.bodies.delete(b.id);
  }
  phClickTick(use) {
    if (!roll(0.15 + use * 0.2)) return; const o = [...this.vis.values()].find(q => q.ph && dist(q, this.pos) < PH_R - 20); if (o) this.act({ t: 'ab', a: 'phclick', to: o.id });
  }
  evidence(id) { const j = this.known.get(id); if (j) return JOB[j].team !== 'inn' && j !== 'joker' ? 100 : -100; return this.susp.get(id) ?? 20; }
  shootCheck() {
    const p = this.p; if (!p.alive || this.ab.cd.skill > 0 || p.vent >= 0) return;
    const cand = [...this.vis.values()].filter(o => !o.ghost && !this.deadKnown.has(o.id)).map(o => ({ o, e: this.evidence(o.id) + (this.heatOf(o.id) >= 2 && !this.known.has(o.id) ? 10 : 0) })).filter(x => x.e >= 94 && !(this.known.get(x.o.id) === 'joker')).sort((a, b) => b.e - a.e)[0];
    if (!cand) { const t = this.topSuspect(); if (t && t.v >= 94 && this.seen.get(t.id) && this.clock - this.seen.get(t.id).t < 20 && roll(0.2)) this.setGoal({ k: 'hunt', id: t.id, r: 70, pr: 70, until: this.clock + 12 }); return; }
    const d = dist(cand.o, this.pos); if (d < KILL_R - 14 && this.nearestIs(cand.o)) { this.act({ t: 'ab', a: 'skill' }); } else this.setGoal({ k: 'hunt', id: cand.o.id, r: 70, pr: 70, until: this.clock + 10 });
  }
  locateSuspect(use) { if (!this.p.alive || this.ab.cd.locate > 0 || this.ab.act.locate > 0 || !roll(use * 0.5)) return; const t = this.topSuspect() || { id: pick([...this.roster.keys()].filter(i => i !== this.p.id && !this.deadKnown.has(i)) || [0]) }; if (t && t.id != null) this.act({ t: 'ab', a: 'locate', to: t.id }); }
  probeCheck(use) {
    if (!this.p.alive || this.ab.cd.probe > 0 || this.probeBusy) return; const cand = [...this.vis.values()].filter(o => !o.ghost && !o.mv && dist(o, this.pos) < 100 && !this.known.has(o.id) && (this.susp.get(o.id) ?? 20) > 28).sort((a, b) => (this.susp.get(b.id) ?? 20) - (this.susp.get(a.id) ?? 20))[0];
    if (cand && roll(use)) { this.act({ t: 'ab', a: 'probe' }); this.hold = this.clock + this.c('men_inv') + 0.6; }
  }
  angelTick(use) {
    if (this.p.alive || this.ab.cd.shield > 0 || !roll(use * 0.5) || this.room.phase !== 'play') return; let best = null, bs = 0;
    for (const o of this.vis.values()) { if (o.ghost || this.deadKnown.has(o.id)) continue; const others = [...this.vis.values()].filter(q => q.id !== o.id && !q.ghost); const close = others.filter(q => dist(q, o) < 260), farGroup = others.filter(q => dist(q, o) < 480); if (close.length === 1 && farGroup.length === 1) { const s = 1 + (260 - dist(close[0], o)) / 260; if (s > bs) { bs = s; best = o; } } }
    if (!best && roll(0.04)) best = pick([...this.vis.values()].filter(o => !o.ghost && !this.deadKnown.has(o.id)) || [null]); if (best) this.act({ t: 'ab', a: 'shield', to: best.id });
  }
  impSab() {
    if (this.sab || this.sabCd > 0 || this.clock - this.gameT0 < 25 || this.clock - this.meetEnd < 12 || !roll(this.pc('bot_sab') * 0.05)) return;
    const prey = this.cdKill === 0 ? this.preyCandidate() : null; let k;
    if (prey && roll(0.7)) k = 'lights'; else if (this.clock - this.camLed < 30 || roll(0.35)) k = 'comms'; else k = pick(['heat', 'lights', 'comms']);
    this.act({ t: 'sabotage', k });
  }

  // ================= reuniões: chat e voto =================
  meetTick() {
    const p = this.p, t = this.clock - this.mtgStart;
    if (p.alive) {
      if (!this.panelDone && t > 1.2) { this.panelDone = true; this.meetAbilities(); }
      while (this.chatQ.length && this.clock > this.chatQ[0].at + 25) this.chatQ.shift();
      const q = this.chatQ[0]; if (q && this.clock >= q.at && this.clock - this.lastSend >= this.c('bot_gap_own') && this.room.botCanSpeak()) { this.chatQ.shift(); if (q.reply != null && this.said.has(q.text.toLowerCase().replace(/^[^:]{1,14}:\s*/, ''))) return; this.lastSend = this.clock; this.room.botSpoke(); this.act({ t: 'chat', text: q.text }); }
    } else if (this.ghostJob === 'influencer' && !this.panelDone && t > 1.5) { this.panelDone = true; this.infSend(); }
  }
  meetAbilities() {
    const J = this.job, use = this.pc('bot_abil');
    if ((J === 'cientista' || J === 'mentalista') && this.ab.us.panel > 0 && roll(0.4 + use * 0.6)) this.act({ t: 'ab', a: 'panel' });
    if (J === 'mentalista' && this.jp) this.act({ t: 'ab', a: 'jobpanel' });
  }
  infSend() {
    if (!(this.ab.us.inf > 0) && this.ab.us.inf !== undefined) return; const alive = [...this.mtgAlive].filter(i => i !== this.p.id); if (!alive.length || !roll(0.4 + this.pc('bot_abil') * 0.6)) return;
    alive.sort((a, b) => (this.susp.get(a) ?? 20) - (this.susp.get(b) ?? 20)); const to = alive[0]; const kind = this.deathBy === 'kill' ? (roll(0.65) ? 'job' : 'tone') : 'where';
    this.act({ t: 'ab', a: 'infmsg', to, kind });
  }
  defend(accuser) {
    if (!roll(0.9) || !this.p.alive) return; const at = this.clock + rnd(1.5, 4), room = this.lastRoom || 'um corredor', J = this.job, me = this.p.id; let text;
    if (this.imp || J === 'joker') { const o = this.lieTarget(accuser); text = pick([`Eu? Tava ${inR(pick(CENTERS).name)} fazendo task. E o ${o}, ninguém viu ele?`, `Que absurdo, ${this.nm(accuser)}. Tá tentando me tirar do jogo?`, `Não fui eu! Vi o ${o} bem estranho antes.`]); }
    else text = pick([`Não fui eu, eu tava ${inR(room)} fazendo task.`, `Pode confiar, tava ${inR(room)} o tempo todo.`, `Eu? Nunca! Estava ${inR(room)}.`]);
    this.chatQ.push({ at, text }); this.chatQ.sort((a, b) => a.at - b.at);
  }
  lieTarget(excl) {
    const cands = [...this.mtgAlive].filter(i => i !== this.p.id && !this.mates.has(i) && i !== excl); if (!cands.length) return this.nm(excl);
    cands.sort((a, b) => (this.heatOf(b) * 12 + (this.susp.get(b) ?? 20)) - (this.heatOf(a) * 12 + (this.susp.get(a) ?? 20))); return this.nm(roll(0.7) ? cands[0] : pick(cands));
  }
  compose(m) {
    const out = [], me = this.p.id, imp = this.imp, J = this.job, D = this.room.settings.discuss, room = this.lastRoom || 'um corredor';
    const nMsg = Math.max(0, Math.round(this.pc('bot_talk') * this.trait.chatty * rnd(1, 3.6))), body = m.body != null ? m.body : null;
    const top = this.topSuspect(); const reason = id => ({ near: 'estava perto do corpo', vent: 'sumiu perto de um duto', sumiu: 'sumiu do nada na minha frente', duplo: 'apareceu duplicado', transformou: 'mudou de aparência', kill: 'eu vi matando', tone: 'tem a cor da pista', accused: 'tá muito suspeito', last: 'foi o último que vi com a vítima' })[this.why.get(id)] || 'age de forma estranha';
    const pri = this.factLines();
    if (m.by === me) out.push(m.reason === 'body' ? pick([`Achei um corpo ${inR(room)}!`, `Corpo ${inR(room)}, gente!`, `Morreu alguém ${inR(room)}.`]) : pick([`Chamei porque tem algo errado.`, `Reunião: precisamos conversar.`]));
    if (J === 'detetive' && this.toneHint) out.push(`Sou detetive: a pista aponta para a cor ${this.toneHint}.${top && top.v >= 40 ? ' Desconfio do ' + this.nm(top.id) + '.' : ''}`);
    if ((imp && roll(0.25 * this.pc('bot_lie'))) || (J === 'joker' && roll(0.2))) {
      const pool = ['detetive', 'cientista', 'engenheiro'].filter(j => this.room.settings['m_' + j] > 0 && this.room.settings['w_' + j] > 0 && ![...this.claims.values()].some(c => c.job === j));
      if (pool.length) { const fj = pick(pool), o = this.lieTarget(-1), ct = [...this.roster].find(([id]) => this.nm(id) === o); out.unshift(fj === 'detetive' ? `Sou detetive: a pista aponta para a cor ${ct ? colorTone(ct[1].look.c) : 'escura'}. Votem no ${o}.` : `Sou ${JOB[fj].name} e vi o ${o} muito suspeito.`); }
    }
    if (!imp && J !== 'joker' && J !== 'execution') {
      out.push(pick([`Eu tava ${inR(room)} fazendo task.`, `Estava ${inR(room)}, não vi nada.`, `Passei ${via(room)} agora há pouco.`]));
      if (top && top.v >= 32) out.push(pick([`Acho o ${this.nm(top.id)} suspeito: ${reason(top.id)}.`, `Desconfio do ${this.nm(top.id)}, ${reason(top.id)}.`, `${this.nm(top.id)} ${reason(top.id)}. Voto nele.`]));
      else out.push(pick([`Não tenho certeza de ninguém ainda.`, `Sem informação, vou pular se ninguém tiver nada.`]));
      if (this.hiddenDead.size) out.push(`Alguém morreu e ninguém achou o corpo, tem algo estranho.`);
      if ((J === 'cientista' || J === 'mentalista') && this.ab.us.panel > 0) out.push(`Vou checar quem está vivo.`);
      if (J === 'mentalista' && this.jp) out.push(`Tenho informação confiável, vou falar já.`);
      if (J === 'juiz' && this.supLeft > 0 && top && top.v > 80) out.push(`Se for preciso, eu resolvo isso.`);
    } else if (imp) {
      const o = this.lieTarget(-1), r2 = pick(CENTERS).name;
      out.push(pick([`Eu tava ${inR(r2)} fazendo task.`, `Fiquei ${inR(r2)} o tempo todo.`, `Passei ${inR(r2)} e depois vim pra cá.`]));
      if (roll(0.3 + this.pc('bot_lie') * 0.65)) out.push(pick([`Vi o ${o} perto do corpo, ${pick(['achei estranho', 'saindo correndo', 'sozinho'])}.`, `O ${o} tá muito suspeito, votem nele.`, `Desconfio do ${o}, sumiu depois.`]));
      if (roll(0.2)) out.push(pick([`Sem acusação sem prova, galera.`, `Calma, vamos pensar antes de votar.`]));
    } else if (J === 'execution') {
      const t = this.nm(this.target ?? -1), r2 = pick(CENTERS).name;
      out.push(pick([`O ${t} tava estranho, vi ele ${inR(r2)} sozinho.`, `Não confio no ${t}.`, `${t} some toda hora, voto nele.`]));
      out.push(pick([`Alguém mais viu o ${t}?`, `Todo mundo devia votar no ${t}.`]));
    } else if (J === 'joker') {
      const o = this.lieTarget(-1);
      out.push(pick([`Não vi ninguém. Mas o ${o} me seguiu.`, `Tava ${inR(pick(CENTERS).name)}, mas não sei se alguém me viu.`, `Sei lá, ${o} tá com cara de culpado.`, `Hmm... foi o ${o}? Ou foi o ${this.nm(pick([...this.mtgAlive]))}?`]));
      out.push(pick([`Eu tava perto do corpo, mas só passei por ali.`, `Ninguém me viu fazendo task, né? Estranho.`, `Podem votar em mim se quiserem, tanto faz.`]));
    }
    const slots = [...pri.slice(0, 2), ...out.slice(0, Math.max(nMsg, m.by === me ? 1 : 0))], res = []; let at = this.clock + rnd(1.5, 5);
    for (const text of slots) { res.push({ at, text }); at += rnd(2.2, Math.max(4, D * 0.22)); }
    return res.filter(x => x.at < this.clock + D * 0.9 || true);
  }
  // Frases de dedução baseadas no que o bot realmente viu/ouviu/descobriu (impostores não entregam a si mesmos).
  factLines() {
    const L = [], rn = id => this.nm(id), col = id => { const c = cname(this.roster.get(id)?.look.c); return c ? ` (${c})` : ''; };
    if (this.revInfo && this.p.alive) { const k = this.revInfo.ap; L.push(k != null && k !== this.p.id && !this.imp ? `Eu morri e fui ressuscitado! Quem me matou foi o ${rn(k)}${col(k)}${this.revInfo.room ? ', ' + inR(this.revInfo.room) : ''}!` : `Eu morri e fui ressuscitado, mas não vi quem foi.`); }
    if (this.revealedLover != null && !this.deadKnown.has(this.revealedLover)) L.push(`Tenho uma informação confiável: ${rn(this.revealedLover)} é impostor, votem nele!`);
    if (!this.imp) {
      for (const [id, g] of this.guess) {
        if (this.deadKnown.has(id) || g.conf < 0.8 || JOB[g.job]?.team !== 'imp') continue;
        if (g.job === 'metamorfo') L.push(g.ex?.from != null && g.ex.to != null ? `Vi o ${rn(g.ex.from)}${col(g.ex.from)} virar ${rn(g.ex.to)}${col(g.ex.to)} na minha frente! Ele é Metamorfo!` : `Vi o ${rn(id)} mudar de aparência. Ele é Metamorfo!`);
        else if (g.job === 'vibora') L.push(`O corpo sumiu na frente do ${rn(id)}, ele deve ser Víbora.`);
      }
      if (this.killerJob && JOB[this.killerJob.id]?.team === 'imp') L.push(`O jeito que o corpo ficou mostra que o assassino é ${this.killerJob.name}.`);
      if (this.fact.has('dexter')) L.push(`Vi um saco de corpo, tem um Dexter aqui.`);
      if (this.tlKnown) L.push(`Voltaram o tempo! Tem Time Lord, melhor não reportar corpo correndo.`);
      else if (this.medKnown) L.push(`Vi gente voltar à vida ou corpo sendo carregado, deve ter Médico.`);
    }
    this.revInfo = this.revInfo && this.p.alive ? this.revInfo : null;
    return L;
  }
  voteTick() {
    if (this.voted || !this.p.alive || this.phase !== 'vote' || this.clock < this.voteAt) return; this.voted = true; const v = this.decideVote();
    if (this.job === 'advogado') { // controla os votos acumulados: guarda quando não há alvo claro, gasta quando há
      const max = this.c('law_max'); if (v.to === 'skip' && this.bank < max && roll(0.7)) { this.act({ t: 'ab', a: 'lawsave' }); return; }
      if (v.to !== 'skip' && this.bank > 0) { const strong = (this.evidence(v.to) + this.heatOf(v.to) * 8) >= 90; v.spend = strong ? this.bank : (roll(0.35) ? 1 : 0); }
    }
    this.act({ t: 'vote', to: v.to, sup: v.sup ? 1 : 0, spend: v.spend || 0 });
  }
  decideVote() {
    const me = this.p.id, alive = [...this.mtgAlive].filter(i => i !== me && i !== this.lover), J = this.job, err = roll(this.pc('bot_err') * 0.5);
    if (!alive.length) return { to: 'skip' };
    const skipW = this.skipWeight();
    if (J === 'execution' && this.target != null && alive.includes(this.target) && !err) return { to: this.target };
    if (this.imp) {
      const crew = alive.filter(i => !this.mates.has(i)); if (!crew.length) return { to: 'skip' };
      const score = i => this.heatOf(i) * 10 + this.voteWeight(i) * 6 + (this.susp.get(i) ?? 20) + rnd(0, 8);
      crew.sort((a, b) => score(b) - score(a));
      if (err) return roll(0.3) ? { to: pick(crew) } : { to: 'skip' };
      if (this.heatOf(crew[0]) === 0 && this.voteWeight(crew[0]) < 1) return skipW >= 1.5 || roll(0.5) ? { to: 'skip' } : { to: crew[0] }; // sem onda de acusação: pula ou segue o líder
      return { to: crew[0] };
    }
    if (J === 'joker') return roll(0.5) ? { to: pick(alive) } : { to: 'skip' };
    const cand = alive.map(id => ({ id, e: this.evidence(id) + this.heatOf(id) * 8 + this.voteWeight(id) * 5 })).sort((a, b) => b.e - a.e);
    const jk = cand.filter(x => (this.jokerSus.get(x.id) || 0) >= 40 && x.e < 90); if (jk.length) { for (const x of jk) cand.splice(cand.indexOf(x), 1); this.chat(`Acho que o ${this.nm(jk[0].id)} é Joker, vou evitar votar nele.`, 0.5); } if (!cand.length) return { to: 'skip' };
    const best = cand[0], thr = clamp(54 - this.pc('bot_sus') * 20 - this.pc('bot_skill') * 8, 30, 66);
    if (err) return roll(0.2) ? { to: pick(alive) } : { to: 'skip' }; // erro humano raramente vira voto aleatório
    const grounded = this.known.has(best.id) || this.why.has(best.id) || this.heatOf(best.id) >= 2 || best.e >= 85; // precisa de um motivo concreto
    const late = alive.length <= 3; // pouca gente viva: pular pode custar a partida
    const need = thr + (skipW >= 2.5 && best.e < 80 ? 22 : skipW >= 1.5 && best.e < 70 ? 10 : 0) - (late ? 10 : 0);
    if (best.e >= need && (grounded || late)) return { to: best.id, sup: this.supLeft > 0 && best.e >= 90 && (J === 'juiz' || J === 'mentalista') };
    return { to: 'skip' };
  }
}
