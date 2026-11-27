// Hints arrive at 30 s for both host and players, and a reconnecting player gets them in the round message.
const base = process.argv[2] || 'http://127.0.0.1:8787', wsBase = base.replace(/^http/, 'ws');
const open = c => new Promise((res, rej) => { const ws = new WebSocket(`${wsBase}/ws/${c}`); ws.msgs = []; ws.onmessage = e => ws.msgs.push(JSON.parse(e.data)); ws.onopen = () => res(ws); ws.onerror = rej; });
const wait = ms => new Promise(r => setTimeout(r, ms)), tx = (ws, m) => ws.send(JSON.stringify(m));
const last = (ws, t) => [...ws.msgs].reverse().find(m => m.type === t);
let fails = 0; const check = (n, ok) => { console.log(ok ? 'PASS' : 'FAIL', n); if (!ok) fails++; };
const { code, hostToken } = await (await fetch(`${base}/rooms`, { method: 'POST' })).json();
const host = await open(code); tx(host, { type: 'host', hostToken });
const p = await open(code); tx(p, { type: 'join', name: 'Ann' }); await wait(300);
tx(host, { type: 'start', gameId: 'contexto', context: 'ko' }); await wait(500);
check('no hint at start', !last(p, 'hint') && (last(p, 'round').hints ?? []).length === 0);
await wait(31_000);
check('player got hint level 1', last(p, 'hint')?.level === 1 && last(p, 'hint').hints[0].kind === 'category');
check('host got hint level 1', last(host, 'hint')?.level === 1);
const tok = last(p, 'joined').token; p.close(); const p2 = await open(code); tx(p2, { type: 'join', name: 'x', token: tok }); await wait(400);
check('reconnect round msg carries hints', (last(p2, 'round')?.hints ?? []).length === 1);
tx(host, { type: 'close' }); await wait(200);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
