import { mkGame, adv, place, ab, check, summary, section } from './harness.mjs';
section('smoke: jogo inicia com as novas profissões');
const g = mkGame({ n: 6, jobs: ['chuck', 'inquisidor', 'tripulante', 'tripulante', 'sabio', 'jackpot'] });
check('fase play', g.room.phase === 'play');
adv(2);
check('sem exceção no tick; ainda play', g.room.phase === 'play');
check('jackpot sorteou habilidade', ['kill', 'speed', 'shield'].includes(g.ps[5].jpAb), g.ps[5].jpAb);
summary();
