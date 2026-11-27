import { connect } from './core/net.js';
import { renderTimer } from './core/timer.js';
import { $, show, ERRORS, CLOSED } from './core/dom.js';
import { mountSky, islandSvg, confetti } from './core/scene.js';
import { sfx, unlockAudio, muteButton } from './core/sfx.js';

const code = new URLSearchParams(location.search).get('code');
if (!/^\d{6}$/.test(code || '')) location.replace('index.html');
else init();

function init() {
  mountSky({ density: 'light' });
  document.body.append(muteButton());
  $('#code').textContent = code;
  $('#waitIsland').innerHTML = islandSvg({ seed: 11, trees: 3 });
  const KEY = `player:${code}`;
  const NAMES = { contexto: 'Guess the Word', davini: 'Davini' };
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
  let saved = load(), net = null, game = null, stopTimer = null, seq = 0, typedName = '';
  const forget = () => { saved = null; try { sessionStorage.removeItem(KEY); } catch {} };
  const submitBtn = $('#nameForm button');

  function backToNameForm(text) {
    net?.close(); net = null; forget();
    $('#msg').textContent = text; submitBtn.disabled = false; show('name');
  }

  function start(name) {
    if (net) return; // already connecting
    typedName = name; submitBtn.disabled = true;
    net = connect(code, () => ({ type: 'join', name: saved?.name ?? typedName, token: saved?.token }));
    net.on('_status', s => ($('#status').hidden = s === 'online'));
    net.on('error', m => backToNameForm(ERRORS[m.code] || m.code));
    net.on('joined', m => {
      saved = { name: m.name, token: m.token };
      try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch {}
      submitBtn.disabled = false;
      $('#me').textContent = m.name;
      $('#waitText').textContent = m.spectator ? 'A round is running. You will join the next one!' : 'Watch the big screen. The game starts soon.';
      if (m.phase !== 'round' || m.spectator) show('wait');
    });
    net.on('round', async m => {
      const my = ++seq;
      sfx.start();
      $('#roundTitle').textContent = NAMES[m.gameId];
      stopTimer?.(); stopTimer = renderTimer($('#timer'), m.endsAt, { onTick: s => s <= 5 && s > 0 && sfx.tick() });
      game?.unmount();
      const mod = await import(`./games/${m.gameId}/player.js`);
      if (my !== seq) return; // reveal arrived while loading
      game = mod.mount($('#game-root'), net, m);
      show('round');
    });
    net.on('reply', m => game?.update(m));
    net.on('reveal', async m => {
      const my = ++seq;
      stopTimer?.(); game?.unmount(); game = null;
      $('#gained').textContent = m.you ? `+${m.you.gained} points` : 'Round over';
      $('#total').textContent = m.you?.score ?? '–';
      const mod = await import(`./games/${m.gameId}/host.js`);
      if (my !== seq) return;
      $('#reveal-root').replaceChildren(mod.renderReveal(m.reveal, { compact: true }));
      show('reveal'); sfx.fanfare(); if (m.you?.gained >= 400) confetti(50);
    });
    net.on('lobby', () => { $('#waitText').textContent = 'Watch the big screen. The next game starts soon.'; show('wait'); });
    net.on('closed', m => { forget(); $('#closedText').textContent = CLOSED[m.reason] || CLOSED.CLOSED; show('closed'); });
  }

  $('#nameForm').onsubmit = e => { e.preventDefault(); unlockAudio(); sfx.pop(); $('#msg').textContent = ''; start($('#name').value.trim()); };
  if (saved) start(saved.name); else show('name');
}
