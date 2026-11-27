import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const W = 'http://127.0.0.1:8080', errs = [];
const host = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage(); host.on('pageerror', e => errs.push(e.message));
await host.goto(W + '/index.html'); await host.waitForTimeout(500); await host.screenshot({ path: '/tmp/s-home.png' });
await host.click('#host'); await host.waitForURL(/host.html/); await host.waitForFunction(() => document.querySelector('#code').textContent.length === 6);
const code = await host.textContent('#code');
const ps = [];
for (const [n, words] of [['Mint', ['bread', 'food']], ['Ploy', ['music']], ['Beam', ['animal', 'tree']], ['Fah', ['car']]]) {
  const p = await (await b.newContext({ viewport: { width: 360, height: 800 } })).newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(`${W}/play.html?code=${code}`); await p.fill('#name', n); await p.click('button[type=submit]'); ps.push([p, words]);
}
await host.waitForTimeout(600); await host.screenshot({ path: '/tmp/s-lobby.png' });
await host.click('#start'); await host.waitForTimeout(800);
for (const [p, words] of ps) for (const w of words) { await p.fill('[data-view=round] input', w); await p.press('[data-view=round] input', 'Enter'); await p.waitForTimeout(1600); }
await host.waitForTimeout(1500); await host.screenshot({ path: '/tmp/s-race.png' }); await ps[0][0].screenshot({ path: '/tmp/s-phone.png' });
console.log('errors:', errs.length ? errs : 'none'); await b.close();
