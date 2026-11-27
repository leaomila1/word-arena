import { h } from '../../core/dom.js';
import { emojiImg } from '../shared.js';
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
  const puzzle = h('div', { class: 'card stack center pop', style: 'display:flex;flex-direction:column;align-items:center' },
    h('h3', { style: 'margin:0' }, '🗝️ What is the word?'),
    h('div', { class: 'row center' }, v.emoji.map(e => emojiImg(e))),
    h('p', { class: 'head', style: 'margin:0;font-size:22px' }, `Clue: ${v.clue}`),
    h('div', { class: 'blanks', style: 'font-size:32px', 'aria-label': `${v.letters} letters` }, blanks(v.letters)),
    h('p', { style: 'margin:0;font-weight:700;color:#9A5B00' }, '⚡ Be the first to answer!'));
  root.replaceChildren(puzzle, form); input.focus();
  return {
    update(r) {
      if (r.error) {
        msg.className = 'msg msg--err';
        msg.textContent = r.error === 'SLOW_DOWN' ? 'Wait a moment before trying again…' : r.error === 'WRONG' ? 'Not quite. Try again!' : '';
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); sfx.wrong(); return;
      }
      if (r.stage === 'solved') { form.hidden = true; puzzle.replaceChildren(h('h2', { style: 'font-size:42px;margin:0' }, '🏆 You got it first!')); sfx.correct(); confetti(); }
    },
    unmount() { root.replaceChildren(); },
  };
}
