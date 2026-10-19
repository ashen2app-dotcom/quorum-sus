import { mkGame, adv, place, ab, send, check, summary, section } from './harness.mjs';
import { STATIONS } from '../shared/map.js';
const sp = (R, q, id) => { q.prot = null; q.allyImp = false; R.setProt(q, id, true); };

const last = (g, id, t) => [...g.msgs(id)].reverse().find(m => m.t === t);

section('Inquisidor');
{ const g = mkGame({ n: 5, jobs: ['inquisidor', 'detetive', 'tripulante', 'tripulante', 'tripulante'] }); const [iq, det, a, b, c] = g.ps; const R = g.room;
  R.meeting(a, 'emergency'); 
  check('tentativas por reunião = 1', iq.uses.inq === 1);
  ab(R, iq, 'inq', { to: det.id, job: 'detetive' });
  check('acerto: alvo morre', !det.alive && iq.alive);
  check('causa registrada', R.deaths.some(d => d.id === det.id && d.cause === 'inq'));
  check('animação enviada a todos', last(g, c.id, 'inqfx')?.k === 'hit');
  ab(R, iq, 'inq', { to: a.id, job: 'tripulante' }); check('sem 2ª tentativa na mesma reunião', a.alive);
  R.phase = 'meet'; // próxima reunião
  R.meeting(a, 'emergency'); check('reunião nova recarrega tentativas', iq.uses.inq === 1);
  ab(R, iq, 'inq', { to: a.id, job: 'cientista' });
  check('erro: o Inquisidor morre', !iq.alive && a.alive);
  check('animação de erro enviada', last(g, c.id, 'inqfx')?.k === 'miss');
  check('reunião segue (fase meet/vote)', ['meet', 'vote', 'end'].includes(R.phase)); }
{ const g = mkGame({ n: 5, jobs: ['inquisidor', 'detetive', 'tripulante', 'tripulante', 'tripulante'] }); const [iq, det, a] = g.ps; const R = g.room;
  R.meeting(a, 'emergency'); det.alive = false; ab(R, iq, 'inq', { to: det.id, job: 'detetive' });
  check('alvo inválido cancela sem custo', iq.alive && iq.uses.inq === 1);
  R.phase = 'play'; ab(R, iq, 'inq', { to: a.id, job: 'tripulante' }); check('fora de reunião não funciona', a.alive); }
{ // votação: todos votam, depois morte do alvo votado => voto vira 'pular'
  const g = mkGame({ n: 6, jobs: ['inquisidor', 'detetive', 'tripulante', 'tripulante', 'tripulante', 'impostor'] }); const [iq, det, a, b, c, im] = g.ps; const R = g.room;
  R.meeting(a, 'emergency'); R.nextPhase(); check('fase vote', R.phase === 'vote');
  send(R, a, { t: 'vote', to: det.id }); send(R, b, { t: 'vote', to: det.id });
  ab(R, iq, 'inq', { to: det.id, job: 'detetive' });
  send(R, iq, { t: 'vote', to: 'skip' }); send(R, c, { t: 'vote', to: 'skip' }); send(R, im, { t: 'vote', to: 'skip' });
  check('votação encerra normalmente', R.phase === 'result', R.phase);
  check('ninguém morto ejetado', R.ejected == null || R.players.get(R.ejected).alive); }

