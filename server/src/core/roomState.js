// Pure room state: players, phases, timer, scores. No Cloudflare APIs here.
import { validateName } from './names.js';

export const ROUND_MS = 180_000;
export const MAX_PLAYERS = 200;

const newId = () => crypto.randomUUID();

export function createRoom(code, hostToken) {
  return { code, hostToken, phase: 'lobby', gameId: null, endsAt: 0, round: null, players: {}, tokens: {}, kickedTokens: [], kickedNames: [], lastActive: 0 };
}

const nameKey = n => n.trim().toLowerCase();

export function join(state, name, token) {
  const known = token && state.tokens[token];
  if (known && state.players[known]) return { ok: true, playerId: known, token, reconnected: true };
  if (token && (state.kickedTokens ?? []).includes(token)) return { ok: false, code: 'KICKED' };

  const v = validateName(name);
  if (!v.ok) return { ok: false, code: 'NAME_INVALID' };
  const players = Object.values(state.players);
  if (players.length >= MAX_PLAYERS) return { ok: false, code: 'FULL' };
  if (players.some(p => nameKey(p.name) === nameKey(v.name)) || (state.kickedNames ?? []).includes(nameKey(v.name))) return { ok: false, code: 'NAME_TAKEN' };

  const playerId = newId(), tok = newId();
  state.players[playerId] = { id: playerId, name: v.name, score: 0, spectator: state.phase === 'round' };
  state.tokens[tok] = playerId;
  return { ok: true, playerId, token: tok };
}

export function kick(state, playerId) {
  const p = state.players[playerId];
  if (p) (state.kickedNames ??= []).push(nameKey(p.name));
  delete state.players[playerId];
  for (const [t, id] of Object.entries(state.tokens)) if (id === playerId) { delete state.tokens[t]; (state.kickedTokens ??= []).push(t); }
}

export function startRound(state, gameId, roundState, nowMs) {
  state.phase = 'round';
  state.gameId = gameId;
  state.round = roundState;
  state.endsAt = nowMs + ROUND_MS;
  for (const p of Object.values(state.players)) p.spectator = false;
}

export const isExpired = (state, nowMs) => state.phase === 'round' && nowMs >= state.endsAt;

export function endRound(state, scores) {
  for (const [id, pts] of Object.entries(scores)) {
    const p = state.players[id];
    if (p && !p.spectator) p.score += pts;
  }
  state.phase = 'reveal';
}

export const leaderboard = (state, n = 5) =>
  Object.values(state.players).sort((a, b) => b.score - a.score).slice(0, n).map(({ id, name, score }) => ({ id, name, score }));
