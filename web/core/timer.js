// Countdown to endsAt (server time ms). onTick(secondsLeft) fires once per second. Returns a stop function.
export function renderTimer(el, endsAt, { onTick } = {}) {
  let lastS = null;
  const tick = () => {
    const s = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    if (s === lastS) return; lastS = s;
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('timer--low', s <= 15);
    onTick?.(s);
    if (s === 0) clearInterval(id);
  };
  const id = setInterval(tick, 200); tick();
  return () => clearInterval(id);
}
