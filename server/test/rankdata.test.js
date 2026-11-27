import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadRankData } from '../src/games/rankdata.js';

const vocabText = 'cat\ndog\ncar\ntable';
// one target "cat", TOP = 3: order = [cat, dog, table]
const buf = new Uint16Array([0, 1, 3]).buffer;
const targets = [{ id: 'en-01', word: 'cat' }];

test('vocab index from text', () => {
  const { vocabIndex } = loadRankData(vocabText, buf, targets, 3);
  assert.equal(vocabIndex.get('table'), 3); assert.equal(vocabIndex.size, 4);
});
test('ranks from top list; outside top = TOP+1', () => {
  const { vocabIndex, getRanks } = loadRankData(vocabText, buf, targets, 3);
  const r = getRanks('cat');
  assert.equal(r[vocabIndex.get('cat')], 1);
  assert.equal(r[vocabIndex.get('dog')], 2);
  assert.equal(r[vocabIndex.get('table')], 3);
  assert.equal(r[vocabIndex.get('car')], 4);
});
test('unknown target throws', () => {
  const { getRanks } = loadRankData(vocabText, buf, targets, 3);
  assert.throws(() => getRanks('zebra'));
});
