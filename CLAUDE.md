# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Electron Teleprompter is a desktop app that displays markdown/HTML as a translucent overlay, allowing users to read scripts while seeing through to presentations or video calls. Built with Electron.js using ES modules (`"type": "module"`).

## Commands

- **Start app:** `npm start`
- **Build:** `npm run build` (uses `@electron/packager`, outputs to `dist/`)
- **Lint:** `npm run lint` (ESLint with `--fix`, uses `eslint-config-reverentgeek`)
- **Install deps:** `pnpm install` (pnpm v10.30.2 is the configured package manager)
- **No test suite** — there are no tests configured

## Architecture

```
Main Process (src/main.js)
    ├── IPC messages: "content", "refresh", "error-messages"
    ├── menus.js — app menu with File > Open for loading scripts
    └── utils/
        ├── state.js — persists window geometry to app-state.json
        └── content.js — markdown→HTML via showdown, injects H2 anchor navigation
            │
            │  IPC "content" sends HTML
            ▼
Preload (src/client/teleprompter-preload.mjs)
    - Receives "content" IPC, injects into #md element
    - Exposes window.electron.refresh() to renderer
            │
            ▼
Renderer (src/client/teleprompter.js + teleprompter.html + teleprompter.css)
    - Keyboard/clicker navigation: arrow keys jump between H2 sections
    - Scroll-based refresh (debounced) for transparent window repainting
```

**Data flow for opening a file:** Menu open dialog → `readAndConvertMarkdown()` (reads file, converts via showdown, injects `<a name="N">` anchors before H2s, appends scroll padding) → sends HTML over IPC → preload injects into DOM → renderer triggers `forceRepaint()`.

**File watching:** Main process uses `chokidar` to watch the opened script file and auto-reloads on external changes.

**Window:** Frameless, transparent, always-on-top. Position/size persisted via `state.js` to `~/Library/Application Support/Electron Teleprompter/app-state.json`.

## Code Style

- ES modules throughout (`.js` and `.mjs` extensions)
- Tab indentation
- ESLint config splits: `node-esm` rules for main process, `browser` rules for `src/client/`
- Requires Node.js >= 22.16.0
