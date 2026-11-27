import { h } from '../../core/dom.js';
import { emojiImg, letterSpans, mysteryBox, mergePatterns } from '../shared.js';
import { vibrate } from '../../core/fx.js';
import { sfx } from '../../core/sfx.js';
import { confetti } from '../../core/scene.js';

// Davini (one step): 3 emoji + a short clue → type the word. First correct answer wins and ends the round.
export const blanks = n => '_ '.repeat(n).trim();

export function mount(root, net, m) {
  const v = m.view;
  const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: 40, 'aria-label': 'Your answer', placeholder: 'Answer' });
  const msg = h('p', { class: 'msg', role: 'status' });
  const form = h('form', { class: 'card stack' }, h('div', { class: 'row', style: 'flex-wrap:nowrap' }, input, h('button', { class: 'btn btn--go', type: 'submit' }, 'Go')), msg);
  form.onsubmit = e => {
    e.preventDefault();
    const t = input.value.trim(); if (!t) return;
    if (net.send({ type: 'guess', text: t })) input.value = '';
    else { msg.className = 'msg msg--err'; msg.textContent = 'Connection lost — try again in a moment.'; }
  };
  const slots = h('div', { class: 'blanks', style: 'font-size:32px', 'aria-label': `${v.letters} letters` }, blanks(v.letters));
  const puzzle = h('div', { class: 'card stack center pop', style: 'display:flex;flex-direction:column;align-items:center' },
    h('h3', { style: 'margin:0' }, '🗝️ What is the word?'),
    h('div', { class: 'row center' }, v.emoji.map(e => emojiImg(e))),
    h('p', { class: 'head', style: 'margin:0;font-size:22px' }, `Clue: ${v.clue}`),
    slots,
    h('p', { style: 'margin:0;font-weight:700;color:#9A5B00' }, '⚡ Be the first to answer!'));
  let pub = null, mine = null;
  const draw = () => { const t = mergePatterns(pub, mine); if (t) slots.replaceChildren(...letterSpans(t)); };
  const box = mysteryBox(net, v.items, { onLetters: t => { mine = mergePatterns(mine, t); draw(); } });
  for (const g of v.items?.got ?? []) if (g.item === 'letter') mine = mergePatterns(mine, g.text);
  root.replaceChildren(puzzle, form, box.el); input.focus();
  const hint = list => { const l = list?.find(x => x.kind === 'letters'); if (l) pub = l.text; draw(); };
  hint(m.hints);
  return {
    hint,
    item: r => box.got(r),
    update(r) {
      if (r.error) {
        msg.className = 'msg msg--err';
        msg.textContent = r.error === 'SLOW_DOWN' ? 'Wait a moment before trying again…' : r.error === 'WRONG' ? 'Not quite. Try again!' : r.error === 'PAUSED' ? '⏸ Paused — wait for your teacher.' : '';
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); sfx.wrong(); vibrate(80); if (r.boxes) { box.set(r.boxes); box.gotBox(); sfx.unlock(); } return;
      }
      if (r.stage === 'solved') { form.hidden = true; puzzle.replaceChildren(h('h2', { style: 'font-size:42px;margin:0' }, '🏆 You got it first!')); sfx.correct(); confetti(); vibrate([100, 60, 200]); }
    },
    unmount() { root.replaceChildren(); },
  };
}
