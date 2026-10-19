// Harness de testes sem rede/navegador: sala real, jogadores falsos, relógio virtual.
process.env.MIN_PLAYERS = process.env.MIN_PLAYERS || '2';
const { Room } = await import('../server/room.js');
let vt = 1_000_000; const realNow = Date.now; Date.now = () => vt;
export const adv = (sec, step = 0.033) => { for (let t = 0; t < sec; t += step) { vt += step * 1000; world.room.last = vt - step * 1000; world.room.tick(); } };
export const world = { room: null };
export function mkGame({ n = 6, jobs = [], settings = {}, bots = 0, seed } = {}) {
  const inbox = new Map(); const room = new Room('TEST', () => { });
  world.room = room; Object.assign(room.settings, settings);
  const ps = [];
  for (let i = 0; i < n; i++) {
    const pid = room.nextId, ws = { readyState: 1, send(m) { const o = JSON.parse(m); (inbox.get(pid) || inbox.set(pid, []).get(pid)).push(o); } };
    const r = room.join(ws, 'P' + (i + 1), { c: i, h: 0, o: 0, a: 0, m: 0, s: 0 }); ps.push(r.p);
  }
  room.assign = function (list) { // profissões escolhidas pelo teste: jogador P<n> recebe jobs[n-1]
    for (const q of list) { const job = jobs[q.id - 1] || 'tripulante'; q.job = job; q.team = JOB_TEAM(job); q.role = q.team === 'imp' ? 'imp' : 'crew'; q.lover = null; q.medRev = false; }
    this.pair = null;
  };
  room.start(ps[0]);
  clearInterval(room.loop); room.intro = 0; room.sab = null; room.sabCd = 0;
  for (const q of ps) { q.killCd = 0; q.cd = KILL_JOBS_T.includes(q.job) ? { skill: 0 } : {}; q.x = 300 + (q.id - 1) * 70; q.y = 300; }
  Date.now = () => vt;
  return { room, ps, inbox, msgs: id => inbox.get(id) || [], clear: () => inbox.clear() };
}
import { JOB } from '../shared/jobs.js';
const JOB_TEAM = j => JOB[j].team; const KILL_JOBS_T = ['xerife', 'mentalista', 'policial', 'seguranca'];
export const place = (p, x, y) => { p.x = x; p.y = y; p.ix = p.iy = 0; };
export const send = (room, p, m) => room.handle(p, m);
export const ab = (room, p, a, extra = {}) => room.handle(p, { t: 'ab', a, ...extra });
let pass = 0, fail = 0; const fails = [];
export const check = (name, cond, info = '') => { if (cond) { pass++; console.log('  ✔', name); } else { fail++; fails.push(name); console.log('  ✘ FALHOU:', name, info); } };
export const summary = () => { console.log(`\n${pass} ok, ${fail} falhas`); if (fail) { console.log('Falhas:', fails.join(' | ')); process.exitCode = 1; } };
export const section = t => console.log('\n## ' + t);
