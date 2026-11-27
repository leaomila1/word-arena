import { h, CONTEXTS } from '../core/dom.js';
import { islandSvg, FLAGS } from '../core/scene.js';
export const TOP = 5000;
export const rankText = r => (r > TOP ? `${TOP}+` : `#${r}`);
export const emojiImg = (hex, big) => h('img', { class: big ? 'emoji emoji--big' : 'emoji', src: `vendor/openmoji/${hex}.svg`, alt: '' });

// One hint chip: icon + text, or icon + emoji pictures.
export const hintChip = (x, isNew) => h('span', { class: `hint${isNew ? ' new' : ''}` },
  x.emoji ? x.emoji.map(e => emojiImg(e)) : h('span', {}, x.text));
// Renders the hint row; chips beyond `seen` animate in. Returns the new count.
export function renderHints(el, hints = [], seen = 0) {
  el.replaceChildren(...hints.map((x, i) => hintChip(x, i >= seen)));
  return hints.length;
}
// Letter pattern 'K _ M _ _ _' → spans, revealed letters highlighted.
export const letterSpans = text => text.split(' ').map(c => h('span', { class: c === '_' ? '' : 'got' }, c, ' '));

// Merge two letter patterns ('K _ _ C _ _' + '_ I _ _ _ _' → 'K I _ C _ _').
export const mergePatterns = (a, b) => { if (!a) return b; if (!b) return a; const x = a.split(' '), y = b.split(' '); return x.map((c, i) => (c === '_' ? y[i] ?? '_' : c)).join(' '); };

// 🎁 Mystery box for the phone. set(n) = unopened boxes; got(res) = an item just opened (spins first).
export const ITEM_TEXT = {
  letter: r => ['Secret letter: ', h('b', { class: 'mono' }, r.text)],
  nexthint: r => ['Next hint early: ', hintChip(r.hint)],
  near: r => ['A close word: ', h('b', {}, r.word), ` ${rankText(r.rank)}`],
  double: () => ['Double points if you get it right!'],
};
const SPIN = ['🔤', '⏩', '🎯', '✖️2'];
export function mysteryBox(net, view = {}, { onLetters } = {}) {
  const btn = h('button', { class: 'gift', type: 'button', hidden: '' });
  const list = h('div', { class: 'items' });
  const el = h('div', { class: 'stack', style: 'gap:8px' }, btn, list);
  let n = 0, spinning = false;
  const set = k => { n = k ?? n; btn.hidden = n <= 0 || spinning; btn.textContent = n > 1 ? `🎁 Open box (${n})` : '🎁 Open box'; };
  const row = r => h('div', { class: 'item-card' }, h('span', { class: 'item-icon' }, r.icon), h('span', {}, ...ITEM_TEXT[r.item](r)));
  btn.onclick = () => { if (net.send({ type: 'open' })) { spinning = true; btn.hidden = true; } };
  (view.got ?? []).forEach(r => list.prepend(row(r)));
  set(view.boxes ?? 0);
  return {
    el, set,
    gotBox() { set(); btn.classList.remove('bounce'); void btn.offsetWidth; btn.classList.add('bounce'); },
    got(r) {
      if (r.error) { spinning = false; set(r.boxes ?? 0); return; }
      const wheel = h('div', { class: 'item-card spin' }, h('span', { class: 'item-icon' }, '🎁'), h('span', {}, 'Opening…'));
      list.prepend(wheel);
      let i = 0; const t = setInterval(() => { wheel.firstChild.textContent = SPIN[i++ % SPIN.length]; }, 90);
      setTimeout(() => { clearInterval(t); wheel.replaceWith(row(r)); spinning = false; set(r.boxes); if (r.item === 'letter') onLetters?.(r.text); }, 1300);
    },
  };
}

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
