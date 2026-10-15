// Cosméticos compartilhados (cliente desenha, servidor valida índices)
export const COLORS = ['#ff4f6d','#ff9f43','#ffd93d','#6bd968','#2de2c5','#4aa8ff','#7b6cff','#c06bff','#ff7ac8','#e8eefc','#a08060','#3b4a6b'];
export const HATS = ['Nenhum','Antena','Boné','Coroa','Auréola','Chapéu de festa','Folhas'];
export const OUTFITS = ['Macacão','Listras','Colete','Jaqueta','Jaleco'];
export const ACCS = ['Nenhum','Óculos','Bandana','Headset','Cachecol'];
export const MASCOTS = ['Nenhum','Orbe','Robozinho','Mochi'];
export const SKINS = ['Liso','Galáxia','Camuflado','Dourado'];
const lim = [COLORS, HATS, OUTFITS, ACCS, MASCOTS, SKINS].map(a => a.length);
export function sanitizeLook(l) {
  l = l || {};
  const f = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);
  return { c: f(l.c, lim[0]), h: f(l.h, lim[1]), o: f(l.o, lim[2]), a: f(l.a, lim[3]), m: f(l.m, lim[4]), s: f(l.s, lim[5]) };
}
export function sanitizeName(n) {
  return String(n || '').replace(/[^\p{L}\p{N} _\-]/gu, '').trim().slice(0, 12) || 'Tripulante';
}
