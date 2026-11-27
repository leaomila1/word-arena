import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContexto, colorFor, scoreCorrect, scoreTimeout } from '../src/games/contexto.js';
import { fixture, getRanks } from './fixtures/contexto.js';

const g = createContexto({ vocabIndex: fixture.vocabIndex, targets: fixture.targets, getRanks });
const target = fixture.targets[0];
const fresh = () => g.startRound(target, Math.random, 0);

test('colorFor thresholds', () => {
  assert.equal(colorFor(1), 'gold'); assert.equal(colorFor(2), 'green'); assert.equal(colorFor(300), 'green');
  assert.equal(colorFor(301), 'orange'); assert.equal(colorFor(1500), 'orange'); assert.equal(colorFor(1501), 'red');
});
test('scoreCorrect', () => { assert.equal(scoreCorrect(0), 1000); assert.equal(scoreCorrect(100), 700); assert.equal(scoreCorrect(250), 400); });
test('scoreTimeout', () => { assert.equal(scoreTimeout(1), 400); assert.equal(scoreTimeout(1000), 200); assert.equal(scoreTimeout(5000), 0); assert.equal(scoreTimeout(null), 0); });

test('normalises input', () => {
  const r = fresh();
  const { reply } = g.onGuess(r, 'p', '  CAT ', 1000);
  assert.equal(reply.rank, 1); assert.equal(reply.color, 'gold'); assert.equal(reply.label, 'Correct!');
});
test('labels match colors', () => {
  const r = fresh();
  assert.equal(g.onGuess(r, 'p', 'table', 0).reply.label, 'Getting warm');
  assert.equal(g.onGuess(r, 'p', 'car', 2000).reply.label, 'Far');
  assert.equal(g.onGuess(r, 'p', 'dog', 4000).reply.label, 'Very close');
});
test('unknown word not counted', () => {
  const r = fresh();
  assert.equal(g.onGuess(r, 'p', 'zzzz', 0).reply.error, 'NOT_IN_LIST');
  assert.equal(g.playerView(r, 'p').guesses.length, 0);
});
test('rate limit 1500 ms', () => {
  const r = fresh();
  g.onGuess(r, 'p', 'dog', 0);
  assert.equal(g.onGuess(r, 'p', 'car', 1499).reply.error, 'SLOW_DOWN');
  assert.equal(g.onGuess(r, 'p', 'car', 1500).reply.rank, 1600);
});
test('no guesses after solving', () => {
  const r = fresh();
  g.onGuess(r, 'p', 'cat', 0);
  assert.equal(g.onGuess(r, 'p', 'dog', 5000).reply.error, 'ALREADY_SOLVED');
});
test('plural not auto-accepted', () => {
  const r = fresh();
  assert.equal(g.onGuess(r, 'p', 'cats', 0).reply.error, 'NOT_IN_LIST');
});
test('best rank tracked per player', () => {
  const r = fresh();
  g.onGuess(r, 'a', 'car', 0); g.onGuess(r, 'a', 'dog', 2000); g.onGuess(r, 'a', 'table', 4000);
  g.onGuess(r, 'b', 'table', 0);
  const v = Object.fromEntries(g.publicView(r).players.map(p => [p.id, p.bestRank]));
  assert.deepEqual(v, { a: 3, b: 400 });
});
test('publicView never contains the answer', () => {
  const r = fresh();
  g.onGuess(r, 'a', 'cat', 0);
  assert.equal(JSON.stringify(g.publicView(r)).includes('cat'), false);
});
test('playerView restores own guesses sorted by rank', () => {
  const r = fresh();
  g.onGuess(r, 'a', 'car', 0); g.onGuess(r, 'a', 'dog', 2000);
  assert.deepEqual(g.playerView(r, 'a').guesses.map(x => x.word), ['dog', 'car']);
});
test('round state is JSON-serialisable', () => {
  const r = fresh(); g.onGuess(r, 'a', 'dog', 0);
  const r2 = JSON.parse(JSON.stringify(r));
  assert.equal(g.onGuess(r2, 'a', 'cat', 2000).reply.rank, 1);
});
test('endRound scores', () => {
  const r = fresh();
  g.onGuess(r, 'a', 'cat', 100_000);   // solved at 100 s -> 700
  g.onGuess(r, 'b', 'dog', 0);         // best 3 -> round(400 - 0.6) = 399
  const { scores, reveal } = g.endRound(r, 180_000);
  assert.deepEqual(scores, { a: 700, b: 399 });
  assert.equal(reveal.answer, 'cat'); assert.equal(reveal.culture_note_th, 'n-th');
});
test('pickContent filters by context and avoids used', () => {
  assert.equal(g.pickContent('ko', Math.random, []).id, 'ko-01');
  assert.equal(g.pickContent('mixed', () => 0, ['en-01']).id, 'ko-01');
  assert.ok(g.pickContent('en', Math.random, ['en-01'])); // all used -> reuse
  assert.equal(g.pickContent('fr', Math.random, []), null);
});

test('accented guess matches unaccented vocab (Câr → car)', () => {
  const r = fresh();
  assert.equal(g.onGuess(r, 'p', 'Câr', 0).reply.rank, 1600);
});

test('not-in-list guess does not start the rate limit (spec: not counted)', () => {
  const r = fresh();
  assert.equal(g.onGuess(r, 'p', 'zzzz', 0).reply.error, 'NOT_IN_LIST');
  assert.equal(g.onGuess(r, 'p', 'dog', 100).reply.rank, 3);
});
test('trailing punctuation from mobile keyboards is ignored', () => {
  const r = fresh();
  assert.equal(g.onGuess(r, 'p', 'Cat.', 0).reply.rank, 1);
});
