// Áudio 100% sintetizado (WebAudio): sem arquivos, sem direitos autorais, carrega instantaneamente.
let ac, master, musicG, sfxG, step = 0, next = 0, alarmT = 0;
export const A = { vol: { master: 0.7, music: 0.5, sfx: 0.8 }, mode: null, tension: 0 };
const apply = () => { if (!ac) return; master.gain.value = A.vol.master; musicG.gain.value = A.vol.music * 0.5; sfxG.gain.value = A.vol.sfx; };
export function setVol(k, v) { A.vol[k] = v; apply(); }
export function initAudio() {
  if (ac) { ac.state === 'suspended' && ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  master = ac.createGain(); musicG = ac.createGain(); sfxG = ac.createGain(); musicG.connect(master); sfxG.connect(master); master.connect(ac.destination); apply();
  next = ac.currentTime + 0.1; setInterval(seq, 80);
}
function tone(f, t0, d, type = 'sine', g = 0.2, dest = sfxG, to = null) {
  const o = ac.createOscillator(), v = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t0); if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
  v.gain.setValueAtTime(0.0001, t0); v.gain.exponentialRampToValueAtTime(g, t0 + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(v); v.connect(dest); o.start(t0); o.stop(t0 + d + 0.05);
}
let nb; function noise(t0, d, g, f = 1500, dest = sfxG, type = 'bandpass') {
  if (!nb) { nb = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const a = nb.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; }
  const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), v = ac.createGain(); s.buffer = nb; fl.type = type; fl.frequency.value = f; v.gain.setValueAtTime(g, t0); v.gain.exponentialRampToValueAtTime(0.0001, t0 + d); s.connect(fl); fl.connect(v); v.connect(dest); s.start(t0, Math.random()); s.stop(t0 + d);
}
const hz = n => 110 * Math.pow(2, n / 12);
const SFX = {
  step: t => noise(t, 0.07, 0.12, 400 + Math.random() * 300),
  door: t => { noise(t, 0.35, 0.18, 900); tone(160, t, 0.3, 'sawtooth', 0.06, sfxG, 70); },
  click: t => tone(660, t, 0.06, 'square', 0.07),
  bad: t => { tone(150, t, 0.25, 'sawtooth', 0.15); tone(140, t + 0.12, 0.25, 'sawtooth', 0.12); },
  ok: t => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.18, 'triangle', 0.15)),
  node: t => tone(880, t, 0.1, 'triangle', 0.12),
  kill: t => { noise(t, 0.3, 0.5, 800); tone(300, t, 0.4, 'sawtooth', 0.2, sfxG, 40); tone(900, t, 0.1, 'square', 0.15); },
  vent: t => { noise(t, 0.25, 0.2, 500); tone(200, t, 0.2, 'triangle', 0.1, sfxG, 90); },
  meeting: t => { tone(440, t, 0.5, 'sawtooth', 0.18); tone(554, t, 0.5, 'sawtooth', 0.12); tone(440, t + 0.6, 0.7, 'sawtooth', 0.18); tone(554, t + 0.6, 0.7, 'sawtooth', 0.12); },
  vote: t => tone(520, t, 0.12, 'triangle', 0.14),
  eject: t => { tone(600, t, 1.2, 'sine', 0.2, sfxG, 60); noise(t + 0.9, 0.5, 0.2, 300); },
  sabotage: t => { for (let i = 0; i < 3; i++) tone(500, t + i * 0.4, 0.38, 'sawtooth', 0.14, sfxG, 900); },
  blackout: t => { tone(400, t, 0.8, 'sawtooth', 0.15, sfxG, 40); noise(t, 0.4, 0.2, 200); },
  fixed: t => [392, 523, 659].forEach((f, i) => tone(f, t + i * 0.09, 0.25, 'triangle', 0.15)),
  win: t => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.13, 0.35, 'triangle', 0.18)),
  lose: t => [392, 349, 311, 262].forEach((f, i) => tone(f, t + i * 0.25, 0.5, 'sawtooth', 0.12)),
  alarm: t => tone(880, t, 0.22, 'square', 0.08),
  report: t => { tone(700, t, 0.15, 'square', 0.15); tone(1000, t + 0.15, 0.3, 'square', 0.15); },
};
export function sfx(n) { if (ac && SFX[n]) SFX[n](ac.currentTime + 0.01); }
export function alarm(on) { clearInterval(alarmT); alarmT = on ? setInterval(() => sfx('alarm'), 500) : 0; }
const ARP = [0, 7, 12, 7, 3, 10, 15, 10, 5, 12, 17, 12, 7, 14, 19, 14];
function seq() {
  if (!ac || !A.mode) return;
  const bpm = A.mode === 'lobby' ? 96 : 90 + A.tension * 55;
  while (next < ac.currentTime + 0.25) {
    const t = next, s = step++, bar = (s >> 4) % 4, root = [0, -2, -4, -2][bar];
    if (A.mode === 'lobby') { if (s % 2 === 0) tone(hz(ARP[(s >> 1) % 16] + root + 12), t, 0.3, 'triangle', 0.1, musicG); if (s % 16 === 0) { tone(hz(root), t, 1.8, 'sine', 0.2, musicG); tone(hz(root + 7), t, 1.8, 'sine', 0.1, musicG); } }
    else {
      if (s % 4 === 0) tone(hz(root - 12), t, 0.35, 'sine', 0.3, musicG);
      if (s % 2 === 1) noise(t, 0.04, 0.06 + A.tension * 0.06, 6000, musicG, 'highpass');
      if (s % 16 === 0) tone(hz(root + 3), t, 3, 'sine', 0.07, musicG);
      if (A.tension > 0.3 && s % 8 === 6) tone(hz(root + 24 + (A.tension > 0.6 ? 1 : 0)), t, 0.5, 'triangle', 0.06 * A.tension, musicG);
      if (A.tension > 0.6 && s % 4 === 2) tone(60, t, 0.15, 'sine', 0.35, musicG, 40);
    }
    next += 60 / bpm / 4;
  }
}
