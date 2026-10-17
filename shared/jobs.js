// Sistema de profissões: dados compartilhados (servidor aplica regras, cliente mostra nomes/cores/configurações).
export const TEAMS = {
  inn: { name: 'Inocente', color: '#4aa8ff', icon: '🔵' },
  neu: { name: 'Neutro', color: '#b583ff', icon: '🟣' },
  imp: { name: 'Impostor', color: '#ff4f6d', icon: '🔴' },
};
// w = chance relativa de aparecer (0 desliga) · m = máximo de jogadores com a profissão · ghost = só recebida depois de morrer
const j = (id, name, team, color, desc, w, m, ghost = false) => ({ id, name, team, color, desc, w, m, ghost });
export const JOBS = [
  j('tripulante', 'Tripulante', 'inn', '#4aa8ff', 'Complete todas as tarefas. Sem habilidades especiais.', 100, 15),
  j('detetive', 'Detetive', 'inn', '#4aa8ff', 'Investiga corpos: descobre se a cor do assassino é quente, fria, escura ou clara.', 50, 1),
  j('engenheiro', 'Engenheiro', 'inn', '#4aa8ff', 'Usa os dutos e conserta sabotagens de qualquer lugar do mapa.', 50, 1),
  j('cientista', 'Cientista', 'inn', '#4aa8ff', 'Abre um painel que mostra quem está vivo ou morto.', 50, 1),
  j('barulhento', 'Barulhento', 'inn', '#4aa8ff', 'Quando morre, uma seta aponta para o corpo para todos.', 50, 1),
  j('juiz', 'Juiz', 'inn', '#4aa8ff', 'Após completar uma tarefa, ganha o Voto Supremo: ejeta o escolhido.', 40, 1),
  j('localizador', 'Localizador', 'inn', '#4aa8ff', 'Rastreia a posição de outro jogador no mapa.', 50, 1),
  j('xerife', 'Xerife', 'inn', '#4aa8ff', 'Pode atirar. Se matar um inocente, morre junto.', 50, 1),
  j('mentalista', 'Mentalista', 'inn', '#111419', 'Tiro, rastreio, Voto Supremo, painel e investigação de profissões.', 15, 1),
  j('anjo', 'Anjo', 'neu', '#ffe44d', 'Fantasma: protege um jogador vivo com um escudo.', 100, 1, true),
  j('joker', 'Joker', 'neu', '#aab0bd', 'Vence se for ejetado em uma votação.', 50, 1),
  j('execution', 'Execution', 'neu', '#ff8a1f', 'Vence se o seu alvo secreto for ejetado em votação.', 50, 1),
  j('influencer', 'Influencer', 'neu', '#4fe3e8', 'Fantasma: envia dicas pré-definidas a jogadores vivos.', 100, 1, true),
  j('impostor', 'Impostor', 'imp', '#ff4f6d', 'Mata, usa os dutos e sabota.', 100, 15),
  j('vibora', 'Víbora', 'imp', '#4fd36b', 'Como o Impostor; os corpos que deixa desaparecem em segundos.', 40, 1),
  j('metamorfo', 'Metamorfo', 'imp', '#ff4f6d', 'Como o Impostor; pode assumir a aparência de qualquer jogador.', 40, 1),
  j('espectro', 'Espectro', 'imp', '#a95bff', 'Como o Impostor; pode ficar invisível.', 40, 1),
  // ---- v1.0 ----
  j('policial', 'Policial', 'inn', '#398BFF', 'Atira em suspeitos (se matar um inocente, morre junto) e amplia o mapa inteiro com o zoom.', 40, 1),
  j('hacker', 'Hacker', 'inn', '#22A447', 'Acessa as câmeras de qualquer lugar e conserta a sabotagem de comunicação remotamente.', 40, 1),
  j('ghostinc', 'Ghost Inc', 'inn', '#FFFFFF', 'Atravessa paredes por poucos segundos a cada ativação.', 40, 1),
  j('timelord', 'Time Lord', 'inn', '#398BFF', 'Retrocede o tempo 10–15 s: posições voltam e mortos recentes ressuscitam.', 30, 1),
  j('advogado', 'Advogado', 'inn', '#398BFF', 'Guarda votos nas reuniões e os gasta quando quiser (nesta partida).', 40, 1),
  j('congelador', 'Congelador', 'neu', '#7DF9FF', 'Congela áreas do mapa (aplicado após a votação). Vence ao congelar áreas suficientes.', 40, 1),
  j('parinomo', 'Parinomo', 'neu', '#FFA500', 'Abastece todos com gasolina, acha o isqueiro e incendeia a nave para vencer.', 40, 1),
  j('virus', 'Vírus', 'neu', '#22A447', 'Infecta todos os jogadores e então explode: todos morrem e ele vence.', 40, 1),
  j('phantom', 'Phantom', 'neu', '#FFFFFF', 'Fantasma: conclui as próprias tarefas para vencer sozinho. Fica visível 10 s a cada 20 s; se clicarem nele, perde a profissão.', 100, 1, true),
  j('redjohn', 'Red John', 'imp', '#FF0000', 'Impostor: deixa um rosto vermelho chorando nas vítimas, investiga profissões e amplia o mapa.', 40, 1),
  j('samurai', 'Samurai', 'imp', '#FF0000', 'Impostor: elimina mais rápido, corre um pouco mais e tem armadura que bloqueia 1 morte por rodada.', 40, 1),
  j('dexter', 'Dexter', 'imp', '#233D72', 'Impostor: guarda corpos em sacos, carrega e os esconde por alguns segundos.', 40, 1),
];
export const JOB = Object.fromEntries(JOBS.map(x => [x.id, x]));
// Parâmetros configuráveis pelo host (k, rótulo, mín, máx, passo, padrão)
const P = (k, label, min, max, step, def, grp) => ({ k, label, min, max, step, def, grp });
const PARAMS_RAW = [
  P('eng_vent', 'Engenheiro: recarga do duto (s)', 5, 60, 1, 20, 'Engenheiro'), P('eng_fix', 'Engenheiro: recarga do conserto remoto (s)', 10, 180, 5, 60, 'Engenheiro'),
  P('cie_uses', 'Cientista: usos do painel por reunião', 1, 9, 1, 3, 'Cientista'),
  P('jui_uses', 'Juiz/Mentalista: usos do Voto Supremo', 1, 3, 1, 1, 'Juiz'),
  P('loc_cd', 'Localizador: recarga (s)', 5, 90, 1, 25, 'Localizador'), P('loc_dur', 'Localizador: duração do rastreio (s)', 10, 120, 5, 40, 'Localizador'),
  P('xer_cd', 'Xerife/Mentalista: recarga do tiro (s)', 10, 90, 1, 30, 'Xerife'),
  P('men_inv', 'Mentalista: tempo parado na sondagem (s)', 2, 15, 1, 5, 'Mentalista'), P('men_cd', 'Mentalista: recarga da sondagem (s)', 5, 120, 5, 20, 'Mentalista'), P('anj_dur', 'Anjo: duração do escudo (s)', 10, 120, 5, 60, 'Anjo'), P('anj_cd', 'Anjo: espera extra após o escudo (s)', 0, 60, 5, 0, 'Anjo'),
  P('inf_uses', 'Influencer: mensagens por reunião', 1, 3, 1, 1, 'Influencer'),
  P('vib_van', 'Víbora: sumiço do corpo (s)', 2, 20, 1, 5, 'Víbora'),
  P('met_dur', 'Metamorfo: duração (s)', 5, 90, 5, 30, 'Metamorfo'), P('met_cd', 'Metamorfo: recarga (s)', 5, 90, 5, 20, 'Metamorfo'),
  P('esp_dur', 'Espectro: duração da invisibilidade (s)', 3, 30, 1, 10, 'Espectro'), P('esp_cd', 'Espectro: recarga (s)', 5, 90, 5, 25, 'Espectro'),
  P('rj_cd', 'Red John: recarga da investigação (s)', 5, 90, 1, 25, 'Red John'), P('rj_uses', 'Red John: investigações por rodada', 1, 6, 1, 2, 'Red John'),
  P('zoom_dur', 'Zoom (Red John/Policial): duração (s)', 3, 30, 1, 8, 'Policial'), P('zoom_cd', 'Zoom (Red John/Policial): recarga (s)', 5, 90, 1, 30, 'Policial'), P('pol_cd', 'Policial: recarga do tiro (s)', 10, 90, 1, 30, 'Policial'),
  P('sam_speed', 'Samurai: bônus de velocidade (x)', 1, 1.6, 0.05, 1.15, 'Samurai'), P('sam_killcd', 'Samurai: tempo entre eliminações (s)', 3, 30, 1, 10, 'Samurai'), P('sam_armor', 'Samurai: bloqueios de armadura por rodada (0 = sem armadura)', 0, 3, 1, 1, 'Samurai'),
  P('dex_hide', 'Dexter: saco invisível por (s)', 5, 60, 1, 15, 'Dexter'), P('dex_carry', 'Dexter: tempo máximo carregando (s)', 5, 90, 1, 30, 'Dexter'), P('dex_cd', 'Dexter: recarga ao ensacar (s)', 5, 90, 1, 20, 'Dexter'),
  P('hak_cd', 'Hacker: recarga do conserto remoto (s)', 10, 180, 5, 45, 'Hacker'),
  P('gh_dur', 'Ghost Inc: duração (s)', 2, 15, 1, 5, 'Ghost Inc'), P('gh_cd', 'Ghost Inc: recarga (s)', 5, 120, 5, 30, 'Ghost Inc'),
  P('tl_rew', 'Time Lord: retrocesso (s)', 10, 15, 1, 12, 'Time Lord'), P('tl_cd', 'Time Lord: recarga (s)', 20, 180, 5, 90, 'Time Lord'), P('tl_uses', 'Time Lord: usos por partida', 1, 5, 1, 2, 'Time Lord'),
  P('law_max', 'Advogado: máximo de votos acumulados', 1, 5, 1, 3, 'Advogado'),
  P('frz_n', 'Congelador: áreas por rodada', 1, 5, 1, 3, 'Congelador'), P('frz_win', 'Congelador: áreas congeladas para vencer', 1, 8, 1, 5, 'Congelador'),
  P('pa_cd', 'Parinomo: recarga do abastecimento (s)', 3, 60, 1, 10, 'Parinomo'), P('pa_resp', 'Parinomo: isqueiro reaparece a cada (s)', 15, 120, 5, 45, 'Parinomo'),
  P('vir_cd', 'Vírus: recarga da infecção (s)', 3, 60, 1, 10, 'Vírus'),
  P('ph_hid', 'Phantom: tempo oculto (s)', 5, 60, 1, 20, 'Phantom'), P('ph_vis', 'Phantom: tempo visível (s)', 3, 30, 1, 10, 'Phantom'),
];
export const PARAMS = PARAMS_RAW.filter((p, i, a) => a.findIndex(q => q.k === p.k) === i); // chaves únicas
export const DEFAULT_SETTINGS = { neutrals: 1 };
export const SETTING_LIMITS = { neutrals: [0, 4] };
for (const x of JOBS) { DEFAULT_SETTINGS['w_' + x.id] = x.w; DEFAULT_SETTINGS['m_' + x.id] = x.m; SETTING_LIMITS['w_' + x.id] = [0, 100]; SETTING_LIMITS['m_' + x.id] = [0, x.m > 4 ? 15 : 4]; }
for (const x of PARAMS) { DEFAULT_SETTINGS[x.k] = x.def; SETTING_LIMITS[x.k] = [x.min, x.max]; }
// Habilidades ativas mostradas como botões: [id, rótulo]
export const ABIL = {
  detetive: [['investigate', 'INVESTIGAR']], engenheiro: [['remoteFix', 'CONSERTAR']], cientista: [['panel', 'PAINEL']], localizador: [['locate', 'LOCALIZAR']],
  xerife: [['skill', 'ATIRAR']], mentalista: [['skill', 'ATIRAR'], ['locate', 'LOCALIZAR'], ['panel', 'PAINEL'], ['probe', 'SONDAR']],
  policial: [['skill', 'ATIRAR'], ['zoom', 'ZOOM']], hacker: [['cam', 'CÂMERAS'], ['remoteFix', 'CONSERTAR']], ghostinc: [['phase', 'ATRAVESSAR']], timelord: [['rewind', 'RETROCEDER']],
  advogado: [['lawsave', 'GUARDAR VOTO']], congelador: [['freeze', 'CONGELAR']], parinomo: [['fuel', 'ABASTECER'], ['ignite', 'INCENDIAR']], virus: [['infect', 'INFECTAR'], ['explode', 'EXPLODIR']],
  phantom: [], redjohn: [['rjinv', 'INVESTIGAR'], ['zoom', 'ZOOM']], samurai: [['armor', 'ARMADURA']], dexter: [['bag', 'ENSACAR'], ['drop', 'SOLTAR']],
  anjo: [['shield', 'ESCUDO']], influencer: [['infmsg', 'MENSAGEM']], metamorfo: [['morph', 'TRANSFORMAR']], espectro: [['invis', 'INVISIBILIDADE']],
};
export const INF_MSGS = [['tone', 'Cor de quem me matou'], ['job', 'Profissão de quem me matou'], ['where', 'Onde fui morto']];
const TONE = ['quente', 'quente', 'quente', 'fria', 'fria', 'fria', 'escura', 'escura', 'quente', 'clara', 'quente', 'escura', 'fria', 'escura', 'escura', 'clara', 'clara', 'clara', 'quente', 'clara', 'quente', 'escura', 'clara', 'clara']; // por índice de COLORS
export const colorTone = i => TONE[i] || 'neutra';

