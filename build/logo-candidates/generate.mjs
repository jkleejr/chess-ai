// Generates the logo candidate SVGs (1024x1024) and a preview page.
// Base knight: Cburnett chess set (CC-BY-SA, the Wikipedia/lichess pieces).
import { writeFileSync } from 'fs'

// Cburnett black knight, 45x45 viewBox, stroke-based.
const CBURNETT_KNIGHT = `
<g style="fill:none;fill-rule:evenodd;stroke:#111111;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round" transform="translate(0,0.3)">
  <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18" style="fill:#111111;stroke:#111111;" />
  <path d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10" style="fill:#111111;stroke:#111111;" />
  <path d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z" style="fill:#ffffff;stroke:#ffffff;" />
  <path d="M 15 15.5 A 0.5 1.5 0 1 1  14,15.5 A 0.5 1.5 0 1 1  15 15.5 z" transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)" style="fill:#ffffff;stroke:#ffffff;" />
  <path d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z" style="fill:#ffffff;stroke:none;" />
</g>`

// Same knight with the app-accent green highlight stripe instead of white.
const CBURNETT_KNIGHT_ACCENT = CBURNETT_KNIGHT.replaceAll('#ffffff', '#7fa650')

// Minimal angular knight, 100x100 viewBox, single filled path.
const MINIMAL_KNIGHT = `
<path fill="#111111" d="
M 26 88
L 80 88
L 80 79
L 71 72
C 76 58 75 42 66 30
C 60 22 51 17 43 15
L 41 6
L 33 13
L 18 34
C 17 36 17 38 19 40
L 27 47
C 29 49 32 49 34 47
L 41 42
C 37 54 29 62 26 74
Z" stroke-linejoin="round" stroke="#111111" stroke-width="3"/>
<circle cx="38" cy="27" r="3.2" fill="#ffffff"/>`

const MINIMAL_KNIGHT_BASE = `${MINIMAL_KNIGHT}
<rect x="22" y="92" width="62" height="6" rx="3" fill="#111111"/>`

// macOS-style rounded square: full 1024 canvas, radius ≈ 22.5%.
function tile(inner, { border = true, r = 230 } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="8" y="8" width="1008" height="1008" rx="${r}" fill="#ffffff"${border ? ' stroke="#d9d7d2" stroke-width="10"' : ''}/>
  ${inner}
</svg>`
}

// A — Classic: Cburnett knight, large, centered on white rounded square.
const A = tile(`<g transform="translate(150, 122) scale(16)">${CBURNETT_KNIGHT}</g>`)

// B — Circle badge: white circle, double ring, classic knight.
const B = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <circle cx="512" cy="512" r="500" fill="#ffffff" stroke="#111111" stroke-width="14"/>
  <circle cx="512" cy="512" r="452" fill="none" stroke="#111111" stroke-width="5"/>
  <g transform="translate(198, 176) scale(14)">${CBURNETT_KNIGHT}</g>
</svg>`

// C — Minimal mark: angular knight, white rounded square, no border.
const C = tile(`<g transform="translate(122, 92) scale(8)">${MINIMAL_KNIGHT_BASE}</g>`, {
  border: false
})

// D — Classic with green accents: mane stripe + eye in the app green.
const D = tile(
  `<g transform="translate(150, 122) scale(16)">${CBURNETT_KNIGHT_ACCENT}</g>
   <rect x="256" y="905" width="512" height="34" rx="17" fill="#7fa650"/>`
)

writeFileSync('candidate-A.svg', A)
writeFileSync('candidate-B.svg', B)
writeFileSync('candidate-C.svg', C)
writeFileSync('candidate-D.svg', D)

const preview = `<!doctype html>
<html><head><meta charset="utf-8"><title>My Chess — logo candidates</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #f2f1ee; margin: 40px; color: #222; }
  h1 { font-size: 22px; } p { color: #666; max-width: 640px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; max-width: 980px; }
  .cand { background: white; border: 1px solid #ddd; border-radius: 14px; padding: 24px; }
  .cand h2 { margin: 0 0 4px; font-size: 17px; } .cand .desc { font-size: 13px; color: #777; margin-bottom: 16px; }
  .sizes { display: flex; align-items: flex-end; gap: 24px; }
  .sizes img { display: block; }
  .dock { background: linear-gradient(#3c74c9,#274b85); padding: 14px 18px; border-radius: 12px; display: inline-flex; gap: 14px; align-items: end; margin-top: 14px; }
  .lbl { font-size: 11px; color: #999; text-align: center; margin-top: 6px; }
</style></head><body>
<h1>My Chess — logo candidates (black knight on white)</h1>
<p>Each shown at app-icon size, small size, and on a Dock-like background. Tell me A, B, C or D (or what to change).</p>
<div class="grid">
${['A', 'B', 'C', 'D']
  .map(
    (k) => `
  <div class="cand">
    <h2>Candidate ${k}</h2>
    <div class="desc">${
      {
        A: 'Classic tournament knight, macOS rounded-square tile with a subtle border',
        B: 'Circle badge with double ring — crest / club feel',
        C: 'Minimal angular knight — modern flat mark, cleanest at tiny sizes',
        D: 'Classic knight with the app’s green as mane accent + base bar'
      }[k]
    }</div>
    <div class="sizes">
      <div><img src="candidate-${k}.svg" width="180"><div class="lbl">180px</div></div>
      <div><img src="candidate-${k}.svg" width="64"><div class="lbl">64px</div></div>
      <div><img src="candidate-${k}.svg" width="32"><div class="lbl">32px</div></div>
      <div>
        <div class="dock">
          <img src="candidate-${k}.svg" width="56">
          <img src="candidate-${k}.svg" width="56" style="filter: brightness(1)">
        </div>
        <div class="lbl">in the Dock</div>
      </div>
    </div>
  </div>`
  )
  .join('')}
</div></body></html>`
writeFileSync('preview.html', preview)
console.log('generated 4 candidates + preview.html')
