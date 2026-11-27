import { h, CONTEXTS } from '../core/dom.js';
import { islandSvg, FLAGS } from '../core/scene.js';
export const TOP = 5000;
export const rankText = r => (r > TOP ? `${TOP}+` : `#${r}`);
export const emojiImg = (hex, big) => h('img', { class: big ? 'emoji emoji--big' : 'emoji', src: `vendor/openmoji/${hex}.svg`, alt: '' });

// One hint chip: icon + text, or icon + emoji pictures.
export const hintChip = (x, isNew) => h('span', { class: `hint${isNew ? ' new' : ''}` }, x.icon,
  x.emoji ? x.emoji.map(e => emojiImg(e)) : h('span', {}, x.text));
// Renders the hint row; chips beyond `seen` animate in. Returns the new count.
export function renderHints(el, hints = [], seen = 0) {
  el.replaceChildren(...hints.map((x, i) => hintChip(x, i >= seen)));
  return hints.length;
}
// Letter pattern 'K _ M _ _ _' → spans, revealed letters highlighted.
export const letterSpans = text => text.split(' ').map(c => h('span', { class: c === '_' ? '' : 'got' }, c, ' '));

export function revealCard(r, { compact = false } = {}) {
  const isle = h('div', { class: 'float-island', style: `position:relative;width:${compact ? 46 : 22}%;margin:0 auto` });
  isle.innerHTML = islandSvg({ flag: FLAGS[r.context], seed: r.answer.length * 13 + 5, trees: 3 });
  return h('div', { class: 'card stack center pop', style: 'display:flex;flex-direction:column;align-items:center' },
    h('p', { class: 'head muted', style: 'margin:0;font-size:22px' }, `The answer · ${CONTEXTS[r.context] ?? ''}`),
    h('div', { class: 'answer', style: compact ? 'font-size:52px' : '' }, r.answer.toUpperCase()),
    r.winnerName ? h('p', { class: 'head', style: `margin:0;font-size:${compact ? 22 : 34}px;color:var(--coral-dark)` }, `🏆 ${r.winnerName} got it first!`) : null,
    r.emoji ? h('div', { class: 'row center' }, r.emoji.map(e => emojiImg(e, !compact))) : isle,
    h('p', { style: `font-size:${compact ? 18 : 26}px;max-width:960px;margin:0` }, r.culture_note_en),
    h('p', { lang: 'th', class: 'muted', style: `font-size:${compact ? 17 : 24}px;max-width:960px;margin:0` }, r.culture_note_th));
}
