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
    ├── IPC: "content", "fontSize", "opacity", "mirrored"
    ├── menus.js — File > Open, File > Open Recent
    └── utils/
        ├── state.js — persists app state to app-state.json
        └── content.js — markdown→HTML via showdown, injects H2 anchor navigation
            │
            │  IPC sends HTML + settings to renderer
            ▼
Preload (src/client/teleprompter-preload.mjs)
    - Pure IPC bridge via contextBridge
    - Exposes: onContent, onFontSize/saveFontSize, onOpacity/saveOpacity, onMirrored/saveMirrored
            │
            ▼
Renderer (src/client/teleprompter.js [module] + teleprompter.html + teleprompter.css)
    - Keyboard/clicker navigation: left/right arrows jump between H2 sections
    - Font size, opacity, and mirror mode controls
    - All DOM manipulation happens here (not in preload)
```

**Data flow for opening a file:** Menu or recent file click → `openScriptFile()` → `readAndConvertMarkdown()` (reads file, converts via showdown, injects `<a name="N">` anchors before H2s, appends scroll padding) → sends HTML over IPC → renderer updates `#md` innerHTML.

**File watching:** Main process uses `chokidar` to watch the opened script file and auto-reloads on external changes.

**State persistence:** `app-state.json` at `~/Library/Application Support/Electron Teleprompter/` stores window geometry, fontSize, opacity, mirrored, and recentFiles. On first launch (no state file), the window centers on screen.

**Startup:** Auto-loads the most recent file from `recentFiles` and restores fontSize, opacity, and mirrored settings via `did-finish-load` IPC messages.

**Preload considerations:** The preload is an ESM file (`.mjs`). `sandbox: false` is required in webPreferences for ESM preloads to work. `nodeIntegration: false` is set for security. The renderer script uses `type="module"` to guarantee it runs after the preload's `contextBridge` setup.

## Code Style

- ES modules throughout (`.js` and `.mjs` extensions)
- Tab indentation
- ESLint config splits: `node-esm` rules for main process, `browser` rules for `src/client/`
- Requires Node.js >= 22.16.0
- Use `??` (nullish coalescing) instead of `||` for settings where `0` or `false` are valid values (e.g., opacity)
