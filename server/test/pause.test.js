import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, startRound, isExpired, pauseRound, resumeRound, ROUND_MS } from '../src/core/roomState.js';
import { createContexto } from '../src/games/contexto.js';
import { fixture, getRanks } from './fixtures/contexto.js';

test('paused round never expires and resume shifts the clock by the pause length', () => {
  const s = createRoom('123456', 'h');
  startRound(s, 'x', { startedAt: 0 }, 0);
  assert.equal(pauseRound(s, 60_000), true);
  assert.equal(pauseRound(s, 61_000), false); // already paused
  assert.equal(isExpired(s, ROUND_MS + 999_999), false);
  assert.equal(resumeRound(s, 100_000), true); // paused 40 s
  assert.equal(s.endsAt, ROUND_MS + 40_000);
  assert.equal(s.round.startedAt, 40_000);     // hints and speed scores ignore the pause
  assert.equal(s.pausedAt, null);
  assert.equal(resumeRound(s, 101_000), false);
});

test('pause only works during a round', () => {
  const s = createRoom('123456', 'h');
  assert.equal(pauseRound(s, 0), false);
});

test('contexto: first correct guess ends the round and names the winner', () => {
  const g = createContexto({ vocabIndex: fixture.vocabIndex, targets: fixture.targets, getRanks });
  const r = g.startRound(fixture.targets[0], Math.random, 0);
  assert.equal(g.onGuess(r, 'a', 'dog', 1000).endRound, undefined);
  const res = g.onGuess(r, 'b', fixture.targets[0].word, 5000);
  assert.equal(res.endRound, true);
  const { reveal, scores } = g.endRound(r, 6000);
  assert.equal(reveal.winnerId, 'b');
  assert.ok(scores.b > scores.a);
});
