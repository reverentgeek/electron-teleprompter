# Electron Teleprompter

Desktop teleprompter app built with [Electron.js](https://www.electronjs.org/).

## Usage

The Electron Teleprompter app can load any markdown and/or HTML syntax and display that as a translucent overlay on the screen. In this way you can load a script and still see your presentation, video conferencing, or any other applications through the script.

Use the File -> Open menu (or keyboard shortcut) to open a text file that contains markdown or HTML as a script.

### Use H2 tags for navigation

Use H2 tags (`##` in markdown) to create both headings and navigation points in your script. Pressing the right arrow on your keyboard will jump the script to the next heading, left arrow to go back. You can also use a presentation remote/clicker (e.g. [Logitech presentation remotes](https://www.logitech.com/en-us/products/presenters.html)) to go navigate forward/back.

### Keyboard Shortcuts

| Shortcut         | Action                        |
| ---------------- | ----------------------------- |
| `Cmd/Ctrl+O`     | Open a markdown/text file     |
| `Right Arrow`    | Jump to next section (H2)     |
| `Left Arrow`     | Jump to previous section (H2) |
| `Up/Down Arrow`  | Scroll up/down                |
| `Cmd/Ctrl+Plus`  | Increase font size            |
| `Cmd/Ctrl+Minus` | Decrease font size            |
| `Cmd/Ctrl+0`     | Reset font size to default    |
| `Cmd/Ctrl+M`     | Toggle mirror/flip mode       |

### Features

- Translucent overlay — see through the script to your presentation or video call
- Live reload — script automatically reloads when the file is modified externally
- Font size is persisted across sessions
- Mirror/flip mode — for physical teleprompter setups with beam splitters
- Recently opened files — File > Open Recent submenu
- Auto-loads last opened file on startup
- Window position and size are persisted across sessions

### What is Markdown?

Markdown is a lightweight syntax for creating formatted documents. For example, headings use the <code>#</code> symbol.

```md
# This is a Main Heading
## This is a Secondary Heading
```

## Developer Setup

1. Install [Node.js LTS](https://nodejs.org/) (v22+)
1. Clone or download the source code.
1. Open a terminal/command window, change to the source code folder, and install dependencies using `npm install`.
1. Launch the app from the terminal using `npm start`.

## Origin Story

This app was originally built "in the open" on the [All Hands on Tech Live](https://www.twitch.tv/pluralsight_live) developer stream. You can watch past streams on Pluralsight's [YouTube](https://www.youtube.com/c/pluralsight), [LinkedIn](https://www.linkedin.com/company/pluralsight), or [Facebook](https://www.facebook.com/pluralsight).
