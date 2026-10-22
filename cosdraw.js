// Desenho vetorial dos cosméticos da v1.0 (índices acima dos originais). Chamado por render.js::drawCrew.
// Tudo é desenhado com formas simples (sem imagens) para não pesar; nenhum item cobre o nome ou a interface.
const TAU = Math.PI * 2;
const tri = (c, a, b, d, e, f, g) => { c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.lineTo(f, g); c.closePath(); c.fill(); };
const circ = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const ell = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); c.fill(); };

// ---- chapéus (contexto já transladado: topo da cabeça ≈ y -40) ----
export function hatX(c, h, t) {
  switch (h) {
    case 7: c.fillStyle = '#161a28'; ell(c, 0, -39, 16, 4); c.fillRect(-9, -58, 18, 19); c.fillStyle = '#c0283d'; c.fillRect(-9, -44, 18, 4); break; // cartola
    case 8: c.fillStyle = '#ffc400'; c.beginPath(); c.arc(0, -39, 14, Math.PI, 0); c.fill(); c.fillRect(-16, -41, 32, 3); c.fillStyle = '#e0a800'; c.fillRect(-2, -53, 4, 14); break; // capacete
    case 9: c.fillStyle = '#8f98ab'; c.beginPath(); c.arc(0, -39, 14, Math.PI, 0); c.fill(); c.fillStyle = '#6a7388'; c.fillRect(-14, -41, 28, 3); c.fillStyle = '#f4efe2';
      for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 12, -41); c.quadraticCurveTo(d * 24, -42, d * 20, -56); c.quadraticCurveTo(d * 17, -46, d * 9, -44); c.fill(); } break; // viking
    case 10: for (const d of [-1, 1]) { c.fillStyle = '#2b3350'; tri(c, d * 4, -42, d * 14, -42, d * 11, -56); c.fillStyle = '#ff9db6'; tri(c, d * 7, -43, d * 12, -43, d * 10.5, -52); } break; // orelhas de gato
    case 11: c.fillStyle = '#fff'; for (const x of [-7, 0, 7]) circ(c, x, -50, 7); c.fillRect(-10, -48, 20, 9); c.fillStyle = '#dfe6f2'; c.fillRect(-10, -43, 20, 2); break; // chef
    case 12: c.fillStyle = '#1b1f33'; c.beginPath(); c.moveTo(-17, -39); c.lineTo(-9, -53); c.lineTo(9, -53); c.lineTo(17, -39); c.quadraticCurveTo(0, -35, -17, -39); c.fill(); c.fillStyle = '#e8d9a8'; circ(c, 0, -46, 2.6); c.fillRect(-1, -43, 2, 2); break; // pirata
    case 13: c.fillStyle = '#5a3bb0'; tri(c, -12, -39, 12, -39, 3, -68); c.fillStyle = '#4a2f96'; ell(c, 0, -39, 17, 3.5); c.fillStyle = '#ffd23d'; circ(c, -3, -52, 1.6); circ(c, 3, -46, 1.3); circ(c, 0, -60, 1.2); break; // mago
    case 14: c.fillStyle = '#d94a5e'; c.beginPath(); c.arc(0, -39, 14.5, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; for (let i = -10; i < 12; i += 8) c.fillRect(i, -52, 4, 13); c.fillStyle = '#f2d9dc'; circ(c, 0, -54, 4.5); c.fillStyle = '#b53a4d'; c.fillRect(-15, -41, 30, 4); break; // gorro de lã
    case 15: for (let i = 0; i < 6; i++) { c.fillStyle = '#ff7ac8'; const a = i / 6 * TAU + t * 0.4; ell(c, 9 + Math.cos(a) * 5, -45 + Math.sin(a) * 5, 3.2, 3.2); } c.fillStyle = '#ffd23d'; circ(c, 9, -45, 2.6); break; // flor
    case 17: c.fillStyle = '#2a2f45'; ell(c, 0, -39, 18, 4.2); c.fillStyle = '#383f5c'; c.beginPath(); c.moveTo(-10, -39); c.quadraticCurveTo(-11, -55, -3, -54); c.quadraticCurveTo(0, -51, 3, -54); c.quadraticCurveTo(11, -55, 10, -39); c.fill(); c.fillStyle = '#c0283d'; c.fillRect(-10, -45, 20, 3.4); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(-7, -53, 3, 7); break; // fedora noir
    case 18: c.fillStyle = '#7a4d2b'; c.beginPath(); c.arc(0, -39, 14.5, Math.PI, 0); c.fill(); c.fillStyle = '#5e3a1f'; c.fillRect(-15, -41, 30, 3.4); c.fillStyle = '#e8c36b'; for (const d of [-1, 1]) circ(c, d * 6, -48, 1.3); c.fillStyle = '#2d3550'; c.beginPath(); c.roundRect(-9, -52, 18, 6, 3); c.fill(); c.fillStyle = 'rgba(120,220,255,.75)'; circ(c, -4.5, -49, 2.2); circ(c, 4.5, -49, 2.2); break; // boné de piloto com óculos
    case 19: c.fillStyle = '#9aa5b8'; c.fillRect(-1.2, -50, 2.4, 11); c.save(); c.translate(0, -52); c.rotate(Math.sin(t * 1.5) * 0.35); c.fillStyle = '#dfe6f2'; c.beginPath(); c.ellipse(0, 0, 11, 4.5, -0.2, 0, TAU); c.fill(); c.fillStyle = '#7b87a3'; c.beginPath(); c.ellipse(0, 0.8, 8, 2.4, -0.2, 0, TAU); c.fill(); c.fillStyle = '#ff4f6d'; circ(c, 4.5, -3.5, 1.4); c.restore(); c.fillStyle = '#6a7388'; ell(c, 0, -39, 10, 2.6); break; // antena parabólica
    case 16: for (const d of [-1, 1]) { c.fillStyle = '#e5314f'; c.beginPath(); c.moveTo(d * 5, -41); c.quadraticCurveTo(d * 12, -44, d * 10, -54); c.quadraticCurveTo(d * 6, -47, d * 1, -42); c.fill(); } break; // chifrinhos
  }
}

