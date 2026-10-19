# Quórum — Estação Halcyon (v2.0)

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


## v1.0 — novidades
**Profissões novas (12)** — nomes nas cores do documento; todas configuráveis no lobby (PROFISSÕES → Regras/aba da equipe):
- Impostores: **Red John** (rosto vermelho chorando no corpo, INVESTIGAR profissão de quem está perto, ZOOM no mapa inteiro, mostrando todos os jogadores andando), **Samurai** (kill cooldown menor; ao matar ganha velocidade e fica invisível por alguns segundos — configurável; vítimas ficam com vários cortes; armadura passiva que bloqueia 1 morte por rodada), **Dexter** (ENSACAR corpo, carregar, SOLTAR; o saco fica invisível só enquanto é carregado e aparece na hora ao ser solto no chão).
- Inocentes: **Policial** (tiro como o Xerife + ZOOM que mostra todos os jogadores), **Hacker** (câmeras de qualquer lugar + conserta só a sabotagem de comunicação), **Ghost Inc** (atravessa paredes 5 s; nunca fica preso ao terminar), **Time Lord** (retrocede 10–15 s: posições voltam e mortos recentes ressuscitam), **Advogado** (GUARDAR VOTO na votação; gasta os acumulados com − / + ; persiste na partida).
- Neutros: **Congelador** (seleciona até 3 áreas/rodada com recarga de 60 s por área (configurável); só congelam após a votação; vence com N áreas), **Parinomo** (abastece todos → isqueiro aparece → INCENDIAR), **Vírus** (infecta todos → EXPLODIR), **Phantom** (fantasma; recebe 12 tarefas próprias que não contam para os inocentes e não atravessa paredes; vence ao concluí-las; visível 10 s a cada 20 s; clique de um vivo tira a profissão).
- Elegíveis (Parinomo/Vírus): jogadores vivos e conectados; mortos/desconectados saem da conta. Bots contam como jogadores.

**Cosméticos:** +12 cores (24), +10 chapéus, +10 roupas, +10 acessórios, +10 mascotes, +10 skins — desenhados em `client/js/cosdraw.js`. **Cores únicas:** o servidor garante (humanos e bots); cores ocupadas aparecem riscadas; a partida não inicia com cor repetida.
**Tarefas novas (6 tipos, 12 estações):** sequência (Simon), memória (pares), sliders, observação, bomba multi-etapas, deslizar cartão. **Bots:** comportamento por profissão em `server/bot.js` (usam só as informações que receberam). **Mobile:** botão ✕ no mapa grande; botão do Metamorfo/habilidades reorganizados e sem "clique fantasma" no seletor.

## v1.5 — Bots mais espertos, HUD mobile, Médico e Lovers
Testes automatizados (sem navegador/rede): `node test/t_medic_lovers.mjs`, `node test/t_bots.mjs`, `node test/t_medic_bot.mjs`, `node test/t_bot_brain.mjs`.

### Bots (`server/bot.js`, `server/nav.js`)
- **Consciência de profissões (só por observação):** viu alguém mudar de aparência → deduz Metamorfo e conta na reunião ("Vi o X (laranja) virar Y (amarela)… é Metamorfo"); corpo que some → Víbora; corpo com cortes → Samurai; rosto chorando → Red John; saco de corpo → Dexter; corpo arrastado → Médico. Nada disso lê o estado do servidor.
- **Time Lord / Médico:** ao ver o tempo voltar, alguém "morto" aparecer vivo, corpo sendo arrastado, ou uma alegação confiável dessas profissões, os bots inocentes **esperam 9–20 s antes de reportar** (o Time Lord só reporta depois de tentar retroceder; o Médico tenta carregar o corpo até a Enfermaria). Um bot ressuscitado lembra **quem o matou** (a cena de morte mostrou) e corre ao botão de emergência / conta na reunião; quem ouve "X me matou" dá peso alto à acusação.
- **Votos sem aleatoriedade:** sem motivo concreto (kill, duto, transformação, duplicidade, último com a vítima, informação de habilidade) o bot **pula**; erro humano raramente vira voto aleatório; com poucos vivos ele aceita votar com menos prova.
- **Confiança:** alegações "eu sou X" são aceitas bem menos (≈ 14 % sem prova, antes ≈ 72 %), caem se vierem logo após uma acusação, são checadas contra o que o bot viu e contra a própria profissão (ex.: duas alegações de um cargo único).
- **Vocabulário:** entende (sem acento) "pula o voto / skipa / skipar / ninguém vota", "votem no X", "eu sou <qualquer profissão>" (inclui Time Lord, Ghost Inc, Red John, Médico, Lovers), "X me matou", "fui ressuscitado", "concordo / discordo / confia em mim / quem morreu". Pedidos de skip e de voto só pesam conforme a confiança em quem falou.
- **Navegação:** destrava (anda de lado, replaneja, descarta alvo inalcançável por 30–45 s), evita se amontoar em tarefas/salas com muita gente.

