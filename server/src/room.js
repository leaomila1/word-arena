import { DurableObject } from 'cloudflare:workers';
import { createRoom, join, kick, startRound, isExpired, endRound, leaderboard, pauseRound, resumeRound } from './core/roomState.js';
import { games } from './games/index.js';

const IDLE_MS = 2 * 60 * 60_000; // room (and its scores) kept 2 h after the last activity
const TICK_MS = 1000; // board push + expiry check during a round
const FLOOD_MAX = 20;  // messages per second per socket before we close it

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;        // RoomState cache (lost on hibernation; reloaded from storage)
    this.dirty = false;   // round progress changed since last persist/board push
    this.rate = new WeakMap(); // ws -> {t, n} per-second message counter (in memory only)
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get('state')) ?? null; });
  }

  async save() { await this.ctx.storage.put('state', this.s); }
  send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch {} }
  sockets(role) { return this.ctx.getWebSockets().filter(ws => ws.deserializeAttachment()?.role === role); }
  socketsOf(playerId) { return this.ctx.getWebSockets().filter(ws => ws.deserializeAttachment()?.playerId === playerId); }
  toHosts(msg) { for (const ws of this.sockets('host')) this.send(ws, msg); }
  toPlayers(msg) { for (const ws of this.sockets('player')) this.send(ws, msg); }
  lobbyMsg() { return { type: 'lobby', players: Object.values(this.s.players).map(({ id, name, score }) => ({ id, name, score })) }; }
  currentHints() {
    const g = games[this.s.gameId], r = this.s.round;
    return g?.hints && r ? g.hints(r, r.hintShown ?? 0) : [];
  }
  roundMsg() { return { type: 'round', gameId: this.s.gameId, endsAt: this.s.endsAt, hints: this.currentHints(), paused: !!this.s.pausedAt }; }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init') {
      if (this.s) return new Response('exists', { status: 409 });
      const { code, hostToken } = await request.json();
      this.s = createRoom(code, hostToken);
      this.s.lastActive = Date.now();
      await this.save();
      await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
      return new Response('ok');
    }
    const [client, server] = Object.values(new WebSocketPair());
    if (!this.s) { // accept just to say so, then close — otherwise clients retry forever
      server.accept(); server.send(JSON.stringify({ type: 'closed', reason: 'NO_ROOM' })); server.close(1000, 'NO_ROOM');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role: 'pending' });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    if (!this.s) return this.send(ws, { type: 'closed', reason: 'NO_ROOM' });
    const now = Date.now();
    const r = this.rate.get(ws) ?? { t: now, n: 0 };
    if (now - r.t >= 1000) { r.t = now; r.n = 0; }
    if (++r.n > FLOOD_MAX) { try { ws.close(1008, 'too many messages'); } catch {} return; }
    this.rate.set(ws, r);
    if (typeof raw !== 'string' || raw.length > 500) return;
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment() || {};
    this.s.lastActive = now;

    switch (msg.type) {
      case 'host': {
        if (msg.hostToken !== this.s.hostToken) return this.send(ws, { type: 'error', code: 'BAD_HOST' });
        ws.serializeAttachment({ role: 'host' });
        this.send(ws, { type: 'hosted', code: this.s.code, phase: this.s.phase });
        this.send(ws, this.lobbyMsg());
        if (this.s.phase === 'round') this.send(ws, { ...this.roundMsg(), view: games[this.s.gameId].publicView(this.s.round) });
        if (this.s.phase === 'reveal' && this.s.lastReveal) this.send(ws, this.s.lastReveal);
        return;
      }
      case 'join': {
        if (me.role === 'host') return this.send(ws, { type: 'error', code: 'ALREADY_JOINED' });
        if (me.role === 'player' && this.s.tokens[msg.token] !== me.playerId) return this.send(ws, { type: 'error', code: 'ALREADY_JOINED' });
        const r = join(this.s, msg.name, msg.token);
        if (r.code === 'KICKED') { this.send(ws, { type: 'closed', reason: 'KICKED' }); return ws.close(1000, 'kicked'); }
        if (!r.ok) return this.send(ws, { type: 'error', code: r.code });
        ws.serializeAttachment({ role: 'player', playerId: r.playerId });
        const p = this.s.players[r.playerId];
        this.send(ws, { type: 'joined', playerId: r.playerId, token: r.token, name: p.name, phase: this.s.phase, spectator: p.spectator });
        if (this.s.phase === 'round' && !p.spectator) {
          this.send(ws, { ...this.roundMsg(), view: games[this.s.gameId].playerView(this.s.round, r.playerId) });
        }
        if (!r.reconnected) { await this.save(); this.toHosts(this.lobbyMsg()); }
        return;
      }
      case 'guess': {
        if (me.role !== 'player' || this.s.phase !== 'round') return;
        const p = this.s.players[me.playerId];
        if (!p || p.spectator) return;
        if (this.s.pausedAt) return this.send(ws, { type: 'reply', error: 'PAUSED' });
        const { reply, endRound: ends } = games[this.s.gameId].onGuess(this.s.round, me.playerId, String(msg.text ?? '').slice(0, 40), now);
        this.send(ws, { type: 'reply', ...reply });
        this.dirty = true;
        if (ends || isExpired(this.s, now)) await this.finishRound(now);
        return;
      }
    }

    if (me.role !== 'host') return;
    switch (msg.type) {
      case 'start': {
        const g = Object.hasOwn(games, msg.gameId) ? games[msg.gameId] : null;
        if (!g || this.s.phase === 'round') return this.send(ws, { type: 'error', code: 'CANNOT_START' });
        const content = g.pickContent(msg.context ?? 'mixed', Math.random, this.s.used ?? []);
        if (!content) return this.send(ws, { type: 'error', code: 'NO_CONTENT' });
        this.s.used = [...(this.s.used ?? []), content.id];
        startRound(this.s, g.id, g.startRound(content, Math.random, now), now);
        this.s.lastReveal = null;
        await this.save();
        this.toHosts({ ...this.roundMsg(), view: g.publicView(this.s.round) });
        for (const pws of this.sockets('player')) {
          const id = pws.deserializeAttachment().playerId;
          if (this.s.players[id]) this.send(pws, { ...this.roundMsg(), view: g.playerView(this.s.round, id) });
        }
        await this.ctx.storage.setAlarm(now + TICK_MS);
        return;
      }
      case 'kick': {
        kick(this.s, msg.playerId);
        if (this.s.round?.players) delete this.s.round.players[msg.playerId];
        for (const pws of this.socketsOf(msg.playerId)) { this.send(pws, { type: 'closed', reason: 'KICKED' }); pws.close(1000, 'kicked'); }
        await this.save();
        this.toHosts(this.lobbyMsg());
        return;
      }
      case 'pause': {
        if (!pauseRound(this.s, now)) return;
        await this.save();
        const m = { type: 'paused' }; this.toHosts(m); this.toPlayers(m);
        return this.ctx.storage.setAlarm(now + IDLE_MS); // no ticking while paused
      }
      case 'resume': {
        if (!resumeRound(this.s, now)) return;
        await this.save();
        const m = { type: 'resumed', endsAt: this.s.endsAt }; this.toHosts(m); this.toPlayers(m);
        return this.ctx.storage.setAlarm(now + TICK_MS);
      }
      case 'end': { if (this.s.phase === 'round') await this.finishRound(now); return; }
      case 'lobby': { if (this.s.phase !== 'round') { this.s.phase = 'lobby'; await this.save(); this.toHosts(this.lobbyMsg()); this.toPlayers({ type: 'lobby' }); } return; }
      case 'close': return this.closeRoom('CLOSED');
    }
  }

  async finishRound(now) {
    const g = games[this.s.gameId];
    const { scores, reveal } = g.endRound(this.s.round, now);
    if (reveal.winnerId) reveal.winnerName = this.s.players[reveal.winnerId]?.name ?? null;
    endRound(this.s, scores);
    const msg = { type: 'reveal', gameId: g.id, reveal, top: leaderboard(this.s, 5) };
    this.s.lastReveal = msg;
    this.s.round = null;
    await this.save();
    this.toHosts(msg);
    this.toHosts(this.lobbyMsg()); // full score table for the host's scoreboard
    for (const ws of this.sockets('player')) {
      const id = ws.deserializeAttachment().playerId;
      const p = this.s.players[id];
      this.send(ws, { ...msg, you: p ? { score: p.score, gained: scores[id] ?? 0 } : null });
    }
    await this.ctx.storage.setAlarm(now + IDLE_MS);
  }

  async closeRoom(reason) {
    for (const ws of this.ctx.getWebSockets()) { this.send(ws, { type: 'closed', reason }); try { ws.close(1000, reason); } catch {} }
    this.s = null;
    await this.ctx.storage.deleteAll();
  }

  async alarm() {
    if (!this.s) return;
    const now = Date.now();
    if (this.s.phase === 'round' && this.s.pausedAt) {
      if (now - this.s.pausedAt >= IDLE_MS) return this.closeRoom('IDLE');
      return this.ctx.storage.setAlarm(this.s.pausedAt + IDLE_MS);
    }
    if (this.s.phase === 'round') {
      if (isExpired(this.s, now)) return this.finishRound(now);
      const g = games[this.s.gameId], r = this.s.round;
      if (g.hintLevel) {
        const lvl = g.hintLevel(r, now);
        if (lvl !== (r.hintShown ?? 0)) {
          r.hintShown = lvl; this.dirty = true;
          const msg = { type: 'hint', level: lvl, hints: g.hints(r, lvl) };
          this.toHosts(msg); this.toPlayers(msg);
        }
      }
      if (this.dirty) {
        this.dirty = false;
        await this.save();
        this.toHosts({ type: 'board', view: games[this.s.gameId].publicView(this.s.round) });
      }
      return this.ctx.storage.setAlarm(now + TICK_MS);
    }
    if (now - this.s.lastActive >= IDLE_MS) return this.closeRoom('IDLE');
    return this.ctx.storage.setAlarm(this.s.lastActive + IDLE_MS);
  }

  async webSocketClose(ws) { try { ws.close(); } catch {} }
}
