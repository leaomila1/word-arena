// Tiny DOM helper. Text is always set with textContent (player names are untrusted).
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return el;
}
export const $ = (s, root = document) => root.querySelector(s);
export const show = (id) => document.querySelectorAll('[data-view]').forEach(v => (v.hidden = v.dataset.view !== id));
export const CONTEXTS = { mixed: 'All five', en: 'English', fr: 'French', ru: 'Russian', ko: 'Korean', zh: 'Chinese' };
export const ERRORS = {
  FULL: 'This room is full (200 players).', NAME_TAKEN: 'That name is taken. Try another one.',
  NAME_INVALID: 'Please choose a different name (1–16 characters, no rude words).', BAD_HOST: 'This host link is not valid.',
  NO_CONTENT: 'No words available for this choice.', CANNOT_START: 'A round is already running.',
  ALREADY_JOINED: 'You are already in this game.',
};
export const CLOSED = {
  NO_ROOM: 'This game code does not exist or the game has ended. Check the code on the big screen.',
  NO_SERVER: 'Cannot reach the game server. Check the Wi-Fi and try again.',
  KICKED: 'The teacher removed you from this game.', CLOSED: 'The game has ended. Thanks for playing!', IDLE: 'The game ended because nobody played for 30 minutes.',
};
export function toast(text) { const t = h('div', { class: 'toast', role: 'alert' }, text); document.body.append(t); setTimeout(() => t.remove(), 3500); }
