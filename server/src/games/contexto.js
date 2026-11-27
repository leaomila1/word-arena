// Guess the Word (Contexto-style). Rank 1 = the answer. Rank data stays on the server.
import { fold } from '../core/text.js';
export const RATE_MS = 1500;
export const FEED_MAX = 40;
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

export function createContexto({ vocabIndex, targets, getRanks }) {
  const byId = new Map(targets.map(t => [t.id, t]));
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
      if (rank === 1) p.solvedAt = nowMs;
      // live feed for the big screen (answer masked)
      r.feed ??= []; r.closest ??= {}; r.seq = (r.seq ?? 0) + 1;
      r.feed.push({ seq: r.seq, id: playerId, word: rank === 1 ? HIDDEN : word, rank });
      if (r.feed.length > FEED_MAX) r.feed.splice(0, r.feed.length - FEED_MAX);
      if (rank !== 1) r.closest[word] = rank;
      return { reply: { word, rank, color: colorFor(rank), label: labelFor(rank) } };
    },

    playerView(r, playerId) {
      const p = r.players[playerId];
      const guesses = (p?.guesses ?? []).slice().sort((a, b) => a.rank - b.rank)
        .map(g => ({ ...g, color: colorFor(g.rank), label: labelFor(g.rank) }));
      return { guesses, best: p?.best ?? null, solved: p?.solvedAt != null, vocabSize: r.vocabSize };
    },

    publicView(r) {
      const closest = Object.entries(r.closest ?? {}).sort((a, b) => a[1] - b[1]).slice(0, 10)
        .map(([word, rank]) => ({ word, rank, color: colorFor(rank) }));
      return {
        vocabSize: r.vocabSize,
        feed: (r.feed ?? []).map(f => ({ ...f, color: colorFor(f.rank) })),
        closest,
        players: Object.entries(r.players).map(([id, p]) => ({ id, bestRank: p.best, solved: p.solvedAt != null })),
      };
    },

    endRound(r) {
      const scores = {};
      for (const [id, p] of Object.entries(r.players)) {
        scores[id] = p.solvedAt != null ? scoreCorrect(Math.floor((p.solvedAt - r.startedAt) / 1000)) : scoreTimeout(p.best);
      }
      const t = byId.get(r.targetId);
      return { scores, reveal: { answer: t.word, context: t.context, culture_note_en: t.culture_note_en, culture_note_th: t.culture_note_th } };
    },
  };
}
