// Estação Halcyon — geometria compartilhada (servidor valida colisão, cliente desenha)
export const WORLD = { w: 3300, h: 1900 };
const R = (id, name, theme, x, y, w, h, hidden = false) => ({ id, name, theme, x, y, w, h, hidden });
export const ROOMS = [
  R('central', 'Sala Central', 'hub', 1250, 750, 500, 400),
  R('refeitorio', 'Refeitório', 'mess', 1250, 200, 500, 360),
  R('controle', 'Sala de Controle', 'ctl', 2250, 700, 520, 420),
  R('lab', 'Laboratório', 'lab', 250, 200, 520, 420),
  R('enfermaria', 'Enfermaria', 'med', 250, 750, 460, 380),
  R('engenharia', 'Engenharia', 'eng', 250, 1280, 560, 420),
  R('armazem', 'Armazém', 'store', 1250, 1380, 500, 360),
  R('comunicacoes', 'Comunicações', 'comm', 2250, 1280, 500, 380),
  R('seguranca', 'Segurança', 'sec', 2250, 200, 500, 380),
  R('geradores', 'Geradores', 'gen', 900, 1380, 260, 320),
  R('externa', 'Área Externa', 'ext', 2850, 760, 300, 300),
  R('arquivo', 'Arquivo Secreto', 'hidden', 900, 220, 220, 160, true),
  R('cabine', 'Cabine de Manutenção', 'hidden', 1900, 1580, 200, 160, true),
];
const C = (x, y, w, h) => ({ id: 'c' + x + '_' + y, name: 'Corredor', theme: 'hall', x, y, w, h });
export const CORRIDORS = [
  C(770, 380, 480, 100), C(1750, 380, 500, 100), C(1450, 560, 100, 190), C(1750, 880, 500, 100),
  C(710, 880, 540, 100), C(400, 620, 100, 130), C(400, 1130, 100, 150), C(1450, 1150, 100, 230),
  C(810, 1480, 90, 100), C(1160, 1480, 90, 100), C(1750, 1480, 500, 100), C(2450, 1120, 100, 160),
  C(2450, 580, 100, 120), C(2770, 860, 80, 100),
];
export const RECTS = [...ROOMS, ...CORRIDORS];
const S = (id, type, name, room, x, y) => ({ id, type, name, room, x, y });
export const STATIONS = [
  S('lab1', 'calibrate', 'Calibrar centrífuga', 'Laboratório', 360, 300),
  S('lab2', 'code', 'Analisar amostra', 'Laboratório', 660, 300),
  S('enf1', 'reboot', 'Reiniciar monitor médico', 'Enfermaria', 360, 840),
  S('enf2', 'order', 'Reordenar suprimentos', 'Enfermaria', 600, 1040),
  S('eng1', 'wires', 'Conectar cabos do motor', 'Engenharia', 350, 1400),
  S('eng2', 'fuel', 'Reabastecer motor', 'Engenharia', 700, 1400),
  S('ger1', 'order', 'Reparar módulos de energia', 'Geradores', 1030, 1450),
  S('arm1', 'fuel', 'Encher tanque reserva', 'Armazém', 1350, 1480),
  S('arm2', 'wires', 'Religar painel de carga', 'Armazém', 1650, 1480),
  S('com1', 'code', 'Enviar código de rádio', 'Comunicações', 2350, 1380),
  S('com2', 'reboot', 'Reiniciar servidor de sinal', 'Comunicações', 2650, 1380),
  S('ctl1', 'calibrate', 'Calibrar sensores', 'Sala de Controle', 2380, 800),
  S('ctl2', 'wires', 'Consertar painel de navegação', 'Sala de Controle', 2650, 800),
  S('seg1', 'reboot', 'Reiniciar câmeras', 'Segurança', 2350, 300),
  S('seg2', 'code', 'Autenticar acesso', 'Segurança', 2650, 300),
  S('ref1', 'calibrate', 'Regular o forno', 'Refeitório', 1350, 300),
  S('ref2', 'order', 'Organizar rações', 'Refeitório', 1650, 300),
  S('ext1', 'calibrate', 'Alinhar antena', 'Área Externa', 3000, 820),
  S('arq1', 'code', 'Abrir o cofre', 'Arquivo Secreto', 1010, 290),
  S('cab1', 'fuel', 'Drenar tanque', 'Cabine de Manutenção', 2000, 1680),
  S('cen1', 'swipe', 'Passar o cartão de acesso', 'Sala Central', 1330, 860),
  S('cen2', 'spot', 'Inspecionar o painel central', 'Sala Central', 1670, 860),
  S('lab3', 'memory', 'Combinar amostras', 'Laboratório', 510, 420),
  S('enf3', 'sliders', 'Ajustar o soro', 'Enfermaria', 480, 900),
  S('eng3', 'pump', 'Pressurizar o reator', 'Engenharia', 520, 1500),
  S('ger2', 'simon', 'Sequência dos disjuntores', 'Geradores', 1030, 1540),
  S('arm3', 'spot', 'Conferir o inventário', 'Armazém', 1500, 1600),
  S('com3', 'simon', 'Sincronizar a frequência', 'Comunicações', 2450, 1460),
  S('ctl3', 'memory', 'Verificar rotas de navegação', 'Sala de Controle', 2500, 900),
  S('seg3', 'sliders', 'Calibrar sensores de movimento', 'Segurança', 2400, 430),
  S('ref3', 'pump', 'Encher a caldeira', 'Refeitório', 1500, 420),
  S('ext2', 'swipe', 'Validar o crachá externo', 'Área Externa', 3050, 950),
];
export const VENTS = [
  { x: 300, y: 580, g: 'a' }, { x: 330, y: 1090, g: 'a' }, { x: 300, y: 1660, g: 'a' },
  { x: 2300, y: 540, g: 'b' }, { x: 2300, y: 1080, g: 'b' }, { x: 2700, y: 1620, g: 'b' },
];
export const SPECIAL = {
  spawn: { x: 1500, y: 950 }, emergency: { x: 1500, y: 880 },
  lights: { x: 1030, y: 1650 }, comms: { x: 2500, y: 1600 },
  heatA: { x: 550, y: 1620 }, heatB: { x: 2500, y: 1060 }, camConsole: { x: 2500, y: 490 },
};
export function walkable(x, y) {
  for (const r of RECTS) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  return false;
}
export function canStand(x, y, r = 12) {
  return walkable(x - r, y - r) && walkable(x + r, y - r) && walkable(x - r, y + r) && walkable(x + r, y + r);
}
export function roomAt(x, y) {
  for (const r of ROOMS) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  return null;
}
// Câmeras de segurança: (x,y) = aparelho na parede · (vx,vy) = centro da imagem transmitida
export const CAMS = [
  { name: 'Sala Central', x: 1500, y: 768, vx: 1500, vy: 950 },
  { name: 'Corredor do Laboratório', x: 1010, y: 392, vx: 1010, vy: 430 },
  { name: 'Corredor Leste', x: 2000, y: 892, vx: 2000, vy: 930 },
  { name: 'Armazém', x: 1500, y: 1392, vx: 1500, vy: 1560 },
];
export const TASK_MIN = { wires: 2000, code: 2200, calibrate: 1500, fuel: 3200, reboot: 2000, order: 2200, simon: 3500, memory: 3500, sliders: 2500, spot: 2500, pump: 4000, swipe: 2000 }; // tempo mínimo (ms) por tipo de tarefa
// v1.0: áreas que o Congelador pode congelar (fora as salas essenciais: reunião, spawn e pontos de conserto de sabotagem)
export const FREEZABLE = ['refeitorio', 'lab', 'enfermaria', 'armazem', 'seguranca', 'externa', 'arquivo', 'cabine'];
export const ROOM_BY_ID = Object.fromEntries(ROOMS.map(r => [r.id, r]));