### HUD mobile (`client/css/style.css`, `client/js/main.js`)
Bloco final do CSS consolidado: áreas seguras nos 4 lados, `dvh`, botões ≥ 44 px com toque sempre no botão (filhos sem eventos), `#acts` que não passa do limite da tela, rolagem interna em tarefas/seleção/lista final, rodapé da reunião que quebra linha, sem `backdrop-filter` nem brilho pesado no toque. Menos DOM: o objetivo e os botões só reescrevem texto quando mudam.

### Médico (inocente, nome em gradiente vermelho→azul)
PEGAR corpo (um só carregador por corpo; some após `med_carry` s) → levar até a **Enfermaria** → REVIVER. O servidor valida: Médico vivo, dentro da Enfermaria, corpo válido dentro da Enfermaria, recarga (`med_cd`), usos (`med_uses`), **cada jogador só pode ser ressuscitado 1 vez** (não duplica corpo/personagem). Volta com a mesma profissão/equipe, recargas zeradas (impostor volta com 12 s de espera para matar). Limites: só na fase de jogo (reunião apaga os corpos); só há corpo para morte por ataque/tiro/vínculo — ejeção, explosão do Vírus e corpo de Víbora que sumiu não podem ser revividos; se o jogo já terminou (`checkWin`) não há ressurreição. Lovers: só volta se o par também tem corpo válido; os dois voltam juntos.

### Lovers (inocente, nome rosa)
Par de **exatamente 2** Tripulantes comuns (nunca rouba outra profissão); chance = `w_lovers` %, `m_lovers` = 1 par. Só os dois recebem o parceiro (`lover` no payload de início) e o painel privado (`xt.lv` no snapshot). **Morte vinculada:** morrer (ataque, tiro, voto, explosão) leva o outro com `force`; o par entra com `link:true`, então não há cascata nem evento duplicado (um log `[morte-lovers]`). Quando **os dois** terminam as tarefas (tarefa em área congelada não bloqueia) o botão **DESCOBRIR** libera; o servidor sorteia **um impostor vivo** no momento do uso e manda só aos dois; se não há impostor vivo, não revela nada. Repetir devolve o mesmo resultado. Investigações (Mentalista/Red John) mostram Lovers como Tripulante. Vitória: sem condição própria — continua sendo a da equipe inocente (tarefas / eliminar impostores); a morte dupla pode custar dois votos de maioria, o que já é tratado por `checkWin`.

## v2.0 — 10 novas profissões, bots mais espertos
Testes (sem navegador/rede): `node test/t_update2_server.mjs` (regras de cada profissão), `node test/t_bots_unit.mjs`, `node test/t_bots_sim.mjs [partidas] [segundos]` (partidas só com bots). `test/harness.mjs` cria salas com relógio virtual.

**Impostores** — *Inquisidor*: na reunião escolhe jogador + profissão; acertou → o alvo morre (cena "se matou" para todos); errou → ele morre (cena de infarto). `inq_tries` por reunião; votos em mortos viram "pular". *Sabotador*: instala bomba escondida na estação perto dele (`trap_max`, `trap_cd`, `trap_r`); quem abrir a tarefa explode, a bomba some; só ele vê as próprias bombas; aliados impostores são imunes salvo `bomb_ff`. *Chuck*: possui um jogador próximo por `chk_dur` s (5–60, validado no servidor): o alvo não se move (input descartado), Chuck move o personagem do alvo e pode eliminar (registro: Chuck é o assassino; alvo mantém profissão/equipe); termina por tempo, morte de qualquer um, reunião ou fim; USAR/REPORTAR/DUTO bloqueados. *Bombardeiro*: bomba com pavio `bmb_fuse`, raio `bmb_r` (60–400), paredes bloqueiam, cancelada se o dono morre ou há reunião. *Ninja*: velocidade `nin_speed`, golpe com recarga `nin_killcd` (10 s), shuriken com alcance `nin_range`, recarga própria, para em paredes, respeita escudo/armadura; movimento em passos curtos (nenhuma velocidade atravessa paredes). *Faxineiro*: mata normalmente e LIMPA corpos (`fax_time`, `fax_cd`); registro da morte permanece em `room.deaths`.
**Neutros** — *Trocador*: troca profissão (não equipe) com jogador próximo, estado da profissão reiniciado, notificação aos dois; com Impostor, troca e depois morre. *Segurança*: protege um jogador (sorteado ou escolhido: `seg_mode`); se o protegido morrer por qualquer causa (inclusive ejeção/saída), ele morre, uma só vez, antes da checagem de vitória; atira como o Xerife; câmeras de qualquer lugar (1–4/0 para alternar); protegido impostor → aliado privado dos impostores e conta no lado deles. *Jackpot*: roleta a cada rodada (início do jogo e após cada reunião) com pesos `jp_w_*`; Assassino / Velocidade 2× / Escudo do Anjo; vence junto se estiver vivo ao fim de vitória de Inocentes ou Impostores.
**Inocente** — *Sábio*: painel com as profissões presentes; ao concluir as tarefas mostra quais ainda têm vivos (atualiza com mortes, ejeções, ressurreições e trocas; usa a profissão pública, então Lovers aparece como Tripulante).
Premissas onde a especificação era aberta: ver o relatório de entrega.
