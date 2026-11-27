// Game registry. Each module: { id, pickContent(context, rng, usedIds), startRound(content, rng, nowMs),
// onGuess(round, playerId, text, nowMs) -> {reply}, playerView(round, playerId), publicView(round),
// endRound(round, nowMs) -> {scores, reveal} }. Round state must be JSON-serialisable.
// To add a game: write src/games/<id>.js with this interface and add it to `list`.
import { createContexto } from './contexto.js';
import { createDavini } from './davini.js';
import * as contextoData from '../../data/contexto-data.js';
import * as davini from '../../data/davini-data.js';

const list = [createContexto(contextoData), createDavini(davini)];
export const games = Object.fromEntries(list.map(g => [g.id, g]));
