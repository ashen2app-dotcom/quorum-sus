// Sala/partida autoritativa. O cliente só envia intenções; tudo é validado aqui.
import crypto from 'node:crypto';
import { WORLD, canStand, STATIONS, VENTS, SPECIAL, CAMS, TASK_MIN, ROOMS, FREEZABLE as FREEZ, roomAt } from '../shared/map.js';
import { Bot } from './bot.js';
import { sanitizeLook, sanitizeName, COLORS, HATS, OUTFITS, ACCS, MASCOTS, SKINS } from '../shared/cosmetics.js';
import { JOBS, JOB, DEFAULT_SETTINGS, SETTING_LIMITS, colorTone, INF_MSGS } from '../shared/jobs.js';

export const MIN_PLAYERS = +process.env.MIN_PLAYERS || 4;
const MAX_PLAYERS = 15;
const BASE_SPEED = 190, BASE_VIS = 420, KILL_R = 95, REPORT_R = 150, TASK_R = 110, FIX_R = 110, VENT_R = 80, PROBE_R = 110, CAM_R = 300;
const DC_GRACE = 150, SAB_CD = 30, HEAT_TIME = 45, INTRO = 4.2, RESULT_TIME = 8, END_TIME = 12;
const GEN_NAMES = ['Ashen', 'Shadow', 'Nexus', 'Ghost', 'Dark', 'Lunar', 'Venom', 'Zero', 'Pixel', 'Orion', 'Blaze', 'Echo', 'Nova', 'Rift', 'Onyx', 'Frost', 'Vortex', 'Comet', 'Rogue', 'Mira', 'Kairo', 'Luna', 'Thor', 'Zeca', 'Duda', 'Bruno', 'Lari', 'Gabs', 'Tiago', 'Nina', 'Kiko', 'Rafa', 'Bia', 'Dani', 'Leo', 'Mel', 'Pedro', 'Sol', 'Vini', 'Yuri'];
const DEFAULTS = { impostors: 0, speed: 1, vision: 1, discuss: 30, vote: 30, tasks: 4, killCd: 22, emergencies: 1, emergCd: 20, confirm: 1, ...DEFAULT_SETTINGS };
const LIMITS = { impostors: [0, 3], speed: [0.75, 1.5], vision: [0.5, 1.5], discuss: [10, 120], vote: [10, 120], tasks: [1, 8], killCd: [10, 45], emergencies: [0, 3], emergCd: [0, 60], confirm: [0, 1], ...SETTING_LIMITS };

// v1.0: áreas que o Congelador pode congelar (sem as salas essenciais: reunião, pontos de conserto de sabotagem e spawn)
const FREEZABLE = new Set(FREEZ);
const ROOM_BY = Object.fromEntries(ROOMS.map(r => [r.id, r]));
const PH_R = 230, LIGHTER_R = 110, GHOST_JOBS = ['anjo', 'influencer', 'phantom'];
// v2.0
const POSS_R = 220, SWAP_R = 180, THROW_R = 260, SHUR_HIT = 22, SEG_PICK = 30, SPEED_JP = 2;
const KILL_JOBS = ['xerife', 'mentalista', 'policial', 'seguranca'];
const POSS_BLOCK = new Set(['taskStart', 'taskDone', 'report', 'emergency', 'fix', 'vent']); // ações ligadas ao corpo real de Chuck, bloqueadas durante a possessão // quem tem o TIRO (mesma mecânica do Xerife)
const rnd = n => Math.floor(Math.random() * n);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const stationById = Object.fromEntries(STATIONS.map(s => [s.id, s]));
const dec = (o, dt, fn) => { for (const k in o) { o[k] -= dt; if (o[k] <= 0) { delete o[k]; fn && fn(k); } } };

export class Room {
  constructor(code, onEmpty) {
    Object.assign(this, { code, onEmpty, players: new Map(), hostId: null, settings: { ...DEFAULTS }, pub: false,
      phase: 'lobby', bodies: [], sab: null, sabCd: 0, timer: 0, loop: null, n: 0, nextId: 1, last: Date.now(), meet: null, supreme: null, sups: new Map(), ghostN: {}, botText: '', frozen: new Set(), lighter: null, hist: [], clockT: 0, histMin: 0, neuT: 0, pair: null, bombs: [], bombSeq: 1, traps: new Map(), deaths: [], round: 0, sageDirty: false });
  }
  get list() { return [...this.players.values()]; }
  send(p, m) { if (p.bot) { try { p.ai.onMsg(m); } catch (e) { console.error('[bot]', e); } return; } if (p.ws && p.ws.readyState === 1) p.ws.send(JSON.stringify(m)); }
  all(m, f) { for (const p of this.players.values()) if (!f || f(p)) this.send(p, m); }
  impSide(p) { return p.role === 'imp' || !!p.allyImp; } // v2.0: o Segurança que protege um impostor joga pelos impostores
  alive(role) { return this.list.filter(p => p.alive && !p.gone && (!role || (role === 'imp') === this.impSide(p))); }
  canVent(p) { return p.team === 'imp' || p.job === 'engenheiro'; }

