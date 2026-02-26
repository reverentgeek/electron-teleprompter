# TODO

## Features

- [ ] Auto-scroll mode — toggleable auto-scroll at configurable speed (words-per-minute), spacebar to toggle, up/down to adjust speed
- [ ] Opacity control — keyboard shortcut or slider to adjust background opacity (currently hardcoded `#00000011`)
- [ ] Drag-to-resize handle — visible resize affordance for the frameless window
- [ ] If the state file doesn't exist, center the teleprompter window on the screen
- [ ] Add a basic markdown editor
- [ ] Allow for custom CSS

## Completed

- [x] Font size adjustment at runtime — `Cmd/Ctrl+Plus`/`Cmd/Ctrl+Minus` to scale up/down, `Cmd/Ctrl+0` to reset
- [x] Persist last opened file — auto-load on next launch
- [x] Recently opened files — File > Open Recent submenu, persisted in `app-state.json`
- [x] Mirror/flip mode — `Cmd/Ctrl+M` to toggle horizontal flip for beam splitter setups
