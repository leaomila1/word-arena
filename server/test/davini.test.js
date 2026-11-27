import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDavini, RATE_MS } from '../src/games/davini.js';

const puzzle = { id: 'ko-01', context: 'ko', answer: 'kimchi', clue_text: 'fermented spicy cabbage', emoji: ['1F96C', '1F336', '1FAD9'], culture_note_en: 'en', culture_note_th: 'th' };
const g = createDavini({ puzzles: [puzzle, { ...puzzle, id: 'fr-01', context: 'fr', answer: 'crepe' }] });
const fresh = () => g.startRound(puzzle, Math.random, 0);

test('rate limit is 2 s', () => assert.equal(RATE_MS, 2000));

test('emoji and clue shown from the start, answer never', () => {
  const v = g.playerView(fresh(), 'p');
  assert.deepEqual(v.emoji, puzzle.emoji);
  assert.equal(v.clue, 'FERMENTED SPICY CABBAGE');
  assert.equal(JSON.stringify(v).toLowerCase().includes('kimchi'), false);
});

test('wrong answer: WRONG, round continues', () => {
  const { reply, endRound } = g.onGuess(fresh(), 'p', 'soup', 0);
  assert.equal(reply.error, 'WRONG'); assert.ok(!endRound);
});

test('first correct answer ends the round', () => {
  const r = fresh();
  const out = g.onGuess(r, 'a', ' KimChi ', 30_000);
  assert.equal(out.reply.stage, 'solved'); assert.equal(out.endRound, true);
});

test('winner scored by speed, everyone else 0', () => {
  const r = fresh();
  g.onGuess(r, 'b', 'soup', 0);
  g.onGuess(r, 'a', 'kimchi', 50_000);
  const { scores, reveal } = g.endRound(r, 50_000);
  assert.deepEqual(scores, { a: 850, b: 0 });
  assert.equal(reveal.winnerId, 'a'); assert.equal(reveal.answer, 'kimchi');
});

test('nobody solved: no winner', () => {
  const r = fresh(); g.onGuess(r, 'b', 'soup', 0);
  assert.equal(g.endRound(r, 180_000).reveal.winnerId, null);
});

test('accent-insensitive (crêpe)', () => {
  const r = g.startRound(g.pickContent('fr', Math.random, []), Math.random, 0);
  assert.equal(g.onGuess(r, 'a', 'Crêpe', 0).reply.stage, 'solved');
});

test('rate limit applies to wrong guesses', () => {
  const r = fresh(); g.onGuess(r, 'a', 'soup', 0);
  assert.equal(g.onGuess(r, 'a', 'kimchi', 1999).reply.error, 'SLOW_DOWN');
});

test('publicView shows clue, emoji, tries — never the answer', () => {
  const r = fresh(); g.onGuess(r, 'a', 'soup', 0);
  const v = g.publicView(r);
  assert.equal(v.players, 1); assert.deepEqual(v.emoji, puzzle.emoji);
  assert.equal(JSON.stringify(v).toLowerCase().includes('kimchi'), false);
});

test('round state JSON-serialisable', () => {
  const r = JSON.parse(JSON.stringify(fresh()));
  assert.equal(g.onGuess(r, 'a', 'kimchi', 0).reply.stage, 'solved');
});
