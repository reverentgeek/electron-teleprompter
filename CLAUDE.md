# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Electron Teleprompter is a desktop app that displays markdown/HTML as a translucent overlay, allowing users to read scripts while seeing through to presentations or video calls. Built with Electron.js using ES modules (`"type": "module"`). Includes a built-in CodeMirror 6 markdown editor that toggles with the preview.

## Commands

- **Start app:** `npm start` (runs `build:editor` automatically via `prestart`)
- **Build:** `npm run build` (uses `@electron/packager`, outputs to `dist/`)
- **Build editor bundle:** `npm run build:editor` (esbuild bundles CodeMirror into `src/client/editor-bundle.js`)
- **Lint:** `npm run lint` (ESLint with `--fix`, uses `eslint-config-reverentgeek`)
- **Install deps:** `pnpm install` (pnpm v10.30.2 is the configured package manager)
- **No test suite** — there are no tests configured

## Architecture

```
Main Process (src/main.js)
    ├── IPC: "content", "fontSize", "opacity", "mirrored"
    ├── IPC (editor): "requestRawMarkdown", "saveFile", "saveFileAs", "editorDirty",
    │                  "pauseWatcher", "resumeWatcher", "saveAndClose"
    ├── IPC (to renderer): "rawMarkdown", "saveResult", "toggleEditor",
    │                       "menuSave", "menuSaveAs", "requestSaveBeforeClose"
    ├── menus.js — File > Open/Save/Save As, Edit > Toggle Editor
    └── utils/
        ├── state.js — persists app state to app-state.json
        └── content.js — markdown→HTML via showdown, + readRawMarkdown for editor
            │
            │  IPC sends HTML + settings to renderer
            ▼
Preload (src/client/teleprompter-preload.mjs)
    - Pure IPC bridge via contextBridge
    - Exposes: onContent, onFontSize/saveFontSize, onOpacity/saveOpacity, onMirrored/saveMirrored
    - Editor: requestRawMarkdown/onRawMarkdown, saveFile/saveFileAs/onSaveResult,
              onToggleEditor, setEditorDirty, pauseWatcher/resumeWatcher,
              onRequestSaveBeforeClose/saveAndClose, onMenuSave/onMenuSaveAs
            │
            ▼
Renderer (src/client/teleprompter.js [module] + teleprompter.html + teleprompter.css)
    - Preview mode: keyboard/clicker navigation, font size, opacity, mirror controls
    - Edit mode: CodeMirror 6 editor with markdown syntax, one-dark theme
    - Cmd+E toggles between preview and edit modes
    - All DOM manipulation happens here (not in preload)

Editor Bundle (src/client/editor.js → editor-bundle.js via esbuild)
    - CodeMirror 6 entry point bundled as IIFE (window.EditorModule)
    - editor-bundle.js is gitignored and rebuilt on npm start/build
```

**Data flow for opening a file:** Menu or recent file click → `openScriptFile()` → `readAndConvertMarkdown()` (reads file, converts via showdown, injects `<a name="N">` anchors before H2s, appends scroll padding) → sends HTML over IPC → renderer updates `#md` innerHTML.

**Editor mode:** `Cmd+E` enters edit mode → pauses file watcher → requests raw markdown via IPC → shows CodeMirror editor with opaque dark background. `Cmd+S` saves, `Cmd+Shift+S` saves as. Cancel/toggle returns to preview mode (prompts if dirty). On close with unsaved changes, native dialog offers Save/Don't Save/Cancel.

**File watching:** Main process uses `chokidar` to watch the opened script file and auto-reloads on external changes. Watcher is paused during edit mode to prevent conflicts.

**State persistence:** `app-state.json` at `~/Library/Application Support/Electron Teleprompter/` stores window geometry, fontSize, opacity, mirrored, and recentFiles. On first launch (no state file), the window centers on screen.

**Startup:** Auto-loads the most recent file from `recentFiles` and restores fontSize, opacity, and mirrored settings via `did-finish-load` IPC messages. Always starts in preview mode.

**Preload considerations:** The preload is an ESM file (`.mjs`). `sandbox: false` is required in webPreferences for ESM preloads to work. `nodeIntegration: false` is set for security. The renderer script uses `type="module"` to guarantee it runs after the preload's `contextBridge` setup.

**CSP:** `style-src 'self' 'unsafe-inline'` is required because CodeMirror injects inline styles.

## Code Style

- ES modules throughout (`.js` and `.mjs` extensions)
- Tab indentation
- ESLint config splits: `node-esm` rules for main process, `browser` rules for `src/client/`
- `src/client/editor-bundle.js` is excluded from ESLint (generated file)
- Requires Node.js >= 22.16.0
- Use `??` (nullish coalescing) instead of `||` for settings where `0` or `false` are valid values (e.g., opacity)
