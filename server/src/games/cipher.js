// Letter → symbol substitution with a partial key (about 60% of letters shown).
export const SYMBOLS = [...'★▲●◆■♣♠♥♦☀☂☁☾☯✿❀✦✚✖✱❖⬟⬢⬣◐◑◒◓⊕⊗⊙⌘⚑⚓⚡❄☘♪♫⌂⧫⬤▼◀▶'];
export const KEY_SHARE = 0.6;

// Small deterministic PRNG for tests (mulberry32).
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function encode(clueText, rng) {
  const text = clueText.toUpperCase().replace(/\s+/g, ' ').trim();
  const letters = [...new Set(text.replace(/[^A-Z]/g, ''))];
  const symbols = shuffle(SYMBOLS, rng);
  const fullKey = new Map(letters.map((l, i) => [l, symbols[i]]));
  const shownLetters = shuffle(letters, rng).slice(0, Math.round(KEY_SHARE * letters.length));
  const shownKey = new Map(shownLetters.map(l => [l, fullKey.get(l)]));
  const cipher = [...text].map(c => (c === ' ' ? ' ' : fullKey.get(c) ?? c));
  return { cipher, fullKey, shownKey };
}