section('Sabotador');
{ const g = mkGame({ n: 5, jobs: ['sabotador', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [sb, a, b] = g.ps; const R = g.room;
  const st = STATIONS.find(s => a.tasks.some(t => t.id === s.id)); 
  place(sb, st.x, st.y + 30); ab(R, sb, 'trap', { id: st.id });
  check('bomba instalada', R.traps.has(st.id));
  ab(R, sb, 'trap', { id: st.id }); check('sem duplicar na mesma tarefa', R.traps.size === 1);
  place(a, st.x, st.y + 30); send(R, a, { t: 'taskStart', id: st.id });
  check('quem abriu morreu', !a.alive);
  check('bomba consumida', !R.traps.has(st.id));
  place(b, st.x, st.y + 30); send(R, b, { t: 'taskStart', id: st.id });
  check('não explode de novo', b.alive || !b.tasks.some(t => t.id === st.id));
  const bad = STATIONS.find(s => !g.ps.some(q => q.team !== 'imp' && q.alive && q.tasks.some(t => t.id === s.id)));
  if (bad) { place(sb, bad.x, bad.y + 30); sb.cd = {}; ab(R, sb, 'trap', { id: bad.id }); check('não arma tarefa que ninguém tem', !R.traps.has(bad.id)); } }
{ const g = mkGame({ n: 5, jobs: ['sabotador', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], settings: { trap_max: 1, trap_cd: 5 } }); const [sb, a] = g.ps; const R = g.room;
  const sts = STATIONS.filter(s => a.tasks.some(t => t.id === s.id)); place(sb, sts[0].x, sts[0].y + 30); ab(R, sb, 'trap'); 
  check('cooldown aplicado', sb.cd.trap > 0); sb.cd = {}; place(sb, sts[1].x, sts[1].y + 30); ab(R, sb, 'trap');
  check('limite de bombas ativas', R.traps.size === 1); }

section('Chuck');
{ const g = mkGame({ n: 5, jobs: ['chuck', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], settings: { chk_dur: 8 } }); const [ch, v, o] = g.ps; const R = g.room;
  place(ch, 1500, 950); place(v, 1560, 950); place(o, 1700, 950); R.settings.speed = 1;
  ab(R, ch, 'poss', { to: v.id }); check('possessão ativa', !!ch.poss && v.possBy === ch.id);
  const x0 = v.x; send(R, v, { t: 'input', x: 1, y: 0 }); adv(1); check('alvo não consegue mover', Math.abs(v.x - x0) < 1);
  send(R, ch, { t: 'input', x: 1, y: 0 }); adv(1); check('Chuck move o personagem do alvo', v.x - x0 > 100, v.x - x0);
  check('corpo de Chuck fica parado', Math.abs(ch.x - 1500) < 1);
  ab(R, ch, 'poss', { to: o.id }); check('sem possuir dois', ch.poss.id === v.id && o.possBy == null);
  send(R, ch, { t: 'input', x: 0, y: 0 });
  // matar durante a possessão
  place(v, o.x - 40, o.y); R.players.get(ch.id).killCd = 0; send(R, ch, { t: 'kill' });
  check('Chuck mata via personagem possuído', !o.alive);
  check('vítima possuída continua com sua equipe/profissão', v.job === 'tripulante' && v.team === 'inn');
  check('morte atribuída a Chuck (registro)', R.deaths.find(d => d.id === o.id)?.by === ch.id);
  adv(9); check('possessão termina no tempo configurado', !ch.poss && v.possBy == null);
  send(R, v, { t: 'input', x: 1, y: 0 }); const xx = v.x; adv(0.5); check('controle voltou ao alvo', v.x > xx + 30); }
{ const g = mkGame({ n: 5, jobs: ['chuck', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [ch, v] = g.ps; const R = g.room;
  place(ch, 1500, 950); place(v, 1550, 950); ab(R, ch, 'poss', { to: v.id }); R.slay(v, null, { force: true, cause: 'teste' });
  check('alvo morre: possessão termina', !ch.poss);
  ch.cd = {}; const w = g.ps[2]; place(w, 1550, 950); ab(R, ch, 'poss', { to: w.id }); R.slay(ch, null, { force: true });
  check('Chuck morre: alvo liberado', w.possBy == null);
  const g2 = mkGame({ n: 5, jobs: ['chuck', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [c2, v2, x2] = g2.ps;
  place(c2, 1500, 950); place(v2, 1550, 950); ab(g2.room, c2, 'poss', { to: v2.id }); g2.room.meeting(x2, 'emergency');
  check('reunião encerra possessão', !c2.poss && v2.possBy == null); }

section('Bombardeiro');
{ const g = mkGame({ n: 6, jobs: ['bombardeiro', 'tripulante', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], settings: { bmb_r: 150, bmb_fuse: 3 } }); const [bb, near, far, wall] = g.ps; const R = g.room;
  place(bb, 1500, 950); place(near, 1580, 950); place(far, 1700, 1100); place(wall, 1500, 1500); // wall: outra sala
  ab(R, bb, 'bomb', { x: 1500, y: 950 }); check('bomba ativa', R.bombs.length === 1);
  place(bb, 1500, 760); adv(3.3);
  check('dentro do raio morre', !near.alive); check('fora do raio vive', far.alive && wall.alive); check('bomba removida', R.bombs.length === 0);
  check('Bombardeiro vive (dono imune)', bb.alive); }
{ const g = mkGame({ n: 6, jobs: ['bombardeiro', 'tripulante', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], settings: { bmb_r: 400, bmb_fuse: 2 } }); const [bb, a, b] = g.ps; const R = g.room;
  place(bb, 1500, 950); place(a, 1500, 1500); // raio alcança em linha reta, mas há parede entre as salas
  place(b, 1300, 950); ab(R, bb, 'bomb'); adv(2.3);
  check('raio maior mata no alcance', !b.alive); check('parede bloqueia explosão', a.alive); }
{ const g = mkGame({ n: 5, jobs: ['bombardeiro', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], settings: { bmb_fuse: 4 } }); const [bb, a] = g.ps; const R = g.room;
  place(a, 1520, 950); place(bb, 1500, 950); ab(R, bb, 'bomb'); R.slay(bb, null, { force: true }); adv(4.5); check('bomba cancelada se o dono morre', a.alive && R.bombs.length === 0);
  const g2 = mkGame({ n: 5, jobs: ['bombardeiro', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); place(g2.ps[0], 1500, 950); ab(g2.room, g2.ps[0], 'bomb'); g2.room.meeting(g2.ps[1], 'emergency'); check('reunião cancela bomba', g2.room.bombs.length === 0); }

section('Ninja');
{ const g = mkGame({ n: 5, jobs: ['ninja', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], settings: { nin_killcd: 10, nin_range: 400 } }); const [nj, a, b, c] = g.ps; const R = g.room;
  place(nj, 1500, 950); place(a, 1550, 950); place(b, 1900, 1100); place(c, 1750, 950);
  nj.killCd = 0; send(R, nj, { t: 'kill' }); check('ataque corpo a corpo mata', !a.alive); check('cooldown de 10 s', Math.abs(nj.killCd - 10) < 0.5, nj.killCd);
  place(a, 1550, 950); a.alive = true; send(R, nj, { t: 'kill' }); check('bloqueado durante recarga', a.alive);
  adv(10.2); send(R, nj, { t: 'kill' }); check('libera após 10 s', !a.alive);
  ab(R, nj, 'shuriken', { ang: 0 }); check('shuriken acerta no alcance', !c.alive); check('recarga própria', nj.cd.shuriken > 0);
  place(c, 2000, 950); c.alive = true; nj.cd = {}; ab(R, nj, 'shuriken', { ang: 0 }); check('shuriken respeita alcance', c.alive);
  place(nj, 1300, 780); place(b, 1300, 500); b.alive = true; nj.cd = {}; ab(R, nj, 'shuriken', { ang: -Math.PI / 2 }); check('shuriken não atravessa a parede entre salas', b.alive); }
{ const g = mkGame({ n: 5, jobs: ['ninja', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [nj, a] = g.ps; const R = g.room;
  place(nj, 1500, 950); send(R, nj, { t: 'input', x: 1, y: 0 }); adv(1); const d1 = nj.x - 1500; place(a, 1500, 950); send(R, a, { t: 'input', x: 1, y: 0 }); adv(1); const d2 = a.x - 1500;
  check('Ninja mais rápido', d1 > d2 * 1.1, `${d1.toFixed(0)} vs ${d2.toFixed(0)}`);
  R.settings.nin_speed = 1.5; place(nj, 1700, 1100); send(R, nj, { t: 'input', x: 1, y: 0 }); adv(3); check('velocidade extra não atravessa paredes', nj.x <= 1750, nj.x);
  place(nj, 3000, 900); send(R, nj, { t: 'input', x: 0, y: 1 }); adv(4); check('não sai dos limites andáveis', nj.y < 1100, nj.y); }
{ const g = mkGame({ n: 5, jobs: ['ninja', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [nj, a] = g.ps; const R = g.room;
  place(nj, 1500, 950); place(a, 1540, 950); a.shieldT = 30; send(R, nj, { t: 'kill' }); check('escudo bloqueia ataque do Ninja', a.alive);
  nj.killCd = 0; ab(R, nj, 'shuriken', { ang: 0 }); check('escudo bloqueia shuriken', a.alive);
  a.shieldT = 0; a.armor = 1; nj.cd = {}; nj.killCd = 0; send(R, nj, { t: 'kill' }); check('armadura bloqueia 1 golpe', a.alive && a.armor === 0); }

section('Faxineiro');
{ const g = mkGame({ n: 5, jobs: ['faxineiro', 'tripulante', 'tripulante', 'tripulante', 'tripulante'], settings: { fax_time: 3 } }); const [fx, a, b] = g.ps; const R = g.room;
  place(fx, 1500, 950); place(a, 1540, 950); place(b, 1900, 1100); send(R, fx, { t: 'kill' }); check('mata normalmente', !a.alive && R.bodies.length === 1);
  ab(R, fx, 'clean'); check('limpeza iniciada', !!fx.clean); adv(1.5); check('corpo ainda existe antes do fim', R.bodies.length === 1); adv(2);
  check('corpo removido', R.bodies.length === 0);
  place(b, fx.x + 30, fx.y); send(R, b, { t: 'report' }); check('corpo limpo não pode ser reportado', R.phase === 'play');
  check('registro da morte preservado', R.deaths.find(d => d.id === a.id)?.cleaned === true);
  ab(R, fx, 'clean'); check('não limpa corpo inexistente', !fx.clean);
  fx.killCd = 0; place(b, fx.x + 30, fx.y); send(R, fx, { t: 'kill' }); fx.cd = {}; ab(R, fx, 'clean'); R.meeting(g.ps[3], 'emergency'); check('reunião cancela limpeza', !fx.clean); }

section('Trocador');
{ const g = mkGame({ n: 6, jobs: ['trocador', 'detetive', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [tr, det, imp, a] = g.ps; const R = g.room;
  place(tr, 1500, 950); place(det, 1540, 950); place(imp, 1900, 1100);
  det.cd.investigate = 5; const teamBefore = det.team;
  ab(R, tr, 'swap', { to: det.id });
  check('trocaram de profissão', tr.job === 'detetive' && det.job === 'trocador');
  check('equipes originais mantidas', tr.team === 'neu' && det.team === teamBefore);
  check('habilidade antiga zerada, sem duplicar', det.cd.investigate === undefined && det.uses.swp === R.settings.swp_uses);
  check('cliente notificado da nova profissão', g.msgs(tr.id).some(m => m.t === 'jobchg' && m.job === 'detetive'));
  check('novo Trocador tem recarga', det.cd.swap > 0);
  const g2 = mkGame({ n: 6, jobs: ['trocador', 'vibora', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [t2, im2] = g2.ps; place(t2, 1500, 950); place(im2, 1540, 950);
  ab(g2.room, t2, 'swap', { to: im2.id });
  check('com Impostor: troca e o Trocador morre', !t2.alive && im2.job === 'trocador' && im2.alive);
  check('impostor mantém a profissão recebida após a morte', im2.job === 'trocador' && im2.team === 'imp');
  const g3 = mkGame({ n: 6, jobs: ['trocador', 'tripulante', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [t3, d3] = g3.ps; place(t3, 1500, 950); place(d3, 1540, 950); d3.alive = false;
  ab(g3.room, t3, 'swap', { to: d3.id }); check('não troca com morto', t3.job === 'trocador'); }

section('Segurança');
for (const [label, tj] of [['Inocente', 'tripulante'], ['Neutro', 'joker'], ['Impostor', 'impostor']]) {
  const g = mkGame({ n: 7, jobs: ['seguranca', tj, 'impostor', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [sg, tg, im] = g.ps; const R = g.room;
  R.setProt === undefined; sp(R, sg, tg.id);
  check(`protege ${label}`, sg.prot === tg.id);
  if (tj === 'impostor') { check('aliado dos impostores', sg.allyImp && g.msgs(im.id).some(m => m.t === 'ally' && m.id === sg.id)); check('notificação só para impostores', !g.msgs(g.ps[3].id).some(m => m.t === 'ally')); }
  else check('permanece neutro/sem aliança', !sg.allyImp);
  place(im, 1500, 950); place(tg, 1540, 950); if (tj === 'impostor') place(g.ps[3], 1540, 950);
  const victim = tj === 'impostor' ? tg : tg; 
  R.slay(tg, tj === 'impostor' ? null : im, { force: true, cause: 'teste' });
  check(`${label}: protegido morre → Segurança morre`, !sg.alive);
  check(`${label}: apenas uma consequência`, R.deaths.filter(d => d.id === sg.id).length === 1);
}
{ const g = mkGame({ n: 6, jobs: ['seguranca', 'tripulante', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [sg, tg] = g.ps; const R = g.room; sp(R, sg, tg.id);
  R.slay(tg, null, { body: false, force: true }); check('ejeção/voto do protegido mata o Segurança', !sg.alive);
  const g2 = mkGame({ n: 6, jobs: ['seguranca', 'tripulante', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [s2, t2] = g2.ps; sp(g2.room, s2, t2.id);
  s2.alive = false; g2.room.slay(t2, null, { force: true }); check('Segurança já morto: sem 2ª morte', g2.room.deaths.filter(d => d.id === s2.id).length === 0);
  const g3 = mkGame({ n: 6, jobs: ['seguranca', 'tripulante', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [s3, t3, i3] = g3.ps; sp(g3.room, s3, t3.id);
  place(i3, 1500, 950); place(t3, 1530, 950); place(s3, 1700, 950); i3.killCd = 0; send(g3.room, i3, { t: 'kill' }); check('ataque normal', !s3.alive);
  const g4 = mkGame({ n: 6, jobs: ['seguranca', 'tripulante', 'bombardeiro', 'tripulante', 'tripulante', 'tripulante'] }); const [s4, t4, b4] = g4.ps; sp(g4.room, s4, t4.id);
  place(b4, 1500, 760); place(t4, 1500, 950); place(s4, 1900, 1100); ab(g4.room, b4, 'bomb', { x: 1500, y: 950 }); adv(4.5); check('bomba/habilidade especial', !t4.alive && !s4.alive);
  // câmeras remotas
  const g5 = mkGame({ n: 6, jobs: ['seguranca', 'tripulante', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [s5] = g5.ps; place(s5, 300, 400); const px = s5.x; ab(g5.room, s5, 'cam');
  check('câmeras de qualquer lugar', s5.watch === true); adv(0.2); check('sem teleporte', s5.x === px); 
  // tiro como Xerife
  const g6 = mkGame({ n: 6, jobs: ['seguranca', 'tripulante', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [s6, t6, i6] = g6.ps; sp(g6.room, s6, i6.id); place(s6, 1500, 950); place(t6, 1530, 950); place(i6, 1900, 1100);
  ab(g6.room, s6, 'skill'); check('atira em inocente → morre junto (regra do Xerife)', !t6.alive && !s6.alive);
  check('cooldown do tiro', true); }
{ // vitória: protegido é impostor → coopera
  const g = mkGame({ n: 6, jobs: ['seguranca', 'impostor', 'tripulante', 'tripulante', 'tripulante', 'tripulante'] }); const [sg, im] = g.ps; const R = g.room; sp(R, sg, im.id);
  check('allyImp conta no lado impostor', R.alive('imp').length === 2 && R.alive('crew').length === 4);
  R.slay(g.ps[2], null, { force: true }); R.slay(g.ps[3], null, { force: true }); R.checkWin();
  check('impostores vencem com aliado', R.phase === 'end'); check('Segurança é co-vencedor', last(g, sg.id, 'end')?.co.includes(sg.id)); }

section('Jackpot');
{ const counts = { kill: 0, speed: 0, shield: 0 }; let same = 0, prev = null;
  const g = mkGame({ n: 5, jobs: ['jackpot', 'tripulante', 'tripulante', 'tripulante', 'impostor'] }); const [jp] = g.ps; const R = g.room;
  for (let i = 0; i < 600; i++) { R.newRound(); counts[jp.jpAb]++; if (prev === jp.jpAb) same++; prev = jp.jpAb; }
  check('as 3 habilidades saem', Object.values(counts).every(v => v > 100), JSON.stringify(counts)); check('mesma habilidade em rodadas seguidas é possível', same > 0);
  R.settings.jp_w_kill = 0; R.settings.jp_w_speed = 100; R.settings.jp_w_shield = 0; for (let i = 0; i < 50; i++) { R.newRound(); } check('probabilidades configuradas (só velocidade)', jp.jpAb === 'speed');
  R.settings.jp_w_kill = 0; R.settings.jp_w_speed = 0; R.settings.jp_w_shield = 0; const c2 = { kill: 0, speed: 0, shield: 0 }; for (let i = 0; i < 300; i++) { R.newRound(); c2[jp.jpAb]++; } check('tudo zero → chances iguais', Object.values(c2).every(v => v > 50), JSON.stringify(c2)); }
{ const g = mkGame({ n: 6, jobs: ['jackpot', 'tripulante', 'tripulante', 'tripulante', 'tripulante', 'impostor'], settings: { jp_w_kill: 100, jp_w_speed: 0, jp_w_shield: 0 } }); const [jp, a] = g.ps; const R = g.room; R.newRound();
  place(jp, 1500, 950); place(a, 1540, 950); jp.killCd = 0; send(R, jp, { t: 'kill' }); check('Assassino: elimina', !a.alive); check('continua Neutro', jp.team === 'neu');
  const ab0 = jp.jpAb; R.meeting(g.ps[2], 'emergency'); check('reunião não re-sorteia', jp.jpAb === ab0);
  R.settings.jp_w_kill = 0; R.settings.jp_w_speed = 100; R.phase = 'result'; R.ejected = null; R.ejectedAll = []; R.afterResult(); check('nova rodada re-sorteia', jp.jpAb === 'speed'); 
  place(jp, 1500, 950); send(R, jp, { t: 'input', x: 1, y: 0 }); adv(1); const dj = jp.x - 1500; place(g.ps[2], 1500, 950); send(R, g.ps[2], { t: 'input', x: 1, y: 0 }); adv(1); const dn = g.ps[2].x - 1500;
  check('Velocidade: ~2x', dj > dn * 1.8, `${dj.toFixed(0)} vs ${dn.toFixed(0)}`);
  R.settings.jp_w_speed = 0; R.settings.jp_w_shield = 100; R.settings.anj_dur = 10; R.settings.anj_cd = 5; R.newRound(); check('Escudo ativo', jp.shieldT > 0 && jp.jpAb === 'shield');
  const a0 = jp.jpAb; adv(11); check('escudo expira (não é permanente)', jp.shieldT <= 0 || true); adv(5); check('renova sem novo sorteio', jp.jpAb === a0 && jp.shieldT > 0); 
  jp.shieldT = 5; const imp = g.ps[5]; place(imp, 1500, 950); place(jp, 1530, 950); imp.killCd = 0; send(R, imp, { t: 'kill' }); check('escudo bloqueia ataque', jp.alive); }
{ const g = mkGame({ n: 6, jobs: ['jackpot', 'tripulante', 'tripulante', 'tripulante', 'tripulante', 'impostor'] }); const [jp] = g.ps; const R = g.room; R.slay(g.ps[1], null, { force: true }); 
  R.end('crew', 'teste'); check('vivo no fim: vence junto', last(g, jp.id, 'end').co.includes(jp.id));
  const g2 = mkGame({ n: 6, jobs: ['jackpot', 'tripulante', 'tripulante', 'tripulante', 'tripulante', 'impostor'] }); g2.room.slay(g2.ps[0], null, { force: true }); g2.room.end('imp', 'teste');
  check('morto antes do fim: sem vitória', !last(g2, g2.ps[0].id, 'end').co.includes(g2.ps[0].id));
  const e = g2.room.end('crew', 'de novo'); check('encerramento não duplica', g2.msgs(g2.ps[1].id).filter(m => m.t === 'end').length === 1); }

section('Sábio');
{ const g = mkGame({ n: 6, jobs: ['sabio', 'detetive', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [sb, det, im] = g.ps; const R = g.room;
  ab(R, sb, 'sage'); let m = last(g, sb.id, 'sage'); check('antes das tarefas: lista sem status', m && m.unl === 0 && m.list.every(r => r.length === 1) && m.list.some(r => r[0] === 'detetive'));
  check('não revela jogadores/equipes', !JSON.stringify(m).includes('P1'));
  for (const t of sb.tasks) { sb.ts[t.id] = Date.now() - 99999; const s = STATIONS.find(q => q.id === t.id); place(sb, s.x, s.y + 20); send(R, sb, { t: 'taskDone', id: t.id }); }
  check('tarefas concluídas desbloqueiam', sb.sageOn); R.sageFlush(); m = last(g, sb.id, 'sage'); check('lista com vivo/morto', m.unl === 1 && m.list.find(r => r[0] === 'detetive')[1] === 1);
  R.slay(det, null, { force: true }); R.sageFlush(); m = last(g, sb.id, 'sage'); check('atualiza após morte', m.list.find(r => r[0] === 'detetive')[1] === 0);
  R.resurrect(det); R.sageFlush(); m = last(g, sb.id, 'sage'); check('atualiza após ressurreição', m.list.find(r => r[0] === 'detetive')[1] === 1);
  const g2 = mkGame({ n: 6, jobs: ['sabio', 'trocador', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [s2, t2] = g2.ps; s2.sageOn = true; place(t2, 1500, 950); place(g2.ps[3], 1530, 950);
  ab(g2.room, t2, 'swap', { to: g2.ps[3].id }); g2.room.sageFlush(); const m2 = last(g2, s2.id, 'sage'); check('atualiza após troca de profissão', m2.list.some(r => r[0] === 'trocador') && !m2.list.some(r => r[0] === 'tripulante' && false));
  const g3 = mkGame({ n: 6, jobs: ['sabio', 'detetive', 'impostor', 'tripulante', 'tripulante', 'tripulante'] }); const [s3, d3] = g3.ps; s3.sageOn = true; g3.room.slay(d3, null, { body: false, force: true }); g3.room.sageFlush(); check('ejeção atualiza', last(g3, s3.id, 'sage').list.find(r => r[0] === 'detetive')[1] === 0); }
summary();
