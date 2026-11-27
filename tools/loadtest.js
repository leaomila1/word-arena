// 200-player load test + answer-leak check.
// Usage: node tools/loadtest.js <worker-url> [contextoSeconds=180] [daviniSeconds=60]
import { readFileSync } from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:8787';
const CTX_S = Number(process.argv[3] || 180), DAV_S = Number(process.argv[4] || 60);
const wsBase = base.replace(/^http/, 'ws');
const vocab = readFileSync(new URL('../server/data/vocab.txt', import.meta.url), 'utf8').split('\n');
const { puzzles } = await import('../server/data/davini-data.js');
const wait = ms => new Promise(r => setTimeout(r, ms));
const pick = a => a[Math.floor(Math.random() * a.length)];
const stats = { opened: 0, unexpectedClose: 0, sent: 0, replies: 0, latencies: [] };

function open(code, label) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`${wsBase}/ws/${code}`);
    ws.msgs = []; ws.pending = [];
    ws.onmessage = e => {
      const m = JSON.parse(e.data); ws.msgs.push(m);
      if (m.type === 'reply') { stats.replies++; const t = ws.pending.shift(); if (t) stats.latencies.push(Date.now() - t); }
    };
    ws.onopen = () => { stats.opened++; res(ws); };
    ws.onclose = () => { if (!ws.expectClose) stats.unexpectedClose++; };
    ws.onerror = () => rej(new Error('ws error ' + label));
  });
}
const tx = (ws, m) => { ws.send(JSON.stringify(m)); if (m.type === 'guess') { stats.sent++; ws.pending.push(Date.now()); } };

const { code, hostToken } = await (await fetch(`${base}/rooms`, { method: 'POST' })).json();
const host = await open(code, 'host'); tx(host, { type: 'host', hostToken });
const players = [];
for (let i = 0; i < 200; i++) { const p = await open(code, 'p' + i); tx(p, { type: 'join', name: `Student${i}` }); players.push(p); }
const extra = await open(code, 'extra'); tx(extra, { type: 'join', name: 'Student200' });
await wait(1500);
const joined = players.filter(p => p.msgs.some(m => m.type === 'joined')).length;
const fullErr = extra.msgs.find(m => m.type === 'error')?.code;
console.log(`joined: ${joined}/200 | 201st: ${fullErr}`);

async function round(gameId, seconds, makeGuess, minGap) {
  tx(host, { type: 'start', gameId, context: 'mixed' }); await wait(800);
  const end = Date.now() + seconds * 1000;
  await Promise.all(players.map(async p => {
    await wait(Math.random() * 3000);
    while (Date.now() < end - 500) { tx(p, { type: 'guess', text: makeGuess(p) }); await wait(minGap + Math.random() * (5000 - minGap)); }
  }));
  if (seconds < 180) tx(host, { type: 'end' });
  for (let i = 0; i < 40 && !host.msgs.some(m => m.type === 'reveal' && m.gameId === gameId); i++) await wait(500);
  // Davini ends on the first correct answer; stop the remaining bots from guessing into the next game.
  return host.msgs.filter(m => m.type === 'reveal' && m.gameId === gameId).pop();
}

const t0 = Date.now();
const r1 = await round('contexto', CTX_S, () => pick(vocab), 1500);
console.log(`contexto reveal: ${r1?.reveal.answer} after ${Math.round((Date.now() - t0) / 1000)} s | boards to host: ${host.msgs.filter(m => m.type === 'board').length}`);
let target = null;
const r2 = await round('davini', DAV_S, p => {
  const rm = p.msgs.filter(m => m.type === 'round').pop();
  target ??= puzzles.find(z => z.clue_text.toUpperCase() === rm.view.clue);
  return Math.random() < 0.02 ? target.answer : pick(vocab);
}, 2000);
console.log(`davini reveal: ${r2?.reveal.answer} | top: ${r2?.top.map(t => t.name + ':' + t.score).join(', ')}`);

// Leak check: between round start and reveal, no message may contain the answer or clue unless the player earned it.
let leaks = 0;
for (const [r, game] of [[r1, 'contexto'], [r2, 'davini']]) {
  const secrets = [r.reveal.answer.toLowerCase()]; // the Davini clue is public by design
  const has = m => { const s = JSON.stringify(m).toLowerCase(); return secrets.some(x => s.includes(x)); };
  for (const p of players) {
    const start = p.msgs.findIndex(m => m.type === 'round' && m.gameId === game);
    const stop = p.msgs.findIndex((m, i) => i > start && m.type === 'reveal');
    for (const m of p.msgs.slice(start, stop)) {
      const earned = m.type === 'reply' && (m.rank === 1 || m.stage === 'solved' || m.stage === 'decoded');
      if (!earned && m.type !== 'reply' && has(m)) { leaks++; if (leaks < 3) console.log('LEAK', JSON.stringify(m).slice(0, 200)); }
    }
  }
  for (const m of host.msgs.filter(m => m.type === 'round' || m.type === 'board')) if (has(m)) { leaks++; console.log('HOST LEAK', m.type); }
}

const lat = stats.latencies.sort((a, b) => a - b);
const med = lat[Math.floor(lat.length / 2)], p95 = lat[Math.floor(lat.length * 0.95)], max = lat[lat.length - 1];
const billed = Math.round(stats.opened + stats.sent / 20 + (CTX_S + DAV_S));
console.log(`guesses sent: ${stats.sent} | replies: ${stats.replies} | latency ms median ${med}, p95 ${p95}, max ${max}`);
console.log(`unexpected disconnects: ${stats.unexpectedClose} | leaks: ${leaks}`);
console.log(`estimated billed requests (connections + messages/20 + 1 alarm/s): ${billed} for both rounds`);
for (const p of [...players, host, extra]) { p.expectClose = true; p.close(); }
process.exit(stats.unexpectedClose || leaks || joined !== 200 || fullErr !== 'FULL' || med > 500 ? 1 : 0);
