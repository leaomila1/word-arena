import { chromium } from 'playwright-core';
import { puzzles } from '/home/claude/word-arena/server/data/davini-data.js';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const W = 'http://127.0.0.1:8080', errs = [];
const host = await (await b.newContext({ viewport: { width: 1920, height: 1080 } })).newPage(); host.on('pageerror', e => errs.push('host:' + e.message));
await host.goto(W + '/index.html'); await host.click('#host'); await host.waitForURL(/host.html/);
await host.waitForFunction(() => document.querySelector('#code').textContent.length === 6);
const code = await host.textContent('#code');
const mk = async n => { const p = await (await b.newContext({ viewport: { width: 360, height: 800 } })).newPage(); p.on('pageerror', e => errs.push(n + ':' + e.message)); await p.goto(`${W}/play.html?code=${code}`); await p.fill('#name', n); await p.click('button[type=submit]'); return p; };
const a = await mk('Ann'), c = await mk('Cam');
const guess = async (p, t, wait = 1600) => { await p.fill('[data-view=round] input', t); await p.press('[data-view=round] input', 'Enter'); await p.waitForTimeout(wait); };

// Davini first (end manually)
await host.click('label:has(input[value=davini])'); await host.click('#start'); await a.waitForSelector('[data-view=round]:not([hidden])');
const cipherLen = (await a.$$eval('[data-view=round] .row .row', els => els.map(e => e.children.length))).join(',');
const pz = puzzles.find(p => p.clue_text.toUpperCase().split(' ').map(w => w.length).join(',') === cipherLen);
await guess(a, 'zzz', 3100); console.log('davini wrong msg:', await a.textContent('[data-view=round] .msg'));
await guess(a, pz.clue_text, 1200); console.log('davini decoded imgs:', (await a.$$('[data-view=round] img.emoji')).length, '| clue shown:', await a.textContent('[data-view=round] h3'));
await a.screenshot({ path: '/tmp/phone-davini.png' });
await guess(c, pz.answer, 1500); console.log('cam skip solved:', await c.textContent('[data-view=round] h2'));
await host.waitForTimeout(1200); await host.screenshot({ path: '/tmp/host-davini.png' });
host.once('dialog', d => d.accept()); await host.click('#endNow'); await host.waitForSelector('[data-view=reveal]:not([hidden])');
console.log('reveal top:', (await host.textContent('#top')).trim(), '| cam:', await c.textContent('#gained'));
await host.screenshot({ path: '/tmp/host-reveal.png' });

// Contexto, wait for natural end at 180 s
await host.click('#toLobby'); await host.click('label:has(input[value=contexto])'); await host.click('#start'); await a.waitForSelector('[data-view=round]:not([hidden])');
const t0 = Date.now();
for (const w of ['food', 'culture', 'zzqq', 'family']) await guess(a, w);
console.log('contexto list:', (await a.$$eval('[data-view=round] .band', els => els.map(e => e.textContent))).slice(0, 4).join(' / '));
await guess(c, 'music'); await a.screenshot({ path: '/tmp/phone-contexto.png' });
await host.waitForTimeout(1500); await host.screenshot({ path: '/tmp/host-contexto.png' });
await host.waitForSelector('[data-view=reveal]:not([hidden])', { timeout: 200000 });
console.log('auto reveal after s:', Math.round((Date.now() - t0) / 1000), '| answer:', await host.textContent('[data-view=reveal] .answer'), '| ann:', await a.textContent('#gained'));
console.log('errors:', errs.length ? errs : 'none');
await b.close();
