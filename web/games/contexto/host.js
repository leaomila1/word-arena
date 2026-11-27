import { h } from '../../core/dom.js';
import { TOP, revealCard } from '../shared.js';
import { islandSvg } from '../../core/scene.js';
import { sfx } from '../../core/sfx.js';
export const renderReveal = revealCard;

// Each student is a little bird flying from the start island to the mystery island.
// Position = how close their best guess is (log scale). Words are never shown.
const COLORS = ['#FF6B6B', '#FFC83D', '#4CC9F0', '#8B5CF6', '#FF8FC7', '#5BBF4A', '#FF8A5B', '#3AB0A0'];
const bird = c => `<svg viewBox="0 0 40 32" aria-hidden="true"><ellipse cx="18" cy="18" rx="14" ry="11" fill="${c}"/><circle cx="28" cy="12" r="8" fill="${c}"/><circle cx="31" cy="10" r="2.2" fill="#2B2350"/><path d="M35 13 l6 2 -6 2z" fill="#FFB020"/><path d="M8 16 q8 -14 16 0" fill="#fff" opacity=".55"/></svg>`;

export function mount(root, _net, m) {
  const race = h('div', { class: 'race' });
  const start = h('div', { class: 'start float-island' }); start.innerHTML = islandSvg({ seed: 4, trees: 2, waterfall: false, label: 'Start' });
  const goal = h('div', { class: 'goal float-island', style: 'animation-delay:-3s' }); goal.innerHTML = islandSvg({ seed: 9, trees: 3, label: '❓ Secret word' });
  const zones = h('div', { class: 'zones' }, h('span', {}, '☁️ Far'), h('span', {}, '🌤️ Getting warm'), h('span', {}, '☀️ Very close'));
  const flock = h('div');
  race.append(start, goal, zones, flock);
  const stats = h('div', { class: 'row', style: 'justify-content:space-between;font:700 32px var(--font-head)' });
  root.replaceChildren(h('div', { class: 'card stack' }, stats, race));
  const birds = new Map();
  let solvedBefore = 0;
  function update(view) {
    const ps = view.players, solved = ps.filter(p => p.solved).length;
    if (solved > solvedBefore) sfx.correct();
    solvedBefore = solved;
    stats.replaceChildren(h('span', {}, `🐦 ${ps.length} flying`), h('span', {}, `🏝️ ${solved} found it!`));
    ps.forEach((p, i) => {
      let el = birds.get(p.id);
      if (!el) { el = h('div', { class: 'bird' }); el.innerHTML = bird(COLORS[i % COLORS.length]); flock.append(el); birds.set(p.id, el); }
      const x = p.bestRank == null ? 0 : p.solved ? 1 : 1 - Math.log(Math.min(p.bestRank, TOP + 1)) / Math.log(TOP + 1);
      el.style.left = `calc(${(8 + x * 76).toFixed(1)}% )`;
      el.style.top = `${p.solved ? 55 + (i * 23) % 120 : 20 + (i * 37) % 300}px`;
    });
    for (const [id, el] of birds) if (!ps.some(p => p.id === id)) { el.remove(); birds.delete(id); }
  }
  update(m.view);
  return { update: b => update(b.view), unmount() { root.replaceChildren(); } };
}
