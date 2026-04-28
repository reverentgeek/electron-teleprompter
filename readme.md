# Electron Teleprompter

Desktop teleprompter app built with [Electron.js](https://www.electronjs.org/).

## Features

- Translucent overlay — see through the script to your presentation or video call
- Built-in markdown editor with syntax highlighting
- Live reload — script automatically reloads when the file is modified externally
- Adjustable background opacity
- Font size is persisted across sessions
- Mirror/flip mode — for physical teleprompter setups with beam splitters
- Recently opened files — File > Open Recent submenu
- Auto-loads last opened file on startup
- Window position and size are persisted across sessions
- **Live session sharing** *(branch: `feat/live-session`)* — broadcast your script position to remote viewers in real time using LiveKit + Deepgram

## Usage

The Electron Teleprompter app can load any markdown and/or HTML syntax and display that as a translucent overlay on the screen. In this way you can load a script and still see your presentation, video conferencing, or any other applications through the script.

Use the File -> Open menu (or keyboard shortcut) to open a text file that contains markdown or HTML as a script.

### What is Markdown?

Markdown is a lightweight syntax for creating formatted documents. For example, headings use the <code>#</code> symbol.

```md
# This is a Main Heading
## This is a Secondary Heading
```

### Use H2 tags for navigation

Use H2 tags (`##` in markdown) to create both headings and navigation points in your script. Pressing the right arrow on your keyboard will jump the script to the next heading, left arrow to go back. You can also use a presentation remote/clicker (e.g. [Logitech presentation remotes](https://www.logitech.com/en-us/products/presenters.html)) to go navigate forward/back.

### Built-in Markdown Editor

Press `Cmd/Ctrl+E` to open the built-in editor, or `Cmd/Ctrl+N` to start a new script. The editor uses a dark theme with syntax highlighting for markdown, and the background becomes opaque so you can focus on writing.

You can freely toggle between the editor and the teleprompter preview with `Cmd/Ctrl+E` to see how your script looks — your changes are preserved as you switch back and forth. Save with `Cmd/Ctrl+S` or use `Cmd/Ctrl+Shift+S` to save as a new file. If you close the app or open a different file with unsaved changes, you'll be prompted to save first.

### Keyboard Shortcuts

#### Shortcuts for the managing the teleprompter overlay

| Shortcut              | Action                        |
| --------------------- | ----------------------------- |
| `Right Arrow`         | Jump to next section (H2)     |
| `Left Arrow`          | Jump to previous section (H2) |
| `Up/Down Arrow`       | Scroll up/down                |
| `Cmd/Ctrl+Plus`       | Increase font size            |
| `Cmd/Ctrl+Minus`      | Decrease font size            |
| `Cmd/Ctrl+0`          | Reset font size to default    |
| `Cmd/Ctrl+M`          | Toggle mirror/flip mode       |
| `Cmd/Ctrl+Shift+Up`   | Increase background opacity   |
| `Cmd/Ctrl+Shift+Down` | Decrease background opacity   |
| `Cmd/Ctrl+Shift+0`    | Reset opacity to default      |

#### Shortcuts for managing the editor

| Shortcut              | Action                        |
| --------------------- | ----------------------------- |
| `Cmd/Ctrl+N`          | New file                      |
| `Cmd/Ctrl+O`          | Open a markdown/text file     |
| `Cmd/Ctrl+E`          | Toggle editor / preview       |
| `Cmd/Ctrl+S`          | Save (in editor mode)         |
| `Cmd/Ctrl+Shift+S`    | Save As (in editor mode)      |

#### Shortcuts for live session sharing

| Shortcut              | Action                        |
| --------------------- | ----------------------------- |
| `Cmd/Ctrl+Shift+L`    | Share session (host)          |
| `Cmd/Ctrl+Shift+J`    | Join session (viewer)         |

## Live Session Sharing (LiveKit + Deepgram)

The `feat/live-session` branch adds remote session sharing. The presenter's app captures their microphone, streams audio to [Deepgram](https://deepgram.com/) for live speech-to-text, aligns the recognized words against the loaded script, and broadcasts the current script position over a [LiveKit](https://livekit.io/) data channel. Other instances of the app — running in *viewer mode* — connect to the same room, receive the script content + position updates, and smooth-scroll to follow the presenter (audio optional).

**The aligner is forgiving:** ad-libs, repeated phrases, and skipped paragraphs are tolerated by sliding-window fuzzy matching against the script. The viewer's scroll position rewinds or jumps as needed.

### Setup

1. Sign up for [LiveKit Cloud](https://cloud.livekit.io/) (free tier works) and copy your project's URL, API key, and API secret.
2. Sign up for [Deepgram](https://console.deepgram.com/) and copy an API key.
3. Copy `.env.example` to `.env` at the repo root and fill in `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `DEEPGRAM_API_KEY`.

### Hosting a session (presenter)

1. Open a script as usual (File → Open).
2. **Session → Share Session** (`Cmd/Ctrl+Shift+L`). The status badge in the top-right shows the auto-generated room name (`tp-xxxxxx`). Click it to copy the room name.
3. Speak — the script scrolls along with you, and the position is broadcast to anyone who joins the room.

### Joining a session (viewer)

1. Launch a second instance of the app (`pnpm start` in another terminal).
2. **Session → Join Session…** (`Cmd/Ctrl+Shift+J`). Paste the room name shared by the presenter.
3. The script appears (delivered over the data channel), the viewer toolbar shows up, and the prompter scrolls in sync. Click **Unmute** to hear the presenter.

### Recipe for LiveKit developers

The `recipe/` directory contains a standalone, ~250-line example that demonstrates the same LiveKit + Deepgram observer pattern without the teleprompter UI — two HTML pages and a tiny Node token server. See [`recipe/README.md`](./recipe/README.md) for setup and a full walkthrough.

## Developer Setup

1. Install [Node.js LTS](https://nodejs.org/) (v22+)
1. Clone or download the source code.
1. Open a terminal/command window, change to the source code folder, and install dependencies using `pnpm install` (or `npm install`).
1. Launch the app from the terminal using `pnpm start`.

## Origin Story

This app was originally built "in the open" on the [All Hands on Tech Live](https://www.twitch.tv/pluralsight_live) developer stream. You can watch past streams on Pluralsight's [YouTube](https://www.youtube.com/c/pluralsight), [LinkedIn](https://www.linkedin.com/company/pluralsight), or [Facebook](https://www.facebook.com/pluralsight).
