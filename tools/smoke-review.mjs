// Checks for the final-review findings (room level). Usage: node tools/smoke-review.mjs http://127.0.0.1:8787
const base = process.argv[2] || 'http://127.0.0.1:8787', wsBase = base.replace(/^http/, 'ws');
const open = c => new Promise((res, rej) => { const ws = new WebSocket(`${wsBase}/ws/${c}`); ws.msgs = []; ws.onmessage = e => ws.msgs.push(JSON.parse(e.data)); ws.onopen = () => res(ws); ws.onerror = rej; });
const wait = ms => new Promise(r => setTimeout(r, ms)), tx = (ws, m) => ws.send(JSON.stringify(m));
const last = (ws, t) => [...ws.msgs].reverse().find(m => m.type === t);
let fails = 0; const check = (name, ok) => { console.log(ok ? 'PASS' : 'FAIL', name); if (!ok) fails++; };

// 1. Unknown room → closed NO_ROOM (not an endless reconnect)
try { const ws = await open('000000'); await wait(400); check('unknown room says NO_ROOM', last(ws, 'closed')?.reason === 'NO_ROOM'); }
catch { check('unknown room says NO_ROOM', false); }

const { code, hostToken } = await (await fetch(`${base}/rooms`, { method: 'POST' })).json();
const host = await open(code); tx(host, { type: 'host', hostToken });

// 3. One socket cannot create many players; host socket cannot join
const spam = await open(code);
for (let i = 0; i < 5; i++) tx(spam, { type: 'join', name: 'bot' + i });
await wait(500);
check('one socket = one player', last(host, 'lobby').players.length === 1);
tx(host, { type: 'join', name: 'sneaky' }); await wait(300);
check('host socket cannot join as player', !last(host, 'lobby').players.some(p => p.name === 'sneaky') && last(host, 'error')?.code === 'ALREADY_JOINED');

// 3b. Message flood closes the socket
const flood = await open(code); tx(flood, { type: 'join', name: 'Flood' });
let closed = false; flood.onclose = () => (closed = true);
for (let i = 0; i < 60; i++) tx(flood, { type: 'guess', text: 'x' });
await wait(600);
check('flooding socket is closed', closed);

// 4. Kicked while offline → wakes up with old token → KICKED, name not reusable
const rude = await open(code); tx(rude, { type: 'join', name: 'Rude' }); await wait(300);
const { token, playerId } = last(rude, 'joined'); rude.close(); await wait(200);
tx(host, { type: 'kick', playerId }); await wait(300);
const back = await open(code); tx(back, { type: 'join', name: 'Rude', token }); await wait(300);
check('kicked token gets closed KICKED', last(back, 'closed')?.reason === 'KICKED');

// 12. Inherited gameId does not crash the room
tx(host, { type: 'start', gameId: 'constructor' }); await wait(300);
check('bad gameId → CANNOT_START', last(host, 'error')?.code === 'CANNOT_START');

// 14. Room creation from a foreign origin is refused when ALLOWED_ORIGIN is set (only checkable on a deployed Worker)
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
