// Game registry. Each module: { id, pickContent(context, rng, usedIds), startRound(content, rng, nowMs),
// onGuess(round, playerId, text, nowMs) -> {reply}, playerView(round, playerId), publicView(round),
// endRound(round, nowMs) -> {scores, reveal} }. Round state must be JSON-serialisable.
// To add a game: write src/games/<id>.js with this interface and add it to `list`.
import { createContexto } from './contexto.js';
import { createDavini } from './davini.js';
import * as contextoData from '../../data/contexto-data.js';
import * as davini from '../../data/davini-data.js';

// Contexto hints reuse each word's emoji, clue and category from the Davini puzzle data (same ids).
const meta = Object.fromEntries(davini.puzzles.map(p => [p.id, { category: p.category, emoji: p.emoji, clue_text: p.clue_text }]));
const list = [createContexto({ ...contextoData, meta }), createDavini(davini)];
export const games = Object.fromEntries(list.map(g => [g.id, g]));
