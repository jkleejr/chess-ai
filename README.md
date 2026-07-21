# My Chess

A personal AI chess coach for macOS. It downloads your chess.com games, analyzes
every move with a local Stockfish engine, and uses Claude to explain your
mistakes, track your recurring tendencies, and coach you toward improvement —
like chess.com's Game Review, but personalized to *your* play and history.

<img width="1267" height="832" alt="Screenshot 2026-07-21 at 3 39 01 AM" src="https://github.com/user-attachments/assets/f89c1b1d-2723-4e0f-9545-003a06c724c0" />


## What it does

- **Syncs your chess.com games** (public API, incremental — only new games are
  fetched on re-sync)
- **Engine analysis** with a local Stockfish: per-move evals, best moves,
  brilliant/best/inaccuracy/mistake/blunder classification, and chess.com-style
  accuracy scores. Runs at low CPU priority, on demand.
- **AI coaching** (bring your own Anthropic API key):
  - Per-game reviews (Claude Haiku, ~$0.01/game): what happened at each critical
    moment, why, and the better plan — connected to your known tendencies
  - "Explain this move" on any position
  - Deep **style reports** (Claude Sonnet, ~$0.25): your playing style,
    recurring mistakes with evidence, opening repertoire advice, improvement plan
- **Player profile that learns**: every coached game feeds mistake tags and
  stats into a persistent profile that future coaching builds on
- **Insights dashboard**: accuracy over time, opening win rates, recurring
  mistake patterns, AI spend tracker

Everything is stored locally in SQLite (`~/Library/Application Support/chess-ai/`).
The API key is encrypted via the macOS Keychain and never leaves your machine
except to call the Anthropic API. No game is ever analyzed or billed twice.

## Development

```bash
npm install
npm run dev        # launch with hot reload
npm test           # unit tests (handles the better-sqlite3 ABI swap)
npm run typecheck
npm run build:mac  # package a DMG
```

Stockfish is located from `PATH`/Homebrew or downloaded on first run from the
official releases. Headless smoke tests for the coaching pipeline:
`COACH_SMOKE_GAME=<id> npx electron .` or `STYLE_SMOKE=1 npx electron .`.

## Stack

Electron (electron-vite) · React · TypeScript · better-sqlite3 · chess.js ·
react-chessboard · Stockfish (UCI) · Anthropic SDK (structured outputs + prompt
caching) · vitest
