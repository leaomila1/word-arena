import { h } from '../../core/dom.js';
import { revealCard } from '../shared.js';
import { cipherView, keyView } from './player.js';
import { sfx } from '../../core/sfx.js';
export const renderReveal = revealCard;

export function mount(root, _net, m) {
  const stats = h('div', { class: 'row', style: 'justify-content:space-around;font:700 36px var(--font-head)' });
  root.replaceChildren(
    h('div', { class: 'card stack center', style: 'display:flex;flex-direction:column;align-items:center' }, h('h3', { style: 'margin:0;font-size:30px' }, '🗝️ Crack the code!'), cipherView(m.view.cipher, m.view.shownKey, 76), keyView(m.view.shownKey)),
    h('div', { class: 'card' }, stats));
  let before = { decoded: 0, solved: 0 };
  const update = v => {
    if (v.solved > before.solved) sfx.correct(); else if (v.decoded > before.decoded) sfx.unlock();
    before = v;
    stats.replaceChildren(h('span', {}, `🔓 ${v.decoded} cracked the code`), h('span', {}, `🏆 ${v.solved} solved`), h('span', {}, `✋ ${v.players} tried`));
  };
  update(m.view);
  return { update: b => update(b.view), unmount() { root.replaceChildren(); } };
}
