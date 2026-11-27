// Davini: look at 3 emoji + a short clue, type the word. The first correct answer ends the round.
import { fold } from '../core/text.js';
import { scoreCorrect } from './contexto.js';

export const RATE_MS = 2000;

const norm = s => fold(s).replace(/[^a-z]+/g, ' ').trim();

export function createDavini({ puzzles }) {
  const byId = new Map(puzzles.map(p => [p.id, p]));
  const player = (r, id) => (r.players[id] ??= { last: -Infinity });

  return {
    id: 'davini',

    pickContent(context, rng, used = []) {
      const pool = puzzles.filter(p => context === 'mixed' || p.context === context);
      if (!pool.length) return null;
      const fresh = pool.filter(p => !used.includes(p.id));
      const from = fresh.length ? fresh : pool;
      return from[Math.floor(rng() * from.length)];
    },

    startRound(content, _rng, nowMs) {
      return { puzzleId: content.id, startedAt: nowMs, winnerId: null, solvedAt: null, players: {} };
    },

    onGuess(r, playerId, text, nowMs) {
      if (r.winnerId) return { reply: { error: 'ALREADY_SOLVED' } };
      const p = player(r, playerId);
      if (nowMs - p.last < RATE_MS) return { reply: { error: 'SLOW_DOWN', retryIn: RATE_MS - (nowMs - p.last) } };
      p.last = nowMs;
      if (norm(text) === norm(byId.get(r.puzzleId).answer)) {
        r.winnerId = playerId; r.solvedAt = nowMs;
        return { reply: { stage: 'solved' }, endRound: true };
      }
      return { reply: { error: 'WRONG' } };
    },

    playerView(r) {
      const pz = byId.get(r.puzzleId);
      return { emoji: pz.emoji, clue: pz.clue_text.toUpperCase(), letters: pz.answer.length };
    },

    publicView(r) {
      const pz = byId.get(r.puzzleId);
      return { emoji: pz.emoji, clue: pz.clue_text.toUpperCase(), letters: pz.answer.length, players: Object.keys(r.players).length };
    },

    endRound(r) {
      const scores = Object.fromEntries(Object.keys(r.players).map(id => [id, 0]));
      if (r.winnerId) scores[r.winnerId] = scoreCorrect(Math.floor((r.solvedAt - r.startedAt) / 1000));
      const pz = byId.get(r.puzzleId);
      return { scores, reveal: { answer: pz.answer, clue: pz.clue_text.toUpperCase(), emoji: pz.emoji, context: pz.context, culture_note_en: pz.culture_note_en, culture_note_th: pz.culture_note_th, winnerId: r.winnerId } };
    },
  };
}
