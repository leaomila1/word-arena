// Guess the Word (Contexto-style). Rank 1 = the answer. Rank data stays on the server.
import { fold } from '../core/text.js';
import { progress, open, itemsView, isDouble } from './items.js';
export const BOX_EVERY = 5; // accepted guesses per mystery box
export const RATE_MS = 1500;
export const FEED_MAX = 40;
export const HINT_MS = 30_000;
export const CULTURE = { en: 'English', fr: 'French', ru: 'Russian', ko: 'Korean', zh: 'Chinese' };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const pattern = (w, show) => [...w.toUpperCase()].map((c, i) => (show.includes(i) ? c : '_')).join(' ');
const HIDDEN = '★★★';

const BANDS = [
  [1, 'gold', 'Correct!'],
  [300, 'green', 'Very close'],
  [1500, 'orange', 'Getting warm'],
  [Infinity, 'red', 'Far'],
];
const band = rank => BANDS.find(([max]) => rank <= max);
export const colorFor = rank => band(rank)[1];
const labelFor = rank => band(rank)[2];

export const scoreCorrect = seconds => Math.max(400, 1000 - 3 * seconds);
export const scoreTimeout = bestRank => (bestRank == null ? 0 : Math.max(0, Math.round(400 - bestRank / 5)));

export function createContexto({ vocabIndex, targets, getRanks, meta = {} }) {
  const byId = new Map(targets.map(t => [t.id, t]));
  const vocab = []; for (const [w, i] of vocabIndex) vocab[i] = w;
  const publicLetters = (w, lvl) => (lvl >= 5 ? [0, w.length - 1] : lvl >= 3 ? [0] : []);
  const player = (r, id) => (r.players[id] ??= { best: null, solvedAt: null, last: -Infinity, guesses: [] });

  return {
    id: 'contexto',

    pickContent(context, rng, used = []) {
      const pool = targets.filter(t => context === 'mixed' || t.context === context);
      if (!pool.length) return null;
      const fresh = pool.filter(t => !used.includes(t.id));
      const from = fresh.length ? fresh : pool;
      return from[Math.floor(rng() * from.length)];
    },

    startRound(content, _rng, nowMs) {
      return { targetId: content.id, startedAt: nowMs, vocabSize: vocabIndex.size, players: {}, feed: [], seq: 0, closest: {} };
    },

    onGuess(r, playerId, text, nowMs) {
      const p = player(r, playerId);
      if (p.solvedAt != null) return { reply: { error: 'ALREADY_SOLVED' } };
      if (nowMs - p.last < RATE_MS) return { reply: { error: 'SLOW_DOWN', retryIn: RATE_MS - (nowMs - p.last) } };
      const word = fold(text).replace(/[^a-z]/g, '');
      const idx = vocabIndex.get(word);
      if (idx === undefined) return { reply: { error: 'NOT_IN_LIST', word } }; // not counted (spec §7)
      p.last = nowMs;
      const rank = getRanks(byId.get(r.targetId).word)[idx];
      if (!p.guesses.some(g => g.word === word)) p.guesses.push({ word, rank });
      if (p.best == null || rank < p.best) p.best = rank;
      if (rank === 1) { p.solvedAt = nowMs; r.winnerId ??= playerId; }
      // live feed for the big screen (answer masked)
      r.feed ??= []; r.closest ??= {}; r.seq = (r.seq ?? 0) + 1;
      r.feed.push({ seq: r.seq, id: playerId, word: rank === 1 ? HIDDEN : word, rank });
      if (r.feed.length > FEED_MAX) r.feed.splice(0, r.feed.length - FEED_MAX);
      if (rank !== 1) r.closest[word] = rank;
      const boxes = rank === 1 ? undefined : progress(r, playerId, BOX_EVERY);
      // first correct answer ends the round for everyone (same as Davini)
      return { reply: { word, rank, color: colorFor(rank), label: labelFor(rank), boxes }, endRound: rank === 1 || undefined };
    },

    // Hints unlock every 30 s: category+culture, emoji, first letter, clue, last letter.
    hintLevel(r, nowMs) { return Math.min(5, Math.floor((nowMs - r.startedAt) / HINT_MS)); },
    hints(r, level) {
      const t = byId.get(r.targetId), m = meta[r.targetId], w = t.word;
      const list = [
        { kind: 'category', icon: '🗂️', text: m?.category ? `${cap(m.category)} · ${CULTURE[t.context]}` : CULTURE[t.context] },
        m?.emoji && { kind: 'emoji', icon: '🖼️', emoji: m.emoji },
        { kind: 'letters', icon: '🔤', text: pattern(w, [0]) },
        m?.clue_text && { kind: 'clue', icon: '💡', text: m.clue_text.toUpperCase() },
        { kind: 'letters', icon: '🔤', text: pattern(w, [0, w.length - 1]) },
      ].filter(Boolean);
      return list.slice(0, level);
    },

    // Mystery box: letter / next hint early / a near word / double points. Only the opener sees the result.
    openBox(r, playerId, rng, nowMs) {
      const t = byId.get(r.targetId), w = t.word, lvl = r.hintShown ?? this.hintLevel(r, nowMs);
      const all = this.hints(r, 5);
      const res = open(r, playerId, ['letter', 'nexthint', 'near', 'double'], rng, (item, s) => {
        if (item === 'letter') {
          const shown = new Set([...publicLetters(w, lvl), ...s.letters]);
          const free = [...w].map((_, i) => i).filter(i => !shown.has(i));
          if (free.length <= 1) return null; // never complete the word
          s.letters.push(free[Math.floor(rng() * free.length)]);
          return { text: pattern(w, [...shown, s.letters.at(-1)]) };
        }
        if (item === 'nexthint') return lvl < all.length ? { hint: all[lvl] } : null;
        if (item === 'near') {
          const ranks = getRanks(w), pickIn = (lo, hi) => vocab.filter((v, i) => v && ranks[i] >= lo && ranks[i] <= hi);
          const pool = pickIn(10, 30).length ? pickIn(10, 30) : pickIn(2, 50);
          if (!pool.length) return null;
          const word = pool[Math.floor(rng() * pool.length)];
          return { word, rank: ranks[vocabIndex.get(word)] };
        }
        return {}; // double
      });
      if (res.item) { r.feed ??= []; r.seq = (r.seq ?? 0) + 1; r.feed.push({ seq: r.seq, id: playerId, item: res.item }); if (r.feed.length > FEED_MAX) r.feed.shift(); }
      return res;
    },

    playerView(r, playerId) {
      const p = r.players[playerId];
      const guesses = (p?.guesses ?? []).slice().sort((a, b) => a.rank - b.rank)
        .map(g => ({ ...g, color: colorFor(g.rank), label: labelFor(g.rank) }));
      return { guesses, best: p?.best ?? null, solved: p?.solvedAt != null, vocabSize: r.vocabSize, items: itemsView(r, playerId) };
    },

    publicView(r) {
      const closest = Object.entries(r.closest ?? {}).sort((a, b) => a[1] - b[1]).slice(0, 10)
        .map(([word, rank]) => ({ word, rank, color: colorFor(rank) }));
      return {
        vocabSize: r.vocabSize,
        feed: (r.feed ?? []).map(f => (f.item ? f : { ...f, color: colorFor(f.rank) })),
        closest,
        players: Object.entries(r.players).map(([id, p]) => ({ id, bestRank: p.best, solved: p.solvedAt != null })),
      };
    },

    endRound(r) {
      const scores = {};
      for (const [id, p] of Object.entries(r.players)) {
        scores[id] = p.solvedAt != null ? scoreCorrect(Math.floor((p.solvedAt - r.startedAt) / 1000)) * (isDouble(r, id) ? 2 : 1) : scoreTimeout(p.best);
      }
      const t = byId.get(r.targetId);
      return { scores, reveal: { winnerId: r.winnerId ?? null, answer: t.word, context: t.context, culture_note_en: t.culture_note_en, culture_note_th: t.culture_note_th } };
    },
  };
}
