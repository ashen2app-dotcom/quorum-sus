// Servidor HTTP (estáticos) + WebSocket (salas). Única dependência: ws.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const rooms = new Map();
const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => { let c; do c = Array.from({ length: 4 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join(''); while (rooms.has(c)); return c; };
const makeRoom = () => { const code = newCode(); const r = new Room(code, c => rooms.delete(c)); rooms.set(code, r); return r; };

const server = http.createServer((req, res) => {
  let u = decodeURIComponent((req.url || '/').split('?')[0]);
  if (u === '/') u = '/index.html';
  const base = u.startsWith('/shared/') ? root : path.join(root, 'client');
  const file = path.normalize(path.join(base, u));
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
// batimento: evita que proxies derrubem conexões ociosas (lobby/reunião) e remove conexões mortas
setInterval(() => { for (const w of wss.clients) { if (w.isAlive === false) { w.terminate(); continue; } w.isAlive = false; try { w.ping(); } catch { } } }, 25000);
wss.on('connection', ws => {
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  const c = { room: null, p: null, n: 0, t0: Date.now() };
  const err = msg => ws.send(JSON.stringify({ t: 'err', msg }));
  const bind = r => { if (!r.p) return err(r.err || 'Erro.'); c.room = r.room; c.p = r.p; };
  ws.on('message', raw => {
    const now = Date.now(); if (now - c.t0 > 1000) { c.t0 = now; c.n = 0; } if (++c.n > 240) return; // limite de mensagens/s
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (!c.p) {
      if (m.t === 'create') { const room = makeRoom(); const r = room.join(ws, m.name, m.look); bind({ ...r, room }); }
      else if (m.t === 'train') { // treinamento: sala privada de 1 pessoa, bots parados e computador para escolher a profissão
        const room = makeRoom(); room.training = true; room.pub = false; Object.assign(room.settings, { bot_on: 1, bot_n: 9, emergCd: 0, neutrals: 0, emergencies: 3 });
        const r = room.join(ws, m.name, m.look); bind({ ...r, room }); if (r.p) { room.syncBots(); room.start(r.p); }
      } else if (m.t === 'join') { const room = rooms.get(String(m.code || '').toUpperCase()); if (!room) return err('Sala não encontrada.'); bind({ ...room.join(ws, m.name, m.look), room }); }
      else if (m.t === 'quick') {
        const room = [...rooms.values()].find(r => r.pub && r.phase === 'lobby' && r.players.size < 15) || (() => { const r = makeRoom(); r.pub = true; return r; })();
        bind({ ...room.join(ws, m.name, m.look), room });
      } else if (m.t === 'rejoin') {
        const room = rooms.get(String(m.code || '').toUpperCase()); const p = room?.rejoin(ws, m.token);
        if (p) { c.room = room; c.p = p; } else ws.send(JSON.stringify({ t: 'norejoin' }));
      }
      return;
    }
    if (m.t === 'leave') { c.room.leave(c.p); c.room = c.p = null; return; }
    c.room.handle(c.p, m);
  });
  ws.on('close', () => { if (c.room && c.p) c.room.disconnect(c.p); });
});

const port = +process.env.PORT || 3000;
server.listen(port, () => console.log(`Quórum rodando em http://localhost:${port}`));
