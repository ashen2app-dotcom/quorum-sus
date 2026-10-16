// Sala/partida autoritativa. O cliente só envia intenções; tudo é validado aqui.
import crypto from 'node:crypto';
import { WORLD, canStand, STATIONS, VENTS, SPECIAL, CAMS, TASK_MIN, roomAt } from '../shared/map.js';
import { Bot } from './bot.js';
import { sanitizeLook, sanitizeName } from '../shared/cosmetics.js';
import { JOBS, JOB, DEFAULT_SETTINGS, SETTING_LIMITS, colorTone, INF_MSGS } from '../shared/jobs.js';

export const MIN_PLAYERS = +process.env.MIN_PLAYERS || 4;
const MAX_PLAYERS = 15;
const BASE_SPEED = 190, BASE_VIS = 420, KILL_R = 95, REPORT_R = 150, TASK_R = 110, FIX_R = 110, VENT_R = 80, PROBE_R = 110, CAM_R = 300;
const DC_GRACE = 150, SAB_CD = 30, HEAT_TIME = 45, INTRO = 4.2, RESULT_TIME = 8, END_TIME = 12;
const GEN_NAMES = ['Ashen', 'Shadow', 'Nexus', 'Ghost', 'Dark', 'Lunar', 'Venom', 'Zero', 'Pixel', 'Orion', 'Blaze', 'Echo', 'Nova', 'Rift', 'Onyx', 'Frost', 'Vortex', 'Comet', 'Rogue', 'Mira', 'Kairo', 'Luna', 'Thor', 'Zeca', 'Duda', 'Bruno', 'Lari', 'Gabs', 'Tiago', 'Nina', 'Kiko', 'Rafa', 'Bia', 'Dani', 'Leo', 'Mel', 'Pedro', 'Sol', 'Vini', 'Yuri'];
const DEFAULTS = { impostors: 0, speed: 1, vision: 1, discuss: 30, vote: 30, tasks: 4, killCd: 22, emergencies: 1, emergCd: 20, confirm: 1, ...DEFAULT_SETTINGS };
const LIMITS = { impostors: [0, 3], speed: [0.75, 1.5], vision: [0.5, 1.5], discuss: [10, 120], vote: [10, 120], tasks: [1, 8], killCd: [10, 45], emergencies: [0, 3], emergCd: [0, 60], confirm: [0, 1], ...SETTING_LIMITS };

const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const stationById = Object.fromEntries(STATIONS.map(s => [s.id, s]));
const dec = (o, dt, fn) => { for (const k in o) { o[k] -= dt; if (o[k] <= 0) { delete o[k]; fn && fn(k); } } };