// Bots: tudo personalizável pelo host
export const BOT_PARAMS = [
  P('bot_on', 'Bots', 0, 1, 1, 0, 'Bots'), P('bot_n', 'Quantidade de bots', 0, 14, 1, 3, 'Bots'),
  P('bot_skill', 'Habilidade geral (%)', 10, 100, 5, 65, 'Comportamento'), P('bot_err', 'Chance de errar (%)', 0, 60, 5, 12, 'Comportamento'),
  P('bot_react', 'Tempo de reação (s)', 0.3, 4, 0.1, 1.2, 'Comportamento'), P('bot_wait', 'Pausas e hesitação (%)', 0, 100, 5, 40, 'Comportamento'),
  P('bot_follow', 'Tendência a andar em grupo (%)', 0, 100, 5, 35, 'Comportamento'), P('bot_task', 'Dedicação às tarefas (%)', 0, 100, 5, 75, 'Inocentes'),
  P('bot_sus', 'Sensibilidade a suspeitas (%)', 10, 100, 5, 55, 'Inocentes'), P('bot_cam', 'Uso das câmeras (%)', 0, 100, 5, 30, 'Inocentes'),
  P('bot_abil', 'Uso das habilidades (%)', 0, 100, 5, 70, 'Habilidades'), P('bot_aggr', 'Agressividade dos impostores (%)', 0, 100, 5, 50, 'Impostores'),
  P('bot_sab', 'Frequência de sabotagem (%)', 0, 100, 5, 40, 'Impostores'), P('bot_lie', 'Habilidade de mentir (%)', 0, 100, 5, 60, 'Impostores'),
  P('bot_talk', 'Quanto falam nas reuniões (%)', 0, 100, 5, 60, 'Reuniões'), P('bot_gap_all', 'Intervalo entre mensagens de bots (s)', 0.5, 15, 0.5, 3.5, 'Velocidade do chat'), P('bot_gap_own', 'Intervalo mínimo entre mensagens do mesmo bot (s)', 1, 30, 1, 6, 'Velocidade do chat'),
];
for (const x of BOT_PARAMS) { DEFAULT_SETTINGS[x.k] = x.def; SETTING_LIMITS[x.k] = [x.min, x.max]; }
