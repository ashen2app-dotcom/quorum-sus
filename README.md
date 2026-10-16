# Quórum — Estação Halcyon (v0.5 Beta)

Jogo 2D multiplayer de dedução social (4–15 jogadores). Servidor autoritativo em Node.js + WebSocket; cliente em Canvas 2D (sem build, sem assets externos: arte vetorial e áudio sintetizados).

## Rodar
    npm install
    npm start            # http://localhost:3000
Abra 4 abas/navegadores (ou amigos na mesma rede) → CRIAR SALA → os outros ENTRAR com o código → COMEÇAR.
Para testar com menos gente: `MIN_PLAYERS=2 npm start` (a partida termina rápido, é só para ver telas).
Hospedagem: qualquer host Node com WebSocket (Railway, Render, Fly). Use a variável PORT.

## Controles
WASD/setas mover · E usar/tarefa/reparar/emergência · R reportar · Q eliminar · V ventilação (C troca, V sai) · F sabotar · ESC fecha tarefa

## Estrutura
- `shared/map.js` mapa (13 salas, 14 corredores, 20 estações de tarefa, ventilações) e colisão — usado por servidor e cliente
- `shared/cosmetics.js` cores, chapéus, roupas, acessórios, mascotes, skins
- `server/room.js` regras: papéis, movimento, visão, kill, tarefas, sabotagens, reuniões, votos, vitória, reconexão
- `server/index.js` HTTP estático + WebSocket + limite de mensagens
- `client/js/render.js` mapa, personagens, luz/sombra, partículas, câmera, portas
- `client/js/tasks.js` 6 minigames · `audio.js` música/sfx sintetizados · `ui.js` telas · `main.js` orquestração

## Profissões (17)
`shared/jobs.js` define profissões, cores, descrições e TODOS os parâmetros configuráveis; `server/room.js` aplica as regras.
- Inocentes (azul): Tripulante, Detetive, Engenheiro, Cientista, Barulhento, Juiz, Localizador, Xerife, Mentalista (nome preto)
- Neutros: Anjo (amarelo) e Influencer (ciano) — só recebidos por inocentes que morrem; Joker (cinza); Execution (laranja)
- Impostores: Impostor e Metamorfo (vermelho), Víbora (verde), Espectro (roxo)
Início da partida: Carregando → Categoria → Profissão. Habilidades: botões na tela (teclas 1–4), M abre o mapa grande (rastreio do Localizador).
O host configura no lobby (botão PROFISSÕES): chance e máximo de cada profissão, nº de neutros/impostores, recargas, durações, usos e regras de cada habilidade; chance 0 desliga a profissão.

## Mentalista
Tem dois painéis: **PAINEL** (igual ao do Cientista: vivo/morto, usos por reunião) e **PROFISSÕES** (desbloqueia ao completar todas as tarefas; mostra nome, profissão e vivo/morto de todos; só abre durante as reuniões). A sondagem individual continua revelando a profissão de quem ficar parado.

## Botão de emergência e reuniões
O botão tem recarga (padrão 20 s, configurável no lobby) no início e depois de cada reunião; durante a recarga o botão mostra os segundos. Ao reportar um corpo ou apertar o botão há uma cena em tela cheia. Desconexões não matam mais: o jogador fica offline por até 150 s (aparece "OFFLINE" na reunião) antes de ser removido, e o servidor registra `[morte]` e `[saiu]` nos logs.

## Toque (celular)
Os botões reagem ao toque imediato, mesmo com o dedo no joystick (não precisa parar de andar para eliminar, reportar ou chamar reunião). O movimento sai em 16 direções com poucas mensagens, o servidor para sozinho quem fica sem avisar o cliente por 0,7 s, e a correção de posição leva em conta a latência (sem vai e vem).

## Dispositivo
Na primeira vez o jogo pergunta se você joga no **Celular** ou no **Computador** (dá para trocar em Configurações). Computador usa teclado e layout compacto/centralizado; Celular usa joystick e botões de toque.

