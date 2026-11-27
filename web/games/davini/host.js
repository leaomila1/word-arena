import { h } from '../../core/dom.js';
import { revealCard, emojiImg, letterSpans } from '../shared.js';
import { blanks } from './player.js';
import { sfx } from '../../core/sfx.js';
export const renderReveal = revealCard;

export function mount(root, _net, m) {
  const v = m.view;
  const tries = h('span', {}, '');
  const slots = h('div', { class: 'blanks' }, blanks(v.letters));
  root.replaceChildren(
    h('div', { class: 'card stack center', style: 'display:flex;flex-direction:column;align-items:center' },
      h('h3', { style: 'margin:0;font-size:34px' }, '🗝️ What is the word?'),
      h('div', { class: 'row center', style: 'gap:28px' }, v.emoji.map(e => emojiImg(e, true))),
      h('p', { class: 'head', style: 'margin:0;font-size:40px' }, `Clue: ${v.clue}`),
      slots,
      h('p', { style: 'margin:0;font:700 28px var(--font-head);color:#9A5B00' }, '⚡ First correct answer wins!')),
    h('div', { class: 'card center row', style: 'font:700 34px var(--font-head)' }, tries));
  let before = 0;
  const update = view => {
    if (view.players > before) sfx.guess();
    before = view.players;
    tries.textContent = `✋ ${view.players} ${view.players === 1 ? 'student has' : 'students have'} tried`;
  };
  update(v);
  const hint = list => { const l = list?.find(x => x.kind === 'letters'); if (l) slots.replaceChildren(...letterSpans(l.text)); };
  hint(m.hints);
  return { update: b => update(b.view), hint, unmount() { root.replaceChildren(); } };
}