export class Room {
  constructor(code, onEmpty) {
    Object.assign(this, { code, onEmpty, players: new Map(), hostId: null, settings: { ...DEFAULTS }, pub: false,
      phase: 'lobby', bodies: [], sab: null, sabCd: 0, timer: 0, loop: null, n: 0, nextId: 1, last: Date.now(), meet: null, supreme: null, ghostN: {}, botText: '' });
  }
  get list() { return [...this.players.values()]; }
  send(p, m) { if (p.bot) { try { p.ai.onMsg(m); } catch (e) { console.error('[bot]', e); } return; } if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(m)); }
  all(m, f) { for (const p of this.players.values()) if (!f || f(p)) this.send(p, m); }
  alive(role) { return this.list.filter(p => p.alive && !p.gone && (!role || (role === 'imp') === (p.role === 'imp'))); }
  canVent(p) { return p.team === 'imp' || p.job === 'engenheiro'; }

  // ---------- lobby ----------
  join(ws, name, look) {
    if (this.phase !== 'lobby') return { err: 'Partida em andamento.' };
    if (this.humansList().length >= MAX_PLAYERS) return { err: 'Sala cheia.' };
    const p = this.mk(ws, name, look);
    if (!this.hostId) this.hostId = p.id;
    this.players.set(p.id, p);
    this.send(p, { t: 'hello', id: p.id, token: p.token, code: this.code });
    this.syncBots(); this.lobby();
    return { p };
  }
  rejoin(ws, tok) {
    const p = this.list.find(q => q.token === tok && !q.gone);
    if (!p) return null;
    p.ws = ws; p.dcAt = 0;
    this.send(p, { t: 'hello', id: p.id, token: p.token, code: this.code });
    if (this.phase === 'lobby') this.lobby(); else this.send(p, { t: 'resume', ...this.startPayload(p), phase: this.phase, timer: Math.ceil(this.timer), meet: this.meet && { ...this.meet, voted: this.list.filter(q => q.voted).map(q => q.id) } });
    return p;
  }
  mk(ws, name, look) { return { id: this.nextId++, token: crypto.randomBytes(12).toString('hex'), name: sanitizeName(name), look: sanitizeLook(look), ws,
      x: 0, y: 0, ix: 0, iy: 0, face: 1, moving: false, alive: true, role: null, team: null, job: null, ghostJob: null, tasks: [], ts: {}, killCd: 0, emerg: 0, vent: -1,
      vote: null, voted: false, chatAt: 0, dcAt: 0, gone: false, cd: {}, act: {}, uses: {}, shieldT: 0, morph: null, track: null, probe: null, supLeft: 0, supGiven: false,
      killedBy: null, deathRoom: '', target: null, seen: new Set(), revealed: false, sciWait: false, watch: false }; }
  botCount() { const S = this.settings; return S.bot_on ? Math.max(0, Math.min(S.bot_n, MAX_PLAYERS - this.humansList().length)) : 0; }
  botNameList(nb) {
    const taken = new Set(this.list.map(q => q.name.toLowerCase())), out = [];
    const add = raw => { const nm = String(raw || '').replace(/[^\p{L}\p{N} _\-]/gu, '').trim().slice(0, 12); if (!nm || taken.has(nm.toLowerCase())) return; taken.add(nm.toLowerCase()); out.push(nm); };
    for (const raw of String(this.botText || '').split(/[\n,;]+/)) { if (out.length >= nb) break; add(raw); }
    for (const nm of shuffle([...GEN_NAMES])) { if (out.length >= nb) break; add(nm); }
    for (let i = 2; out.length < nb; i++) add('Jogador' + i);
    return out;
  }
  addBots(nb) {
    if (!nb) return; const names = this.botNameList(nb), used = new Set(this.list.map(q => q.look.c)), free = shuffle([...Array(12).keys()].filter(c => !used.has(c))), anyc = shuffle([...Array(12).keys()]);
    const opt = n => (Math.random() < 0.45 ? 0 : 1 + rnd(n - 1));
    for (let i = 0; i < nb; i++) {
      const look = { c: free.length ? free.shift() : anyc[i % 12], h: opt(7), o: rnd(5), a: opt(5), m: opt(4), s: opt(4) };
      const p = this.mk(null, names[i], look); p.bot = true; p.ai = new Bot(this, p); this.players.set(p.id, p);
    }
  }
  humansList() { return this.list.filter(p => !p.bot); }
  pubSettings() { const s = { ...this.settings }; for (const k of Object.keys(s)) if (k.startsWith('bot_')) delete s[k]; return s; } // quem não é o dono não vê a config dos bots
  syncBots(rebuild = false) {
    if (this.phase !== 'lobby') return;
    if (rebuild) for (const b of this.list.filter(p => p.bot)) this.players.delete(b.id);
    const hn = new Set(this.humansList().map(p => p.name.toLowerCase()));
    for (const b of this.list.filter(p => p.bot)) if (hn.has(b.name.toLowerCase())) this.players.delete(b.id);
    const want = this.botCount(), cur = this.list.filter(p => p.bot);
    while (cur.length > want) this.players.delete(cur.pop().id);
    if (cur.length < want) this.addBots(want - cur.length);
  }
  botCanSpeak() { return Date.now() - (this.lastBotChat || 0) >= this.settings.bot_gap_all * 1000; }
  botSpoke() { this.lastBotChat = Date.now(); }
  lobby() {
    const players = this.list.map(p => ({ id: p.id, name: p.name, look: p.look, dc: !p.ws })), base = { t: 'lobby', min: MIN_PLAYERS, code: this.code, host: this.hostId, pub: this.pub, players };
    for (const p of this.list) if (p.ws) this.send(p, p.id === this.hostId ? { ...base, settings: this.settings, bots: this.list.filter(q => q.bot).length, botNames: this.botText } : { ...base, settings: this.pubSettings() });
  }
  leave(p) {
    if (this.phase === 'lobby') {
      this.players.delete(p.id);
      if (this.hostId === p.id) this.hostId = this.humansList()[0]?.id ?? null;
      if (this.humansList().length) { this.syncBots(); this.lobby(); } else this.destroy();
    } else { p.ws = null; p.dcAt = Date.now(); }
  }
  disconnect(p) { if (this.phase === 'lobby') this.leave(p); else { p.ws = null; p.dcAt = Date.now(); } }
  destroy() { clearInterval(this.loop); this.onEmpty(this.code); }

  setSetting(p, k, v) {
    if (p.id !== this.hostId || this.phase !== 'lobby') return;
    if (k === 'pub') this.pub = !!v;
    else if (LIMITS[k]) { v = +v; if (!Number.isFinite(v)) return; this.settings[k] = Math.min(LIMITS[k][1], Math.max(LIMITS[k][0], v)); }
    if (k === 'bot_on' || k === 'bot_n') this.syncBots();
    this.lobby();
  }

  // ---------- início e distribuição de profissões ----------
  assign(ps, ni, nn) {
    const S = this.settings, cnt = {};
    const draw = (team, fallback) => {
      const pool = JOBS.filter(j => j.team === team && !j.ghost && S['w_' + j.id] > 0 && (cnt[j.id] || 0) < S['m_' + j.id]);
      const sum = pool.reduce((a, j) => a + S['w_' + j.id], 0); if (!pool.length || sum <= 0) return fallback;
      let r = Math.random() * sum; for (const j of pool) { r -= S['w_' + j.id]; if (r <= 0) { cnt[j.id] = (cnt[j.id] || 0) + 1; return j.id; } }
      return pool[pool.length - 1].id;
    };
    ps.forEach((q, i) => {
      let job = i < ni ? draw('imp', 'impostor') : i < ni + nn ? draw('neu', null) : null;
      if (!job) job = draw('inn', 'tripulante'); // vaga neutra sem profissão disponível vira inocente
      q.job = job; q.team = JOB[job].team; q.role = q.team === 'imp' ? 'imp' : 'crew';
    });
    const mates = ps.filter(q => q.team !== 'inn' || true);
    for (const q of ps) if (q.job === 'execution') q.target = shuffle(mates.filter(o => o !== q))[0]?.id ?? null;
  }
  start(p) {
    if (p.id !== this.hostId || this.phase !== 'lobby') return;
    const S = this.settings; this.syncBots(); const n = this.list.filter(q => q.ws || q.bot).length;
    if (n < MIN_PLAYERS) return this.send(p, { t: 'err', msg: `São necessários ao menos ${MIN_PLAYERS} jogadores.` });
    let ni = S.impostors || (n <= 6 ? 1 : n <= 10 ? 2 : 3);
    ni = Math.max(1, Math.min(ni, Math.floor((n - 1) / 2)));
    const nn = Math.max(0, Math.min(S.neutrals, n - ni - 2));
    for (const q of [...this.players.values()]) if (!q.ws && !q.bot) this.players.delete(q.id);
    const ps = shuffle(this.list.filter(q => q.ws || q.bot));
    this.assign(ps, ni, nn);
    ps.forEach((q, i) => {
      const a = (i / n) * Math.PI * 2;
      Object.assign(q, { alive: true, x: SPECIAL.spawn.x + Math.cos(a) * 85, y: SPECIAL.spawn.y + Math.sin(a) * 60, ix: 0, iy: 0, vent: -1, killCd: 10 + INTRO, emerg: 0, vote: null, voted: false, ts: {}, gone: false,
        ghostJob: null, cd: q.job === 'xerife' || q.job === 'mentalista' ? { skill: 10 + INTRO } : {}, act: {}, uses: { panel: S.cie_uses, inf: S.inf_uses }, shieldT: 0, morph: null, track: null, probe: null, supLeft: 0, supGiven: false,
        killedBy: null, deathRoom: '', seen: new Set(), revealed: false, sciWait: false, watch: false,
        tasks: q.team === 'neu' ? [] : shuffle([...STATIONS]).slice(0, S.tasks).map(s => ({ id: s.id, type: s.type, name: s.name, room: s.room, done: false })) });
    });
    Object.assign(this, { phase: 'play', bodies: [], sab: null, sabCd: 25, emergCd: this.settings.emergCd, intro: INTRO, meet: null, supreme: null, ghostN: {}, last: Date.now(), n: 0 });
    for (const q of this.list) this.send(q, { t: 'start', ...this.startPayload(q) });
    clearInterval(this.loop); this.loop = setInterval(() => this.tick(), 33);
  }
  startPayload(p) {
    return { role: p.role, team: p.team, job: p.job, ghostJob: p.ghostJob, jp: p.revealed, target: p.target, sup: p.supLeft, x: p.x, y: p.y, alive: p.alive,
      mates: p.team === 'imp' ? this.list.filter(q => q.team === 'imp').map(q => [q.id, q.job]) : [],
      tasks: p.tasks, settings: this.pubSettings(), players: this.list.map(q => ({ id: q.id, name: q.name, look: q.look })), emergUsed: p.emerg };
  }

  // ---------- loop ----------
  tick() {
    const now = Date.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.n++;
    if (this.phase === 'play') {
      if (this.intro > 0) this.intro -= dt;
      else {
        for (const p of this.list) { this.move(p, dt); this.cool(p, dt); }
        this.bodyTick(dt);
        if (this.sabCd > 0 && !this.sab) this.sabCd -= dt;
        if (this.emergCd > 0) this.emergCd -= dt;
        if (this.sab?.k === 'heat') { this.sab.t -= dt; if (this.sab.t <= 0) return this.end('imp', 'O superaquecimento destruiu a estação.'); }
      }
      if (this.n % 2 === 0) this.snapshot();
    } else if (this.phase !== 'lobby') {
      this.timer -= dt;
      if (this.timer <= 0) this.nextPhase();
    }
    if (this.n % 3 === 0 && (this.phase === 'play' || this.phase === 'meet' || this.phase === 'vote')) for (const p of this.list) if (p.bot && !p.gone) { try { p.ai.tick(dt * 3); } catch (e) { console.error('[bot]', e); } }
    if (this.n % 30 === 0) this.housekeeping(now);
  }
  cool(p, dt) {
    if (p.killCd > 0) p.killCd -= dt;
    dec(p.cd, dt); if (p.shieldT > 0) p.shieldT -= dt;
    dec(p.act, dt, k => { if (k === 'morph') { p.morph = null; p.cd.morph = this.settings.met_cd; } else if (k === 'invis') p.cd.invis = this.settings.esp_cd; else if (k === 'locate') p.track = null; });
    if (p.probe) {
      const t = this.players.get(p.probe.id);
      if (!t || !t.alive || t.moving || dist(p, t) > PROBE_R || !p.alive) p.probe = null;
      else if ((p.probe.t += dt) >= this.settings.men_inv) { this.send(p, { t: 'reveal', list: [[t.id, t.job]] }); p.probe = null; }
    }
  }
  bodyTick(dt) {
    for (let i = this.bodies.length - 1; i >= 0; i--) { const b = this.bodies[i]; if (b.vanish > 0 && (b.vanish -= dt) <= 0) this.bodies.splice(i, 1); }
  }
  move(p, dt) {
    if (p.gone || p.vent >= 0 || p.watch) { if (p.watch) p.moving = false; return; }
    if (!p.bot && p.inAt && Date.now() - p.inAt > 700) p.ix = p.iy = 0; // sem notícias do cliente: para (evita boneco andando sozinho)
    const l = Math.hypot(p.ix, p.iy); p.moving = l > 0.05;
    if (!p.moving) return;
    const k = Math.min(1, 1 / l) * BASE_SPEED * this.settings.speed * dt, dx = p.ix * k, dy = p.iy * k;
    if (dx) p.face = dx > 0 ? 1 : -1;
    if (!p.alive) { p.x = Math.min(WORLD.w - 20, Math.max(20, p.x + dx)); p.y = Math.min(WORLD.h - 20, Math.max(20, p.y + dy)); return; }
    if (canStand(p.x + dx, p.y)) p.x += dx;
    if (canStand(p.x, p.y + dy)) p.y += dy;
  }
  visR(p) {
    if (!p.alive) return Infinity;
    const base = BASE_VIS * this.settings.vision * (p.role === 'imp' ? 1.2 : 1);
    return this.sab?.k === 'lights' && p.role !== 'imp' ? 140 * this.settings.vision : base;
  }
  taskCount() {
    let d = 0, t = 0;
    for (const p of this.list) if (p.team === 'inn' && !p.gone) for (const k of p.tasks) { t++; if (k.done) d++; }
    return [d, t];
  }
  snapshot() {
    const tk = this.taskCount(), sab = this.sab && { k: this.sab.k, t: Math.ceil(this.sab.t || 0), fixed: this.sab.fixed };
    const arrows = this.bodies.filter(b => b.arrow).map(b => [b.x | 0, b.y | 0]);
    if (this.sab?.k === 'comms') for (const p of this.list) if (p.watch) { p.watch = false; this.send(p, { t: 'camOff' }); }
    const camOn = this.list.some(p => p.watch);
    const r0 = o => { const r = {}; for (const k in o) r[k] = Math.ceil(o[k]); return r; };
    for (const v of this.list) {
      if (!v.ws && !v.bot) continue;
      const vrr = this.visR(v), R = vrr * 1.15, pl = [], bd = [];
      for (const p of this.list) {
        if (p === v || p.gone || p.vent >= 0) continue;
        if (!p.alive && v.alive) continue;
        const inv = p.act.invis > 0; if (inv && v.alive && v.team !== 'imp') continue;
        if (v.alive && dist(v, p) > R) continue;
        pl.push([p.id, p.x | 0, p.y | 0, p.face, p.moving ? 1 : 0, p.alive ? 0 : 1, p.morph || p.id, inv ? 1 : 0]);
      }
      for (const b of this.bodies) if (!v.alive || dist(v, b) <= R) bd.push([b.id, b.x | 0, b.y | 0, b.g ? 1 : 0]);
      let cams = null, vd = null;
      if (v.watch) cams = CAMS.map(c => { const o = { x: c.vx, y: c.vy }; return [this.list.filter(p => p.alive && !p.gone && p.vent < 0 && !(p.act.invis > 0) && dist(p, o) <= CAM_R).map(p => [p.id, p.x | 0, p.y | 0, p.face, p.moving ? 1 : 0, p.morph || p.id]), this.bodies.filter(b => dist(b, o) <= CAM_R).map(b => [b.id, b.x | 0, b.y | 0, b.g ? 1 : 0])]; });
      if (v.vent >= 0 && v.alive) vd = this.list.filter(p => p !== v && p.alive && !p.gone && dist(p, v) <= 1600).map(p => +Math.atan2(p.y - v.y, p.x - v.x).toFixed(2));
      const tr = v.track && this.players.get(v.track); const loc = tr && tr.alive && v.act.locate > 0 ? [tr.x | 0, tr.y | 0, tr.id] : null;
      this.send(v, { t: 'snap', ec: Math.ceil(Math.max(0, this.emergCd || 0)), you: [v.x | 0, v.y | 0, v.vent, v.morph || v.id, v.act.invis > 0 ? 1 : 0, Math.ceil(v.shieldT > 0 ? v.shieldT : 0)], pl, bd, tk, sab: sab || null, vr: Math.round(vrr), ar: arrows, loc,
        cd: v.role === 'imp' ? [Math.max(0, Math.ceil(v.killCd)), Math.max(0, Math.ceil(this.sabCd))] : null, ab: { cd: r0(v.cd), act: r0(v.act), us: v.uses, sup: v.supLeft },
        probe: v.probe ? [v.probe.id, v.probe.t / this.settings.men_inv] : null, cams, vd, co: camOn ? 1 : 0, intro: this.intro > 0 ? Math.ceil(this.intro) : 0 });
    }
  }
  housekeeping(now) {
    for (const p of this.list) {
      if (p.ws || !p.dcAt || p.gone || now - p.dcAt < DC_GRACE * 1000) continue;
      p.gone = true; p.alive = false; console.log(`[saiu] ${this.code} ${p.name} ficou offline por mais de ${DC_GRACE}s e foi removido da partida`);
    }
    if (this.phase !== 'lobby' && this.phase !== 'end') {
      if (this.checkWin()) return;
      if (!this.list.some(p => p.ws || (p.dcAt && now - p.dcAt < DC_GRACE * 1000))) this.destroy();
    }
  }

  // ---------- ações ----------
  handle(p, m) {
    const ph = this.phase, live = p.alive && !p.gone;
    switch (m.t) {
      case 'look': if (ph === 'lobby') { p.look = sanitizeLook(m.look); if (m.name) p.name = sanitizeName(m.name); this.syncBots(); this.lobby(); } break;
      case 'botlook': { if (p.id !== this.hostId || ph !== 'lobby') break; const b = this.players.get(+m.id); if (b && b.bot) { b.look = sanitizeLook(m.look); this.lobby(); } else this.send(p, { t: 'err', msg: 'Só dá para personalizar o seu personagem ou os de bots.' }); break; }
      case 'set': this.setSetting(p, m.k, m.v); break;
      case 'botnames': if (p.id === this.hostId && ph === 'lobby') { this.botText = String(m.text || '').slice(0, 600); this.syncBots(true); this.lobby(); } break;
      case 'start': this.start(p); break;
      case 'ping': this.send(p, { t: 'pong', ts: m.ts }); break;
      case 'input': if (ph === 'play') { p.inAt = Date.now(); p.ix = Math.max(-1, Math.min(1, +m.x || 0)); p.iy = Math.max(-1, Math.min(1, +m.y || 0)); } break;
      case 'taskStart': { if (ph !== 'play') break; const k = p.tasks.find(t => t.id === m.id && !t.done), s = stationById[m.id];
        if (k && s && dist(p, s) <= TASK_R) p.ts[m.id] = Date.now(); break; }
      case 'taskDone': { if (ph !== 'play') break; const k = p.tasks.find(t => t.id === m.id && !t.done), s = stationById[m.id], t0 = p.ts[m.id];
        if (!k || !s || !t0 || dist(p, s) > TASK_R + 30 || Date.now() - t0 < TASK_MIN[k.type]) break;
        k.done = true; delete p.ts[m.id]; this.send(p, { t: 'taskOk', id: m.id }); this.taskHooks(p); this.checkWin(); break; }
      case 'kill': this.kill(p); break;
      case 'ab': this.ab(p, m); break;
      case 'report': if (ph === 'play' && live && p.vent < 0) { const b = this.bodies.find(b => dist(p, b) <= REPORT_R); if (b) this.meeting(p, 'body', b.id); } break;
      case 'emergency': if (ph === 'play' && live && p.vent < 0 && dist(p, SPECIAL.emergency) <= FIX_R + 40 && p.emerg < this.settings.emergencies && this.sab?.k !== 'heat') { if (this.emergCd > 0) { this.send(p, { t: 'err', msg: `O botão de emergência está recarregando (${Math.ceil(this.emergCd)}s).` }); break; } p.emerg++; this.meeting(p, 'emergency'); } break;
      case 'sabotage': if (ph === 'play' && live && p.team === 'imp' && !this.sab && this.sabCd <= 0 && ['lights', 'comms', 'heat'].includes(m.k)) {
        this.sab = { k: m.k, t: m.k === 'heat' ? HEAT_TIME : 0, fixed: m.k === 'heat' ? [false, false] : [false] };
        this.all({ t: 'sab', k: m.k }); } break;
      case 'fix': if (ph === 'play' && live && this.sab) this.fix(p, m.id); break;
      case 'vent': this.vent(p, m.a); break;
      case 'vote': if (ph === 'vote' && live && !p.voted) {
        const t = this.players.get(m.to), ok = m.to === 'skip' || (t?.alive && !t.gone);
        if (!ok) break;
        if (m.sup && m.to !== 'skip' && p.supLeft > 0) { p.supLeft--; if (this.supreme == null) this.supreme = m.to; }
        p.voted = true; p.vote = m.to; this.all({ t: 'voted', id: p.id });
        if (this.alive().every(q => q.voted || (!q.ws && !q.bot))) this.finishVote(); } break;
      case 'chat': { if (ph !== 'meet' && ph !== 'vote') break; const now = Date.now(); if (now - p.chatAt < 700) break; p.chatAt = now;
        const text = String(m.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 140); if (!text) break;
        this.all({ t: 'chat', id: p.id, text, dead: !p.alive }, q => p.alive || !q.alive); break; }
    }
  }
  taskHooks(p) {
    if (!p.supGiven && (p.job === 'juiz' || p.job === 'mentalista')) { p.supGiven = true; p.supLeft = this.settings.jui_uses; this.send(p, { t: 'sup', left: p.supLeft, fresh: true }); }
    if (p.job === 'mentalista' && !p.revealed && p.tasks.every(k => k.done)) { p.revealed = true; this.send(p, { t: 'unlock' }); }
  }
  // Morte unificada (kill, tiro, voto). force ignora escudo.
  slay(v, killer, { body = true, force = false } = {}) {
    if (!v.alive || (!force && v.shieldT > 0)) return false;
    const vap = v.morph || v.id, kap = killer ? (killer.morph || killer.id) : null;
    v.alive = false; v.ix = v.iy = 0; v.moving = false; v.watch = false; v.vent = -1; v.track = null; v.probe = null; v.act = {}; v.morph = null;
    v.killedBy = killer?.id ?? null; v.deathRoom = roomAt(v.x, v.y)?.name || 'corredor';
    console.log(`[morte] ${this.code} ${v.name} (${v.job}) por ${killer ? killer.name + ' (' + killer.job + ')' : 'voto/tiro'} em ${v.deathRoom}`);
    const vib = killer?.job === 'vibora';
    if (body) {
      this.bodies.push({ id: v.id, x: v.x, y: v.y, killer: killer?.id ?? null, arrow: v.job === 'barulhento', g: vib, vanish: vib ? this.settings.vib_van : 0 });
      this.all({ t: 'fx', k: vib ? 'killg' : 'kill', id: v.id, x: v.x | 0, y: v.y | 0 }, q => !q.alive || dist(q, v) <= this.visR(q) * 1.3);
    }
    if (body) this.send(v, { t: 'kanim', k: kap, v: vap, r: 'victim' }); // a cena aparece só para quem morre
    this.send(v, { t: 'died', by: killer ? 'kill' : 'vote' });
    // alvo do Execution morreu por outros meios
    for (const q of this.list) if (q.job === 'execution' && q.target === v.id && q.alive && killer) { q.target = null; this.send(q, { t: 'err', msg: 'Seu alvo morreu. Você agora joga pela sobrevivência.' }); }
    // profissões de fantasma (só inocentes que morrem)
    if (v.team === 'inn') for (const gj of shuffle(['anjo', 'influencer'])) {
      if ((this.ghostN[gj] || 0) < this.settings['m_' + gj] && Math.random() * 100 < this.settings['w_' + gj]) {
        this.ghostN[gj] = (this.ghostN[gj] || 0) + 1; v.ghostJob = gj; v.cd = {}; v.uses.inf = this.settings.inf_uses; this.send(v, { t: 'ghost', job: gj }); break;
      }
    }
    return true;
  }
  nearestVictim(p, pred) {
    let best = null, bd = KILL_R;
    for (const q of this.list) if (q !== p && q.alive && !q.gone && q.vent < 0 && pred(q) && dist(p, q) <= bd) { best = q; bd = dist(p, q); }
    return best;
  }
  kill(p) {
    if (this.phase !== 'play' || this.intro > 0 || p.team !== 'imp' || !p.alive || p.vent >= 0 || p.killCd > 0) return;
    const v = this.nearestVictim(p, q => q.team !== 'imp'); if (!v) return;
    p.killCd = this.settings.killCd;
    if (!this.slay(v, p)) return this.send(p, { t: 'err', msg: 'Um escudo protegeu o alvo!' });
    p.x = v.x; p.y = v.y; this.checkWin();
  }
  fix(p, id) {
    const s = this.sab, at = { lights: SPECIAL.lights, comms: SPECIAL.comms, A: SPECIAL.heatA, B: SPECIAL.heatB };
    const pt = s.k === 'heat' ? at[id] : s.k === id ? at[id] : null;
    if (!pt || dist(p, pt) > FIX_R) return;
    if (s.k === 'heat') { s.fixed[id === 'A' ? 0 : 1] = true; if (!s.fixed.every(Boolean)) return this.all({ t: 'sabPart', fixed: s.fixed }); }
    this.sab = null; this.sabCd = SAB_CD; this.all({ t: 'sabEnd' });
  }
  vent(p, a) {
    if (this.phase !== 'play' || !this.canVent(p) || !p.alive) return;
    if (p.vent < 0 && a === 'in') {
      if (p.cd.vent > 0) return;
      const i = VENTS.findIndex(v => dist(p, v) <= VENT_R); if (i < 0) return;
      p.vent = i; p.x = VENTS[i].x; p.y = VENTS[i].y; p.ix = p.iy = 0;
    } else if (p.vent >= 0 && a === 'next') {
      const g = VENTS.filter(v => v.g === VENTS[p.vent].g), v = g[(g.indexOf(VENTS[p.vent]) + 1) % g.length];
      p.vent = VENTS.indexOf(v); p.x = v.x; p.y = v.y;
    } else if (p.vent >= 0 && a === 'out') { p.vent = -1; if (p.job === 'engenheiro') p.cd.vent = this.settings.eng_vent; }
  }

  // ---------- habilidades de profissão ----------
  ab(p, m) {
    const ph = this.phase, S = this.settings, play = ph === 'play' && this.intro <= 0, J = p.alive ? p.job : p.ghostJob, a = m.a;
    if (!J || p.gone) return;
    const tgt = () => { const t = this.players.get(+m.to); return t && !t.gone && t.alive && t !== p ? t : null; };
    const bad = msg => this.send(p, { t: 'err', msg });
    switch (a) {
      case 'cam':
        if (!play || !p.alive || p.vent >= 0 || this.sab?.k === 'comms' || Math.hypot(p.x - SPECIAL.camConsole.x, p.y - SPECIAL.camConsole.y) > 110) return;
        p.watch = true; p.ix = p.iy = 0; p.moving = false; break;
      case 'camOff': p.watch = false; break;
      case 'investigate': {
        if (J !== 'detetive' || !play) return; const b = this.bodies.find(b => dist(p, b) <= REPORT_R); if (!b) return;
        if (p.seen.has(b.id)) return bad('Você já investigou este corpo.'); p.seen.add(b.id);
        const k = this.players.get(b.killer);
        this.send(p, { t: 'hint', text: k ? `Pista: a cor de quem matou é ${colorTone(k.look.c)}.` : 'Nenhuma pista: não há assassino identificável.' }); break;
      }
      case 'remoteFix':
        if (J !== 'engenheiro' || !play || !this.sab || p.cd.remoteFix > 0) return;
        this.sab = null; this.sabCd = SAB_CD; p.cd.remoteFix = S.eng_fix; this.all({ t: 'sabEnd' }); break;
      case 'panel': {
        if ((J !== 'cientista' && J !== 'mentalista') || ph === 'lobby' || ph === 'end' || !(p.uses.panel > 0)) return;
        p.uses.panel--; this.send(p, { t: 'panel', list: this.list.filter(q => !q.gone).map(q => [q.id, q.alive ? 1 : 0]) }); break;
      }
      case 'locate': {
        if ((J !== 'localizador' && J !== 'mentalista') || !play || !p.alive || p.cd.locate > 0) return;
        const t = tgt(); if (!t) return bad('Alvo inválido.'); p.track = t.id; p.act.locate = S.loc_dur; p.cd.locate = S.loc_cd; break;
      }
      case 'skill': {
        if ((J !== 'xerife' && J !== 'mentalista') || !play || !p.alive || p.cd.skill > 0 || p.vent >= 0) return;
        const v = this.nearestVictim(p, () => true); if (!v) return;
        p.cd.skill = S.xer_cd;
        if (!this.slay(v, p)) return bad('Um escudo protegeu o alvo!');
        if (v.team === 'inn') this.slay(p, null, { force: true }); // matou um inocente: o atirador morre junto
        else { p.x = v.x; p.y = v.y; }
        this.checkWin(); break;
      }
      case 'jobpanel': {
        if (J !== 'mentalista' || !p.revealed || (ph !== 'meet' && ph !== 'vote')) return;
        this.send(p, { t: 'jobpanel', list: this.list.filter(q => !q.gone).map(q => [q.id, q.job, q.alive ? 1 : 0]) }); break;
      }
      case 'probe': {
        if (J !== 'mentalista' || !play || !p.alive || p.probe || p.cd.probe > 0) return;
        const t = this.nearestVictim(p, () => true); if (!t || dist(p, t) > PROBE_R) return bad('Aproxime-se de alguém.'); p.probe = { id: t.id, t: 0 }; p.cd.probe = S.men_cd; break;
      }
      case 'shield': {
        if (J !== 'anjo' || p.alive || !play || p.cd.shield > 0) return;
        const t = this.players.get(+m.to); if (!t || !t.alive || t.gone) return bad('Escolha um jogador vivo.');
        t.shieldT = S.anj_dur; p.cd.shield = S.anj_dur + S.anj_cd; this.send(t, { t: 'shield', dur: S.anj_dur }); break;
      }
      case 'infmsg': {
        if (J !== 'influencer' || p.alive || ph === 'lobby' || ph === 'end' || !(p.uses.inf > 0)) return;
        const t = this.players.get(+m.to); if (!t || !t.alive || t.gone) return bad('Escolha um jogador vivo.');
        const k = this.players.get(p.killedBy); let text;
        if (m.kind === 'tone') text = k ? `Sussurro de ${p.name}: quem me matou tem cor ${colorTone(k.look.c)}.` : `Sussurro de ${p.name}: não sei quem me matou.`;
        else if (m.kind === 'job') text = k ? `Sussurro de ${p.name}: quem me matou era ${JOB[k.job].name}.` : `Sussurro de ${p.name}: não sei quem me matou.`;
        else if (m.kind === 'where') text = `Sussurro de ${p.name}: fui morto em ${p.deathRoom}.`; else return;
        p.uses.inf--; this.send(t, { t: 'infmsg', text }); this.send(p, { t: 'hint', text: 'Mensagem enviada.' }); break;
      }
      case 'morph': {
        if (J !== 'metamorfo' || !play || !p.alive) return;
        if (p.morph) { p.morph = null; delete p.act.morph; p.cd.morph = S.met_cd; return; }
        if (p.cd.morph > 0) return; const t = this.players.get(+m.to); if (!t || t === p || t.gone) return bad('Alvo inválido.');
        p.morph = t.id; p.act.morph = S.met_dur; break;
      }
      case 'invis':
        if (J !== 'espectro' || !play || !p.alive) return;
        if (p.act.invis > 0) { delete p.act.invis; p.cd.invis = S.esp_cd; } else if (!(p.cd.invis > 0)) p.act.invis = S.esp_dur; break;
    }
  }

  // ---------- reuniões ----------
  meeting(by, reason, bodyId = null) {
    const bd = bodyId != null ? this.bodies.find(b => b.id === bodyId) : null;
    for (const p of this.list) { p.vote = null; p.voted = false; p.ix = p.iy = 0; p.vent = -1; p.morph = null; p.act = {}; p.track = null; p.probe = null; p.watch = false; }
    Object.assign(this, { phase: 'meet', timer: this.settings.discuss, sab: null, bodies: [], supreme: null, meet: { by: by.id, reason, body: bodyId } });
    this.all({ t: 'meeting', by: by.id, reason, body: bodyId, bpos: bd ? [bd.x | 0, bd.y | 0] : null, time: this.settings.discuss, alive: this.alive().map(p => p.id), dead: this.list.filter(p => !p.alive || p.gone).map(p => p.id), off: this.list.filter(p => !p.bot && !p.ws && !p.gone).map(p => p.id), gone: this.list.filter(p => p.gone).map(p => p.id) });
    for (const p of this.list) if (p.supLeft > 0 && p.alive) this.send(p, { t: 'sup', left: p.supLeft });
  }
  nextPhase() {
    if (this.phase === 'meet') { this.phase = 'vote'; this.timer = this.settings.vote; this.all({ t: 'phase', p: 'vote', time: this.settings.vote }); }
    else if (this.phase === 'vote') this.finishVote();
    else if (this.phase === 'result') this.afterResult();
    else if (this.phase === 'end') this.toLobby();
  }
  finishVote() {
    if (this.phase !== 'vote') return;
    const votes = {}, skip = [];
    for (const p of this.alive()) { if (p.vote == null || p.vote === 'skip') skip.push(p.id); else (votes[p.vote] ||= []).push(p.id); }
    let best = null, max = 0, tie = false;
    for (const [id, a] of Object.entries(votes)) { if (a.length > max) { max = a.length; best = +id; tie = false; } else if (a.length === max) tie = true; }
    const sup = this.supreme != null && this.players.get(+this.supreme)?.alive;
    this.ejected = sup ? +this.supreme : !tie && best != null && max > skip.length ? best : null;
    const e = this.players.get(this.ejected), wasImp = e?.team === 'imp';
    this.phase = 'result'; this.timer = RESULT_TIME;
    this.all({ t: 'result', votes, skip, ejected: this.ejected, supreme: !!sup, imp: this.settings.confirm && e ? wasImp : null,
      left: this.settings.confirm && e ? this.alive('imp').length - (wasImp ? 1 : 0) : null, time: RESULT_TIME });
  }
  afterResult() {
    const e = this.players.get(this.ejected);
    if (e) {
      this.slay(e, null, { body: false, force: true });
      if (e.job === 'joker') return this.end('joker', `${e.name} (Joker) foi ejetado e venceu sozinho!`, e.id);
      const ex = this.list.find(q => q.job === 'execution' && q.alive && !q.gone && q.target === e.id);
      if (ex) return this.end('exec', `${ex.name} (Execution) conseguiu ejetar o seu alvo!`, ex.id);
    }
    if (this.checkWin()) return;
    for (const p of this.list) { // recuperação de usos por reunião
      if (p.job === 'cientista' || p.job === 'mentalista') {
        if (p.uses.panel > 0) p.uses.panel = this.settings.cie_uses; else if (p.sciWait) { p.uses.panel = this.settings.cie_uses; p.sciWait = false; } else p.sciWait = true;
      }
      if (p.ghostJob === 'influencer') p.uses.inf = this.settings.inf_uses;
    }
    const ps = this.list.filter(p => !p.gone);
    ps.forEach((p, i) => { const a = (i / ps.length) * Math.PI * 2; p.x = SPECIAL.spawn.x + Math.cos(a) * 85; p.y = SPECIAL.spawn.y + Math.sin(a) * 60; p.killCd = Math.max(p.killCd, 12); if (p.cd.skill != null) p.cd.skill = Math.max(p.cd.skill, 12); });
    Object.assign(this, { phase: 'play', meet: null, sabCd: 15, emergCd: this.settings.emergCd, intro: 0 });
    this.all({ t: 'play' });
  }

  // ---------- fim ----------
  checkWin() {
    if (this.phase === 'lobby' || this.phase === 'end') return false;
    const imp = this.alive('imp').length, crew = this.alive('crew').length, [d, t] = this.taskCount();
    if (imp === 0) return this.end('crew', 'Todos os impostores foram eliminados.');
    if (imp >= crew) return this.end('imp', 'Os impostores dominam a votação.');
    if (t > 0 && d >= t) return this.end('crew', 'Todas as tarefas foram concluídas.');
    return false;
  }
  end(winner, reason, who = null) {
    Object.assign(this, { phase: 'end', timer: END_TIME, sab: null });
    this.all({ t: 'end', winner, who, reason, roles: this.list.map(p => [p.id, p.role, p.alive ? 1 : 0, p.job]) });
    return true;
  }
  toLobby() {
    clearInterval(this.loop); this.loop = null;
    for (const p of [...this.players.values()]) { if (!p.ws || p.gone) this.players.delete(p.id); else Object.assign(p, { role: null, team: null, job: null, ghostJob: null, alive: true, tasks: [], vent: -1, act: {}, cd: {}, morph: null }); }
    if (!this.players.has(this.hostId)) this.hostId = this.humansList()[0]?.id ?? null;
    Object.assign(this, { phase: 'lobby', bodies: [], sab: null, meet: null });
    if (this.humansList().length) { this.syncBots(); this.lobby(); } else this.destroy();
  }
}
