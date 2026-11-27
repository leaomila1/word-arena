import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, join, kick, startRound, isExpired, leaderboard, endRound, ROUND_MS, MAX_PLAYERS } from '../src/core/roomState.js';

const fill = (s, n) => { for (let i = 0; i < n; i++) assert.equal(join(s, 'p' + i).ok, true); };

test('constants match spec', () => { assert.equal(ROUND_MS, 180000); assert.equal(MAX_PLAYERS, 200); });

test('join_200_then_201_full', () => {
  const s = createRoom('123456', 'h');
  fill(s, 200);
  assert.deepEqual(join(s, 'extra'), { ok: false, code: 'FULL' });
});

test('duplicate_name_rejected', () => {
  const s = createRoom('123456', 'h');
  join(s, 'Mint');
  assert.equal(join(s, 'mint ').code, 'NAME_TAKEN');
});

test('invalid_name_rejected', () => {
  const s = createRoom('123456', 'h');
  assert.equal(join(s, '   ').code, 'NAME_INVALID');
});

test('late_join_is_spectator', () => {
  const s = createRoom('123456', 'h');
  join(s, 'a');
  startRound(s, 'contexto', {}, 0);
  const r = join(s, 'late');
  assert.equal(s.players[r.playerId].spectator, true);
  endRound(s, { [r.playerId]: 999 });
  startRound(s, 'contexto', {}, 1000);
  assert.equal(s.players[r.playerId].spectator, false);
});

test('spectator_gets_no_score', () => {
  const s = createRoom('123456', 'h');
  startRound(s, 'contexto', {}, 0);
  const r = join(s, 'late');
  endRound(s, { [r.playerId]: 999 });
  assert.equal(s.players[r.playerId].score, 0);
});

test('reconnect_restores_player', () => {
  const s = createRoom('123456', 'h');
  const a = join(s, 'Bee');
  s.players[a.playerId].score = 50;
  const again = join(s, 'Bee', a.token);
  assert.equal(again.playerId, a.playerId);
  assert.equal(s.players[a.playerId].score, 50);
  assert.equal(Object.keys(s.players).length, 1);
});

test('reconnect_allowed_when_full', () => {
  const s = createRoom('123456', 'h');
  const a = join(s, 'first');
  fill(s, 199);
  assert.equal(join(s, 'first', a.token).ok, true);
});

test('kick_removes_player', () => {
  const s = createRoom('123456', 'h');
  const a = join(s, 'Bad');
  kick(s, a.playerId);
  assert.equal(s.players[a.playerId], undefined);
});
test('kicked token cannot rejoin (offline phone wakes up)', () => {
  const s = createRoom('123456', 'h');
  const a = join(s, 'Rude');
  kick(s, a.playerId);
  assert.deepEqual(join(s, 'Rude', a.token), { ok: false, code: 'KICKED' });
});
test('kicked name cannot be reused by anyone', () => {
  const s = createRoom('123456', 'h');
  kick(s, join(s, 'Rude').playerId);
  assert.equal(join(s, 'rude ').code, 'NAME_TAKEN');
});
test('unknown token joins as a new player', () => {
  const s = createRoom('123456', 'h');
  assert.equal(join(s, 'New', 'not-a-real-token').ok, true);
});

test('round_ends_after_180s', () => {
  const s = createRoom('123456', 'h');
  startRound(s, 'contexto', {}, 1000);
  assert.equal(s.endsAt, 181000);
  assert.equal(isExpired(s, 180999), false);
  assert.equal(isExpired(s, 181000), true);
});

test('endRound_adds_scores_and_leaderboard_sorted', () => {
  const s = createRoom('123456', 'h');
  const a = join(s, 'a'), b = join(s, 'b');
  startRound(s, 'contexto', {}, 0);
  endRound(s, { [a.playerId]: 300, [b.playerId]: 900 });
  assert.equal(s.phase, 'reveal');
  assert.deepEqual(leaderboard(s, 5).map(p => p.name), ['b', 'a']);
});
