// 2D "sky islands" scene: pastel sunset sky, puffy clouds, floating grass islands with waterfalls.
// Everything is inline SVG — no image downloads.

export const FLAGS = { en: '1F1EC-1F1E7', fr: '1F1EB-1F1F7', ru: '1F1F7-1F1FA', ko: '1F1F0-1F1F7', zh: '1F1E8-1F1F3' };
let uid = 0;

// Deterministic pseudo-random so islands look the same on every render.
const rnd = seed => () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

export function islandSvg({ flag, seed = 1, waterfall = true, trees = 3, label } = {}) {
  const r = rnd(seed), id = `i${++uid}`;
  // jagged rocky underside
  const pts = [[8, 46]];
  for (let x = 20; x <= 180; x += 16) pts.push([x, 58 + r() * 14 + (100 - Math.abs(100 - x)) * 0.62]);
  pts.push([192, 46]);
  // rounded, chunky underside like the reference (not a sharp cone)
  const rock = `M8 46 Q2 70 22 92 Q40 130 70 150 Q100 176 130 150 Q160 125 176 92 Q198 70 192 46 Z`;
  const chunks = pts.slice(1, -1).map(([x, y]) => `<circle cx="${x}" cy="${Math.min(y, 150).toFixed(0)}" r="${(6 + r() * 6).toFixed(1)}" fill="#A8714F" opacity=".55"/>`).join('');
  const treeEls = Array.from({ length: trees }, (_, i) => {
    const x = 40 + i * (120 / Math.max(1, trees - 1)) + (r() - .5) * 14, s = 9 + r() * 6;
    return `<rect x="${x - 1.5}" y="${30 - s}" width="3" height="${s}" fill="#7A4E36"/><circle cx="${x}" cy="${26 - s}" r="${s}" fill="#4FAE3E"/><circle cx="${x - 3}" cy="${23 - s}" r="${s * .55}" fill="#7DD55E"/>`;
  }).join('');
  const flowers = Array.from({ length: 9 }, () => `<circle cx="${20 + r() * 160}" cy="${36 + r() * 14}" r="2.2" fill="${['#FF7EB6', '#FFD23F', '#fff', '#FF8A5B'][Math.floor(r() * 4)]}"/>`).join('');
  return `<svg viewBox="0 0 200 ${waterfall ? 230 : 180}" class="island-svg" aria-hidden="true">
  <defs>
    <linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C98B63"/><stop offset="1" stop-color="#6E4532"/></linearGradient>
    <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8F7FF"/><stop offset="1" stop-color="#E8F7FF" stop-opacity="0"/></linearGradient>
  </defs>
  ${waterfall ? `<rect x="146" y="44" width="9" height="180" fill="url(#${id}w)" class="waterfall"/>` : ''}
  <path d="${rock}" fill="url(#${id}r)"/>${chunks}
  <path d="M8 46 Q2 70 22 92 Q40 130 70 150 Q90 164 100 166 Q70 140 52 104 Q40 76 40 50 Z" fill="#E0A27A" opacity=".45"/>
  <path d="M30 70 Q70 78 110 70 M50 95 Q90 102 130 92 M75 120 Q100 126 120 118" stroke="#5A3727" stroke-width="2" fill="none" opacity=".35"/>
  <ellipse cx="100" cy="44" rx="94" ry="20" fill="#5BBF4A"/>
  <ellipse cx="96" cy="40" rx="84" ry="14" fill="#8FE070"/>
  <path d="M10 48 q6 10 10 0 q6 12 12 0 q5 8 10 0 M150 50 q6 10 10 0 q6 9 12 0" fill="#5BBF4A"/>
  ${waterfall ? `<ellipse cx="150" cy="42" rx="14" ry="5" fill="#7FD3F7"/>` : ''}
  ${treeEls}${flowers}
  ${flag ? `<line x1="100" y1="38" x2="100" y2="2" stroke="#6E4532" stroke-width="3"/><image href="vendor/openmoji/${flag}.svg" x="100" y="-6" width="40" height="40"/>` : ''}
  ${label ? `<text x="100" y="${waterfall ? 226 : 178}" text-anchor="middle" class="island-label">${label}</text>` : ''}
</svg>`;
}

function cloudSvg(seed) {
  const r = rnd(seed), id = `c${++uid}`;
  // puffy cumulus: a row of round bottoms + bigger puffs on top, soft pink shading underneath
  const bottom = Array.from({ length: 7 }, (_, i) => `<circle cx="${40 + i * 30}" cy="${82 + r() * 6}" r="${24 + r() * 8}"/>`).join('');
  const top = Array.from({ length: 5 }, (_, i) => `<circle cx="${62 + i * 34 + r() * 10}" cy="${58 - Math.sin((i + .5) / 5 * Math.PI) * (26 + r() * 14)}" r="${26 + Math.sin((i + .5) / 5 * Math.PI) * 18 + r() * 6}"/>`).join('');
  return `<svg viewBox="0 0 260 120" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset=".25" stop-color="#FFFFFF"/><stop offset="1" stop-color="#F6CFE2"/></linearGradient></defs><g fill="url(#${id})">${top}${bottom}</g></svg>`;
}

// Fixed background behind the page. density: 'full' (home/host) or 'light' (phones).
export function mountSky({ density = 'full' } = {}) {
  if (document.querySelector('.sky')) return;
  const sky = document.createElement('div');
  sky.className = 'sky';
  const clouds = density === 'full'
    ? [[2, 8, 34, 5], [60, 4, 40, 9], [30, 52, 46, 13], [72, 60, 36, 21], [-6, 74, 38, 33]]
    : [[-10, 6, 70, 5], [40, 70, 80, 9]];
  const isl = density === 'full'
    ? [[3, 30, 9, 2, 0], [86, 18, 11, 7, 1], [12, 78, 7, 11, 0], [80, 74, 13, 17, 1]]
    : [[78, 14, 22, 3, 0]];
  sky.innerHTML = clouds.map(([x, y, w, s]) => `<div class="cloud" style="left:${x}%;top:${y}%;width:${w}%;animation-duration:${60 + s * 3}s">${cloudSvg(s)}</div>`).join('')
    + isl.map(([x, y, w, s, wf]) => `<div class="float-island" style="left:${x}%;top:${y}%;width:${w}%;animation-delay:-${s}s">${islandSvg({ seed: s, waterfall: !!wf, trees: 2 })}</div>`).join('');
  document.body.prepend(sky);
}

// Confetti burst (respects reduced motion).
export function confetti(n = 80) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = document.createElement('div'); box.className = 'confetti'; box.setAttribute('aria-hidden', 'true');
  const colors = ['#FF6B6B', '#FFD23F', '#5BBF4A', '#4CC9F0', '#B983FF', '#FF8FC7'];
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-delay:${Math.random() * .6}s;animation-duration:${2 + Math.random() * 1.5}s;transform:rotate(${Math.random() * 360}deg)`;
    box.append(p);
  }
  document.body.append(box); setTimeout(() => box.remove(), 4500);
}
