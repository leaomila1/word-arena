import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateName } from '../src/core/names.js';

test('accepts normal name', () => assert.equal(validateName('Mint 5/1').ok, true));
test('rejects 17 chars', () => assert.equal(validateName('a'.repeat(17)).ok, false));
test('accepts 16 chars', () => assert.equal(validateName('a'.repeat(16)).ok, true));
test('rejects empty/whitespace', () => { assert.equal(validateName('').ok, false); assert.equal(validateName('   ').ok, false); });
test('rejects profanity', () => assert.equal(validateName('fuck').ok, false));
test('rejects leetspeak profanity', () => assert.equal(validateName('a$$hole').ok, false));
test('rejects profanity embedded', () => assert.equal(validateName('xxShitxx').ok, false));
test('does not reject innocent word', () => assert.equal(validateName('Glass').ok, true));
test('innocent names containing short slurs pass', () => {
  for (const n of ['Wheel', 'Played', 'Essex']) assert.equal(validateName(n).ok, true, n);
});
test('thai romanised profanity as whole word rejected', () => assert.equal(validateName('ai hee').ok, false));
test('thai-script profanity rejected anywhere in name', () => {
  for (const n of ['ควย', 'ไอ้เหี้ย', 'เย็ดแม่', 'สัส', 'มึงสัด']) assert.equal(validateName(n).ok, false, n);
});
test('normal thai name accepted', () => assert.equal(validateName('น้องมิ้นท์').ok, true));
test('zero-width-only name rejected', () => assert.equal(validateName('​​').ok, false));
test('cyrillic homoglyph spelling rejected', () => assert.equal(validateName('fuсk').ok, false)); // с is Cyrillic
