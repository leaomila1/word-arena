// Browser check for hints + suspense effects (needs wrangler dev :8787 and http.server :8080 in web/).
import { chromium } from 'playwright-core';
import { puzzles } from '../server/data/davini-data.js';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const W = 'http://127.0.0.1:8080', errs = [];
const ctx = async opts => { const c = await b.newContext(opts); await c.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: "export const WORKER_URL = 'http://127.0.0.1:8787';" })); return c; };
let fails = 0; const check = (n, ok, extra = '') => { console.log(ok ? 'PASS' : 'FAIL', n, extra); if (!ok) fails++; };
const host = await (await ctx({ viewport: { width: 1920, height: 1080 } })).newPage(); host.on('pageerror', e => errs.push('host:' + e.message));
await host.goto(W + '/index.html'); await host.click('#host'); await host.waitForURL(/host.html/);
await host.waitForFunction(() => document.querySelector('#code').textContent.length === 6);
const code = await host.textContent('#code');
const ph = await (await ctx({ viewport: { width: 390, height: 844 }, hasTouch: true })).newPage(); ph.on('pageerror', e => errs.push('phone:' + e.message));
await ph.goto(`${W}/play.html?code=${code}`); await ph.fill('#name', 'Ann'); await ph.click('button[type=submit]'); await ph.waitForSelector('[data-view=wait]:not([hidden])');
const R = '[data-view=round]';

// ── Guess the Word
await host.click('label:has(input[value=contexto])'); await host.click('label:has(input[value=ko])'); await host.click('#start');
await host.waitForSelector('.fx-count', { timeout: 3000 }); check('host 3-2-1 countdown shown', true);
check('phone countdown shown', !!(await ph.waitForSelector('.fx-count', { timeout: 3000 }).catch(() => null)));
await host.screenshot({ path: '/tmp/fx-countdown.png' });
await ph.waitForSelector(`${R} input`, { timeout: 6000 });
check('countdown gone after ~3 s', !(await host.$('.fx-count')) && !(await ph.$('.fx-count')));
check('no hints yet', (await host.$$('.hints .hint')).length === 0);
await ph.fill(`${R} input`, 'food'); await ph.press(`${R} input`, 'Enter');
await host.waitForTimeout(29_000);
await host.waitForSelector('.hints .hint', { timeout: 6000 });
const hh = await host.textContent('.hints'), ph1 = await ph.textContent('.hints').catch(() => '');
check('host hint 1 = category · Korean', /Korean/.test(hh), hh);
check('phone hint 1 shown', /Korean/.test(ph1), ph1);
check('hint banner on host', !!(await host.$('.fx-banner')));
await host.screenshot({ path: '/tmp/fx-hint-host.png' }); await ph.screenshot({ path: '/tmp/fx-hint-phone.png' });

// tension states (same module instance the page uses)
await host.evaluate(async () => { const fx = await import('./core/fx.js'); fx.tension(25); });
check('last 30 s → tense vignette', await host.evaluate(() => document.body.classList.contains('fx-tense')));
await host.evaluate(async () => { const fx = await import('./core/fx.js'); fx.tension(7); });
check('last 10 s → critical + big number', await host.evaluate(() => document.body.classList.contains('fx-critical') && document.querySelector('.fx-big')?.textContent === '7'));
await host.screenshot({ path: '/tmp/fx-critical.png' });

host.once('dialog', d => d.accept()); await host.click('#endNow');
check('drumroll before reveal', !!(await host.waitForSelector('.fx-roll', { timeout: 3000 }).catch(() => null)));
check('vignette cleared at drumroll', await host.evaluate(() => !document.body.classList.contains('fx-critical')));
await host.waitForSelector('[data-view=reveal]:not([hidden])', { timeout: 5000 });
check('reveal after drumroll, overlay gone', !(await host.$('.fx-roll')));
await ph.waitForSelector('[data-view=reveal]:not([hidden])', { timeout: 5000 });

// ── Davini
await host.click('#toLobby'); await host.click('label:has(input[value=davini])'); await host.click('#start');
await ph.waitForSelector(`${R} input`, { timeout: 7000 });
const clue = (await ph.textContent(`${R} .head`)).replace('Clue: ', '').trim();
const pz = puzzles.find(p => p.clue_text.toUpperCase() === clue && p.context === 'ko');
check('found puzzle for clue', !!pz, clue);
await host.waitForTimeout(30_500);
const slots = (await ph.textContent(`${R} .blanks`)).trim().split(/\s+/);
check('davini 1 letter revealed at 0:30', slots.filter(c => c !== '_').length === 1 && slots.length === pz.answer.length, slots.join(' '));
check('host blanks match phone', (await host.textContent(`${R} .blanks`)).trim().split(/\s+/).join(' ') === slots.join(' '));
await ph.screenshot({ path: '/tmp/fx-davini-phone.png' }); await host.screenshot({ path: '/tmp/fx-davini-host.png' });
await ph.fill(`${R} input`, pz.answer); await ph.press(`${R} input`, 'Enter');
await host.waitForSelector('[data-view=reveal]:not([hidden])', { timeout: 6000 });
check('davini reveal names winner', /Ann got it first/.test(await host.textContent('#reveal-root')));
await host.screenshot({ path: '/tmp/fx-reveal.png' });
check('no page errors', errs.length === 0, errs.join(' | '));
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); await b.close(); process.exit(fails ? 1 : 0);