  // ---------- lobby ----------
  join(ws, name, look) {
    if (this.phase !== 'lobby') return { err: 'Partida em andamento.' };
    if (this.humansList().length >= MAX_PLAYERS) return { err: 'Sala cheia.' };
    const p = this.mk(ws, name, look); p.look.c = this.freeColor(p.look.c, p);
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
    if (this.phase !== 'lobby' && p.job === 'sabio') this.pushSage(p);
    return p;
  }
  mk(ws, name, look) { return { id: this.nextId++, token: crypto.randomBytes(12).toString('hex'), name: sanitizeName(name), look: sanitizeLook(look), ws,
      x: 0, y: 0, ix: 0, iy: 0, face: 1, moving: false, alive: true, role: null, team: null, job: null, ghostJob: null, tasks: [], ts: {}, killCd: 0, emerg: 0, vent: -1,
      vote: null, voted: false, chatAt: 0, dcAt: 0, gone: false, cd: {}, act: {}, uses: {}, shieldT: 0, morph: null, track: null, probe: null, supLeft: 0, supGiven: false,
      killedBy: null, deathRoom: '', target: null, seen: new Set(), revealed: false, sciWait: false, watch: false,
      armor: 0, bank: 0, voteW: 1, inf: false, fuel: false, hasLighter: false, phT: 0, phLost: false, phTasks: [], frzSel: [], carry: null, carryT: 0, lover: null, medRev: false,
      poss: null, possBy: null, clean: null, prot: null, allyImp: false, jpAb: null, jpSh: false, swapped: false, job0: null, sageOn: false }; }
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
    if (!nb) return; const names = this.botNameList(nb), used = new Set(this.list.map(q => q.look.c)), free = shuffle(COLORS.map((_, c) => c).filter(c => !used.has(c)));
    const opt = n => (Math.random() < 0.45 ? 0 : 1 + rnd(n - 1));
    for (let i = 0; i < nb; i++) {
      if (!free.length) break; // sem cores livres: não cria bot com cor repetida
      const look = { c: free.shift(), h: opt(HATS.length), o: rnd(OUTFITS.length), a: opt(ACCS.length), m: opt(MASCOTS.length), s: opt(SKINS.length) };
      const p = this.mk(null, names[i], look); p.bot = true; p.ai = new Bot(this, p); this.players.set(p.id, p);
    }
  }
  // ---- cores únicas: ninguém (humano ou bot) repete a cor visual de outro ----
  usedColors(except) { return new Set(this.list.filter(q => q !== except && !q.gone).map(q => q.look.c)); }
  freeColor(pref, except) { const used = this.usedColors(except); if (!used.has(pref)) return pref; const f = COLORS.map((_, i) => i).filter(i => !used.has(i)); return f.length ? f[rnd(f.length)] : pref; }
  fixLook(p, look) { const l = sanitizeLook(look); if (this.usedColors(p).has(l.c)) { l.c = p.look && !this.usedColors(p).has(p.look.c) ? p.look.c : this.freeColor(l.c, p); return { look: l, taken: true }; } return { look: l, taken: false }; }
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
      const pool = JOBS.filter(j => j.team === team && !j.ghost && S['w_' + j.id] > 0 && (cnt[j.id] || 0) < S['m_' + j.id] && !j.pair);
      const sum = pool.reduce((a, j) => a + S['w_' + j.id], 0); if (!pool.length || sum <= 0) return fallback;
      let r = Math.random() * sum; for (const j of pool) { r -= S['w_' + j.id]; if (r <= 0) { cnt[j.id] = (cnt[j.id] || 0) + 1; return j.id; } }
      return pool[pool.length - 1].id;
    };
    ps.forEach((q, i) => {
      let job = i < ni ? draw('imp', 'impostor') : i < ni + nn ? draw('neu', null) : null;
      if (!job) job = draw('inn', 'tripulante'); // vaga neutra sem profissão disponível vira inocente
      q.job = job; q.team = JOB[job].team; q.role = q.team === 'imp' ? 'imp' : 'crew';
    });
    // v1.5 Lovers: exatamente dois Tripulantes comuns viram o par (chance configurável; nunca rouba outra profissão)
    this.pair = null; for (const q of ps) { q.lover = null; q.medRev = false; }
    if (S.w_lovers > 0 && S.m_lovers > 0 && Math.random() * 100 < S.w_lovers) {
      const plain = ps.filter(q => q.job === 'tripulante');
      if (plain.length >= 2) { const [a, b] = shuffle(plain); a.job = b.job = 'lovers'; a.lover = b.id; b.lover = a.id; this.pair = { a: a.id, b: b.id, unlocked: false, used: false, target: null }; }
    }
    const mates = ps.filter(q => q.team !== 'inn' || true);
    for (const q of ps) if (q.job === 'execution') q.target = shuffle(mates.filter(o => o !== q && o.job !== 'joker'))[0]?.id ?? null; // nunca sorteia o Joker como alvo
  }
  start(p) {
    if (p.id !== this.hostId || this.phase !== 'lobby') return;
    const S = this.settings; this.syncBots(); const n = this.list.filter(q => q.ws || q.bot).length;
    if (n < MIN_PLAYERS) return this.send(p, { t: 'err', msg: `São necessários ao menos ${MIN_PLAYERS} jogadores.` });
    let ni = S.impostors || (n <= 6 ? 1 : n <= 10 ? 2 : 3);
    ni = Math.max(1, Math.min(ni, Math.floor((n - 1) / 2)));
    const nn = Math.max(0, Math.min(S.neutrals, n - ni - 2));
    for (const q of [...this.players.values()]) if (!q.ws && !q.bot) this.players.delete(q.id);
    { const seen = new Set(); for (const q of this.list) { if (seen.has(q.look.c)) { const f = COLORS.map((_, i) => i).filter(i => !seen.has(i) && !this.usedColors(q).has(i)); if (!f.length) return this.send(p, { t: 'err', msg: 'Não há cores suficientes para todos os jogadores.' }); q.look.c = f[rnd(f.length)]; } seen.add(q.look.c); } }
    const ps = shuffle(this.list.filter(q => q.ws || q.bot));
    this.assign(ps, ni, nn);
    ps.forEach((q, i) => {
      const a = (i / n) * Math.PI * 2;
      Object.assign(q, { alive: true, x: SPECIAL.spawn.x + Math.cos(a) * 85, y: SPECIAL.spawn.y + Math.sin(a) * 60, ix: 0, iy: 0, vent: -1, killCd: (q.job === 'ninja' ? S.nin_killcd : 10) + INTRO, emerg: 0, vote: null, voted: false, ts: {}, gone: false,
        ghostJob: null, cd: KILL_JOBS.includes(q.job) ? { skill: 10 + INTRO } : {}, act: {}, uses: { panel: S.cie_uses, inf: S.inf_uses, tl: S.tl_uses, rj: S.rj_uses, med: S.med_uses, inq: S.inq_tries, swp: S.swp_uses }, shieldT: 0, armor: q.job === 'samurai' ? S.sam_armor : 0, bank: 0, voteW: 1, inf: false, fuel: false, hasLighter: false, phT: 0, phLost: false, phTasks: [], frzSel: [], carry: null, carryT: 0, medRev: false, poss: null, possBy: null, clean: null, prot: null, allyImp: false, jpAb: null, jpSh: false, swapped: false, job0: q.job, sageOn: false, morph: null, track: null, probe: null, supLeft: 0, supGiven: false,
        killedBy: null, deathRoom: '', seen: new Set(), revealed: false, sciWait: false, watch: false,
        tasks: q.team === 'neu' ? [] : shuffle([...STATIONS]).slice(0, S.tasks).map(s => ({ id: s.id, type: s.type, name: s.name, room: s.room, done: false })) });
    });
    Object.assign(this, { bombs: [], bombSeq: 1, traps: new Map(), deaths: [], round: 1, sageDirty: true });
    Object.assign(this, { phase: 'play', bodies: [], sab: null, sabCd: 25, emergCd: this.settings.emergCd, intro: INTRO, meet: null, supreme: null, sups: new Map(), ghostN: {}, last: Date.now(), n: 0, frozen: new Set(), lighter: null, hist: [], clockT: 0, histMin: 0, neuT: 0 });
    this.setupV2(ps);
    for (const q of this.list) this.send(q, { t: 'start', ...this.startPayload(q) });
    clearInterval(this.loop); this.loop = setInterval(() => this.tick(), 33);
  }
  startPayload(p) {
    return { role: p.role, team: p.team, job: p.job, lover: p.lover, ghostJob: p.ghostJob, jp: p.revealed, target: p.target, sup: p.supLeft, x: p.x, y: p.y, alive: p.alive,
      mates: p.team === 'imp' ? this.list.filter(q => q.team === 'imp' || q.allyImp).map(q => [q.id, q.job]) : [], pr: p.prot ?? null, ally: p.allyImp ? 1 : 0,
      tasks: this.activeTasks(p), settings: this.pubSettings(), players: this.list.map(q => ({ id: q.id, name: q.name, look: q.look })), emergUsed: p.emerg };
  }

  // ---------- loop ----------
  tick() {
    const now = Date.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now; this.n++;
    if (this.phase === 'play') {
      if (this.intro > 0) this.intro -= dt;
      else {
        this.possTick(dt);
        for (const p of this.list) { this.move(p, dt); this.cool(p, dt); }
        this.bodyTick(dt); this.clockT += dt; this.histTick(); this.neutralTick(dt); this.v2Tick(dt);
        if (this.phase !== 'play') return;
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
    if (this.sageDirty && this.phase !== 'lobby') this.sageFlush();
    if (this.n % 30 === 0) this.housekeeping(now);
  }
  cool(p, dt) {
    if (p.killCd > 0) p.killCd -= dt;
    dec(p.cd, dt); if (p.shieldT > 0) p.shieldT -= dt;
    dec(p.act, dt, k => { if (k === 'morph') { p.morph = null; p.cd.morph = this.settings.met_cd; } else if (k === 'invis') p.cd.invis = this.settings.esp_cd; else if (k === 'locate') p.track = null; else if (k === 'zoom') p.cd.zoom = this.settings.zoom_cd; else if (k === 'phase') { p.cd.phase = this.settings.gh_cd; this.unstick(p); } });
    if (!p.alive && p.ghostJob === 'phantom' && !p.phLost) p.phT += dt;
    if (p.carry != null && (p.carryT -= dt) <= 0) this.drop(p);
    if (p.probe) {
      const t = this.players.get(p.probe.id);
      if (!t || !t.alive || t.moving || dist(p, t) > PROBE_R || !p.alive) p.probe = null;
      else if ((p.probe.t += dt) >= this.settings.men_inv) { this.send(p, { t: 'reveal', list: [[t.id, this.pubJob(t.job)]] }); p.probe = null; }
    }
  }
  bodyTick(dt) {
    for (let i = this.bodies.length - 1; i >= 0; i--) { const b = this.bodies[i]; if (b.vanish > 0 && (b.vanish -= dt) <= 0) { this.bodies.splice(i, 1); continue; } if (b.hideT > 0) b.hideT -= dt; if (b.carry != null) { const c = this.players.get(b.carry); if (c && c.alive && c.carry === b.id) { b.x = c.x; b.y = c.y; } else { b.carry = null; b.med = false; } } }
  }
  move(p, dt) {
    if (p.gone || p.vent >= 0 || p.watch) { if (p.watch) p.moving = false; return; }
    if (p.poss) { p.moving = false; return; } // Chuck controla o personagem do alvo; o corpo dele fica parado
    if (!p.bot && p.inAt && Date.now() - p.inAt > 700) p.ix = p.iy = 0; // sem notícias do cliente: para (evita boneco andando sozinho)
    const l = Math.hypot(p.ix, p.iy); p.moving = l > 0.05;
    if (!p.moving) return;
    const k = Math.min(1, 1 / l) * BASE_SPEED * this.settings.speed * (p.act.samrush > 0 ? this.settings.sam_speed : 1) * this.spdMul(p) * dt, dx = p.ix * k, dy = p.iy * k;
    if (dx) p.face = dx > 0 ? 1 : -1;
    if (!p.alive && !(p.ghostJob === 'phantom' && !p.phLost)) { p.x = Math.min(WORLD.w - 20, Math.max(20, p.x + dx)); p.y = Math.min(WORLD.h - 20, Math.max(20, p.y + dy)); return; }
    const ph = p.act.phase > 0, ok = (x, y) => !this.frozenHit(x, y) && (ph ? x > 20 && y > 20 && x < WORLD.w - 20 && y < WORLD.h - 20 : canStand(x, y));
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8)), sx = dx / n, sy = dy / n; // passos curtos: nenhuma velocidade atravessa paredes
    for (let i = 0; i < n; i++) { if (ok(p.x + sx, p.y)) p.x += sx; if (ok(p.x, p.y + sy)) p.y += sy; }
  }
  // ---- v1.0: áreas congeladas, Ghost Inc, histórico do Time Lord, neutros ----
  frozenHit(x, y) { for (const id of this.frozen) { const r = ROOM_BY[id]; if (x + 12 > r.x && x - 12 < r.x + r.w && y + 12 > r.y && y - 12 < r.y + r.h) return true; } return false; }
  unstick(p) { // ao terminar a habilidade de atravessar paredes: nunca deixa o jogador preso
    const ok = (x, y) => canStand(x, y) && !this.frozenHit(x, y); if (ok(p.x, p.y)) return;
    for (let r = 20; r <= 600; r += 20) for (let a = 0; a < 24; a++) { const x = p.x + Math.cos(a / 24 * Math.PI * 2) * r, y = p.y + Math.sin(a / 24 * Math.PI * 2) * r; if (ok(x, y)) { p.x = x; p.y = y; return; } }
    p.x = SPECIAL.spawn.x; p.y = SPECIAL.spawn.y;
  }
  eligible(except) { return this.list.filter(q => q !== except && q.alive && !q.gone); }
  bodyHidden(b) { return b.hideT > 0; }
  drop(p) { const b = this.bodies.find(q => q.id === p.carry); if (b) { b.carry = null; b.med = false; b.x = p.x; b.y = p.y; b.hideT = 0; /* no chão o saco fica visível na hora */ } p.carry = null; }
  histTick() {
    if (this.n % 15 !== 0) return; // ~2 amostras por segundo
    this.hist.push({ t: this.clockT, pl: this.list.filter(q => !q.gone).map(q => [q.id, q.x, q.y, q.alive ? 1 : 0, q.vent]) });
    const keep = 16; while (this.hist.length && this.clockT - this.hist[0].t > keep) this.hist.shift();
  }
  rewind(p) {
    this.endAllPoss('rewind');
    const S = this.settings, want = this.clockT - S.tl_rew; let e = null;
    for (const h of this.hist) if (h.t >= this.histMin && h.t <= want + 0.6) e = h; // amostra mais próxima do alvo (sem cruzar reunião)
    if (!e) e = this.hist.find(h => h.t >= this.histMin);
    if (!e || this.clockT - e.t < 3) return this.send(p, { t: 'err', msg: 'Ainda não há histórico suficiente para retroceder.' });
    const rev = [], ps = [];
    for (const [id, x, y, al] of e.pl) {
      const q = this.players.get(id); if (!q || q.gone) continue;
      if (al && !q.alive) { // ressuscita
        this.resurrect(q); rev.push(id);
      }
      if (q.alive) { q.vent = -1; q.x = x; q.y = y; q.ix = q.iy = 0; if (q.morph) q.morph = null; if (q.carry != null) this.drop(q); ps.push([id, x | 0, y | 0]); }
    }
    this.bodies = this.bodies.filter(b => !rev.includes(b.id));
    p.uses.tl--; p.cd.rewind = S.tl_cd; this.hist = []; this.histMin = this.clockT;
    this.all({ t: 'rewind', ps, rev }); // sem nome do usuário: ninguém sabe quem retrocedeu
    for (const id of rev) this.send(this.players.get(id), { t: 'revive' });
    console.log(`[retrocesso] ${this.code} ${p.name} voltou ${Math.round(this.clockT - e.t)}s; ressuscitados: ${rev.length}`);
  }
  // v1.5: volta à vida mantendo profissão/equipe (usado pelo Time Lord e pelo Médico). Não mexe em posição nem em corpos.
  resurrect(q) {
    this.sageDirty = true; q.poss = q.possBy = q.clean = null;
    q.alive = true; q.killedBy = null; q.vent = -1; q.ix = q.iy = 0; q.watch = false; q.cd = {}; q.act = {}; q.shieldT = 0;
    if (q.ghostJob) { this.ghostN[q.ghostJob] = Math.max(0, (this.ghostN[q.ghostJob] || 1) - 1); if (q.ghostJob === 'phantom') { q.phTasks = []; this.send(q, { t: 'tasks', list: q.tasks }); } q.ghostJob = null; }
    if (q.team === 'imp') q.killCd = Math.max(q.killCd, 12);
  }
  activeTasks(p) { return p.ghostJob === 'phantom' && !p.phLost ? p.phTasks : p.tasks; } // lista que o jogador está fazendo agora
  givePhantomTasks(v) { // 12 tarefas próprias (não contam para os inocentes). As tarefas originais continuam guardadas e as já concluídas seguem contando para a equipe
    const mine = new Set(v.tasks.map(k => k.id));
    v.phTasks = shuffle(STATIONS.filter(s => !mine.has(s.id))).slice(0, this.settings.ph_tasks).map(s => ({ id: s.id, type: s.type, name: s.name, room: s.room, done: false })); v.ts = {};
    this.send(v, { t: 'tasks', list: v.phTasks });
  }
  phantomDone(p) { return p.ghostJob === 'phantom' && !p.phLost && p.phTasks.length > 0 && p.phTasks.filter(k => !this.taskFrozen(k)).every(k => k.done); }
  phVisible(p) { const S = this.settings, cyc = S.ph_hid + S.ph_vis; return p.ghostJob === 'phantom' && !p.alive && !p.phLost && (p.phT % cyc) >= S.ph_hid; }
  paProgress(pa) { const el = this.eligible(pa); return [el.filter(q => q.fuel).length, el.length]; }
  viProgress(vi) { const el = this.eligible(vi); return [el.filter(q => q.inf).length, el.length]; }
  spawnLighter() {
    const S = this.settings; for (let i = 0; i < 80; i++) { const r = ROOMS[rnd(ROOMS.length)]; if (this.frozen.has(r.id)) continue; const x = r.x + 60 + Math.random() * (r.w - 120), y = r.y + 60 + Math.random() * (r.h - 120); if (canStand(x, y, 16)) { this.lighter = { x, y, t: S.pa_resp }; return; } }
    this.lighter = { x: SPECIAL.spawn.x, y: SPECIAL.spawn.y + 120, t: S.pa_resp };
  }
  neutralTick(dt) {
    const pa = this.list.find(q => q.job === 'parinomo' && q.alive && !q.gone);
    if (!pa) { this.lighter = null; return; }
    if (pa.hasLighter) return;
    if (this.lighter) { if ((this.lighter.t -= dt) <= 0) this.spawnLighter(); return; } // reaparece em outro lugar se ninguém pegar
    if (this.n % 15 === 0) { const [a, t] = this.paProgress(pa); if (t > 0 && a >= t) this.spawnLighter(); }
  }
  visR(p) {
    if (!p.alive) return Infinity;
    const base = BASE_VIS * this.settings.vision * (p.role === 'imp' ? 1.2 : 1);
    return this.sab?.k === 'lights' && p.role !== 'imp' ? 140 * this.settings.vision : base;
  }
  taskCount() {
    let d = 0, t = 0;
    for (const p of this.list) if (p.team === 'inn' && !p.gone) { const ph = p.ghostJob === 'phantom' && !p.phLost; for (const k of p.tasks) { if (ph && !k.done) continue; /* Phantom: só as já concluídas continuam contando */ if (this.taskFrozen(k)) continue; t++; if (k.done) d++; } }
    return [d, t];
  }
  snapshot() {
    const tk = this.taskCount(), sab = this.sab && { k: this.sab.k, t: Math.ceil(this.sab.t || 0), fixed: this.sab.fixed };
    const arrows = this.bodies.filter(b => b.arrow && !this.bodyHidden(b)).map(b => [b.x | 0, b.y | 0]);
    if (this.sab?.k === 'comms') for (const p of this.list) if (p.watch) { p.watch = false; this.send(p, { t: 'camOff' }); }
    const camOn = this.list.some(p => p.watch);
    const r0 = o => { const r = {}; for (const k in o) r[k] = Math.ceil(o[k]); return r; };
    for (const v of this.list) {
      if (!v.ws && !v.bot) continue;
      const vrr = this.visR(v), R = vrr * 1.15, pl = [], bd = [], ctl = v.poss ? (this.players.get(v.poss.id) || v) : v; // ctl: personagem que o jogador está controlando (Chuck possuindo)
      for (const p of this.list) {
        if (p === ctl || p.gone || p.vent >= 0) continue;
        const phv = this.phVisible(p); if (!p.alive && v.alive && !phv) continue;
        const inv = p.act.invis > 0 || p.act.samrush > 0; if (inv && v.alive && v.team !== 'imp') continue; // Espectro e Samurai em disparada ficam invisíveis
        if (v.alive && !(v.act.zoom > 0) && dist(ctl, p) > R) continue; // com ZOOM (Policial/Red John) vê todos os jogadores andando
        pl.push([p.id, p.x | 0, p.y | 0, p.face, p.moving ? 1 : 0, p.alive ? 0 : phv && v.alive ? 2 : 1, p.morph || p.id, inv ? 1 : 0]);
      }
      for (const b of this.bodies) if ((!v.alive || v.act.zoom > 0 || dist(ctl, b) <= R) && (!this.bodyHidden(b) || !v.alive)) bd.push([b.id, b.x | 0, b.y | 0, b.g ? 1 : 0, b.fx || 0, b.bag ? (this.bodyHidden(b) ? 2 : 1) : 0, b.med ? 1 : 0]);
      let cams = null, vd = null;
      if (v.watch) cams = CAMS.map(c => { const o = { x: c.vx, y: c.vy }; return [this.list.filter(p => p.alive && !p.gone && p.vent < 0 && !(p.act.invis > 0) && !(p.act.samrush > 0) && dist(p, o) <= CAM_R).map(p => [p.id, p.x | 0, p.y | 0, p.face, p.moving ? 1 : 0, p.morph || p.id]), this.bodies.filter(b => dist(b, o) <= CAM_R && !this.bodyHidden(b)).map(b => [b.id, b.x | 0, b.y | 0, b.g ? 1 : 0])]; });
      if (v.vent >= 0 && v.alive) vd = this.list.filter(p => p !== v && p.alive && !p.gone && dist(p, v) <= 1600).map(p => +Math.atan2(p.y - v.y, p.x - v.x).toFixed(2));
      const tr = v.track && this.players.get(v.track); const loc = tr && tr.alive && v.act.locate > 0 ? [tr.x | 0, tr.y | 0, tr.id] : null;
      const bm = this.bombs.filter(b => !v.alive || v.act.zoom > 0 || dist(ctl, b) <= R).map(b => [b.id, b.x | 0, b.y | 0, +b.t.toFixed(1)]);
      this.send(v, { t: 'snap', bm, ec: Math.ceil(Math.max(0, this.emergCd || 0)), you: [ctl.x | 0, ctl.y | 0, v.vent, ctl === v ? (v.morph || v.id) : (ctl.morph || ctl.id), v.act.invis > 0 || v.act.samrush > 0 ? 1 : 0, Math.ceil(v.shieldT > 0 ? v.shieldT : 0)], pl, bd, tk, sab: sab || null, vr: Math.round(vrr), ar: arrows, loc,
        cd: v.role === 'imp' || (v.alive && this.canKillJob(v)) ? [Math.max(0, Math.ceil(v.killCd)), v.role === 'imp' ? Math.max(0, Math.ceil(this.sabCd)) : 0] : null, ab: { cd: r0(v.cd), act: r0(v.act), us: v.uses, sup: v.supLeft, mul: this.spdMul(v) },
        probe: v.probe ? [v.probe.id, v.probe.t / this.settings.men_inv] : null, fz: this.frozen.size ? [...this.frozen] : 0, xt: this.extra(v, R), cams, vd, co: camOn ? 1 : 0, intro: this.intro > 0 ? Math.ceil(this.intro) : 0 });
    }
  }
  extra(v, R) { // dados privados de cada profissão (só vão para quem tem a profissão)
    const x = {}, J = v.alive ? v.job : v.ghostJob;
    if (this.lighter && (!v.alive || dist(v, this.lighter) <= R)) x.lt = [this.lighter.x | 0, this.lighter.y | 0];
    if (J === 'samurai') x.arm = v.armor;
    if (J === 'congelador') x.sel = v.frzSel;
    if (J === 'parinomo') { x.pf = this.paProgress(v); x.pids = this.eligible(v).filter(q => q.fuel).map(q => q.id); x.hl = v.hasLighter ? 1 : 0; x.ls = this.lighter ? 1 : 0; }
    if (J === 'virus') { x.vi = this.viProgress(v); x.vids = this.eligible(v).filter(q => q.inf).map(q => q.id); }
    if (J === 'dexter' || J === 'medico') x.carry = v.carry != null ? Math.ceil(v.carryT) : 0;
    if (v.alive && v.job === 'lovers' && this.pair) { // privado: só os dois Lovers recebem
      const o = this.players.get(v.lover), cnt = q => [q.tasks.filter(k => k.done).length, q.tasks.length];
      x.lv = [v.lover, ...cnt(v), ...(o ? cnt(o) : [0, 0]), this.pair.unlocked ? 1 : 0, this.pair.used ? 1 : 0, this.pair.target ?? -1];
    }
    if (J === 'advogado') x.bank = v.bank;
    if (J === 'sabotador') x.tr = [...this.traps].filter(([, t]) => t.by === v.id).map(([id]) => id);
    if (v.poss) x.pc = [v.poss.id, Math.ceil(v.poss.t)];
    if (v.possBy != null) x.pd = 1;
    if (J === 'faxineiro' && v.clean) x.cl = Math.ceil(v.clean.t);
    if (J === 'seguranca') x.pr = [v.prot ?? -1, v.prot != null && this.players.get(v.prot)?.alive ? 1 : 0, v.allyImp ? 1 : 0, v.prot == null ? Math.max(0, Math.ceil((v.protDl || 0) - this.clockT)) : 0];
    if (J === 'jackpot') x.jp = [v.jpAb, v.jpRound || 0];
    if (!v.alive && v.ghostJob === 'phantom') { const S = this.settings, cyc = S.ph_hid + S.ph_vis, t = v.phT % cyc, vis = t >= S.ph_hid; x.ph = [vis ? 1 : 0, Math.ceil(vis ? cyc - t : S.ph_hid - t), v.phLost ? 1 : 0]; }
    return Object.keys(x).length ? x : 0;
  }
  housekeeping(now) {
    for (const p of this.list) {
      if (p.ws || !p.dcAt || p.gone || now - p.dcAt < DC_GRACE * 1000) continue;
      p.gone = true; p.alive = false; console.log(`[saiu] ${this.code} ${p.name} ficou offline por mais de ${DC_GRACE}s e foi removido da partida`); this.onGone(p);
    }
    if (this.phase !== 'lobby' && this.phase !== 'end') {
      if (this.checkWin()) return;
      if (!this.list.some(p => p.ws || (p.dcAt && now - p.dcAt < DC_GRACE * 1000))) this.destroy();
    }
  }

  // ---------- ações ----------
  handle(p, m) {
    const ph = this.phase, live = p.alive && !p.gone;
    if (p.poss && POSS_BLOCK.has(m.t)) return;
    switch (m.t) {
      case 'look': if (ph === 'lobby') { const f = this.fixLook(p, m.look); p.look = f.look; if (f.taken) this.send(p, { t: 'err', msg: 'Essa cor já está em uso por outro jogador.' }); if (m.name) p.name = sanitizeName(m.name); this.syncBots(); this.lobby(); } break;
      case 'botlook': { if (p.id !== this.hostId || ph !== 'lobby') break; const b = this.players.get(+m.id); if (b && b.bot) { const f = this.fixLook(b, m.look); b.look = f.look; if (f.taken) this.send(p, { t: 'err', msg: 'Essa cor já está em uso por outro jogador.' }); this.lobby(); } else this.send(p, { t: 'err', msg: 'Só dá para personalizar o seu personagem ou os de bots.' }); break; }
      case 'set': this.setSetting(p, m.k, m.v); break;
      case 'botnames': if (p.id === this.hostId && ph === 'lobby') { this.botText = String(m.text || '').slice(0, 600); this.syncBots(true); this.lobby(); } break;
      case 'start': this.start(p); break;
      case 'ping': this.send(p, { t: 'pong', ts: m.ts }); break;
      case 'input': if (ph === 'play' && p.possBy == null) { p.inAt = Date.now(); p.ix = Math.max(-1, Math.min(1, +m.x || 0)); p.iy = Math.max(-1, Math.min(1, +m.y || 0)); } break;
      case 'taskStart': { if (ph !== 'play') break; const k = this.activeTasks(p).find(t => t.id === m.id && !t.done), s = stationById[m.id];
        if (k && s && !this.taskFrozen(k) && dist(p, s) <= TASK_R) { if (this.trapHit(p, s)) break; p.ts[m.id] = Date.now(); } break; }
      case 'taskDone': { if (ph !== 'play') break; const k = this.activeTasks(p).find(t => t.id === m.id && !t.done), s = stationById[m.id], t0 = p.ts[m.id];
        if (!k || !s || !t0 || this.taskFrozen(k) || dist(p, s) > TASK_R + 30 || Date.now() - t0 < TASK_MIN[k.type]) break;
        k.done = true; delete p.ts[m.id]; this.send(p, { t: 'taskOk', id: m.id }); this.taskHooks(p); this.checkWin(); break; }
      case 'kill': this.kill(p); break;
      case 'ab': this.ab(p, m); break;
      case 'report': if (ph === 'play' && live && p.vent < 0) { const b = this.bodies.find(b => !this.bodyHidden(b) && dist(p, b) <= REPORT_R); if (b) this.meeting(p, 'body', b.id); } break;
      case 'emergency': if (ph === 'play' && live && p.vent < 0 && dist(p, SPECIAL.emergency) <= FIX_R + 40 && p.emerg < this.settings.emergencies && this.sab?.k !== 'heat') { if (this.emergCd > 0) { this.send(p, { t: 'err', msg: `O botão de emergência está recarregando (${Math.ceil(this.emergCd)}s).` }); break; } p.emerg++; this.meeting(p, 'emergency'); } break;
      case 'sabotage': if (ph === 'play' && live && p.team === 'imp' && !this.sab && this.sabCd <= 0 && ['lights', 'comms', 'heat'].includes(m.k)) {
        this.sab = { k: m.k, t: m.k === 'heat' ? HEAT_TIME : 0, fixed: m.k === 'heat' ? [false, false] : [false] };
        this.all({ t: 'sab', k: m.k }); } break;
      case 'fix': if (ph === 'play' && live && this.sab) this.fix(p, m.id); break;
      case 'vent': this.vent(p, m.a); break;
      case 'vote': if (ph === 'vote' && live && !p.voted) {
        const t = this.players.get(m.to), ok = m.to === 'skip' || (t?.alive && !t.gone);
        if (!ok) break;
        if (p.job === 'advogado') { const sp = Math.max(0, Math.min(p.bank, this.settings.law_max, Math.floor(+m.spend || 0))); p.bank -= sp; p.voteW = 1 + sp; this.send(p, { t: 'bank', n: p.bank }); }
        if (m.sup && m.to !== 'skip' && p.supLeft > 0) { p.supLeft--; if (!this.sups.has(p.id)) this.sups.set(p.id, +m.to); if (this.supreme == null) this.supreme = m.to; }
        p.voted = true; p.vote = m.to; this.all({ t: 'voted', id: p.id });
        if (this.alive().every(q => q.voted || (!q.ws && !q.bot))) this.finishVote(); } break;
      case 'chat': { if (ph !== 'meet' && ph !== 'vote') break; const now = Date.now(); if (now - p.chatAt < 700) break; p.chatAt = now;
        const text = String(m.text || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 140); if (!text) break;
        this.all({ t: 'chat', id: p.id, text, dead: !p.alive }, q => p.alive || !q.alive); break; }
    }
  }
  taskFrozen(k) { const s = stationById[k.id]; return !!s && [...this.frozen].some(id => ROOM_BY[id].name === s.room); }
  taskHooks(p) {
    if (this.phantomDone(p)) return this.end('phantom', `${p.name} (Phantom) concluiu todas as tarefas e venceu sozinho!`, p.id);
    if (!p.supGiven && (p.job === 'juiz' || p.job === 'mentalista')) { p.supGiven = true; p.supLeft = this.settings.jui_uses; this.send(p, { t: 'sup', left: p.supLeft, fresh: true }); }
    if (p.job === 'mentalista' && !p.revealed && p.tasks.length && p.tasks.every(k => k.done)) { p.revealed = true; this.send(p, { t: 'unlock' }); }
    if (p.job === 'sabio' && !p.sageOn && p.tasks.length && p.tasks.every(k => k.done || this.taskFrozen(k))) { p.sageOn = true; this.send(p, { t: 'sageon' }); this.sageDirty = true; }
    this.checkLovers();
  }
  // Lovers: só libera a descoberta quando OS DOIS terminaram (tarefas em áreas congeladas não bloqueiam)
  checkLovers() {
    const pr = this.pair; if (!pr || pr.unlocked) return;
    const a = this.players.get(pr.a), b = this.players.get(pr.b); if (!a || !b || a.gone || b.gone) return;
    const done = q => q.tasks.every(k => k.done || this.taskFrozen(k));
    if (!done(a) || !done(b)) return;
    pr.unlocked = true; for (const q of [a, b]) this.send(q, { t: 'lovunlock' });
  }
  pubJob(j) { return j === 'lovers' ? 'tripulante' : j; } // habilidades de investigação nunca expõem os Lovers
  // Morte unificada (kill, tiro, voto). force ignora escudo.
  slay(v, killer, { body = true, force = false, link = false, cause = null, by = null, as = null, scene = true } = {}) {
    if (!v.alive) return false;
    if (!force && v.shieldT > 0) { if (killer) this.send(killer, { t: 'err', msg: 'Um escudo protegeu o alvo!' }); return false; }
    if (!force && killer && v.armor > 0) { v.armor--; this.send(v, { t: 'err', msg: 'Sua armadura bloqueou o ataque!' }); this.send(killer, { t: 'err', msg: 'O alvo estava protegido por uma armadura!' }); return false; }
    if (v.carry != null) this.drop(v); v.hasLighter = false;
    const vap = v.morph || v.id, kap = as != null ? as : killer ? (killer.morph || killer.id) : null;
    v.alive = false; v.ix = v.iy = 0; v.moving = false; v.watch = false; v.vent = -1; v.track = null; v.probe = null; v.act = {}; v.morph = null;
    const who = killer || by; v.killedBy = who?.id ?? null; v.deathRoom = roomAt(v.x, v.y)?.name || 'corredor';
    console.log(`[morte] ${this.code} ${v.name} (${v.job}) por ${who ? who.name + ' (' + who.job + ')' : 'voto/tiro'}${cause ? ' [' + cause + ']' : ''}${as != null ? ' via possessão de ' + (this.players.get(as)?.name || '?') : ''} em ${v.deathRoom}`);
    const vib = killer?.job === 'vibora';
    if (body) {
      this.bodies.push({ id: v.id, x: v.x, y: v.y, killer: killer?.id ?? null, arrow: v.job === 'barulhento', g: vib, vanish: vib ? this.settings.vib_van : 0, fx: killer?.job === 'redjohn' ? 1 : killer?.job === 'samurai' ? 2 : 0, hideT: 0, bag: false, carry: null, via: as });
      this.all({ t: 'fx', k: vib ? 'killg' : 'kill', id: v.id, x: v.x | 0, y: v.y | 0 }, q => !q.alive || dist(q, v) <= this.visR(q) * 1.3);
    }
    if (body && !link && scene) this.send(v, { t: 'kanim', k: kap, v: vap, r: 'victim' }); // a cena aparece só para quem morre
    this.send(v, { t: 'died', by: cause || (link ? 'link' : killer ? 'kill' : 'vote') });
    // alvo do Execution morreu por outros meios
    for (const q of this.list) if (q.job === 'execution' && q.target === v.id && q.alive && killer) { q.target = null; this.send(q, { t: 'err', msg: 'Seu alvo morreu. Você agora joga pela sobrevivência.' }); }
    // profissões de fantasma (só inocentes que morrem)
    if (v.team === 'inn') for (const gj of shuffle([...GHOST_JOBS])) {
      if ((this.ghostN[gj] || 0) < this.settings['m_' + gj] && Math.random() * 100 < this.settings['w_' + gj]) {
        this.ghostN[gj] = (this.ghostN[gj] || 0) + 1; v.ghostJob = gj; v.cd = {}; v.uses.inf = this.settings.inf_uses; v.phT = 0; v.phLost = false; this.send(v, { t: 'ghost', job: gj }); if (gj === 'phantom') this.givePhantomTasks(v); break;
      }
    }
    // v1.5 Lovers: a morte de um leva o outro. O parceiro entra com link:true, então não há cascata (o primeiro já está morto) nem evento duplicado.
    if (v.job === 'lovers' && v.lover != null && !link) {
      const q = this.players.get(v.lover);
      if (q && q.alive && !q.gone) { console.log(`[morte-lovers] ${this.code} ${q.name} morreu junto com ${v.name}`); this.slay(q, null, { body, force: true, link: true }); this.send(q, { t: 'hint', text: 'Seu par dos Lovers morreu e a ligação levou você junto.' }); }
    }
    this.afterDeath(v, who, cause);
    return true;
  }
  nearestVictim(p, pred) {
    let best = null, bd = KILL_R;
    for (const q of this.list) if (q !== p && q.alive && !q.gone && q.vent < 0 && pred(q) && dist(p, q) <= bd) { best = q; bd = dist(p, q); }
    return best;
  }
  kill(p) {
    const jk = this.canKillJob(p);
    if (this.phase !== 'play' || this.intro > 0 || !(p.team === 'imp' || jk) || !p.alive || p.vent >= 0 || p.killCd > 0) return;
    const actor = p.poss ? this.players.get(p.poss.id) : p; // com Chuck possuindo, quem ataca é o personagem do alvo
    if (!actor || !actor.alive || actor.gone) return;
    const v = this.nearestVictim(actor, q => q !== p && (jk ? true : q.team !== 'imp' && !q.allyImp)); if (!v) return;
    p.killCd = this.killCdOf(p);
    if (!this.slay(v, p, { as: actor !== p ? actor.id : null })) return;
    if (p.job === 'samurai') p.act.samrush = this.settings.sam_dur; // velocidade + invisibilidade após matar
    actor.x = v.x; actor.y = v.y; this.checkWin();
  }
  fix(p, id) {
    const s = this.sab, at = { lights: SPECIAL.lights, comms: SPECIAL.comms, A: SPECIAL.heatA, B: SPECIAL.heatB };
    const pt = s.k === 'heat' ? at[id] : s.k === id ? at[id] : null;
    if (!pt || dist(p, pt) > FIX_R) return;
    if (s.k === 'heat') { s.fixed[id === 'A' ? 0 : 1] = true; if (!s.fixed.every(Boolean)) return this.all({ t: 'sabPart', fixed: s.fixed }); }
    this.sab = null; this.sabCd = SAB_CD; this.all({ t: 'sabEnd' });
  }
  vent(p, a) {
    if (this.phase !== 'play' || !this.canVent(p) || !p.alive || p.possBy != null) return;
    if (p.vent < 0 && a === 'in') {
      if (p.cd.vent > 0) return;
      const i = VENTS.findIndex(v => dist(p, v) <= VENT_R && !this.frozenHit(v.x, v.y)); if (i < 0) return; if (p.carry != null) this.drop(p);
      p.vent = i; p.x = VENTS[i].x; p.y = VENTS[i].y; p.ix = p.iy = 0;
    } else if (p.vent >= 0 && a === 'next') {
      const g = VENTS.filter(v => v.g === VENTS[p.vent].g && !this.frozenHit(v.x, v.y)), cur = VENTS[p.vent], v = g[(g.indexOf(cur) + 1) % g.length]; if (!v) return;
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
        if (!play || !p.alive || p.vent >= 0 || this.sab?.k === 'comms' || p.poss || ((J !== 'hacker' && J !== 'seguranca') && Math.hypot(p.x - SPECIAL.camConsole.x, p.y - SPECIAL.camConsole.y) > 110)) return;
        p.watch = true; p.ix = p.iy = 0; p.moving = false; break;
      case 'camOff': p.watch = false; break;
      case 'investigate': {
        if (J !== 'detetive' || !play) return; const b = this.bodies.find(b => !this.bodyHidden(b) && dist(p, b) <= REPORT_R); if (!b) return;
        if (p.seen.has(b.id)) return bad('Você já investigou este corpo.'); p.seen.add(b.id);
        const k = this.players.get(b.killer);
        this.send(p, { t: 'hint', text: k ? `Pista: a cor de quem matou é ${colorTone(k.look.c)}.` : 'Nenhuma pista: não há assassino identificável.' }); break;
      }
      case 'remoteFix':
        if ((J !== 'engenheiro' && J !== 'hacker') || !play || !p.alive || !this.sab || p.cd.remoteFix > 0) return;
        if (J === 'hacker' && this.sab.k !== 'comms') return bad('O Hacker só repara a sabotagem de comunicação.');
        this.sab = null; this.sabCd = SAB_CD; p.cd.remoteFix = J === 'hacker' ? S.hak_cd : S.eng_fix; this.all({ t: 'sabEnd' }); break;
      case 'panel': {
        if ((J !== 'cientista' && J !== 'mentalista') || ph === 'lobby' || ph === 'end' || !(p.uses.panel > 0)) return;
        p.uses.panel--; this.send(p, { t: 'panel', list: this.list.filter(q => !q.gone).map(q => [q.id, q.alive ? 1 : 0]) }); break;
      }
      case 'locate': {
        if ((J !== 'localizador' && J !== 'mentalista') || !play || !p.alive || p.cd.locate > 0) return;
        const t = tgt(); if (!t) return bad('Alvo inválido.'); p.track = t.id; p.act.locate = S.loc_dur; p.cd.locate = S.loc_cd; break;
      }
      case 'skill': {
        if (!KILL_JOBS.includes(J) || !play || !p.alive || p.cd.skill > 0 || p.vent >= 0 || p.poss) return;
        const v = this.nearestVictim(p, () => true); if (!v) return;
        p.cd.skill = J === 'policial' ? S.pol_cd : S.xer_cd;
        if (!this.slay(v, p)) return bad('O alvo estava protegido!');
        if (v.team === 'inn') this.slay(p, null, { force: true }); // matou um inocente: o atirador morre junto
        else { p.x = v.x; p.y = v.y; }
        this.checkWin(); break;
      }
      case 'jobpanel': {
        if (J !== 'mentalista' || !p.revealed || (ph !== 'meet' && ph !== 'vote')) return;
        this.send(p, { t: 'jobpanel', list: this.list.filter(q => !q.gone).map(q => [q.id, this.pubJob(q.job), q.alive ? 1 : 0]) }); break;
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
      case 'zoom': {
        if ((J !== 'redjohn' && J !== 'policial') || !play || !p.alive) return;
        if (p.act.zoom > 0) { delete p.act.zoom; p.cd.zoom = S.zoom_cd; return; } if (p.cd.zoom > 0) return; p.act.zoom = S.zoom_dur; break;
      }
      case 'rjinv': {
        if (J !== 'redjohn' || !play || !p.alive || p.vent >= 0 || p.cd.rjinv > 0) return;
        if (!(p.uses.rj > 0)) return bad('Sem investigações nesta rodada.');
        const t = this.nearestVictim(p, () => true); if (!t) return bad('Aproxime-se de alguém para investigar.');
        p.uses.rj--; p.cd.rjinv = S.rj_cd; this.send(p, { t: 'reveal', list: [[t.id, this.pubJob(t.job)]] }); break;
      }
      case 'phase':
        if (J !== 'ghostinc' || !play || !p.alive || p.vent >= 0 || p.act.phase > 0 || p.cd.phase > 0) return; p.act.phase = S.gh_dur; break;
      case 'rewind':
        if (J !== 'timelord' || !play || !p.alive || p.cd.rewind > 0) return; if (!(p.uses.tl > 0)) return bad('Você não tem mais retrocessos.'); this.rewind(p); break;
      case 'lawsave': {
        if (J !== 'advogado' || !p.alive || ph !== 'vote' || p.voted) return;
        if (p.bank >= S.law_max) return bad(`Limite de ${S.law_max} votos guardados.`);
        p.bank++; p.voted = true; p.vote = 'save'; this.send(p, { t: 'bank', n: p.bank, saved: true }); this.all({ t: 'voted', id: p.id });
        if (this.alive().every(q => q.voted || (!q.ws && !q.bot))) this.finishVote(); break;
      }
      case 'freeze': {
        if (J !== 'congelador' || !play || !p.alive) return; const id = String(m.room || '');
        if (!FREEZABLE.has(id) || this.frozen.has(id)) return bad('Essa área não pode ser congelada.');
        const i = p.frzSel.indexOf(id); if (i >= 0) { p.frzSel.splice(i, 1); p.cd.freeze = 0; return bad('Seleção removida.'); }
        if (p.cd.freeze > 0) return bad(`Aguarde ${Math.ceil(p.cd.freeze)}s para congelar outra área.`);
        if (p.frzSel.length >= S.frz_n) return bad(`Máximo de ${S.frz_n} áreas por rodada.`);
        p.frzSel.push(id); p.cd.freeze = S.frz_cd; this.send(p, { t: 'hint', text: `${ROOM_BY[id].name} selecionada. O congelamento acontece após a votação.` }); break;
      }
      case 'fuel': {
        if (J !== 'parinomo' || !play || !p.alive || p.vent >= 0 || p.cd.fuel > 0) return;
        const t = this.nearestVictim(p, () => true); if (!t) return bad('Aproxime-se de alguém.'); if (t.fuel) return bad('Esse jogador já foi abastecido.');
        t.fuel = true; p.cd.fuel = S.pa_cd; const [a, n] = this.paProgress(p); this.send(p, { t: 'hint', text: `Abastecidos: ${a}/${n}.` }); break;
      }
      case 'lighter': {
        if (!play || !p.alive || !this.lighter || p.vent >= 0 || dist(p, this.lighter) > LIGHTER_R) return;
        if (J === 'parinomo') { p.hasLighter = true; this.lighter = null; this.send(p, { t: 'hint', text: 'Você pegou o isqueiro! Use INCENDIAR.' }); }
        else { this.send(p, { t: 'hint', text: 'Um isqueiro suspeito… ele escorrega das suas mãos e some.' }); this.spawnLighter(); }
        break;
      }
      case 'ignite':
        if (J !== 'parinomo' || !play || !p.alive || !p.hasLighter) return; this.end('parinomo', `${p.name} (Parinomo) incendiou a nave e venceu sozinho!`, p.id); break;
      case 'infect': {
        if (J !== 'virus' || !play || !p.alive || p.vent >= 0 || p.cd.infect > 0) return;
        const t = this.nearestVictim(p, () => true); if (!t) return bad('Aproxime-se de alguém.'); if (t.inf) return bad('Esse jogador já está infectado.');
        t.inf = true; p.cd.infect = S.vir_cd; const [a, n] = this.viProgress(p); this.send(p, { t: 'hint', text: `Infectados: ${a}/${n}.` }); break;
      }
      case 'explode': {
        if (J !== 'virus' || !play || !p.alive) return; const el = this.eligible(p), [a, n] = this.viProgress(p);
        if (!n || a < n) return bad(`Ainda faltam infectar ${n - a} jogador(es).`);
        for (const q of el) this.slay(q, null, { body: false, force: true });
        this.end('virus', `${p.name} (Vírus) infectou todo mundo e explodiu a nave!`, p.id); break;
      }
      case 'phclick': {
        if (!play || !p.alive) return; const ph2 = this.players.get(+m.to);
        if (!ph2 || !this.phVisible(ph2) || Math.hypot(p.x - ph2.x, p.y - ph2.y) > PH_R) return;
        ph2.phLost = true; ph2.ghostJob = null; ph2.phTasks = []; this.send(ph2, { t: 'tasks', list: ph2.tasks }); /* volta às tarefas de inocente */ this.ghostN.phantom = Math.max(0, (this.ghostN.phantom || 1) - 1);
        this.send(ph2, { t: 'phlost' }); this.send(p, { t: 'hint', text: 'Você descobriu o Phantom! Ele perdeu a profissão.' }); break;
      }
      case 'bag': {
        if (J !== 'dexter' || !play || !p.alive || p.vent >= 0 || p.carry != null || p.cd.bag > 0) return;
        const b = this.bodies.find(q => !q.bag && q.carry == null && dist(p, q) <= REPORT_R); if (!b) return bad('Chegue perto de um corpo.');
        b.bag = true; b.carry = p.id; b.hideT = S.dex_hide; p.carry = b.id; p.carryT = S.dex_carry; p.cd.bag = S.dex_cd; b.x = p.x; b.y = p.y; break;
      }
      case 'drop': if (J !== 'dexter' || !play || p.carry == null) return; this.drop(p); break;
      case 'mcarry': { // Médico pega o corpo mais próximo (um corpo só pode ter um carregador)
        if (J !== 'medico' || !play || !p.alive || p.vent >= 0 || p.carry != null) return;
        let b = null, bd = REPORT_R; for (const q of this.bodies) if (!q.bag && q.carry == null && dist(p, q) <= bd) { b = q; bd = dist(p, q); }
        if (!b) return bad('Chegue perto de um corpo.');
        b.carry = p.id; b.med = true; p.carry = b.id; p.carryT = S.med_carry; b.x = p.x; b.y = p.y; break;
      }
      case 'mdrop': if (J !== 'medico' || !play || p.carry == null) return; this.drop(p); break;
      case 'revive': if (J !== 'medico' || !play || !p.alive || p.vent >= 0) return; this.medRevive(p, bad); break;
      case 'lovfind': {
        if (J !== 'lovers' || !p.alive || ph === 'lobby' || ph === 'end') return; const pr = this.pair;
        if (!pr || !pr.unlocked) return bad('Ainda bloqueado: os dois Lovers precisam concluir as tarefas.');
        if (pr.used) { this.send(p, { t: 'lovfound', id: pr.target }); return; } // só um impostor por par: repete o mesmo resultado
        const imps = this.list.filter(q => q.alive && !q.gone && q.team === 'imp'); // estado ATUAL: nunca um impostor morto
        if (!imps.length) return bad('Não há nenhum impostor vivo para revelar.');
        const t = imps[rnd(imps.length)]; pr.used = true; pr.target = t.id;
        for (const id of [pr.a, pr.b]) { const l = this.players.get(id); if (l) this.send(l, { t: 'lovfound', id: t.id }); } break;
      }
      // ---- v2.0 ----
      case 'inq': { // Inquisidor: adivinha a profissão de um jogador vivo durante a reunião/votação
        if (J !== 'inquisidor' || !p.alive || (ph !== 'meet' && ph !== 'vote')) return;
        if (!(p.uses.inq > 0)) return bad('Você não tem mais tentativas nesta reunião.');
        const t = tgt(), jb = JOB[String(m.job || '')];
        if (!t || !jb || t.vent >= 0) return bad('Alvo inválido: a ação foi cancelada.'); // alvo deixou de ser válido: nada acontece
        p.uses.inq--;
        const ok = t.job === jb.id;
        console.log(`[inquisidor] ${this.code} ${p.name} apostou que ${t.name} é ${jb.name}: ${ok ? 'ACERTOU' : 'ERROU'} (real: ${t.job})`);
        this.all({ t: 'inqfx', k: ok ? 'hit' : 'miss', a: p.id, v: t.id });
        if (ok) { this.slay(t, null, { body: false, force: true, by: p, cause: 'inq' }); this.all({ t: 'mdead', id: t.id }); }
        else { this.slay(p, null, { body: false, force: true, cause: 'inqmiss' }); this.all({ t: 'mdead', id: p.id }); }
        if (this.checkWin()) return;
        this.maybeFinishVote(); break;
      }
      case 'trap': { // Sabotador: bomba escondida na estação de tarefa mais próxima
        if (J !== 'sabotador' || !play || !p.alive || p.vent >= 0 || p.poss || p.cd.trap > 0) return;
        let st = null, bd = TASK_R; for (const q of STATIONS) { const d = dist(p, q); if (d <= bd && (m.id == null || m.id === q.id)) { st = q; bd = d; } }
        if (!st) return bad('Aproxime-se de uma estação de tarefa para armar a bomba.');
        if (this.traps.has(st.id)) return bad('Esta tarefa já está armadilhada.');
        if ([...this.traps.values()].filter(q => q.by === p.id).length >= S.trap_max) return bad(`Limite de ${S.trap_max} bomba(s) ativa(s).`);
        if ([...this.frozen].some(id => ROOM_BY[id].name === st.room)) return bad('Tarefa indisponível (área congelada).');
        const open = this.list.some(q => q !== p && q.alive && !q.gone && (S.bomb_ff || (q.team !== 'imp' && !q.allyImp)) && this.activeTasks(q).some(k => k.id === st.id && !k.done));
        if (!open) return bad('Tarefa indisponível: ninguém precisa dela agora.');
        this.traps.set(st.id, { by: p.id, x: st.x, y: st.y }); p.cd.trap = S.trap_cd; this.send(p, { t: 'hint', text: `Bomba instalada em: ${st.name} (${st.room}).` }); break;
      }
      case 'poss': { // Chuck: possui um jogador próximo e controla o personagem dele
        if (J !== 'chuck' || !play || !p.alive || p.vent >= 0 || p.poss || p.cd.poss > 0) return;
        const t = m.to != null ? tgt() : this.nearestVictim(p, q => q.team !== 'imp' && !q.allyImp);
        if (!t || t.team === 'imp' || t.allyImp || t.vent >= 0 || t.possBy != null || t.poss || dist(p, t) > POSS_R) return bad('Alvo inválido ou longe demais para possuir.');
        p.poss = { id: t.id, t: S.chk_dur }; t.possBy = p.id; p.ix = p.iy = 0; t.ix = t.iy = 0; p.moving = false;
        if (t.watch) { t.watch = false; this.send(t, { t: 'camOff' }); } if (t.carry != null) this.drop(t); t.probe = null;
        this.send(p, { t: 'possOn', id: t.id, dur: S.chk_dur }); this.send(t, { t: 'possd' });
        console.log(`[possessão] ${this.code} ${p.name} (Chuck) possuiu ${t.name} (${t.job}) por ${S.chk_dur}s`); break;
      }
      case 'bomb': { // Bombardeiro: lança uma bomba (em posição válida, sem atravessar paredes)
        if (J !== 'bombardeiro' || !play || !p.alive || p.vent >= 0 || p.cd.bomb > 0) return;
        if (this.bombs.filter(b => b.by === p.id).length >= S.bmb_max) return bad(`Limite de ${S.bmb_max} bomba(s) ativa(s).`);
        let tx = p.x, ty = p.y; const ax = +m.x, ay = +m.y;
        if (Number.isFinite(ax) && Number.isFinite(ay)) { const d = Math.hypot(ax - p.x, ay - p.y) || 1, k = Math.min(1, THROW_R / d), cx = p.x + (ax - p.x) * k, cy = p.y + (ay - p.y) * k; if (canStand(cx, cy, 12) && !this.frozenHit(cx, cy) && this.clear(p.x, p.y, cx, cy)) { tx = cx; ty = cy; } }
        if (!canStand(tx, ty, 12) || this.frozenHit(tx, ty)) return bad('Posição inválida para a bomba.');
        this.bombs.push({ id: this.bombSeq++, x: tx, y: ty, t: S.bmb_fuse, by: p.id }); p.cd.bomb = S.bmb_cd;
        this.all({ t: 'bombOn', x: tx | 0, y: ty | 0 }, q => !q.alive || dist(q, { x: tx, y: ty }) <= this.visR(q) * 1.3); break;
      }
      case 'shuriken': { // Ninja: ataque à distância (colide com paredes; respeita escudos/armaduras)
        if (J !== 'ninja' || !play || !p.alive || p.vent >= 0 || p.cd.shuriken > 0) return;
        const ang = +m.ang; if (!Number.isFinite(ang)) return;
        p.cd.shuriken = S.nin_scd; this.shuriken(p, ang); break;
      }
      case 'clean': { // Faxineiro: limpa um corpo próximo (precisa ficar perto até terminar)
        if (J !== 'faxineiro' || !play || !p.alive || p.vent >= 0 || p.clean || p.cd.clean > 0) return;
        let b = null, bd = REPORT_R; for (const q of this.bodies) if (!q.bag && q.carry == null && dist(p, q) <= bd) { b = q; bd = dist(p, q); }
        if (!b) return bad('Chegue perto de um corpo para limpar.');
        p.clean = { id: b.id, t: S.fax_time }; p.ix = p.iy = 0; break;
      }
      case 'swap': { // Trocador: troca de profissão com um jogador próximo
        if (J !== 'trocador' || !play || !p.alive || p.vent >= 0 || p.poss) return;
        if (p.cd.swap > 0) return bad(`Aguarde ${Math.ceil(p.cd.swap)}s para trocar de novo.`);
        if (!(p.uses.swp > 0)) return bad('Você não tem mais trocas.');
        const t = m.to != null ? tgt() : this.nearestVictim(p, () => true);
        if (!t || t.vent >= 0 || t.possBy != null || t.poss || dist(p, t) > SWAP_R) return bad('Aproxime-se de um jogador vivo para trocar.');
        if (t.job === 'lovers' || t.job === 'trocador' || p.job === 'lovers') return bad('Esse jogador não pode trocar de profissão.');
        this.performSwap(p, t); break;
      }
      case 'protect': { // Segurança (modo "escolhe"): define o protegido uma única vez
        if (J !== 'seguranca' || !p.alive || p.prot != null || ph === 'lobby' || ph === 'end') return;
        const t = tgt(); if (!t) return bad('Escolha um jogador vivo.'); this.setProt(p, t.id, true); break;
      }
      case 'sage': if (J !== 'sabio' || !p.alive || ph === 'lobby' || ph === 'end') return; this.pushSage(p); break;
      case 'jpinfo': if (J !== 'jackpot' || !p.alive || !p.jpAb) return; this.send(p, { t: 'jproll', ab: p.jpAb, round: p.jpRound, again: 1 }); break;
      case 'invis':
        if (J !== 'espectro' || !play || !p.alive) return;
        if (p.act.invis > 0) { delete p.act.invis; p.cd.invis = S.esp_cd; } else if (!(p.cd.invis > 0)) p.act.invis = S.esp_dur; break;
    }
  }

  // ================= v2.0: novas profissões =================
  spdMul(p) { return !p.alive ? 1 : p.job === 'ninja' ? this.settings.nin_speed : p.job === 'jackpot' && p.jpAb === 'speed' ? SPEED_JP : 1; }
  canKillJob(p) { return p.job === 'jackpot' && p.jpAb === 'kill'; } // Jackpot com a habilidade Assassino
  killCdOf(p) { const S = this.settings; return p.job === 'samurai' ? S.sam_killcd : p.job === 'ninja' ? S.nin_killcd : S.killCd; }
  clear(ax, ay, bx, by) { // há linha livre (sem paredes nem áreas congeladas) entre dois pontos?
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 10));
    for (let i = 1; i <= n; i++) { const t = i / n, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; if (!canStand(x, y, 3) || this.frozenHit(x, y)) return false; }
    return true;
  }
  setupV2(ps) {
    for (const q of ps) {
      if (q.job === 'seguranca') { q.protDl = this.clockT + SEG_PICK; if (this.settings.seg_mode === 1) q.prot = null; else this.setProt(q, this.pickProt(q), false); }
      if (q.job === 'jackpot') this.jpRoll(q);
    }
  }
  // ---- Segurança ----
  pickProt(q) { const pool = this.list.filter(o => o !== q && o.alive && !o.gone); return pool.length ? pool[rnd(pool.length)].id : null; }
  setProt(q, id, live) {
    const t = this.players.get(id); if (!t || q.prot != null) return;
    q.prot = id; q.allyImp = t.team === 'imp';
    if (live) this.send(q, { t: 'prot', id, ally: q.allyImp ? 1 : 0 });
    if (q.allyImp && live) for (const m of this.list) if (m.team === 'imp') this.send(m, { t: 'ally', id: q.id, job: 'seguranca' }); // aviso privado aos impostores
    console.log(`[segurança] ${this.code} ${q.name} protege ${t.name} (${t.team})${q.allyImp ? ' — aliado dos impostores' : ''}`);
  }
  // ---- Jackpot ----
  jpRoll(q) {
    const S = this.settings, opts = [['kill', S.jp_w_kill], ['speed', S.jp_w_speed], ['shield', S.jp_w_shield]], sum0 = opts.reduce((a, o) => a + o[1], 0);
    const w = sum0 > 0 ? opts : opts.map(o => [o[0], 1]), sum = sum0 > 0 ? sum0 : 3; // sem probabilidades: chances iguais
    let r = Math.random() * sum, pick = null; for (const [k, v] of w) { if (v <= 0) continue; pick = k; r -= v; if (r < 0) break; } // peso 0 nunca é sorteado
    q.jpAb = pick; q.jpRound = this.round; if (q.jpSh) { q.shieldT = 0; q.jpSh = false; } delete q.cd.jpsh;
    if (pick === 'shield') { q.shieldT = S.anj_dur; q.jpSh = true; q.cd.jpsh = S.anj_dur + S.anj_cd; }
    this.send(q, { t: 'jproll', ab: pick, round: this.round, w: w.map(o => o[1]) });
    console.log(`[jackpot] ${this.code} rodada ${this.round}: ${q.name} sorteou ${pick}`);
  }
  newRound() { this.round++; for (const q of this.list) { q.clean = null; if (q.alive && !q.gone && q.job === 'jackpot') this.jpRoll(q); } }
  // ---- Chuck ----
  possTick(dt) {
    for (const c of this.list) {
      if (!c.poss) continue; const v = this.players.get(c.poss.id);
      if (!c.alive || c.gone || !v || !v.alive || v.gone || v.vent >= 0) { this.endPoss(c, 'inválida'); continue; }
      if ((c.poss.t -= dt) <= 0) { this.endPoss(c, 'tempo'); continue; }
      if (!c.bot && c.inAt && Date.now() - c.inAt > 700) c.ix = c.iy = 0; // Chuck sem notícias do cliente: o alvo para
      v.ix = c.ix; v.iy = c.iy; v.inAt = Date.now(); // o controle do alvo é de Chuck; o input do próprio alvo é descartado em handle()
    }
  }
  endPoss(c, why) {
    if (!c.poss) return; const v = this.players.get(c.poss.id); c.poss = null; c.ix = c.iy = 0; c.cd.poss = this.settings.chk_cd;
    if (v) { v.possBy = null; v.ix = v.iy = 0; this.send(v, { t: 'possEnd' }); }
    this.send(c, { t: 'possEnd' }); console.log(`[possessão] ${this.code} terminou (${why})`);
  }
  endAllPoss(why) { for (const c of this.list) if (c.poss) this.endPoss(c, why); for (const v of this.list) v.possBy = null; }
  // ---- explosões e armadilhas ----
  explode(x, y, r, owner, cause, must = null) {
    const S = this.settings, hit = [];
    for (const q of this.list) {
      if (q === owner || !q.alive || q.gone || q.vent >= 0) continue;
      if (q !== must && !S.bomb_ff && (q.team === 'imp' || q.allyImp)) continue; // aliados impostores só morrem se o host permitir
      if (q === must || (Math.hypot(q.x - x, q.y - y) <= r && this.clear(x, y, q.x, q.y))) hit.push(q); // paredes bloqueiam a explosão
    }
    this.all({ t: 'boom', x: x | 0, y: y | 0, r, k: cause }, q => !q.alive || Math.hypot(q.x - x, q.y - y) <= this.visR(q) * 1.4 + r);
    for (const q of hit) this.slay(q, owner, { cause, scene: false });
    console.log(`[explosão] ${this.code} ${cause} raio ${r}: ${hit.map(q => q.name).join(', ') || 'ninguém'}`);
    if (hit.length) this.checkWin(); return hit.length;
  }
  trapHit(p, s) { // alguém abriu a tarefa: se estiver armadilhada, explode (a bomba some e não explode de novo)
    const tr = this.traps.get(s.id); if (!tr || tr.by === p.id) return false;
    if (!this.settings.bomb_ff && (p.team === 'imp' || p.allyImp)) return false;
    this.traps.delete(s.id); const o = this.players.get(tr.by);
    this.explode(tr.x, tr.y, this.settings.trap_r, o || null, 'trap', p); return true;
  }
  shuriken(p, ang) {
    const R = this.settings.nin_range, dx = Math.cos(ang), dy = Math.sin(ang); let ex = p.x, ey = p.y, hit = null;
    for (let d = 8; d <= R && !hit; d += 8) {
      const nx = p.x + dx * d, ny = p.y + dy * d; if (!canStand(nx, ny, 3) || this.frozenHit(nx, ny)) break; // parede: a shuriken para
      ex = nx; ey = ny;
      for (const q of this.list) if (q !== p && q.alive && !q.gone && q.vent < 0 && q.team !== 'imp' && !q.allyImp && Math.hypot(q.x - nx, q.y - ny) <= SHUR_HIT) { hit = q; break; }
    }
    this.all({ t: 'shur', x0: p.x | 0, y0: p.y | 0, x1: ex | 0, y1: ey | 0, h: hit ? 1 : 0 }, q => !q.alive || dist(q, p) <= this.visR(q) * 1.3 + R * 0.3);
    if (hit && this.slay(hit, p, { cause: 'shuriken' })) this.checkWin();
    return hit;
  }
  cleanTick(p, dt) {
    const c = p.clean, b = this.bodies.find(q => q.id === c.id);
    if (!p.alive || p.gone || p.vent >= 0 || !b || b.bag || b.carry != null || dist(p, b) > REPORT_R + 40) { p.clean = null; if (p.alive) p.cd.clean = 3; this.send(p, { t: 'hint', text: 'Limpeza interrompida.' }); return; }
    if ((c.t -= dt) > 0) return;
    this.bodies = this.bodies.filter(q => q !== b); p.clean = null; p.cd.clean = this.settings.fax_cd;
    const d = this.deaths.find(x => x.id === b.id); if (d) d.cleaned = true; // o registro da morte continua
    this.all({ t: 'cleaned', id: b.id, x: b.x | 0, y: b.y | 0 }, q => !q.alive || dist(q, b) <= this.visR(q) * 1.3);
    console.log(`[limpeza] ${this.code} ${p.name} limpou o corpo de ${this.players.get(b.id)?.name}`);
  }
  // ---- Trocador ----
  initJobState(q) {
    const S = this.settings;
    q.uses = { panel: S.cie_uses, inf: S.inf_uses, tl: S.tl_uses, rj: S.rj_uses, med: S.med_uses, inq: S.inq_tries, swp: S.swp_uses };
    q.armor = q.job === 'samurai' ? S.sam_armor : 0; q.cd = KILL_JOBS.includes(q.job) ? { skill: 10 } : {}; q.act = {};
  }
  setJob(q, job) { // troca só a PROFISSÃO: equipe/role/identidade não mudam; estado da profissão antiga é descartado (sem duplicar habilidades)
    const old = q.job, S = this.settings;
    if (q.carry != null) this.drop(q);
    if (old === 'jackpot') { if (q.jpSh) q.shieldT = 0; q.jpSh = false; q.jpAb = null; }
    if (old === 'seguranca') { q.prot = null; q.allyImp = false; }
    if (old === 'execution') q.target = null;
    if (old === 'chuck' && q.poss) this.endPoss(q, 'troca');
    Object.assign(q, { job, probe: null, track: null, morph: null, watch: false, hasLighter: false, frzSel: [], sageOn: false, revealed: false, supGiven: false, supLeft: 0, clean: null });
    this.initJobState(q);
    if (q.vent >= 0 && !this.canVent(q)) q.vent = -1;
    if (job === 'execution') q.target = shuffle(this.list.filter(o => o !== q && !o.gone && o.job !== 'joker'))[0]?.id ?? null;
    if (job === 'jackpot') this.jpRoll(q);
    if (job === 'seguranca') { q.protDl = this.clockT + SEG_PICK; if (S.seg_mode === 1) q.prot = null; else this.setProt(q, this.pickProt(q), true); }
    if ((job === 'juiz' || job === 'mentalista') && q.tasks.some(k => k.done)) { q.supGiven = true; q.supLeft = S.jui_uses; this.send(q, { t: 'sup', left: q.supLeft, fresh: true }); }
    if (job === 'mentalista' && q.tasks.length && q.tasks.every(k => k.done)) { q.revealed = true; this.send(q, { t: 'unlock' }); }
    if (job === 'sabio' && q.tasks.length && q.tasks.every(k => k.done || this.taskFrozen(k))) { q.sageOn = true; this.send(q, { t: 'sageon' }); }
    this.sageDirty = true;
    this.send(q, { t: 'jobchg', job, target: q.target ?? null, sup: q.supLeft, jp: q.revealed ? 1 : 0 });
  }
  performSwap(p, t) {
    const a = p.job, b = t.job, impTarget = t.team === 'imp';
    this.setJob(p, b); this.setJob(t, a); // as duas trocas acontecem juntas, sem passar pelo meio (nenhum evento é processado entre elas)
    p.swapped = true; t.cd.swap = this.settings.swp_cd;
    for (const q of [p, t]) if (q.team === 'imp') for (const m of this.list) if (m.team === 'imp' && m !== q) this.send(m, { t: 'matejob', id: q.id, job: q.job }); // aliados impostores atualizam o que sabem
    console.log(`[troca] ${this.code} ${p.name} (${a} → ${b}) ⇄ ${t.name} (${b} → ${a})`);
    if (impTarget) this.slay(p, null, { force: true, cause: 'swap' }); // a troca acontece primeiro; depois o Trocador morre
    this.checkWin();
  }
  // ---- Sábio ----
  sageList(q) {
    const seen = new Map();
    for (const x of this.list) { const j = this.pubJob(x.job); if (!seen.has(j)) seen.set(j, false); if (x.alive && !x.gone) seen.set(j, true); }
    const arr = [...seen].sort((a, b) => JOB[a[0]].name.localeCompare(JOB[b[0]].name, 'pt'));
    return q.sageOn ? arr.map(([j, al]) => [j, al ? 1 : 0]) : arr.map(([j]) => [j]); // antes das tarefas: só quais profissões existem
  }
  pushSage(q) { this.send(q, { t: 'sage', unl: q.sageOn ? 1 : 0, list: this.sageList(q) }); }
  sageFlush() { this.sageDirty = false; for (const q of this.list) if (q.alive && !q.gone && q.job === 'sabio' && (q.ws || q.bot)) this.pushSage(q); }
  // ---- hooks gerais ----
  maybeFinishVote() { if (this.phase === 'vote' && this.alive().every(q => q.voted || (!q.ws && !q.bot))) this.finishVote(); }
  afterDeath(v, who, cause) { // consequências de QUALQUER morte (uma única vez por jogador: slay só roda para quem está vivo)
    this.sageDirty = true;
    if (v.poss) this.endPoss(v, 'Chuck morreu');
    for (const c of this.list) if (c.poss && c.poss.id === v.id) this.endPoss(c, 'alvo morreu');
    v.clean = null; v.possBy = null;
    this.deaths.push({ id: v.id, name: v.name, job: v.job, team: v.team, by: who?.id ?? null, byJob: who?.job ?? null, cause: cause || 'normal', t: Math.round(this.clockT), cleaned: false });
    for (const q of this.list) if (q !== v && q.alive && !q.gone && q.job === 'seguranca' && q.prot === v.id) { // Segurança morre junto com o protegido, sem exceção de causa
      console.log(`[segurança] ${this.code} ${q.name} morreu porque o protegido ${v.name} morreu (${cause || 'normal'})`);
      this.slay(q, null, { force: true, link: true, cause: 'guard' }); this.send(q, { t: 'hint', text: 'Seu protegido morreu e você morreu junto.' });
    }
  }
  onGone(p) { this.afterDeath(p, null, 'saiu'); }
  v2Tick(dt) {
    const S = this.settings;
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i], o = this.players.get(b.by);
      if (!o || !o.alive || o.gone) { this.bombs.splice(i, 1); continue; } // invalidada: o dono morreu
      if ((b.t -= dt) <= 0) { this.bombs.splice(i, 1); this.explode(b.x, b.y, S.bmb_r, o, 'bomb'); if (this.phase !== 'play') return; }
    }
    for (const p of this.list) {
      if (p.clean) this.cleanTick(p, dt);
      if (p.alive && p.job === 'jackpot' && p.jpAb === 'shield' && p.cd.jpsh === undefined) { p.shieldT = S.anj_dur; p.jpSh = true; p.cd.jpsh = S.anj_dur + S.anj_cd; this.send(p, { t: 'shield', dur: S.anj_dur }); } // renovação sem novo sorteio
      if (p.alive && p.job === 'seguranca' && p.prot == null && this.clockT >= p.protDl) this.setProt(p, this.pickProt(p), true); // prazo da escolha esgotado: sorteia
    }
  }
  coWinners(winner) { // jogadores com vitória individual junto da equipe vencedora (só em vitórias de Inocentes/Impostores)
    if (winner !== 'crew' && winner !== 'imp') return [];
    const out = [];
    for (const q of this.list) {
      if (!q.alive || q.gone) continue;
      if (q.job === 'jackpot') out.push(q.id);
      else if (q.job === 'seguranca' && (q.allyImp ? winner === 'imp' : true)) out.push(q.id);
      else if (q.job0 === 'trocador' && q.swapped && q.team !== 'imp') { const tm = JOB[q.job]?.team; if ((tm === 'inn' && winner === 'crew') || (tm === 'imp' && winner === 'imp')) out.push(q.id); }
    }
    return out;
  }

  // v1.5 Médico: ressuscita na Enfermaria, com corpo válido. Servidor valida tudo; mesma profissão/equipe; no máximo uma vez por jogador.
  medRevive(p, bad) {
    const S = this.settings;
    if (p.cd.revive > 0) return bad(`Aguarde ${Math.ceil(p.cd.revive)}s para ressuscitar de novo.`);
    if (!(p.uses.med > 0)) return bad('Você não tem mais ressuscitações.');
    if (roomAt(p.x, p.y)?.id !== 'enfermaria' || this.frozenHit(p.x, p.y)) return bad('A ressuscitação só funciona dentro da Enfermaria.');
    let b = null, bd = REPORT_R; for (const q of this.bodies) if (!q.bag && (q.carry == null || q.carry === p.id) && dist(p, q) <= bd) { b = q; bd = dist(p, q); }
    if (!b) return bad('Fique perto de um corpo dentro da Enfermaria.');
    if (roomAt(b.x, b.y)?.id !== 'enfermaria') return bad('O corpo precisa estar dentro da Enfermaria.');
    const v = this.players.get(b.id);
    if (!v || v.alive || v.gone) return bad('Esse corpo não é válido.');
    if (v.medRev) return bad('Esse jogador já foi ressuscitado uma vez.');
    if (v.job === 'seguranca' && v.prot != null && !this.players.get(v.prot)?.alive) return bad('O protegido desse Segurança está morto: ele não pode voltar.');
    const group = [[v, b]];
    if (v.job === 'lovers' && v.lover != null) { // o par precisa voltar junto; se o parceiro não tem corpo válido, ninguém volta
      const o = this.players.get(v.lover);
      if (o && !o.alive) { const ob = this.bodies.find(x => x.id === o.id && !x.bag); if (!ob || o.gone || o.medRev) return bad('O parceiro dos Lovers não tem um corpo válido; a ligação impede a ressuscitação.'); group.push([o, ob]); }
    }
    for (const [q, qb] of group) {
      this.bodies = this.bodies.filter(x => x !== qb); if (p.carry === qb.id) p.carry = null;
      this.resurrect(q); q.medRev = true;
      if (q === v) { q.x = b.x; q.y = b.y; } else { q.x = p.x + 34; q.y = p.y; this.unstick(q); }
      this.send(q, { t: 'revive' });
      this.all({ t: 'rvfx', id: q.id, x: q.x | 0, y: q.y | 0 }, w => !w.alive || dist(w, q) <= this.visR(w) * 1.3);
    }
    p.uses.med--; p.cd.revive = S.med_cd;
    console.log(`[ressuscitou] ${this.code} ${p.name} (Médico) trouxe de volta ${group.map(([q]) => q.name + ' (' + q.job + ')').join(' + ')}`);
    this.checkWin();
  }

  // ---------- reuniões ----------
  meeting(by, reason, bodyId = null) {
    this.endAllPoss('meeting'); if (this.bombs.length) { this.bombs = []; this.all({ t: 'bombsOff' }); } // bombas e possessões não atravessam reuniões
    for (const p of this.list) { p.clean = null; if (p.uses) p.uses.inq = this.settings.inq_tries; }
    const bd = bodyId != null ? this.bodies.find(b => b.id === bodyId) : null;
    for (const p of this.list) { p.vote = null; p.voted = false; p.ix = p.iy = 0; p.vent = -1; p.morph = null; p.act = {}; p.track = null; p.probe = null; p.watch = false; p.voteW = 1; if (p.carry != null) p.carry = null; if (p.act.phase > 0) this.unstick(p); }
    this.hist = []; this.histMin = this.clockT;
    Object.assign(this, { phase: 'meet', timer: this.settings.discuss, sab: null, bodies: [], supreme: null, sups: new Map(), meet: { by: by.id, reason, body: bodyId } });
    this.all({ t: 'meeting', by: by.id, reason, body: bodyId, bpos: bd ? [bd.x | 0, bd.y | 0] : null, time: this.settings.discuss, alive: this.alive().map(p => p.id), dead: this.list.filter(p => !p.alive || p.gone).map(p => p.id), off: this.list.filter(p => !p.bot && !p.ws && !p.gone).map(p => p.id), gone: this.list.filter(p => p.gone).map(p => p.id) });
    for (const p of this.list) { if (p.supLeft > 0 && p.alive) this.send(p, { t: 'sup', left: p.supLeft }); if (p.job === 'advogado' && p.alive) this.send(p, { t: 'bank', n: p.bank }); if (p.job === 'inquisidor' && p.alive) this.send(p, { t: 'inq', left: p.uses.inq }); }
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
    for (const p of this.alive()) { if (p.vote === 'save') continue; const w = p.voteW || 1; const tv = typeof p.vote === 'number' ? this.players.get(p.vote) : null; for (let i = 0; i < w; i++) { if (p.vote == null || p.vote === 'skip' || (typeof p.vote === 'number' && !(tv && tv.alive && !tv.gone))) skip.push(p.id); else (votes[p.vote] ||= []).push(p.id); } }
    let best = null, max = 0, tie = false;
    for (const [id, a] of Object.entries(votes)) { if (a.length > max) { max = a.length; best = +id; tie = false; } else if (a.length === max) tie = true; }
    // Voto Supremo: cada usuário (Juiz/Mentalista) ejeta o seu alvo; se dois jogadores diferentes usaram, os DOIS alvos saem
    const supT = [...new Set([...this.sups.values()])].filter(id => this.players.get(id)?.alive), sup = supT.length > 0;
    this.ejectedAll = sup ? supT : [];
    this.ejected = sup ? supT[0] : !tie && best != null && max > skip.length ? best : null;
    const e = this.players.get(this.ejected), wasImp = e?.team === 'imp';
    this.phase = 'result'; this.timer = RESULT_TIME;
    this.all({ t: 'result', votes, skip, ejected: this.ejected, supreme: !!sup, also: supT.slice(1), imp: this.settings.confirm && e ? wasImp : null,
      left: this.settings.confirm && e ? this.alive('imp').length - (wasImp ? 1 : 0) : null, time: RESULT_TIME });
  }
  afterResult() {
    const out = this.ejectedAll?.length ? this.ejectedAll : this.ejected != null ? [this.ejected] : [];
    for (const id of out) {
      const e = this.players.get(id); if (!e) continue;
      this.slay(e, null, { body: false, force: true });
    }
    for (const id of out) { // vitórias neutras avaliadas depois que todos os ejetados saíram
      const e = this.players.get(id); if (!e) continue;
      if (e.job === 'joker') return this.end('joker', `${e.name} (Joker) foi ejetado e venceu sozinho!`, e.id);
      const ex = this.list.find(q => q.job === 'execution' && q.alive && !q.gone && q.target === e.id);
      if (ex) return this.end('exec', `${ex.name} (Execution) conseguiu ejetar o seu alvo!`, ex.id);
    }
    this.ejectedAll = [];
    if (this.checkWin()) return;
    this.applyFreeze(); if (this.phase === 'end') return;
    for (const p of this.list) { if (p.job === 'samurai' && p.alive) p.armor = this.settings.sam_armor; if (p.job === 'redjohn') p.uses.rj = this.settings.rj_uses; } // recargas por rodada
    for (const p of this.list) { // recuperação de usos por reunião
      if (p.job === 'cientista' || p.job === 'mentalista') {
        if (p.uses.panel > 0) p.uses.panel = this.settings.cie_uses; else if (p.sciWait) { p.uses.panel = this.settings.cie_uses; p.sciWait = false; } else p.sciWait = true;
      }
      if (p.ghostJob === 'influencer') p.uses.inf = this.settings.inf_uses;
    }
    const ps = this.list.filter(p => !p.gone);
    ps.forEach((p, i) => { const a = (i / ps.length) * Math.PI * 2; p.x = SPECIAL.spawn.x + Math.cos(a) * 85; p.y = SPECIAL.spawn.y + Math.sin(a) * 60; p.killCd = Math.max(p.killCd, 12); if (p.cd.skill != null) p.cd.skill = Math.max(p.cd.skill, 12); });
    this.newRound();
    Object.assign(this, { phase: 'play', meet: null, sabCd: 15, emergCd: this.settings.emergCd, intro: 0 });
    this.all({ t: 'play' });
  }

  applyFreeze() { // o congelamento só vale depois da votação; todos já reaparecem no centro
    const cg = this.list.filter(p => p.job === 'congelador' && p.alive && !p.gone && p.frzSel.length);
    for (const p of cg) { for (const id of p.frzSel) this.frozen.add(id); const n = p.frzSel.length; p.frzSel = []; this.send(p, { t: 'hint', text: `${n} área(s) congelada(s). Total: ${this.frozen.size}/${this.settings.frz_win}.` }); }
    for (const q of this.list) if (this.phantomDone(q)) { this.end('phantom', `${q.name} (Phantom) concluiu todas as tarefas e venceu sozinho!`, q.id); return; }
    this.checkLovers();
    if (cg.length) { this.all({ t: 'frozen', list: [...this.frozen] }); if (this.frozen.size >= this.settings.frz_win) { const p = cg[0]; this.end('congelador', `${p.name} (Congelador) congelou a estação inteira!`, p.id); } }
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
    if (this.phase === 'end' || this.phase === 'lobby') return true; // fim definitivo: nada reinicia nem duplica o encerramento
    this.endAllPoss('fim'); this.bombs = [];
    const co = this.coWinners(winner);
    Object.assign(this, { phase: 'end', timer: END_TIME, sab: null });
    this.all({ t: 'end', winner, who, reason, co, roles: this.list.map(p => [p.id, p.role, p.alive ? 1 : 0, p.job]) });
    return true;
  }
  toLobby() {
    clearInterval(this.loop); this.loop = null;
    for (const p of [...this.players.values()]) { if (!p.ws || p.gone) this.players.delete(p.id); else Object.assign(p, { role: null, team: null, job: null, ghostJob: null, alive: true, tasks: [], phTasks: [], vent: -1, act: {}, cd: {}, morph: null, armor: 0, bank: 0, inf: false, fuel: false, hasLighter: false, carry: null, frzSel: [], lover: null, medRev: false, poss: null, possBy: null, clean: null, prot: null, allyImp: false, jpAb: null, jpSh: false, swapped: false, job0: null, sageOn: false }); }
    if (!this.players.has(this.hostId)) this.hostId = this.humansList()[0]?.id ?? null;
    Object.assign(this, { phase: 'lobby', bodies: [], sab: null, meet: null, frozen: new Set(), lighter: null, hist: [], pair: null, bombs: [], traps: new Map(), deaths: [], round: 0 });
    if (this.humansList().length) { this.syncBots(); this.lobby(); } else this.destroy();
  }
}
