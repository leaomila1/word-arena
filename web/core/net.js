// WebSocket connection with auto-reconnect. Re-sends the identify message (host/join) on every reconnect.
// Stops for good on a 'closed' message (room gone, kicked) or after 6 attempts that never connected.
import { WORKER_URL } from '../config.js';

export function connect(code, identify) {
  const handlers = {};
  let ws, closed = false, delay = 1000, failedOpens = 0;
  const emit = (type, msg) => (handlers[type] || []).forEach(fn => fn(msg));
  const open = () => {
    let opened = false;
    ws = new WebSocket(`${WORKER_URL.replace(/^http/, 'ws')}/ws/${code}`);
    ws.onopen = () => { opened = true; failedOpens = 0; delay = 1000; emit('_status', 'online'); ws.send(JSON.stringify(identify())); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.type === 'closed') closed = true; emit(m.type, m); emit('*', m); };
    ws.onclose = () => {
      if (closed) return;
      if (!opened && ++failedOpens >= 6) { closed = true; emit('closed', { type: 'closed', reason: 'NO_SERVER' }); return; }
      emit('_status', 'offline'); setTimeout(open, delay); delay = Math.min(delay * 2, 5000);
    };
  };
  // Phones: a socket can die silently while the screen is off. On wake, reconnect if it is not open.
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !closed && ws?.readyState !== 1 && ws?.readyState !== 0) open(); });
  open();
  return {
    send: obj => { if (ws?.readyState === 1) { ws.send(JSON.stringify(obj)); return true; } return false; },
    on: (type, fn) => ((handlers[type] ||= []).push(fn)),
    close: () => { closed = true; ws?.close(); },
  };
}

export async function createRoom() {
  const r = await fetch(`${WORKER_URL}/rooms`, { method: 'POST' });
  if (!r.ok) throw new Error('Could not create a room');
  return r.json();
}
