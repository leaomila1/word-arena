// E2E: start a round of each game, guess, end, check reveal + no answer before reveal.
const base = process.argv[2] || 'http://127.0.0.1:8787', wsBase = base.replace(/^http/, 'ws');
const open = c => new Promise((res, rej) => { const ws = new WebSocket(`${wsBase}/ws/${c}`); ws.msgs = []; ws.onmessage = e => ws.msgs.push(JSON.parse(e.data)); ws.onopen = () => res(ws); ws.onerror = rej; });
const wait = ms => new Promise(r => setTimeout(r, ms)), tx = (ws, m) => ws.send(JSON.stringify(m));
const last = (ws, t) => [...ws.msgs].reverse().find(m => m.type === t);
const { code, hostToken } = await (await fetch(`${base}/rooms`, { method: 'POST' })).json();
const host = await open(code); tx(host, { type: 'host', hostToken });
const p = await open(code); tx(p, { type: 'join', name: 'Ann' }); await wait(300);
for (const [gameId, guesses, answer] of [['contexto', ['dog', 'cat'], 'cat'], ['davini', ['winter dish', 'kimchi'], 'kimchi']]) {
  tx(host, { type: 'start', gameId, context: 'mixed' }); await wait(300);
  const before = JSON.stringify(p.msgs);
  for (const g of guesses) { tx(p, { type: 'guess', text: g }); await wait(gameId === 'davini' ? 3100 : 1600); }
  const replies = p.msgs.filter(m => m.type === 'reply').slice(-2);
  await wait(1200);
  console.log(gameId, 'replies:', JSON.stringify(replies), '| board:', !!last(host, 'board'));
  console.log(gameId, 'answer leaked before guess:', before.toLowerCase().includes(answer));
  tx(host, { type: 'end' }); await wait(400);
  console.log(gameId, 'reveal:', last(p, 'reveal')?.reveal.answer, 'you:', JSON.stringify(last(p, 'reveal')?.you));
}
const late = await open(code); tx(host, { type: 'start', gameId: 'contexto' }); await wait(200); tx(late, { type: 'join', name: 'Late' }); await wait(300);
console.log('late spectator:', last(late, 'joined').spectator, 'got round:', !!last(late, 'round'));
tx(host, { type: 'close' }); await wait(300); console.log('closed:', last(p, 'closed')?.reason);
process.exit(0);
