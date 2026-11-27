// Davini: decode a symbol cipher → unlock 3 emoji → type the answer. Skipping the decode pays ×1.2.
import { encode } from './cipher.js';
import { fold } from '../core/text.js';
import { scoreCorrect } from './contexto.js';

export const RATE_MS = 3000;
export const SKIP_MULT = 1.2;
export const DECODED_ONLY = 200;

const norm = s => fold(s).replace(/[^a-z]+/g, ' ').trim();

export function createDavini({ puzzles }) {
  const byId = new Map(puzzles.map(p => [p.id, p]));
  const player = (r, id) => (r.players[id] ??= { decodedAt: null, solvedAt: null, skipped: false, last: -Infinity });

  return {
    id: 'davini',

    pickContent(context, rng, used = []) {
      const pool = puzzles.filter(p => context === 'mixed' || p.context === context);
      if (!pool.length) return null;
      const fresh = pool.filter(p => !used.includes(p.id));
      const from = fresh.length ? fresh : pool;
      return from[Math.floor(rng() * from.length)];
    },

    startRound(content, rng, nowMs) {
      const { cipher, shownKey } = encode(content.clue_text, rng);
      return { puzzleId: content.id, startedAt: nowMs, cipher, shownKey: Object.fromEntries(shownKey), players: {} };
    },

    onGuess(r, playerId, text, nowMs) {
      const p = player(r, playerId);
      const pz = byId.get(r.puzzleId);
      if (p.solvedAt != null) return { reply: { error: 'ALREADY_SOLVED' } };
      if (nowMs - p.last < RATE_MS) return { reply: { error: 'SLOW_DOWN', retryIn: RATE_MS - (nowMs - p.last) } };
      p.last = nowMs;
      const t = norm(text);
      if (t === norm(pz.answer)) {
        p.solvedAt = nowMs;
        p.skipped = p.decodedAt == null;
        return { reply: { stage: 'solved', skipped: p.skipped } };
      }
      if (p.decodedAt == null && t === norm(pz.clue_text)) {
        p.decodedAt = nowMs;
        return { reply: { stage: 'decoded', clue: pz.clue_text.toUpperCase(), emoji: pz.emoji } };
      }
      return { reply: { error: 'WRONG', stage: p.decodedAt == null ? 'cipher' : 'answer' } };
    },

    playerView(r, playerId) {
      const p = r.players[playerId];
      const pz = byId.get(r.puzzleId);
      const v = { cipher: r.cipher, shownKey: r.shownKey, decoded: p?.decodedAt != null, solved: p?.solvedAt != null };
      if (v.decoded || v.solved) { v.emoji = pz.emoji; v.clue = pz.clue_text.toUpperCase(); }
      return v;
    },

    publicView(r) {
      const ps = Object.values(r.players);
      return { cipher: r.cipher, shownKey: r.shownKey, decoded: ps.filter(p => p.decodedAt != null).length, solved: ps.filter(p => p.solvedAt != null).length, players: ps.length };
    },

    endRound(r) {
      const scores = {};
      for (const [id, p] of Object.entries(r.players)) {
        if (p.solvedAt != null) {
          const base = scoreCorrect(Math.floor((p.solvedAt - r.startedAt) / 1000));
          scores[id] = p.skipped ? Math.round(base * SKIP_MULT) : base;
        } else scores[id] = p.decodedAt != null ? DECODED_ONLY : 0;
      }
      const pz = byId.get(r.puzzleId);
      return { scores, reveal: { answer: pz.answer, clue: pz.clue_text.toUpperCase(), emoji: pz.emoji, context: pz.context, culture_note_en: pz.culture_note_en, culture_note_th: pz.culture_note_th } };
    },
  };
}