## Votação
Botão **🗺 MAPA** na reunião mostra onde você parou, o corpo encontrado e suas tarefas pendentes. Mortos veem o chat dos vivos; vivos não veem o chat dos mortos. A animação de morte aparece só para quem morreu. Painéis de seleção/Cientista/Mentalista marcam mortos com ✕.

## Celular
Joystick flutuante (metade esquerda da tela), botões grandes à direita (USAR, REPORTAR, ELIMINAR, DUTO/PRÓXIMO, SABOTAR e habilidades), HUD compacto (toque na barra de tarefas para ver a lista; toque no minimapa para o mapa grande), botão de tela cheia e aviso para girar o aparelho. Reunião, lobby, menus e minigames são responsivos. Use o celular na horizontal.

## Animação de morte
Quem morre por ataque (e quem matou) vê a cena em tela cheia: o assassino avança, o golpe estilizado (sem gore) e a vítima cai. No lobby, clique no seu personagem para personalizar; o dono também edita os personagens de bots.

## Bots inteligentes
No lobby: PROFISSÕES → aba **🤖 Bots** (ativar, quantidade, nomes e 14 parâmetros de comportamento). `server/bot.js` (cérebro) e `server/nav.js` (navegação A*).
- Bots aparecem no lobby como jogadores normais (quem não é o dono nem vê a configuração de bots), com os nomes definidos pelo admin (sem duplicar; vazio = nomes automáticos) e nada os identifica como bots.
- Recebem as mesmas mensagens de um cliente (visão limitada, avisos, chat) e agem pelas mesmas mensagens (mover, kill, votar, habilidades), então regras, profissões e recargas são idênticas às dos humanos. Não leem o estado dos outros jogadores no servidor.
- Objetivos por prioridade: reportar corpo, consertar sabotagem, fugir, caçar/seguir, tarefas (reais ou fingidas), explorar, câmeras. Memória de suspeitas (quem estava perto do corpo, sumiu perto de duto, mudou de aparência, última companhia da vítima, pistas das habilidades, acusações no chat) usada no chat e no voto.
- **Os bots conversam:** durante as reuniões entendem o que os jogadores escrevem (cumprimentos, "onde você estava?", "alguém viu algo?", "votem no X", acusações, "qual sua profissão?", "você é um bot?") e respondem com atraso natural, com limite por reunião e no estilo da profissão (impostores mentem). Mencionar o nome de um bot garante resposta.
- **Reivindicações:** bots declaram função ("terminei as tasks, sou Mentalista…"), os outros decidem se confiam (função repetida = mentira; sala errada = mentira; quem insiste no mesmo alvo pode ser Execution; quem pede para ser votado pode ser Joker). O ritmo das mensagens é configurável.
- Parâmetros: habilidade, erro, reação, hesitação, grupo, tarefas, suspeita, câmeras, habilidades, agressividade, sabotagem, mentira, conversa.

## Câmeras e setas
- **Câmeras de segurança:** console na Sala de Segurança (E). Mostra 4 imagens ao vivo (Sala Central, Corredor do Laboratório, Corredor Leste, Armazém). Os aparelhos nas paredes ficam com LED vermelho piscando quando alguém assiste. A sabotagem de comunicação derruba as câmeras. Quem assiste fica parado.
- **Setas:** azuis = tarefas pendentes (configurável em Configurações: todas / 3 mais próximas / desligadas); vermelha = onde consertar a sabotagem; rosa = corpo do Barulhento; amarela = alvo do Localizador; vermelhas dentro do duto = direção dos outros jogadores.

## Segurança (servidor manda)
Função, posição, kill (alcance/cooldown), votos, tarefas, sabotagens e vitória são validados no servidor. O servidor só envia posições de quem está dentro do campo de visão (sem wallhack) e a função dos infiltrados só vai aos próprios infiltrados. Tarefas exigem proximidade + tempo mínimo desde o início.
Limite conhecido: o resultado do minigame roda no cliente; o servidor garante proximidade e tempo, não a correção da solução.

## Fase 2 (não incluída ainda)
Loja de moedas/desbloqueios, XP/nível/perfil/estatísticas com salvamento no servidor (banco), skins/animações desbloqueáveis, mais tarefas e polimento de áudio/efeitos.
