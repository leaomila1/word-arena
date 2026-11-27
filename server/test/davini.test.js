import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDavini, SKIP_MULT, RATE_MS } from '../src/games/davini.js';
import { seeded } from '../src/games/cipher.js';

const puzzle = { id: 'ko-01', context: 'ko', answer: 'kimchi', clue_text: 'winter dish', emoji: ['1F1F0-1F1F7', '1F96C', '1F336'], culture_note_en: 'en', culture_note_th: 'th' };
const g = createDavini({ puzzles: [puzzle, { ...puzzle, id: 'fr-01', context: 'fr', answer: 'baguette' }] });
const fresh = () => g.startRound(puzzle, seeded(7), 0);

test('constants', () => { assert.equal(SKIP_MULT, 1.2); assert.equal(RATE_MS, 3000); });

test('emoji absent before decode', () => {
  const r = fresh();
  assert.equal(g.playerView(r, 'p').emoji, undefined);
  assert.equal(g.onGuess(r, 'p', 'soup', 0).reply.error, 'WRONG');
  assert.equal(g.playerView(r, 'p').emoji, undefined);
});

test('correct clue unlocks emoji (case/space-insensitive)', () => {
  const r = fresh();
  const { reply } = g.onGuess(r, 'p', '  Winter   DISH ', 0);
  assert.equal(reply.stage, 'decoded');
  assert.deepEqual(reply.emoji, puzzle.emoji);
  assert.deepEqual(g.playerView(r, 'p').emoji, puzzle.emoji);
});

test('rate limit 3000 ms', () => {
  const r = fresh();
  g.onGuess(r, 'p', 'soup', 0);
  assert.equal(g.onGuess(r, 'p', 'winter dish', 2999).reply.error, 'SLOW_DOWN');
  assert.equal(g.onGuess(r, 'p', 'winter dish', 3000).reply.stage, 'decoded');
});

test('scoring: decode then answer at 50 s = 850', () => {
  const r = fresh();
  g.onGuess(r, 'a', 'winter dish', 10_000);
  assert.equal(g.onGuess(r, 'a', 'KIMCHI', 50_000).reply.stage, 'solved');
  assert.equal(g.endRound(r, 180_000).scores.a, 850);
});

test('scoring: skip decode at 50 s = round(850 * 1.2) = 1020', () => {
  const r = fresh();
  g.onGuess(r, 'a', 'kimchi', 50_000);
  assert.equal(g.endRound(r, 180_000).scores.a, 1020);
});

test('scoring: decoded but unanswered = 200; wrong guesses not penalised; nothing = 0', () => {
  const r = fresh();
  g.onGuess(r, 'a', 'soup', 0); g.onGuess(r, 'a', 'winter dish', 3000); g.onGuess(r, 'a', 'bibimbap', 6000);
  g.onGuess(r, 'b', 'soup', 0);
  const { scores, reveal } = g.endRound(r, 180_000);
  assert.equal(scores.a, 200); assert.equal(scores.b, 0);
  assert.equal(reveal.answer, 'kimchi'); assert.deepEqual(reveal.emoji, puzzle.emoji);
});

test('no guesses after solving', () => {
  const r = fresh(); g.onGuess(r, 'a', 'kimchi', 0);
  assert.equal(g.onGuess(r, 'a', 'kimchi', 5000).reply.error, 'ALREADY_SOLVED');
});

test('publicView has neither answer nor clue', () => {
  const r = fresh(); g.onGuess(r, 'a', 'winter dish', 0); g.onGuess(r, 'b', 'kimchi', 0);
  const v = JSON.stringify(g.publicView(r)).toLowerCase();
  assert.equal(v.includes('kimchi') || v.includes('winter') || v.includes('dish'), false);
  assert.equal(g.publicView(r).decoded, 1); assert.equal(g.publicView(r).solved, 1);
});

test('playerView before decode has no clue plaintext', () => {
  const v = JSON.stringify(g.playerView(fresh(), 'p')).toLowerCase();
  assert.equal(v.includes('winter') || v.includes('kimchi'), false);
});

test('round state JSON-serialisable', () => {
  const r = JSON.parse(JSON.stringify(fresh()));
  assert.equal(g.onGuess(r, 'a', 'winter dish', 0).reply.stage, 'decoded');
});

test('pickContent by context', () => assert.equal(g.pickContent('fr', Math.random, []).id, 'fr-01'));

test('accented answer accepted (crêpe == crepe)', () => {
  const g2 = createDavini({ puzzles: [{ ...puzzle, id: 'fr-04', answer: 'crepe', clue_text: 'very thin pancake' }] });
  const r = g2.startRound(g2.pickContent('mixed', Math.random, []), seeded(1), 0);
  assert.equal(g2.onGuess(r, 'a', 'Crêpe', 0).reply.stage, 'solved');
});
