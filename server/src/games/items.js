// Mystery boxes shared by every game. Each game decides what earns a box and which items it offers;
// this module keeps the per-player bookkeeping inside the round state (JSON-serialisable).
export const BOX_MAX = 2;
export const ITEM_INFO = { letter: '🔤', nexthint: '⏩', near: '🎯', double: '✖️2' };

const slot = (r, id) => ((r.items ??= {})[id] ??= { progress: 0, given: 0, opened: 0, got: [], letters: [], double: false });

// Count one qualifying action; returns the number of unopened boxes if a new one was just earned.
export function progress(r, id, every) {
  const s = slot(r, id);
  s.progress++;
  const earned = Math.min(BOX_MAX, Math.floor(s.progress / every));
  if (earned > s.given) { s.given = earned; return s.given - s.opened; }
  return undefined;
}

// Pick an item this player has not had yet this round from the pool of usable ones, then let `apply` fill in its payload.
// Items whose apply() returns null are skipped (e.g. no letter left to reveal).
export function open(r, id, pool, rng, apply) {
  const s = slot(r, id);
  if (s.given - s.opened <= 0) return { error: 'NO_BOX' };
  let choices = pool.filter(it => !s.got.some(g => g.item === it));
  if (!choices.length) choices = pool.slice();
  while (choices.length) {
    const i = Math.min(choices.length - 1, Math.floor(rng() * choices.length)), item = choices[i];
    const payload = apply(item, s);
    if (payload) {
      s.opened++;
      const res = { item, icon: ITEM_INFO[item], ...payload, boxes: s.given - s.opened };
      s.got.push(res);
      if (item === 'double') s.double = true;
      return res;
    }
    choices.splice(i, 1);
  }
  return { error: 'NO_ITEM' };
}

export const itemsView = (r, id) => { const s = r.items?.[id]; return { boxes: s ? s.given - s.opened : 0, got: s?.got ?? [] }; };
export const isDouble = (r, id) => !!r.items?.[id]?.double;

// 'K _ M _ _ _' from a word and a set of shown positions
export const pattern = (w, show) => [...w.toUpperCase()].map((c, i) => (show.includes(i) ? c : '_')).join(' ');
