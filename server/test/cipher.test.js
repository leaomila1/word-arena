import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, SYMBOLS, seeded } from '../src/games/cipher.js';

test('symbol pool has at least 40 distinct glyphs', () => assert.ok(new Set(SYMBOLS).size >= 40));

test('cipher roundtrip preserves spaces', () => {
  const { cipher, fullKey } = encode('WINTER DISH', seeded(1));
  const back = new Map([...fullKey].map(([l, s]) => [s, l]));
  assert.equal(cipher.map(c => (c === ' ' ? ' ' : back.get(c))).join(''), 'WINTER DISH');
});

test('cipher contains no plaintext letters', () => {
  const { cipher } = encode('winter dish', seeded(2));
  assert.equal(cipher.some(c => /[a-z]/i.test(c)), false);
});

test('partial key reveals round(60%) of unique letters', () => {
  const { shownKey, fullKey } = encode('WINTER DISH', seeded(3));
  assert.equal(fullKey.size, 9);
  assert.equal(shownKey.size, 5);
  for (const [l, s] of shownKey) assert.equal(fullKey.get(l), s);
});

test('symbols differ between rounds', () => {
  const a = encode('WINTER DISH', seeded(4)).cipher.join('');
  const b = encode('WINTER DISH', seeded(5)).cipher.join('');
  assert.notEqual(a, b);
});