// ---- roupas (dentro do clip do torso: x -12..12, y -26..-5) ----
export function outfitX(c, o, col) {
  switch (o) {
    case 5: c.fillStyle = '#12151f'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-5, -26); c.lineTo(0, -12); c.lineTo(5, -26); c.fill(); c.fillStyle = '#d6263d'; tri(c, -5, -22, 0, -20, -5, -17); tri(c, 5, -22, 0, -20, 5, -17); c.fillStyle = '#fff'; circ(c, 0, -8, 1.2); circ(c, 0, -13, 1.2); break; // smoking
    case 6: c.fillStyle = '#ff7a3d'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#fff'; for (const [x, y] of [[-8, -22], [5, -19], [-3, -11], [8, -9], [-9, -8]]) { circ(c, x, y, 2.4); c.fillStyle = '#ffd93d'; circ(c, x, y, 0.9); c.fillStyle = '#fff'; } c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-0.7, -26, 1.4, 21); break; // havaiana
    case 7: c.fillStyle = '#9aa5b8'; c.fillRect(-12, -27, 24, 22); c.strokeStyle = '#6b7588'; c.lineWidth = 1.2; c.strokeRect(-9, -24, 18, 8); c.beginPath(); c.moveTo(0, -24); c.lineTo(0, -5); c.moveTo(-11, -12); c.lineTo(11, -12); c.stroke(); c.fillStyle = '#dfe5f2'; for (const x of [-7, 7]) circ(c, x, -20, 1.2); break; // armadura
    case 8: c.fillStyle = '#6d7aa8'; c.fillRect(-12, -27, 24, 22); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.moveTo(-7, -12); c.lineTo(7, -12); c.lineTo(9, -6); c.lineTo(-9, -6); c.fill(); c.fillStyle = '#e8eefc'; c.fillRect(-4, -25, 1.4, 8); c.fillRect(3, -25, 1.4, 8); break; // moletom
    case 9: c.fillStyle = '#f4f6fb'; c.fillRect(-12, -27, 24, 22); c.strokeStyle = '#c9d1e3'; c.lineWidth = 2; c.beginPath(); c.moveTo(-9, -26); c.lineTo(3, -10); c.moveTo(9, -26); c.lineTo(-3, -10); c.stroke(); c.fillStyle = '#1b2036'; c.fillRect(-12, -12, 24, 4); break; // quimono
    case 10: c.fillStyle = '#d6263d'; c.fillRect(-12, -27, 24, 8); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#d6263d'; c.beginPath(); c.moveTo(-12, -19); c.lineTo(12, -19); c.lineTo(7, -9); c.lineTo(-7, -9); c.fill(); c.fillStyle = '#ffd23d'; circ(c, 0, -19, 2.4); break; // capa
    case 11: c.fillStyle = '#f2f5fb'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#3b6fe0'; c.fillRect(-12, -17, 24, 3); c.fillStyle = '#ff4f6d'; circ(c, -6, -22, 2.4); c.fillStyle = '#3b6fe0'; c.fillRect(3, -24, 6, 3); break; // espacial
    case 12: c.fillStyle = 'rgba(0,0,0,.16)'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#f7f1e3'; c.beginPath(); c.moveTo(-8, -17); c.lineTo(8, -17); c.lineTo(11, -5); c.lineTo(-11, -5); c.fill(); c.fillStyle = '#e1d6bb'; c.fillRect(-4, -12, 8, 5); break; // avental
    case 13: c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#5a3a2a'; c.fillRect(-8, -27, 3, 22); c.fillRect(5, -27, 3, 22); c.fillStyle = '#ffd23d'; circ(c, -6.5, -9, 1.4); circ(c, 6.5, -9, 1.4); break; // suspensório
    case 15: c.fillStyle = '#b79d6e'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#9a8157'; c.beginPath(); c.moveTo(-12, -27); c.lineTo(-2, -27); c.lineTo(-6, -14); c.lineTo(-12, -14); c.fill(); c.beginPath(); c.moveTo(12, -27); c.lineTo(2, -27); c.lineTo(6, -14); c.lineTo(12, -14); c.fill(); c.fillStyle = '#5a4630'; c.fillRect(-12, -14, 24, 3); c.fillStyle = '#e8c36b'; c.fillRect(-2, -14, 4, 3); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(-0.7, -26, 1.4, 12); circ(c, -4, -9, 1); circ(c, 4, -9, 1); break; // casaco noir
    case 16: c.fillStyle = '#6a4a2e'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#ff8a1f'; c.fillRect(-12, -22, 24, 2.6); c.fillRect(-12, -9, 24, 2.6); c.fillStyle = '#e8eef5'; c.fillRect(-12, -17.5, 5, 4); c.fillStyle = '#2b3350'; c.fillRect(3, -24, 7, 5); c.fillStyle = '#ffd23d'; circ(c, 6.5, -21.5, 1.1); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-0.7, -26, 1.4, 21); break; // jaqueta de piloto
    case 17: c.fillStyle = '#f3f7ff'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#4aa8ff'; c.beginPath(); c.moveTo(-12, -27); c.lineTo(-4, -27); c.lineTo(0, -12); c.lineTo(4, -27); c.lineTo(12, -27); c.lineTo(12, -22); c.lineTo(0, -6); c.lineTo(-12, -22); c.closePath(); c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1; c.fillStyle = '#e6b800'; c.fillRect(-12, -9, 24, 2.4); c.fillRect(-12, -27, 24, 1.6); circ(c, 0, -17, 2.4); c.fillStyle = '#f3f7ff'; circ(c, 0, -17, 1); break; // túnica de oráculo
    case 14: c.fillStyle = '#ff8a1f'; c.fillRect(-12, -27, 24, 22); c.fillStyle = '#e8eef5'; c.fillRect(-12, -21, 24, 2.6); c.fillRect(-12, -12, 24, 2.6); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(-0.7, -26, 1.4, 21); break; // colete refletivo
  }
}

