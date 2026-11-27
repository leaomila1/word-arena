import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContexto } from '../src/games/contexto.js';
import { createDavini } from '../src/games/davini.js';
import { fixture, getRanks } from './fixtures/contexto.js';

const meta = { 'en-01': { category: 'daily life', emoji: ['1F431', '1F43E', '1F9F6'], clue_text: 'furry house pet' } };
const g = createContexto({ vocabIndex: fixture.vocabIndex, targets: fixture.targets, getRanks, meta });
const t = fixture.targets[0];

test('contexto hint level by elapsed time: 0 before 30 s, +1 every 30 s, max 5', () => {
  const r = g.startRound(t, Math.random, 0);
  assert.equal(g.hintLevel(r, 29_999), 0);
  assert.equal(g.hintLevel(r, 30_000), 1);
  assert.equal(g.hintLevel(r, 90_000), 3);
  assert.equal(g.hintLevel(r, 179_000), 5);
});

test('contexto hints unlock in order: category+culture, emoji, letters, clue, last letter', () => {
  const r = g.startRound(t, Math.random, 0);
  const h = g.hints(r, 5);
  assert.deepEqual(h.map(x => x.kind), ['category', 'emoji', 'letters', 'clue', 'letters']);
  assert.equal(h[0].text, 'Daily life · English');
  assert.deepEqual(h[1].emoji, meta['en-01'].emoji);
  assert.equal(h[2].text, 'C _ _');
  assert.equal(h[3].text, 'FURRY HOUSE PET');
  assert.equal(h[4].text, 'C _ T');
  assert.equal(g.hints(r, 2).length, 2);
});

test('contexto hints never contain the whole answer', () => {
  const r = g.startRound(t, Math.random, 0);
  assert.equal(JSON.stringify(g.hints(r, 5)).toLowerCase().includes('"cat"'), false);
});

test('contexto hints work without meta (no crash, letters only)', () => {
  const g2 = createContexto({ vocabIndex: fixture.vocabIndex, targets: fixture.targets, getRanks });
  const h = g2.hints(g2.startRound(t, Math.random, 0), 5);
  assert.ok(h.every(x => x.kind === 'letters' || x.kind === 'category'));
});

const pz = { id: 'ko-01', context: 'ko', category: 'food', answer: 'kimchi', clue_text: 'fermented spicy cabbage', emoji: ['1F96C', '1F336', '1FAD9'], culture_note_en: 'en', culture_note_th: 'th' };
const d = createDavini({ puzzles: [pz] });

test('davini reveals one more letter every 30 s, never more than half', () => {
  const r = d.startRound(pz, () => 0.3, 0);
  assert.equal(d.hintLevel(r, 29_000), 0);
  assert.equal(d.hintLevel(r, 60_000), 2);
  assert.equal(d.hintLevel(r, 179_000), 3); // floor(6/2)
});

test('davini letter pattern shows exactly `level` letters in their positions', () => {
  const r = d.startRound(pz, () => 0.3, 0);
  const [h] = d.hints(r, 2);
  assert.equal(h.kind, 'letters');
  const shown = h.text.split(' ').filter(c => c !== '_');
  assert.equal(shown.length, 2);
  h.text.split(' ').forEach((c, i) => c !== '_' && assert.equal(c, 'KIMCHI'[i]));
  assert.equal(d.hints(r, 0)[0].text, '_ _ _ _ _ _');
});

test('hint state JSON-serialisable', () => {
  const r = JSON.parse(JSON.stringify(d.startRound(pz, () => 0.3, 0)));
  assert.equal(d.hints(r, 1)[0].text.split(' ').filter(c => c !== '_').length, 1);
});
