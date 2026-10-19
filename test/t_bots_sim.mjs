// Simulação headless: partidas só com bots (+1 humano parado) com as novas profissões ativas.
process.env.MIN_PLAYERS = '2';
const { Room } = await import('../server/room.js');
import { JOBS } from '../shared/jobs.js';
let vt = 5_000_000; Date.now = () => vt;
const NEW = ['inquisidor', 'sabotador', 'chuck', 'bombardeiro', 'ninja', 'faxineiro', 'trocador', 'seguranca', 'jackpot', 'sabio'];
const errs = []; const origErr = console.error; console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 300)); };
const quiet = console.log; console.log = () => { };
const N = +process.argv[2] || 10, SECS = +process.argv[3] || 420;
const stat = { games: 0, ended: 0, abUse: {}, kills: 0, tasksDone: 0, tasksTotal: 0, stuckBots: 0, jobsSeen: new Set(), winners: {}, meetings: 0, swaps: 0, inqHit: 0, inqMiss: 0 };
for (let g = 0; g < N; g++) {
  const room = new Room('S' + g, () => { }); const ws = { readyState: 1, send() { } };
  const r = room.join(ws, 'Humano', { c: 0, h: 0, o: 0, a: 0, m: 0, s: 0 });
  Object.assign(room.settings, { bot_on: 1, bot_n: 11, bot_react: 0.5, neutrals: 2, impostors: 3, discuss: 12, vote: 10 });
  for (const j of NEW) { room.settings['w_' + j] = 100; }
  for (const j of ['tripulante']) room.settings['w_' + j] = 30;
  room.syncBots(); room.start(r.p); clearInterval(room.loop);
  const handle = room.handle.bind(room); room.handle = (p, m) => { if (m.t === 'ab' && p.bot) { const k = p.job + ':' + m.a; stat.abUse[k] = (stat.abUse[k] || 0) + 1; } return handle(p, m); };
  for (const p of room.list) stat.jobsSeen.add(p.job);
  const pos = new Map(); let lastMove = new Map(); let t = 0, prevPhase = room.phase;
  for (; t < SECS && room.phase !== 'end'; t += 0.033) {
    vt += 33; room.last = vt - 33; room.tick();
    if (room.phase === 'meet' && prevPhase !== 'meet') stat.meetings++; prevPhase = room.phase;
    if (Math.round(t * 30) % 600 === 0 && room.phase === 'play') for (const p of room.list) if (p.bot && p.alive) { const o = pos.get(p.id); if (o && Math.hypot(o.x - p.x, o.y - p.y) < 3 && !p.watch && p.vent < 0 && !p.poss && p.possBy == null && room.intro <= 0) lastMove.set(p.id, (lastMove.get(p.id) || 0) + 1); else lastMove.set(p.id, 0); pos.set(p.id, { x: p.x, y: p.y }); if (lastMove.get(p.id) >= 4) { stat.stuckBots++; lastMove.set(p.id, 0); } }
  }
  stat.games++; if (room.phase === 'end') { stat.ended++; } 
  for (const p of room.list) { for (const k of p.tasks) { stat.tasksTotal++; if (k.done) stat.tasksDone++; } }
  for (const d of room.deaths) { if (d.cause === 'inq') stat.inqHit++; if (d.cause === 'inqmiss') stat.inqMiss++; }
  room.destroy?.();
}
console.log = quiet;
console.log('partidas', stat.games, '| terminaram', stat.ended, '| reuniões', stat.meetings, '| tarefas', stat.tasksDone + '/' + stat.tasksTotal, '| bots parados (suspeita de travar):', stat.stuckBots);
console.log('profissões sorteadas:', [...stat.jobsSeen].filter(j => NEW.includes(j)).sort().join(', '));
console.log('habilidades usadas por bots:', JSON.stringify(Object.fromEntries(Object.entries(stat.abUse).filter(([k]) => NEW.some(j => k.startsWith(j + ':'))).sort())));
console.log('erros de bot/servidor:', errs.length); for (const e of [...new Set(errs)].slice(0, 8)) console.log('  ', e);