// ---- acessórios de rosto (olhos em x=-2.2 e 6.8, y=-32.5; boca y≈-27.8; pescoço y≈-20) ----
export function accX(c, a, t) {
  switch (a) {
    case 5: c.strokeStyle = '#d9a600'; c.lineWidth = 1.8; c.beginPath(); c.arc(6.8, -32.5, 5.4, 0, TAU); c.stroke(); c.lineWidth = 1; c.beginPath(); c.moveTo(11, -29); c.quadraticCurveTo(13, -22, 10, -17); c.stroke(); break; // monóculo
    case 6: c.fillStyle = '#e9f4fb'; c.beginPath(); c.roundRect(-6, -29.5, 16, 8, 3); c.fill(); c.strokeStyle = '#9ac4dc'; c.lineWidth = 1; c.beginPath(); c.moveTo(-3, -27); c.lineTo(8, -27); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.moveTo(-6, -28); c.lineTo(-11, -31); c.moveTo(10, -28); c.lineTo(14, -31); c.stroke(); break; // máscara
    case 7: c.fillStyle = '#10141f'; circ(c, -2.2, -32.5, 4.6); c.strokeStyle = '#10141f'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-6, -35); c.lineTo(-13, -41); c.moveTo(2, -35); c.lineTo(11, -42); c.stroke(); break; // tapa-olho
    case 8: c.fillStyle = '#2a1c14'; c.beginPath(); c.moveTo(1.5, -28.6); c.quadraticCurveTo(-5, -31, -8, -26.5); c.quadraticCurveTo(-3, -27.8, 1.5, -26.8); c.quadraticCurveTo(6, -27.8, 11, -26.5); c.quadraticCurveTo(8, -31, 1.5, -28.6); c.fill(); break; // bigode
    case 9: c.fillStyle = '#d6263d'; tri(c, 1, -19, -9, -24, -9, -14); tri(c, 1, -19, 11, -24, 11, -14); c.fillStyle = '#a81a2e'; circ(c, 1, -19, 2.6); break; // borboleta
    case 10: c.fillStyle = '#10141f'; c.beginPath(); c.roundRect(-8, -36, 10, 7, 3); c.roundRect(3, -36, 10, 7, 3); c.fill(); c.fillRect(1.5, -34.5, 2, 1.6); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(-6.5, -35, 3, 1.4); c.fillRect(4.5, -35, 3, 1.4); break; // óculos escuros
    case 11: c.strokeStyle = '#c0283d'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(7, -38); c.lineTo(11, -26); c.stroke(); c.lineWidth = 1; c.beginPath(); for (const y of [-35, -32, -29]) { c.moveTo(8 + (y + 38) * 0.2 - 1.5, y); c.lineTo(8 + (y + 38) * 0.2 + 1.5, y + 1.2); } c.stroke(); break; // cicatriz
    case 12: c.fillStyle = '#4a3020'; c.beginPath(); c.moveTo(-9, -29); c.quadraticCurveTo(-11, -15, 1, -14); c.quadraticCurveTo(13, -15, 11, -29); c.quadraticCurveTo(8, -24, 1, -24.5); c.quadraticCurveTo(-6, -24, -9, -29); c.fill(); break; // barba
    case 13: c.strokeStyle = '#d6263d'; c.lineWidth = 4; c.beginPath(); c.arc(0, -32, 14.2, Math.PI * 1.12, Math.PI * 1.88); c.stroke(); c.lineWidth = 3; c.beginPath(); c.moveTo(-13, -38); c.lineTo(-19, -34 + Math.sin(t * 5) * 1.5); c.moveTo(-13, -38); c.lineTo(-18, -41 + Math.sin(t * 5 + 1) * 1.5); c.stroke(); break; // faixa
    case 14: c.fillStyle = '#ffd23d'; for (let i = 0; i < 9; i++) { const a2 = Math.PI * (0.12 + i * 0.095); circ(c, 1 + Math.cos(a2) * 9, -22 + Math.sin(a2) * 3.4, 1.5); } c.fillStyle = '#ff4f6d'; circ(c, 1, -18.6, 2.2); break; // colar
  }
}

