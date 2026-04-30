# Electron Teleprompter

Desktop teleprompter app built with [Electron.js](https://www.electronjs.org/).

## Features

- Translucent overlay — see through the script to your presentation or video call
- Built-in markdown editor with syntax highlighting
- Voice-driven auto-scroll — speak your script and the prompter follows you, powered by [Deepgram](https://deepgram.com/)
- Live reload — script automatically reloads when the file is modified externally
- Adjustable background opacity
- Font size is persisted across sessions
- Mirror/flip mode — for physical teleprompter setups with beam splitters
- Recently opened files — File > Open Recent submenu
- Auto-loads last opened file on startup
- Window position and size are persisted across sessions

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

### Voice-Driven Auto-Scroll

The teleprompter can listen to you and scroll the script automatically as you speak. No keyboard, remote, or foot pedals required! Speech is transcribed by [Deepgram](https://deepgram.com/) and the recognized words are matched against your script, so the prompter follows your real cadence and tolerates ad-libs and re-reads.

#### Setup

1. Get a Deepgram API key from [console.deepgram.com](https://console.deepgram.com/) (a free tier is available).
2. Open `Script > Set Deepgram API Key…` and paste in your key. The key is stored locally in the app's state file.
3. Grant microphone access the first time you start auto-scroll.

#### Auto-Scroll Usage

- Press `Cmd/Ctrl+Shift+L` (or `Script > Toggle Auto-scroll`) to start listening. A green "Listening" pill appears in the top-right corner.
- Start reading your script. As you speak, the prompter smoothly scrolls to keep your current word about a third of the way down the screen.
- If you scroll manually (trackpad, arrow keys, page keys), auto-scroll yields to you for a few seconds before resuming.
- Press `Cmd/Ctrl+Shift+L` again, or click the indicator pill, to stop listening.

#### Adjusting the speed

Auto-scroll uses a smooth, critically-damped animation. If it feels too laggy or too snappy for your speaking style, tune it with:

| Shortcut             | Action                          |
| -------------------- | ------------------------------- |
| `Cmd/Ctrl+]`         | Increase auto-scroll speed      |
| `Cmd/Ctrl+[`         | Decrease auto-scroll speed      |
| `Cmd/Ctrl+\`         | Reset auto-scroll speed to 1×   |

The speed is persisted across sessions. Speed range is 0.25× to 4× in 0.1 steps.

#### Selecting a microphone

By default, auto-scroll uses your system's default audio input. To pick a specific microphone (e.g. a USB lavalier or a podcasting mic), open `Script > Select Microphone…` and choose one from the list. The selection is saved and reused on every subsequent auto-scroll session.

A few notes:

- Device names only appear after you've granted microphone access at least once. If the dropdown shows generic IDs, start auto-scroll once to grant access, then reopen the picker.
- Plugging or unplugging a mic while the picker is open refreshes the list automatically.
- If the previously selected mic is unavailable when auto-scroll starts (unplugged, disconnected hub, etc.), it falls back to the system default and briefly shows "Saved mic unavailable — using default" in the indicator. The saved selection is kept so it picks up automatically when you reconnect.
- A microphone change takes effect the next time you start auto-scroll; it does not interrupt an active session.

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

#### Shortcuts for voice-driven auto-scroll

| Shortcut              | Action                        |
| --------------------- | ----------------------------- |
| `Cmd/Ctrl+Shift+L`    | Toggle auto-scroll            |
| `Cmd/Ctrl+]`          | Increase auto-scroll speed    |
| `Cmd/Ctrl+[`          | Decrease auto-scroll speed    |
| `Cmd/Ctrl+\`          | Reset auto-scroll speed       |

## Developer Setup

1. Install [Node.js LTS](https://nodejs.org/) (v22+)
1. Clone or download the source code.
1. Open a terminal/command window, change to the source code folder, and install dependencies using `npm install`.
1. Launch the app from the terminal using `npm start`.

## Origin Story

This app was originally built "in the open" on the [All Hands on Tech Live](https://www.twitch.tv/pluralsight_live) developer stream. You can watch past streams on Pluralsight's [YouTube](https://www.youtube.com/c/pluralsight), [LinkedIn](https://www.linkedin.com/company/pluralsight), or [Facebook](https://www.facebook.com/pluralsight).
