// Final "My Chess" icon: John's chosen solid-black knight silhouette
// (redrawn as vector from his reference), on a solid-white macOS rounded tile.
import { writeFileSync } from 'fs'

// Right-facing solid knight, viewBox 0 0 1136 1127 (matches the reference frame).
export const KNIGHT = `
<path fill="#000000" d="
M 258 1055
L 800 1055
C 822 1055 838 1039 838 1017
L 838 940
C 838 915 826 895 800 882
L 772 870
C 772 810 780 760 786 720
C 794 660 786 600 760 560
C 792 545 850 520 890 480
C 916 455 926 425 918 400
C 908 370 860 300 780 235
C 762 220 745 210 728 202
C 738 175 736 140 724 110
C 720 100 708 98 700 106
L 640 168
C 628 165 616 163 604 163
L 560 84
C 554 73 540 74 536 86
C 524 120 516 160 516 196
C 460 230 400 290 355 370
C 300 468 275 590 268 700
C 263 770 268 820 280 870
C 250 885 240 908 240 940
L 240 1017
C 240 1039 256 1055 258 1055
Z"/>`

// The reference's key shape: smooth arch on the left, two ears, right-facing
// muzzle with a chin notch, belly bulge, rounded base. Iterated to match.
export const KNIGHT_V2 = `
<path fill="#000000" d="
M 262 1056
C 240 1056 222 1040 222 1018
L 222 952
C 222 922 236 900 262 888
C 268 886 272 880 271 874
C 258 796 262 700 282 606
C 305 500 350 400 420 320
C 448 288 478 262 508 244
C 510 200 520 150 538 106
C 543 94 558 93 564 104
L 610 190
C 618 188 628 187 638 188
L 692 128
C 700 119 714 121 718 132
C 730 165 732 200 724 230
C 742 240 760 253 778 270
C 850 336 900 410 916 448
C 926 472 918 500 894 522
C 856 556 800 580 762 592
C 786 636 792 696 782 760
C 776 800 770 844 772 874
C 772 880 776 886 782 888
C 808 900 822 922 822 952
L 822 1018
C 822 1040 804 1056 782 1056
Z"/>`

function icon(knight, { knightScale = 0.82, dy = 0 } = {}) {
  // Tile: full-canvas white rounded square (transparent corners in the PNG).
  const s = (1024 * knightScale) / 1127
  const w = 1136 * s
  const tx = (1024 - w) / 2
  const ty = (1024 - 1127 * s) / 2 + dy
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="0" y="0" width="1024" height="1024" rx="230" fill="#ffffff"/>
  <g transform="translate(${tx.toFixed(1)}, ${ty.toFixed(1)}) scale(${s.toFixed(4)})">${knight}</g>
</svg>`
}

writeFileSync('final-v1.svg', icon(KNIGHT))
writeFileSync('final-v2.svg', icon(KNIGHT_V2))

writeFileSync(
  'final-preview.html',
  `<!doctype html><html><head><meta charset="utf-8"><style>
  body{font-family:-apple-system,sans-serif;background:#e9e8e4;margin:30px;display:flex;gap:40px}
  .col{text-align:center}.col div{font-size:13px;color:#666;margin-top:8px}
  img.big{width:360px}
  </style></head><body>
  <div class="col"><img class="big" src="final-v1.svg"><div>v1</div></div>
  <div class="col"><img class="big" src="final-v2.svg"><div>v2</div></div>
  <div class="col"><img src="final-v2.svg" width="128"><br><img src="final-v2.svg" width="64"><br><img src="final-v2.svg" width="32"><div>v2 small</div></div>
  </body></html>`
)
console.log('final v1/v2 written')