// ---- mascotes (já transladado/escalado; raio ≈ 10) ----
export function mascotX(c, m, t, face = 1) {
  const bob = Math.sin(t * 5);
  switch (m) {
    case 4: c.fillStyle = '#ff9f43'; ell(c, 0, 1, 9, 7.5); tri(c, -8, -4, -3, -6, -7, -13); tri(c, 8, -4, 3, -6, 7, -13); c.fillStyle = '#17203a'; circ(c, -3, 0, 1.3); circ(c, 3, 0, 1.3); c.strokeStyle = '#17203a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-10, 2); c.lineTo(-5, 2.6); c.moveTo(10, 2); c.lineTo(5, 2.6); c.stroke(); break; // gatinho
    case 5: c.fillStyle = 'rgba(255,255,255,.92)'; c.beginPath(); c.moveTo(-8, 8); c.lineTo(-8, -2); c.arc(0, -2, 8, Math.PI, 0); c.lineTo(8, 8); for (let i = 0; i < 4; i++) c.lineTo(8 - (i + 0.5) * 4, 8 - (i % 2 ? 0 : 3.5)); c.closePath(); c.fill(); c.fillStyle = '#17203a'; circ(c, -3, -2, 1.5); circ(c, 3, -2, 1.5); ell(c, 0, 2, 1.4, 1.8); break; // fantasminha
    case 6: c.fillStyle = '#4fd36b'; ell(c, 0, 1, 8.5, 7.5); c.fillStyle = '#2c8a44'; tri(c, -3, -6, 0, -13, 3, -6); c.fillStyle = '#8ff0a6'; ell(c, -9, -2 + bob, 5, 3, -0.6); ell(c, 9, -2 - bob, 5, 3, 0.6); c.fillStyle = '#17203a'; circ(c, -3, 0, 1.3); circ(c, 3, 0, 1.3); c.fillStyle = '#ffd23d'; circ(c, 0, 4, 1.2); break; // dragãozinho
    case 7: c.fillStyle = '#4aa8ff'; ell(c, 0, 1, 8, 7); c.fillStyle = '#2f7cc8'; ell(c, -2, 2 + bob * 1.5, 5, 3, -0.5); c.fillStyle = '#ffb347'; tri(c, face * 7, -1, face * 13, 1, face * 7, 3); c.fillStyle = '#fff'; circ(c, face * 3, -2, 2); c.fillStyle = '#17203a'; circ(c, face * 3.4, -2, 1); break; // passarinho
    case 8: c.fillStyle = '#f1e2c9'; c.fillRect(-3.5, 0, 7, 8); c.fillStyle = '#e5314f'; c.beginPath(); c.arc(0, 1, 10, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; circ(c, -5, -3, 1.8); circ(c, 2, -6, 1.5); circ(c, 6, -2, 1.4); c.fillStyle = '#17203a'; circ(c, -1.6, 4.5, 0.9); circ(c, 1.6, 4.5, 0.9); break; // cogumelo
    case 9: c.save(); c.rotate(Math.sin(t * 2) * 0.25); c.fillStyle = '#ffd93d'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 4.5 : 11, a2 = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); } c.closePath(); c.fill(); c.fillStyle = '#17203a'; circ(c, -2, 0, 1); circ(c, 2, 0, 1); c.restore(); break; // estrela
    case 10: c.fillStyle = '#ff6a1f'; c.beginPath(); c.moveTo(0, -12 + bob); c.quadraticCurveTo(10, -2, 6, 6); c.quadraticCurveTo(0, 11, -6, 6); c.quadraticCurveTo(-10, -2, 0, -12 + bob); c.fill(); c.fillStyle = '#ffd93d'; c.beginPath(); c.moveTo(0, -4); c.quadraticCurveTo(5, 1, 3, 6); c.quadraticCurveTo(0, 8, -3, 6); c.quadraticCurveTo(-5, 1, 0, -4); c.fill(); break; // chama
    case 11: c.fillStyle = '#4aa8ff'; c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(10, 2, 7, 6); c.quadraticCurveTo(0, 13, -7, 6); c.quadraticCurveTo(-10, 2, 0, -12); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; ell(c, -3, 1, 1.6, 3, 0.4); c.fillStyle = '#17203a'; circ(c, -2, 4, 0.9); circ(c, 2, 4, 0.9); break; // gota
    case 12: c.fillStyle = '#e8eefc'; circ(c, -5, 2, 5); circ(c, 0, -2, 6.5); circ(c, 5.5, 2, 5); c.fillRect(-5, 2, 11, 5); c.fillStyle = '#17203a'; circ(c, -2, 1, 1); circ(c, 3, 1, 1); c.fillStyle = '#7ab8ff'; for (let i = 0; i < 3; i++) circ(c, -4 + i * 4, 9 + ((t * 8 + i * 3) % 5), 0.9); break; // nuvem
    case 13: c.fillStyle = '#a26bff'; circ(c, 0, 0, 7); c.fillStyle = '#c9a6ff'; ell(c, -2, -2, 3, 2, -0.5); c.strokeStyle = '#ffd93d'; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, 1, 12, 3.4, -0.35, 0, TAU); c.stroke(); break; // planeta
  }
}

