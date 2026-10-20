process.env.MIN_PLAYERS = '2';
const { Room } = await import('../server/room.js');
import { JOB } from '../shared/jobs.js';
let vt = 9_000_000; Date.now = () => vt;
const log = console.log; console.log = () => { }; const errs = []; console.error = (...a) => errs.push(a.join(' '));
let pass = 0, fail = 0; const chk = (n, c, i = '') => { c ? pass++ : fail++; log(c ? '  ✔' : '  ✘ FALHOU:', n, c ? '' : i); };
function mk(jobs, extra = {}) {
  const room = new Room('B', () => { }); const r = room.join({ readyState: 1, send() { } }, 'Humano', { c: 0, h: 0, o: 0, a: 0, m: 0, s: 0 });
  Object.assign(room.settings, { bot_on: 1, bot_n: jobs.length - 1, bot_react: 0.3, discuss: 10, vote: 8, ...extra }); room.syncBots();
  room.assign = function (list) { for (const q of list) { const j = jobs[q.id - 1] || 'tripulante'; q.job = j; q.team = JOB[j].team; q.role = q.team === 'imp' ? 'imp' : 'crew'; q.lover = null; q.medRev = false; } this.pair = null; };
  room.start(r.p); clearInterval(room.loop); return room;
}
const adv = (room, s) => { for (let t = 0; t < s; t += 0.033) { vt += 33; room.last = vt - 33; room.tick(); } };
const byId = (room, i) => room.players.get(i);

log('\n## Bot Inquisidor com informação legítima acerta e mata');
{ const room = mk(['tripulante', 'inquisidor', 'detetive', 'tripulante', 'tripulante', 'impostor']); const iq = byId(room, 2), det = byId(room, 3);
  iq.ai.onMsg({ t: 'reveal', list: [[3, 'detetive']] }); room.meeting(byId(room, 1), 'emergency'); adv(room, 16);
  chk('bot Inquisidor matou o alvo revelado', !det.alive && iq.alive, `det=${det.alive} iq=${iq.alive}`); }
log('\n## Bot Inquisidor SEM informação não arrisca (não lê jobs do servidor)');
{ const room = mk(['tripulante', 'inquisidor', 'detetive', 'tripulante', 'tripulante', 'impostor']); const iq = byId(room, 2);
  room.meeting(byId(room, 1), 'emergency'); adv(room, 16); chk('sem pistas: ninguém morreu na reunião', iq.alive && room.list.every(p => p.alive)); }

log('\n## Bot Jackpot com Assassino caça e mata');
{ let ok = false, kill = false; for (let k = 0; k < 8 && !ok; k++) { const room = mk(['tripulante', 'jackpot', 'tripulante', 'tripulante', 'tripulante', 'tripulante', 'impostor'], { jp_w_kill: 100, jp_w_speed: 0, jp_w_shield: 0, bot_aggr: 100 }); const jp = byId(room, 2); kill = jp.jpAb === 'kill'; adv(room, 240); ok = room.deaths.some(d => d.by === jp.id); }
  chk('Jackpot sorteou Assassino', kill); chk('Jackpot (Assassino) matou alguém', ok); }

log('\n## Bot Chuck usa possessão e elimina via personagem possuído');
{ let ok = 0, tries = 0; for (let k = 0; k < 20 && !ok; k++) { tries++; const room = mk(['tripulante', 'chuck', 'tripulante', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], { bot_aggr: 100, chk_dur: 20 }); adv(room, 240); if (room.deaths.some(d => d.by === 2)) ok = 1; }
  chk('Chuck bot matou durante partida', ok === 1, 'tentativas ' + tries); }

log('\n## Bots desviam de bombas');
{ const room = mk(['tripulante', 'bombardeiro', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], { bmb_r: 200 }); const c = byId(room, 4); room.intro = 0; c.x = 1500; c.y = 950;
  room.bombs.push({ id: 99, x0: 1300, y0: 950, x: 1520, y: 950, t: 6, T: 6, by: 2 }); adv(room, 4); const d = Math.hypot(c.x - 1520, c.y - 950); chk('bot afastou-se da bomba', d > 120 || !c.alive, d.toFixed(0)); }

log('\n## Bots em partida completa não geram erros');
chk('sem exceções registradas', errs.length === 0, errs.slice(0, 3).join(' | '));
log(`\n${pass} ok, ${fail} falhas`); if (fail) process.exitCode = 1;
