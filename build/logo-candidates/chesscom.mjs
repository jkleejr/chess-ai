// chess.com-style black knight icon: classic staunton silhouette (Cburnett,
// which chess.com's classic set closely follows), restyled with the
// chess.com charcoal body + soft gradient + light-gray detail lines,
// redrawn as vector so it is crisp at every size.
import { writeFileSync } from 'fs'

// Colors sampled from the reference screenshot (chess.com classic black knight)
const TILE_BG = '#f0dbb9' // the screenshot's cream background (chess.com light square)
const OUTLINE = '#26251f'
const BODY_TOP = '#605e59'
const BODY_BOTTOM = '#3b3a36'
const DETAIL = '#8e8c86' // eye / mane stripe / base seam — light gray, not white

function knight({ detail = DETAIL, strokeW = 1.5 } = {}) {
  return `
<defs>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${BODY_TOP}"/>
    <stop offset="1" stop-color="${BODY_BOTTOM}"/>
  </linearGradient>
</defs>
<g style="fill:none;fill-rule:evenodd;stroke:${OUTLINE};stroke-width:${strokeW};stroke-linecap:round;stroke-linejoin:round" transform="translate(0,0.3)">
  <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:url(#body);" />
  <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:url(#body);" />
  <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" style="fill:${detail};stroke:${detail};" />
  <path d="M 15 15.5 A 0.5 1.5 0 1 1  14,15.5 A 0.5 1.5 0 1 1  15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:${detail};stroke:${detail};" />
  <path d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z" style="fill:${detail};stroke:none;" />
</g>`
}

// White macOS rounded tile; knight + a chess.com-style two-tier pedestal base.
function icon({ knightScale = 19.6, ty = 16, opts = {} } = {}) {
  const size = 45 * knightScale
  const tx = (1024 - size) / 2
  const bottom = ty + 39 * knightScale // knight art sits on y=39 of its 45u box
  // Base centered under the piece's footprint (u15..u38 → weighted center)
  const cx = tx + 26.5 * knightScale
  const k = knightScale / 17.5 // base dims proportional to the knight
  const collarW = 390 * k
  const plinthW = 470 * k
  const collarH = 40 * k
  const plinthH = 58 * k
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="baseg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${BODY_TOP}"/>
      <stop offset="1" stop-color="${BODY_BOTTOM}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="230" fill="${TILE_BG}"/>
  <g transform="translate(${tx.toFixed(1)}, ${ty.toFixed(1)}) scale(${knightScale})">${knight(opts)}</g>
  <g stroke="${OUTLINE}" stroke-width="8" stroke-linejoin="round">
    <rect x="${cx - collarW / 2}" y="${bottom - 4}" width="${collarW}" height="${collarH}" rx="12" fill="url(#baseg)"/>
    <rect x="${cx - plinthW / 2}" y="${bottom - 4 + collarH}" width="${plinthW}" height="${plinthH}" rx="16" fill="url(#baseg)"/>
  </g>
  <rect x="${cx - collarW / 2 + 26}" y="${bottom + 4}" width="${collarW - 52}" height="7" rx="3.5" fill="${DETAIL}" opacity="0.85"/>
  <rect x="${cx - plinthW / 2 + 30}" y="${bottom + collarH + 5}" width="${plinthW - 60}" height="7" rx="3.5" fill="${DETAIL}" opacity="0.85"/>
</svg>`
}

writeFileSync('chesscom-v1.svg', icon())

writeFileSync(
  'chesscom-preview.html',
  `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,sans-serif;background:#e9e8e4;margin:30px}
  .row{display:flex;gap:40px;align-items:flex-end}
  .col{text-align:center}.col div{font-size:13px;color:#666;margin-top:8px}
  img.ref{width:200px;image-rendering:pixelated}
  </style></head><body>
  <div class="row">
    <div class="col"><img class="ref" src="reference-chesscom.png"><div>reference (chess.com)</div></div>
    <div class="col"><img src="chesscom-v1.svg" width="360"><div>vector redraw 360px</div></div>
    <div class="col"><img src="chesscom-v1.svg" width="128"><div>128</div></div>
    <div class="col"><img src="chesscom-v1.svg" width="64"><div>64</div></div>
    <div class="col"><img src="chesscom-v1.svg" width="32"><div>32</div></div>
  </div>
  </body></html>`
)
console.log('chesscom-v1 written')
