import { connect } from './core/net.js';
import { qrSvg } from './core/qr.js';
import { renderTimer } from './core/timer.js';
import { h, $, show, CONTEXTS, ERRORS, CLOSED } from './core/dom.js';
import { mountSky, confetti, FLAGS } from './core/scene.js';
import { sfx, unlockAudio, startMusic, stopMusic, muteButton, startGameMusic, setGameMusicFast, stopGameMusic } from './core/sfx.js';
import { countdown, tension, calm, banner, drumroll, pauseOverlay } from './core/fx.js';
import { hintChip } from './games/shared.js';
const ROUND_MS = 180_000;

const code = new URLSearchParams(location.search).get('code');
let hostToken = null;
try { hostToken = localStorage.getItem(`host:${code}`) ?? sessionStorage.getItem(`host:${code}`); } catch {}
if (!code || !hostToken) location.replace('index.html');
else init();

function init() {
  const NAMES = { contexto: 'Guess the Word', davini: 'Davini' };
  const GAME_INFO = { contexto: ['🔮', 'Guess the Word', 'Find the secret word by meaning'], davini: ['🗝️', 'Davini', 'Read the emoji — first answer wins'] };
  GAME_INFO.contexto[2] = 'Find the secret word by meaning — first to find it wins';
  mountSky();
  document.body.append(muteButton());
  document.addEventListener('mutechange', e => { if (e.detail) return; if (!$('[data-view=lobby]').hidden) startMusic(); else if (!$('[data-view=round]').hidden && !paused && stopTimer) startGameMusic({ fast: endsAt - Date.now() <= 30_000 }); });
  // Audio may only start after a click on the page.
  document.addEventListener('click', () => { unlockAudio(); if (!$('[data-view=lobby]').hidden) startMusic(); }, { once: true });

  const joinUrl = new URL(`play.html?code=${code}`, location.href).href;
  $('#code').textContent = code;
  $('#joinUrl').textContent = new URL('.', location.href).host + new URL('.', location.href).pathname;
  $('#qr').innerHTML = qrSvg(joinUrl);
  $('#qrMini').innerHTML = qrSvg(joinUrl);
  $('#codeMini').textContent = code;
  const tile = (name, value, img, title, sub, checked) => h('label', { class: 'tile' },
    h('input', { type: 'radio', name, value, checked: checked ? '' : false }),
    h('span', {}, img, title, sub ? h('small', {}, sub) : null));
  $('#gameTiles').append(...Object.entries(GAME_INFO).map(([k, [icon, t, sub]], i) => tile('game', k, h('b', { style: 'font-size:40px;line-height:1' }, icon), t, sub, i === 0)));
  $('#cultureTiles').append(...Object.entries(CONTEXTS).map(([k, v], i) => tile('context', k,
    k === 'mixed' ? h('b', { style: 'font-size:40px;line-height:1.2' }, '🌏') : h('img', { src: `vendor/openmoji/${FLAGS[k]}.svg`, alt: '' }), v, null, i === 0)));
  const picked = name => document.querySelector(`input[name=${name}]:checked`).value;

  const net = connect(code, () => ({ type: 'host', hostToken }));
  let game = null, stopTimer = null, seq = 0, lastCount = 0;
  const names = new Map();
  let roster = [], paused = false, endsAt = 0;
  const ctx = { nameOf: id => names.get(id) ?? '?' };
  const flash = text => { const m = $('#msg'); m.textContent = text; m.hidden = false; setTimeout(() => (m.hidden = true), 3500); };
  const goLobby = () => { clearTimeout(autoScores); document.querySelector('.scoreboard')?.remove(); calm(); pauseOverlay(false); show('lobby'); startMusic(); };

  net.on('_status', s => ($('#status').hidden = s === 'online'));
  net.on('error', m => {
    if (m.code === 'BAD_HOST') { try { localStorage.removeItem(`host:${code}`); } catch {} }
    flash(ERRORS[m.code] || m.code);
  });
  const runTimer = () => { stopTimer?.(); stopTimer = renderTimer($('#timer'), endsAt, { onTick: s => { tension(s, { heartbeat: true }); setGameMusicFast(s <= 30); s > 0 && (s <= 10 ? sfx.tick() : sfx.clock(s)); } }); };
  const setPaused = on => {
    paused = on; $('#pause').textContent = on ? '▶ Continue' : '⏸ Pause';
    pauseOverlay(on);
    if (on) { stopTimer?.(); stopTimer = null; stopGameMusic(); } else { runTimer(); startGameMusic({ fast: endsAt - Date.now() <= 30_000 }); }
  };
  net.on('paused', () => setPaused(true));
  net.on('resumed', m => { endsAt = m.endsAt; sfx.start(); setPaused(false); });
  $('#pause').onclick = () => net.send({ type: paused ? 'resume' : 'pause' });

  // Full scoreboard (everyone in the room, highest first)
  const MEDAL = ['🥇', '🥈', '🥉'];
  let before = new Map(), autoScores = null;
  const snapshot = () => { before = new Map([...roster].sort((a, b) => b.score - a.score).map((p, i) => [p.id, { score: p.score, rank: i }])); };
  const showScores = (opts = {}) => {
    document.querySelector('.scoreboard')?.remove();
    const list = [...roster].sort((a, b) => b.score - a.score);
    const extra = (p, i) => {
      if (!opts.round) return null;
      const b = before.get(p.id), gain = p.score - (b?.score ?? 0), move = b ? b.rank - i : 0;
      return h('span', { class: 'gain' }, gain > 0 ? `+${gain}` : '', move > 0 ? h('em', { class: 'up' }, `▲${move}`) : move < 0 ? h('em', { class: 'down' }, `▼${-move}`) : b ? null : h('em', { class: 'up' }, 'NEW'));
    };
    const box = h('div', { class: 'scoreboard', role: 'dialog', 'aria-label': 'Scoreboard', onclick: e => e.target === box && box.remove() },
      h('div', { class: 'card' },
        h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', { style: 'margin:0;font-size:44px' }, '🏆 Scoreboard'), h('button', { class: 'btn btn--ghost', onclick: () => box.remove() }, 'Close ✕')),
        list.length ? h('ol', {}, list.map((p, i) => h('li', { style: `animation-delay:${Math.min(i, 20) * 60}ms` }, h('span', {}, `${MEDAL[i] ?? `${i + 1}.`} ${p.name}`), h('span', { class: 'row', style: 'gap:10px' }, extra(p, i), h('b', {}, p.score)))))
          : h('p', { class: 'muted' }, 'No players yet.'),
        opts.round ? h('div', { class: 'row' }, h('button', { class: 'btn btn--go', onclick: () => { box.remove(); start(); } }, 'Next round ▶'), h('button', { class: 'btn btn--ghost', onclick: () => { box.remove(); $('#toLobby').click(); } }, 'Change game')) : null));
    document.body.append(box); sfx.fanfare();
  };
  document.querySelectorAll('.js-scores').forEach(b => (b.onclick = () => showScores({ round: !$('[data-view=reveal]').hidden })));
  net.on('hosted', m => { if (m.phase === 'lobby') goLobby(); });
  net.on('lobby', m => {
    $('#count').textContent = m.players.length;
    $('#empty').hidden = m.players.length > 0;
    if (m.players.length > lastCount) sfx.pop();
    lastCount = m.players.length;
    for (const p of m.players) names.set(p.id, p.name);
    roster = m.players;
    $('#players').replaceChildren(...m.players.map(p => h('span', { class: 'chip' }, p.name,
      h('button', { 'aria-label': `Remove ${p.name}`, title: 'Remove', onclick: () => confirm(`Remove ${p.name}?`) && net.send({ type: 'kick', playerId: p.id }) }, '✕'))));
  });
  net.on('round', async m => {
    const my = ++seq;
    clearTimeout(autoScores); document.querySelector('.scoreboard')?.remove();
    if (m.endsAt - Date.now() > ROUND_MS - 5000) snapshot();
    stopMusic(); calm(); pauseOverlay(false); paused = false; $('#pause').textContent = '⏸ Pause'; endsAt = m.endsAt;
    $('#roundTitle').textContent = NAMES[m.gameId];
    game?.unmount(); game = null;
    const mod = await import(`./games/${m.gameId}/host.js`);
    if (my !== seq) return; // a newer message arrived while loading
    game = mod.mount($('#game-root'), net, m, ctx);
    show('round');
    if (m.paused) { renderTimer($('#timer'), m.endsAt)(); return setPaused(true); }
    if (m.endsAt - Date.now() > ROUND_MS - 5000) await countdown(); // fresh round only, not after a reload
    if (my !== seq) return;
    runTimer(); startGameMusic({ fast: m.endsAt - Date.now() <= 30_000 });
  });
  net.on('board', m => game?.update(m));
  net.on('gotItem', m => game?.onItem ? game.onItem(m) : banner(`🎁 ${m.name} got ${m.icon}!`, { tone: 'item', ms: 2200, sound: 'sparkle' }));
  net.on('hint', m => {
    game?.hint?.(m.hints);
    const last = m.hints.at(-1);
    if (last) banner(['New hint! ', hintChip(last)], { sound: 'sparkle' });
  });
  net.on('reveal', async m => {
    const my = ++seq;
    stopTimer?.(); stopGameMusic(); pauseOverlay(false); paused = false;
    const [mod] = await Promise.all([import(`./games/${m.gameId}/host.js`), drumroll(1.8)]);
    if (my !== seq) return;
    game?.unmount(); game = null;
    $('#reveal-root').replaceChildren(mod.renderReveal(m.reveal));
    $('#top').replaceChildren(...m.top.map(p => h('li', {}, `${p.name} — ${p.score}`)));
    show('reveal'); sfx.fanfare(); confetti();
    clearTimeout(autoScores); autoScores = setTimeout(() => { if (!$('[data-view=reveal]').hidden) showScores({ round: true }); }, 8000);
  });
  net.on('closed', m => { stopMusic(); calm(); pauseOverlay(false); try { localStorage.removeItem(`host:${code}`); } catch {} $('#closedText').textContent = CLOSED[m.reason] || 'Room closed'; show('closed'); });

  const start = () => { unlockAudio(); net.send({ type: 'start', gameId: picked('game'), context: picked('context') }); };
  $('#start').onclick = start;
  $('#again').onclick = start;
  $('#endNow').onclick = () => confirm('End this round now?') && net.send({ type: 'end' });
  $('#toLobby').onclick = () => { net.send({ type: 'lobby' }); goLobby(); };
  $('#close').onclick = () => confirm('Close the room for everyone?') && net.send({ type: 'close' });
}
