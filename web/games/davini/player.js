import { h } from '../../core/dom.js';
import { emojiImg } from '../shared.js';
import { sfx } from '../../core/sfx.js';
import { confetti } from '../../core/scene.js';

// Cipher as stone tablets: symbol on top, decoded letter (if given in the key) underneath.
export function cipherView(cipher, key, size = 34) {
  const rev = new Map(Object.entries(key).map(([l, s]) => [s, l]));
  const words = cipher.join('').split(' ').map(w => [...w]);
  return h('div', { class: 'row center', style: 'gap:22px' }, words.map(w =>
    h('div', { class: 'row', style: 'gap:6px;flex-wrap:nowrap' }, w.map(s =>
      h('div', { class: 'tablet', style: `font-size:${size}px` }, h('span', {}, s), h('b', { style: `font-size:${Math.round(size * .62)}px` }, rev.get(s) ?? ''))))));
}
export function keyView(key) {
  return h('div', { class: 'chips center' }, Object.entries(key).sort().map(([l, s]) => h('span', { class: 'chip', style: 'padding:6px 16px;animation:none' }, `${s} = ${l}`)));
}

export function mount(root, net, m) {
  let v = m.view;
  const input = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', maxlength: 40, 'aria-label': 'Your answer' });
  const msg = h('p', { class: 'msg', role: 'status' });
  const stage = h('div', { class: 'stack' });
  const form = h('form', { class: 'card stack' }, h('div', { class: 'row', style: 'flex-wrap:nowrap' }, input, h('button', { class: 'btn btn--go', type: 'submit' }, 'Go')), msg);
  form.onsubmit = e => {
    e.preventDefault();
    const t = input.value.trim(); if (!t) return;
    if (net.send({ type: 'guess', text: t })) input.value = '';
    else { msg.className = 'msg msg--err'; msg.textContent = 'Connection lost — try again in a moment.'; }
  };
  const draw = () => {
    if (v.solved) { stage.replaceChildren(h('div', { class: 'card stack center pop', style: 'display:flex;flex-direction:column' }, h('h2', { style: 'font-size:42px;margin:0' }, 'Solved! 🎉'), h('p', { class: 'muted', style: 'margin:0' }, 'Wait for the round to end.'))); form.hidden = true; return; }
    if (!v.decoded) {
      stage.replaceChildren(h('div', { class: 'card stack' }, h('h3', { style: 'margin:0' }, '🗝️ 1. Break the code'), cipherView(v.cipher, v.shownKey),
        h('p', { class: 'muted', style: 'margin:0' }, 'Some symbols are given. Work out the rest and type the hidden clue.'), keyView(v.shownKey),
        h('p', { style: 'margin:0;font-weight:700;color:#9A5B00' }, '⭐ Know the answer already? Type it now for a ×1.2 bonus!')));
      input.placeholder = 'Clue or answer';
    } else {
      stage.replaceChildren(h('div', { class: 'card stack center pop', style: 'display:flex;flex-direction:column;align-items:center' }, h('h3', { style: 'margin:0' }, `🔓 2. Clue: ${v.clue}`), h('div', { class: 'row center' }, v.emoji.map(e => emojiImg(e))), h('p', { class: 'muted', style: 'margin:0' }, 'What is the word?')));
      input.placeholder = 'Answer';
    }
  };
  root.replaceChildren(stage, form); draw(); input.focus();
  return {
    update(r) {
      if (r.error) {
        msg.className = 'msg msg--err'; msg.textContent = r.error === 'SLOW_DOWN' ? 'Wait a moment before trying again…' : r.error === 'WRONG' ? 'Not quite. Try again!' : '';
        form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake'); sfx.wrong(); return;
      }
      msg.textContent = '';
      if (r.stage === 'decoded') { v = { ...v, decoded: true, clue: r.clue, emoji: r.emoji }; sfx.unlock(); }
      if (r.stage === 'solved') { v = { ...v, solved: true }; sfx.correct(); confetti(); }
      draw();
    },
    unmount() { root.replaceChildren(); },
  };
}
