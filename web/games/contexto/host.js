import { h } from '../../core/dom.js';
import { TOP, revealCard, rankText } from '../shared.js';
import { islandSvg, confetti } from '../../core/scene.js';
import { sfx, guessSound } from '../../core/sfx.js';
import { banner } from '../../core/fx.js';
import { renderHints } from '../shared.js';
export const renderReveal = revealCard;

// Big screen: race track (birds) + live feed of every guess (name, word, rank) + closest words of the whole room.
const COLORS = ['#FF6B6B', '#FFC83D', '#4CC9F0', '#8B5CF6', '#FF8FC7', '#5BBF4A', '#FF8A5B', '#3AB0A0'];
const bird = c => `<svg viewBox="0 0 40 32" aria-hidden="true"><ellipse cx="18" cy="18" rx="14" ry="11" fill="${c}"/><circle cx="28" cy="12" r="8" fill="${c}"/><circle cx="31" cy="10" r="2.2" fill="#2B2350"/><path d="M35 13 l6 2 -6 2z" fill="#FFB020"/><path d="M8 16 q8 -14 16 0" fill="#fff" opacity=".55"/></svg>`;
const ORDER = { gold: 0, green: 1, orange: 2, red: 3 };

export function mount(root, _net, m, ctx = { nameOf: () => '?' }) {
  const race = h('div', { class: 'race' });
  const start = h('div', { class: 'start float-island' }); start.innerHTML = islandSvg({ seed: 4, trees: 2, waterfall: false, label: 'Start' });
  const goal = h('div', { class: 'goal float-island', style: 'animation-delay:-3s' }); goal.innerHTML = islandSvg({ seed: 9, trees: 3, label: '❓ Secret' });
  const flock = h('div');
  race.append(start, goal, flock);
  const stats = h('div', { class: 'row', style: 'justify-content:space-between;font:700 28px var(--font-head)' });
  const feed = h('div', { class: 'feed', 'aria-live': 'polite' });
  const closest = h('div', { class: 'stack closest', style: 'gap:8px' });
  const hints = h('div', { class: 'hints', style: 'font-size:26px' });
  root.replaceChildren(h('div', { class: 'card', style: 'padding:12px 18px' }, h('div', { class: 'row', style: 'gap:12px;align-items:center' }, h('b', { style: 'font:700 26px var(--font-head)' }, '💡 Hints'), hints, h('span', { class: 'hint-next', 'data-empty': '' }, 'A new hint every 30 seconds'))), h('div', { class: 'ctx-grid' },
    h('div', { class: 'card stack race-card' }, stats, race),
    h('div', { class: 'card stack' }, h('h3', { style: 'margin:0;font-size:28px' }, '💬 Live guesses'), feed),
    h('div', { class: 'card stack' }, h('h3', { style: 'margin:0;font-size:28px' }, '🎯 Closest so far'), closest)));

  const birds = new Map();
  let lastSeq = 0, solvedBefore = 0, first = true, bestRoom = Infinity, hintSeen = 0, lastHot = 0;
  function update(view) {
    const ps = view.players, solved = ps.filter(p => p.solved).length;
    stats.replaceChildren(h('span', {}, `🐦 ${ps.length} flying`), h('span', {}, `🏝️ ${solved} found it!`));
    ps.forEach((p, i) => {
      let el = birds.get(p.id);
      if (!el) { el = h('div', { class: 'bird', title: ctx.nameOf(p.id) }); el.innerHTML = bird(COLORS[i % COLORS.length]); flock.append(el); birds.set(p.id, el); }
      const x = p.bestRank == null ? 0 : p.solved ? 1 : 1 - Math.log(Math.min(p.bestRank, TOP + 1)) / Math.log(TOP + 1);
      el.style.left = `${(8 + x * 76).toFixed(1)}%`;
      el.style.top = `${p.solved ? 70 + (i * 23) % 140 : 20 + (i * 37) % 360}px`;
    });
    for (const [id, el] of birds) if (!ps.some(p => p.id === id)) { el.remove(); birds.delete(id); }

    // live feed: newest on top
    const fresh = (view.feed ?? []).filter(f => f.seq > lastSeq);
    if (fresh.length) lastSeq = fresh.at(-1).seq;
    feed.replaceChildren(...(view.feed ?? []).slice(-14).reverse().map(f =>
      h('div', { class: `band band--${f.color}${fresh.includes(f) ? ' pop' : ''}` },
        h('span', {}, h('span', { class: 'who' }, `${ctx.nameOf(f.id)}:`), f.word), h('span', {}, rankText(f.rank)))));
    closest.replaceChildren(...(view.closest ?? []).map((c, i) =>
      h('div', { class: `band band--${c.color}` }, h('span', {}, `${i + 1}. ${c.word}`), h('span', {}, rankText(c.rank)))));
    if (!view.closest?.length) closest.append(h('p', { class: 'muted', style: 'margin:0' }, 'Waiting for the first guess…'));

    // sounds: one per batch, the closest colour wins; fanfare when someone finds it
    if (!first && fresh.length) {
      if (solved > solvedBefore) { sfx.correct(); confetti(40); }
      else { const best = fresh.map(f => f.color).sort((a, b) => ORDER[a] - ORDER[b])[0]; best === 'red' ? sfx.guess() : guessSound(best); }
    }
    // "X is getting closer!" when someone beats the room's best (not the answer itself), at most every 4 s
    for (const f of fresh) if (f.rank > 1 && f.rank < bestRoom) {
      const was = bestRoom; bestRoom = f.rank;
      if (!first && was !== Infinity && f.rank <= 1500 && Date.now() - lastHot > 4000) { lastHot = Date.now(); banner(`🔥 ${ctx.nameOf(f.id)} is getting closer! ${rankText(f.rank)}`, { tone: 'hot', ms: 2600 }); }
    }
    solvedBefore = solved; first = false;
  }
  update(m.view);
  const hint = list => { hintSeen = renderHints(hints, list, hintSeen); root.querySelector('[data-empty]').hidden = list.length > 0; };
  hint(m.hints); hintSeen = m.hints?.length ?? 0;
  return { update: b => update(b.view), hint, unmount() { root.replaceChildren(); } };
}
