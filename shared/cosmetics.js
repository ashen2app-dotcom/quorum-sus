// Cosméticos compartilhados (cliente desenha, servidor valida índices)
export const COLORS = ['#ff4f6d','#ff9f43','#ffd93d','#6bd968','#2de2c5','#4aa8ff','#7b6cff','#c06bff','#ff7ac8','#e8eefc','#a08060','#3b4a6b',
  '#1fb5a8','#7a1f3d','#7b4a2a','#d9c7a0','#b6f23a','#b8a6ff','#ff6f61','#c0c7d1','#e6b800','#14285a','#ffc9a3','#9ff0c8'];
export const COLOR_NAMES = ['Vermelho','Laranja','Amarelo','Verde','Água','Azul','Índigo','Roxo','Rosa','Branco','Café','Grafite','Turquesa','Vinho','Marrom','Bege','Verde-lima','Lavanda','Coral','Prata','Dourado','Azul-marinho','Pêssego','Menta'];
export const HATS = ['Nenhum','Antena','Boné','Coroa','Auréola','Chapéu de festa','Folhas','Cartola','Capacete de obra','Viking','Orelhas de gato','Chapéu de chef','Tricórnio pirata','Chapéu de mago','Gorro de lã','Flor','Chifrinhos'];
export const OUTFITS = ['Macacão','Listras','Colete','Jaqueta','Jaleco','Smoking','Camisa havaiana','Armadura','Moletom','Quimono','Capa','Uniforme espacial','Avental','Suspensório','Colete refletivo'];
export const ACCS = ['Nenhum','Óculos','Bandana','Headset','Cachecol','Monóculo','Máscara','Tapa-olho','Bigode','Gravata-borboleta','Óculos escuros','Cicatriz','Barba','Faixa na cabeça','Colar'];
export const MASCOTS = ['Nenhum','Orbe','Robozinho','Mochi','Gatinho','Fantasminha','Dragãozinho','Passarinho','Cogumelo','Estrela','Chama','Gota','Nuvem','Planeta'];
export const SKINS = ['Liso','Galáxia','Camuflado','Dourado','Gelo','Lava','Neon','Arco-íris','Cromado','Xadrez','Bolinhas','Madeira','Aquarela','Circuito'];
const lim = [COLORS, HATS, OUTFITS, ACCS, MASCOTS, SKINS].map(a => a.length);
export function sanitizeLook(l) {
  l = l || {};
  const f = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);
  return { c: f(l.c, lim[0]), h: f(l.h, lim[1]), o: f(l.o, lim[2]), a: f(l.a, lim[3]), m: f(l.m, lim[4]), s: f(l.s, lim[5]) };
}
export function sanitizeName(n) {
  return String(n || '').replace(/[^\p{L}\p{N} _\-]/gu, '').trim().slice(0, 12) || 'Tripulante';
}