// ---- skins (corpo): gradiente + estampa ----
export function skinFill(g, s, col, mix) {
  const st = {
    4: ['#f2fdff', '#a9e4ff', '#5fb4e8'], 5: ['#4a1208', '#9a2a0c', '#ff5a1f'], 6: ['#0d1230', '#141a3f', '#0a0e26'], 7: ['#ff4f6d', '#ffd93d', '#4aa8ff'],
    8: ['#f4f7fb', '#9aa5b8', '#dfe6f2'], 9: [mix(col, 0.35), mix(col, 0.35), mix(col, 0.35)], 10: [mix(col, 0.2), mix(col, 0.05), mix(col, -0.2)],
    11: ['#b07a45', '#8a5a30', '#6b4423'], 12: ['#fff7ec', '#f3e6ff', '#e6f5ff'], 13: ['#0f2a22', '#123a2e', '#0a1c17'],
  }[s]; if (!st) return false; st.forEach((cl, i) => g.addColorStop(i / (st.length - 1), cl)); return true;
}
export function skinOver(c, s, col, mix) {
  switch (s) {
    case 4: c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1; c.beginPath(); for (const [a, b, d, e] of [[-10, -40, -3, -30], [8, -38, 2, -24], [-6, -18, 6, -10], [-12, -26, -5, -20]]) { c.moveTo(a, b); c.lineTo(d, e); } c.stroke(); break;
    case 5: c.strokeStyle = '#ffb347'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-10, -38); c.lineTo(-4, -30); c.lineTo(-8, -22); c.lineTo(0, -14); c.moveTo(10, -36); c.lineTo(4, -26); c.lineTo(8, -16); c.stroke(); break;
    case 6: c.strokeStyle = col; c.lineWidth = 2; c.shadowColor = col; c.shadowBlur = 6; c.beginPath(); c.moveTo(-12, -14); c.lineTo(12, -14); c.moveTo(-12, -22); c.lineTo(12, -22); c.stroke(); c.shadowBlur = 0; break;
    case 8: c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(-14, -42, 5, 40); c.fillRect(2, -42, 2, 40); break;
    case 9: c.fillStyle = mix(col, -0.45); for (let y = -50; y < -4; y += 8) for (let x = -16; x < 16; x += 8) if (((x + 16) / 8 + (y + 50) / 8) % 2 === 0) c.fillRect(x, y, 8, 8); break;
    case 10: c.fillStyle = 'rgba(255,255,255,.75)'; for (const [a, b] of [[-9, -42], [0, -38], [8, -44], [-6, -26], [6, -22], [-10, -12], [2, -10], [10, -30]]) circ(c, a, b, 2.3); break;
    case 11: c.strokeStyle = 'rgba(40,20,5,.45)'; c.lineWidth = 1; c.beginPath(); for (let y = -46; y < -4; y += 5) { c.moveTo(-16, y); c.quadraticCurveTo(0, y + 3, 16, y - 1); } c.stroke(); break;
    case 12: for (const [a, b, r, cl] of [[-8, -38, 9, 'rgba(255,100,150,.35)'], [8, -28, 10, 'rgba(80,160,255,.35)'], [-4, -14, 8, 'rgba(255,220,80,.35)']]) { c.fillStyle = cl; circ(c, a, b, r); } break;
    case 13: c.strokeStyle = '#4dffb8'; c.lineWidth = 1; c.beginPath(); c.moveTo(-12, -40); c.lineTo(-4, -40); c.lineTo(-4, -30); c.lineTo(6, -30); c.moveTo(12, -20); c.lineTo(2, -20); c.lineTo(2, -10); c.moveTo(-12, -16); c.lineTo(-6, -16); c.stroke(); c.fillStyle = '#4dffb8'; circ(c, -4, -40, 1.4); circ(c, 6, -30, 1.4); circ(c, 2, -10, 1.4); break;
  }
}
