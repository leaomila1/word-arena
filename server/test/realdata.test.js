import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadRankData } from '../src/games/rankdata.js';

// Load built data the way the Worker does (contexto-data.js imports .txt/.bin which Node can't).
const src = readFileSync(new URL('../data/contexto-data.js', import.meta.url), 'utf8');
const TOP = Number(src.match(/export const TOP = (\d+)/)[1]);
const targets = JSON.parse(src.match(/export const targets = (\[.*\]);/)[1]);
const vocab = readFileSync(new URL('../data/vocab.txt', import.meta.url), 'utf8');
const bin = readFileSync(new URL('../data/ranks.bin', import.meta.url));
const { vocabIndex, getRanks } = loadRankData(vocab, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength), targets, TOP);

test('every target is rank 1 for itself', () => {
  for (const t of targets) assert.equal(getRanks(t.word)[vocabIndex.get(t.word)], 1, t.word);
});
test('related word ranks within "Very close" (≤300)', () => {
  const pairs = [['kimchi', 'cabbage'], ['samovar', 'kettle'], ['tea', 'coffee'], ['cricket', 'bat'], ['panda', 'bear']];
  for (const [t, w] of pairs) assert.ok(getRanks(t)[vocabIndex.get(w)] <= 300, `${t}/${w} = ${getRanks(t)[vocabIndex.get(w)]}`);
});
test('blocked words are not guessable', () => {
  for (const w of ['porno', 'naked', 'fuck', 'shit']) assert.equal(vocabIndex.has(w), false, w);
});
test('common words are guessable', () => {
  for (const w of ['house', 'played', 'cats', 'food', 'pizza']) assert.equal(vocabIndex.has(w), true, w);
});
test('davini puzzles: 100, answers lowercase, 3 emoji', async () => {
  const { puzzles } = await import('../data/davini-data.js');
  assert.equal(puzzles.length, 100);
  for (const p of puzzles) { assert.equal(p.answer, p.answer.toLowerCase()); assert.equal(p.emoji.length, 3); }
});
