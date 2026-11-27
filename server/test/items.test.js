import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContexto } from '../src/games/contexto.js';
import { createDavini } from '../src/games/davini.js';
import { BOX_MAX } from '../src/games/items.js';
import { fixture, getRanks } from './fixtures/contexto.js';

const meta = { 'en-01': { category: 'daily life', emoji: ['1F431'], clue_text: 'furry house pet' } };
const g = createContexto({ vocabIndex: fixture.vocabIndex, targets: fixture.targets, getRanks, meta });
const cat = fixture.targets[0];
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };
// fixture vocab: cat kitten dog car table. Repeat the 4 wrong words to reach 5 accepted guesses.
const guessN = (r, id, n, t0 = 0) => { const w = ['kitten', 'dog', 'car', 'table']; let res; for (let i = 0; i < n; i++) res = g.onGuess(r, id, w[i % 4], t0 + i * 2000); return res; };

test('contexto: a box every 5 accepted guesses, at most 2 per round', () => {
  const r = g.startRound(cat, Math.random, 0);
  assert.equal(guessN(r, 'a', 4).reply.boxes, undefined);
  const fifth = g.onGuess(r, 'a', 'dog', 20_000);
  assert.equal(fifth.reply.boxes, 1);
  guessN(r, 'a', 5, 30_000);
  assert.equal(g.playerView(r, 'a').items.boxes, BOX_MAX);
  guessN(r, 'a', 5, 50_000);
  assert.equal(g.playerView(r, 'a').items.boxes, 2); // capped
});

test('not-in-list and too-fast guesses earn nothing', () => {
  const r = g.startRound(cat, Math.random, 0);
  for (let i = 0; i < 10; i++) g.onGuess(r, 'a', 'zzzz', i * 2000);
  for (let i = 0; i < 10; i++) g.onGuess(r, 'b', 'dog', 100);
  assert.equal(g.playerView(r, 'a').items.boxes, 0);
  assert.equal(g.playerView(r, 'b').items.boxes, 0);
});

test('opening without a box fails', () => {
  const r = g.startRound(cat, Math.random, 0);
  assert.equal(g.openBox(r, 'a', Math.random, 1000).error, 'NO_BOX');
});

test('one player never gets the same item twice in a round', () => {
  const r = g.startRound(cat, Math.random, 0);
  guessN(r, 'a', 10);
  const one = g.openBox(r, 'a', () => 0, 30_000), two = g.openBox(r, 'a', () => 0, 30_000);
  assert.ok(one.item && two.item && one.item !== two.item, `${one.item} ${two.item}`);
  assert.equal(g.openBox(r, 'a', Math.random, 30_000).error, 'NO_BOX');
});

test('contexto items never reveal the whole answer', () => {
  for (let k = 0; k < 40; k++) {
    const r = g.startRound(cat, Math.random, 0); r.hintShown = 5;
    guessN(r, 'a', 10);
    for (const it of [g.openBox(r, 'a', Math.random, 60_000), g.openBox(r, 'a', Math.random, 60_000)]) {
      const s = JSON.stringify(it).toLowerCase();
      assert.equal(s.includes('"cat"'), false, s);
      if (it.item === 'letter') assert.ok(it.text.includes('_'), it.text);
    }
  }
});

test('contexto items: letter, nexthint, near, double behave', () => {
  const pick = name => { const order = ['letter', 'nexthint', 'near', 'double']; return () => order.indexOf(name) / 4 + 0.01; };
  let r = g.startRound(cat, Math.random, 0); guessN(r, 'a', 5);
  const L = g.openBox(r, 'a', pick('letter'), 10_000);
  assert.equal(L.item, 'letter'); assert.equal(L.text.split(' ').filter(c => c !== '_').length, 1);
  r = g.startRound(cat, Math.random, 0); r.hintShown = 1; guessN(r, 'a', 5);
  const N = g.openBox(r, 'a', pick('nexthint'), 40_000);
  assert.equal(N.item, 'nexthint'); assert.equal(N.hint.kind, 'emoji');
  r = g.startRound(cat, Math.random, 0); guessN(r, 'a', 5);
  const W = g.openBox(r, 'a', pick('near'), 10_000);
  assert.equal(W.item, 'near'); assert.ok(W.word && W.word !== 'cat' && W.rank > 1, JSON.stringify(W));
  r = g.startRound(cat, Math.random, 0); guessN(r, 'a', 5);
  assert.equal(g.openBox(r, 'a', pick('double'), 10_000).item, 'double');
  g.onGuess(r, 'a', 'cat', 30_000);
  r.players.b = undefined; delete r.players.b;
  const { scores } = g.endRound(r, 31_000);
  assert.equal(scores.a, 2 * (1000 - 3 * 30));
});

test('nexthint is not offered once all hints are out', () => {
  const r = g.startRound(cat, Math.random, 0); r.hintShown = 5; guessN(r, 'a', 10);
  const got = [g.openBox(r, 'a', Math.random, 1).item, g.openBox(r, 'a', Math.random, 1).item];
  assert.equal(got.includes('nexthint'), false);
});

test('opening a box adds an anonymous line to the public feed', () => {
  const r = g.startRound(cat, Math.random, 0); guessN(r, 'a', 5);
  const it = g.openBox(r, 'a', Math.random, 10_000);
  const f = g.publicView(r).feed.at(-1);
  assert.deepEqual([f.id, f.item], ['a', it.item]);
  assert.equal(JSON.stringify(f).includes('text'), false);
});

const pz = { id: 'ko-01', context: 'ko', category: 'food', answer: 'kimchi', clue_text: 'fermented cabbage', emoji: ['1F96C'], culture_note_en: 'e', culture_note_th: 't' };
const d = createDavini({ puzzles: [pz] });

test('davini: a box every 3 wrong answers; only letter or double', () => {
  const r = d.startRound(pz, () => 0.3, 0);
  for (let i = 0; i < 6; i++) d.onGuess(r, 'a', 'nope', i * 2500);
  assert.equal(d.playerView(r, 'a').items.boxes, 2);
  const items = [d.openBox(r, 'a', Math.random, 20_000).item, d.openBox(r, 'a', Math.random, 20_000).item].sort();
  assert.deepEqual(items, ['double', 'letter']);
});

test('davini letter item adds a letter beyond the public ones, never the whole word', () => {
  const r = d.startRound(pz, () => 0.3, 0); r.hintShown = 3;
  for (let i = 0; i < 3; i++) d.onGuess(r, 'a', 'nope', i * 2500);
  const it = d.openBox(r, 'a', () => 0, 100_000);
  assert.equal(it.item, 'letter');
  assert.equal(it.text.split(' ').filter(c => c !== '_').length, 4);
});

test('davini double doubles the winner score', () => {
  const r = d.startRound(pz, () => 0.3, 0);
  for (let i = 0; i < 3; i++) d.onGuess(r, 'a', 'nope', i * 2500);
  const it = d.openBox(r, 'a', () => 0.99, 8000); assert.equal(it.item, 'double');
  d.onGuess(r, 'a', 'kimchi', 10_000);
  assert.equal(d.endRound(r, 11_000).scores.a, 2 * (1000 - 30));
});
