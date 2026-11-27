// Sound effects synthesised with the Web Audio API (no audio files, nothing to license or download).
// Browsers only allow sound after a tap/click: call unlockAudio() inside a click handler.

let ctx = null;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
let muted = store.get('wa:mute') === '1';

function ac() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function unlockAudio() { ac(); }

function tone(freq, at = 0, dur = .15, { type = 'sine', vol = .18, to } = {}) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + .02);
}
// short burst of filtered noise (snare / whoosh)
function noise(at = 0, dur = .08, { vol = .12, freq = 1800, q = .8, to } = {}) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, len = Math.ceil(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  src.connect(f).connect(g).connect(c.destination); src.start(t);
}
const arp = (notes, step = .08, opts) => notes.forEach((f, i) => tone(f, i * step, .25, opts));

export const sfx = {
  pop: () => tone(520, 0, .12, { type: 'triangle', to: 880, vol: .15 }),              // player joins / button
  start: () => arp([392, 523, 659, 784, 1047], .09, { type: 'triangle', vol: .16 }),   // round starts
  tick: () => tone(1200, 0, .06, { type: 'square', vol: .08 }),                         // last 10 seconds (louder)
  clock: (s) => tone(s % 2 ? 1500 : 1100, 0, .03, { type: 'sine', vol: .045 }),          // tick-tock every second
  guess: () => tone(660, 0, .08, { type: 'triangle', vol: .07, to: 880 }),               // someone guessed (host)
  far: () => tone(220, 0, .18, { type: 'sine', vol: .14, to: 160 }),                    // red guess
  warm: () => arp([440, 554], .07, { type: 'triangle', vol: .12 }),                     // orange guess
  close: () => arp([659, 880, 1109], .06, { type: 'triangle', vol: .13 }),              // green guess
  correct: () => arp([784, 988, 1175, 1568, 2093], .07, { type: 'sine', vol: .18 }),    // found it
  wrong: () => tone(196, 0, .22, { type: 'sawtooth', vol: .06, to: 147 }),             // Davini wrong
  unlock: () => { tone(300, 0, .35, { type: 'sine', vol: .08, to: 1200 }); arp([1047, 1319], .1, { vol: .12 }); }, // code cracked
  drum: (big = false) => { tone(big ? 90 : 130, 0, big ? .5 : .3, { type: 'sine', vol: .35, to: 45 }); noise(0, .06, { vol: .08, freq: 900 }); }, // 3-2-1 beats
  drumroll: (sec = 1.6) => { const n = Math.round(sec / .045); for (let i = 0; i < n; i++) noise(i * .045, .05, { vol: .03 + .09 * i / n, freq: 2200 }); tone(80, sec, .6, { vol: .35, to: 40 }); noise(sec, .5, { vol: .2, freq: 6000, q: .3 }); },
  heartbeat: () => { tone(70, 0, .16, { vol: .3, to: 45 }); tone(65, .2, .16, { vol: .22, to: 42 }); },     // last 30 s
  whoosh: () => noise(0, .45, { vol: .12, freq: 400, to: 3000, q: 1.2 }),                              // banner flies in
  sparkle: () => arp([1568, 2093, 2637, 3136], .05, { type: 'sine', vol: .07 }),                      // new hint
  fanfare: () => { arp([523, 659, 784], .12, { type: 'triangle', vol: .16 }); tone(1047, .4, .7, { type: 'triangle', vol: .18 }); }, // reveal
};
export const guessSound = color => ({ gold: sfx.correct, green: sfx.close, orange: sfx.warm, red: sfx.far })[color]?.();

// Gentle lobby music: pentatonic melody over a soft bass, generated on the fly.
let musicTimer = null;
export function startMusic() {
  if (musicTimer || muted || !ac()) return;
  const scale = [523, 587, 659, 784, 880, 1047], bass = [131, 175, 196, 165];
  let step = 0;
  musicTimer = setInterval(() => {
    if (muted) return;
    if (step % 8 === 0) tone(bass[(step / 8) % 4], 0, 1.6, { type: 'sine', vol: .07 });
    if (Math.random() < .7) tone(scale[Math.floor(Math.random() * scale.length)], 0, .5, { type: 'triangle', vol: .045 });
    step++;
  }, 260);
}
export function stopMusic() { clearInterval(musicTimer); musicTimer = null; }

export function muteButton() {
  const b = document.createElement('button');
  b.className = 'mute'; b.type = 'button';
  const draw = () => { b.textContent = muted ? '🔇' : '🔊'; b.setAttribute('aria-label', muted ? 'Sound off. Turn sound on' : 'Sound on. Turn sound off'); b.setAttribute('aria-pressed', String(muted)); };
  b.onclick = () => { muted = !muted; store.set('wa:mute', muted ? '1' : '0'); if (muted) stopMusic(); else { unlockAudio(); sfx.pop(); } draw(); b.dispatchEvent(new CustomEvent('mutechange', { bubbles: true, detail: muted })); };
  draw();
  return b;
}
export const isMuted = () => muted;
