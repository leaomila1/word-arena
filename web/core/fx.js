// Suspense effects shared by every game and both screens: 3-2-1 countdown, last-30-seconds tension,
// big final countdown, banners, drumroll before the reveal, and phone vibration.
import { h } from './dom.js';
import { sfx } from './sfx.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const vibrate = p => { try { navigator.vibrate?.(p); } catch {} }; // Android only; iPhone ignores it

function overlay(cls) { const o = h('div', { class: `fx-overlay ${cls}`, 'aria-hidden': 'true' }); document.body.append(o); return o; }
const wait = ms => new Promise(r => setTimeout(r, ms));

// Full-screen 3 · 2 · 1 · GO! Resolves after about 3.2 s.
export async function countdown() {
  const o = overlay('fx-count');
  for (const n of ['3', '2', '1', 'GO!']) {
    o.replaceChildren(h('span', { class: n === 'GO!' ? 'go' : '' }, n));
    n === 'GO!' ? (sfx.drum(true), sfx.start(), vibrate(120)) : (sfx.drum(), vibrate(40));
    await wait(n === 'GO!' ? 650 : 800);
  }
  o.remove();
}

// Call every second with seconds left. heartbeat=true on the big screen only (40 phones beating is too much).
let big = null;
export function tension(s, { heartbeat = false } = {}) {
  const b = document.body;
  b.classList.toggle('fx-tense', s <= 30 && s > 10);
  b.classList.toggle('fx-critical', s <= 10 && s > 0);
  if (heartbeat && s <= 30 && s > 10 && s % 2 === 0) sfx.heartbeat();
  if (s <= 10 && s > 0) {
    big ??= overlay('fx-big');
    big.replaceChildren(h('span', {}, String(s)));
    if (s <= 3) vibrate(60);
  } else { big?.remove(); big = null; }
}
export function calm() { document.body.classList.remove('fx-tense', 'fx-critical'); big?.remove(); big = null; document.querySelectorAll('.fx-overlay').forEach(o => o.remove()); }

// Banner that slides in from the top for a few seconds.
export function banner(content, { tone = 'hint', ms = 3500, sound = 'whoosh' } = {}) {
  document.querySelector(`.fx-banner--${tone}`)?.remove();
  const el = h('div', { class: `fx-banner fx-banner--${tone}`, role: 'status' }, content);
  document.body.append(el);
  sfx[sound]?.();
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 500);
}

// "And the answer is…" with a drumroll, then resolves so the caller can show the reveal.
export async function drumroll(sec = 1.8) {
  calm();
  const o = overlay('fx-roll');
  o.append(h('span', {}, 'And the answer is…'));
  sfx.drumroll(sec);
  await wait(reduce ? 400 : sec * 1000);
  o.remove();
}
