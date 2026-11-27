import { h } from '../../core/dom.js';
import { rankText, renderHints } from '../shared.js';
import { vibrate } from '../../core/fx.js';
import { sfx, guessSound } from '../../core/sfx.js';
import { confetti } from '../../core/scene.js';

const ERR = { NOT_IN_LIST: w => `“${w}” is not in our word list. Try another word.`, SLOW_DOWN: () => 'Slow down a little…', ALREADY_SOLVED: () => 'You already found it! 🎉', PAUSED: () => '⏸ Paused — wait for your teacher.' };

export function mount(root, net, m) {
  const guesses = new Map(m.view.guesses.map(g => [g.word, g]));
  const input = h('input', { id: 'guess', type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: 40, 'aria-label': 'Your guess', placeholder: 'A word…' });
  const btn = h('button', { class: 'btn btn--go', type: 'submit' }, 'Go');
  const msg = h('p', { class: 'msg', role: 'status' });
  const latest = h('div', { 'aria-live': 'polite' });
  const list = h('div', { class: 'stack', style: 'max-height:52vh;overflow:auto' });
  const hints = h('div', { class: 'hints', 'aria-live': 'polite' });
  const form = h('form', { class: 'card stack' },
    h('p', { style: 'margin:0;font-weight:600' }, '🔮 Guess the secret word. Closer meaning = smaller number. First to find it wins!'), hints,
    h('div', { class: 'row', style: 'flex-wrap:nowrap' }, input, btn), msg, latest);
  const row = g => h('div', { class: `band band--${g.color}` }, h('span', {}, g.word), h('span', {}, `${rankText(g.rank)} · ${g.label}`));
  const draw = () => list.replaceChildren(...[...guesses.values()].sort((a, b) => a.rank - b.rank).map(row));
  const solvedView = () => { input.disabled = true; btn.disabled = true; msg.className = 'msg'; msg.textContent = '🏆 You found it first!'; };
  form.onsubmit = e => {
    e.preventDefault();
    const t = input.value.trim(); if (!t) return;
    if (net.send({ type: 'guess', text: t })) input.value = '';
    else { msg.className = 'msg msg--err'; msg.textContent = 'Connection lost — your word is kept. Try again in a moment.'; }
    input.focus();
  };
  root.replaceChildren(form, h('div', { class: 'card stack' }, h('h3', { style: 'margin:0' }, 'Your guesses'), list));
  draw(); if (m.view.solved) solvedView(); else input.focus();
  let hintSeen = renderHints(hints, m.hints, m.hints?.length ?? 0);
  return {
    hint(list) { hintSeen = renderHints(hints, list, hintSeen); },
    update(r) {
      if (r.error) { msg.className = 'msg msg--err'; msg.textContent = (ERR[r.error] ?? (() => r.error))(r.word); form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); sfx.wrong(); vibrate(80); return; }
      msg.className = 'msg'; msg.textContent = '';
      guesses.set(r.word, r); draw();
      latest.replaceChildren(h('p', { class: 'muted', style: 'margin:0' }, 'Latest:'), row(r));
      guessSound(r.color);
      if (r.rank === 1) { solvedView(); confetti(); vibrate([100, 60, 200]); }
    },
    unmount() { root.replaceChildren(); },
  };
}
