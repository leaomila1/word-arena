// Late join plays at once; mystery box earned after 3 wrong Davini answers; opening it notifies the host.
const base = process.argv[2] || 'http://127.0.0.1:8787', wsBase = base.replace(/^http/, 'ws');
const open = c => new Promise((res, rej) => { const ws = new WebSocket(`${wsBase}/ws/${c}`); ws.msgs = []; ws.onmessage = e => ws.msgs.push(JSON.parse(e.data)); ws.onopen = () => res(ws); ws.onerror = rej; });
const wait = ms => new Promise(r => setTimeout(r, ms)), tx = (ws, m) => ws.send(JSON.stringify(m));
const last = (ws, t) => [...ws.msgs].reverse().find(m => m.type === t);
let fails = 0; const check = (n, ok, x = '') => { console.log(ok ? 'PASS' : 'FAIL', n, x); if (!ok) fails++; };
const { code, hostToken } = await (await fetch(`${base}/rooms`, { method: 'POST' })).json();
const host = await open(code); tx(host, { type: 'host', hostToken }); await wait(200);
tx(host, { type: 'start', gameId: 'davini', context: 'ko' }); await wait(400);
const a = await open(code); tx(a, { type: 'join', name: 'Late' }); await wait(400);
check('late joiner gets the round', !!last(a, 'round') && last(a, 'joined').spectator === false);
for (let i = 0; i < 3; i++) { tx(a, { type: 'guess', text: 'nope' + i }); await wait(2100); }
check('box earned after 3 wrong', last(a, 'reply')?.boxes === 1, JSON.stringify(last(a, 'reply')));
tx(a, { type: 'open' }); await wait(300);
const it = last(a, 'item');
check('box opens to letter or double', ['letter', 'double'].includes(it?.item), JSON.stringify(it));
check('host told who got what', last(host, 'gotItem')?.name === 'Late');
tx(a, { type: 'open' }); await wait(300);
check('no second box yet', last(a, 'item')?.error === 'NO_BOX');
tx(host, { type: 'close' }); await wait(200);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
