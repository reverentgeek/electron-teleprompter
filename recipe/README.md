# Stream Deepgram transcripts over a LiveKit data channel

A working recipe for adding Deepgram speech-to-text to a LiveKit application — for the **observer pattern**, not the voice-agent pattern.

Most Deepgram + LiveKit examples build a turn-taking voice assistant: user speaks, an Agent runs STT → LLM → TTS, and an audio track answers back. This recipe is for the other half of the design space: **one participant speaks, the others read what they said.** Live captions, meeting transcription, compliance monitoring, coaching tools, and teleprompters all share this shape.

The pattern is small:

1. The presenter publishes their microphone as an audio track.
2. The presenter's client also opens a Deepgram WebSocket and pipes the same mic audio into it.
3. On every `is_final` Deepgram result, the presenter publishes the transcript over a LiveKit data channel using `localParticipant.publishData(...)`.
4. Every other participant subscribes to the data channel and renders the transcripts however they like.

No Agent framework, no LLM, no TTS round-trip — just `publishData` carrying STT output to anyone in the room.

## What you'll build

Two pages (`presenter.html`, `viewer.html`) served by a tiny Node token server (`server.js`). Open them in two tabs, click Start in one, paste the room name into the other, and you'll see Deepgram transcripts stream from the presenter to the viewer in real time.

```
┌─────────────────────────┐     ┌──────────────┐
│ presenter.html          │     │ viewer.html  │
│                         │     │              │
│ mic ─► Deepgram WS      │     │              │
│        │                │     │              │
│        ▼                │     │              │
│ publishData(transcript) ├────►│ DataReceived │
│                         │ LK  │  → render    │
│ publishTrack(audio)     ├────►│ TrackSub.    │
│                         │     │  → audio     │
└─────────────────────────┘     └──────────────┘
```

## Setup

You'll need:

- **Node.js 20+**
- **LiveKit Cloud project** (free tier works) — grab `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` from your project's [API Keys page](https://cloud.livekit.io/).
- **Deepgram API key with `keys:write` scope** — create one at [console.deepgram.com](https://console.deepgram.com/) and select the **Admin** or **Owner** role when creating the key. The recipe mints short-lived access tokens server-side via `/v1/auth/grant`, which requires this scope. A default member-role key can stream audio fine but cannot mint tokens, and you'll see a 403 error on first run if you use one. Free credits cover a few hours of streaming.

```bash
cd recipe
cp .env.example .env
# fill in LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, DEEPGRAM_API_KEY
npm install
npm start
```

The server starts at `http://localhost:3000` and serves both pages from `public/`.

## First call works

1. Open `http://localhost:3000/presenter.html` in one browser tab. Click **Start session**, allow microphone access, and note the room name (auto-generated, like `recipe-x7j2k`).
2. Open `http://localhost:3000/viewer.html` in another tab. Paste the room name, click **Join**, then **Unmute audio** to hear the presenter.
3. Speak into the presenter tab's mic. Each Deepgram final result appears in **both** tabs — the presenter shows what was transcribed locally; the viewer shows what arrived over the LiveKit data channel.

If you don't see transcripts on the viewer side, check the presenter tab's console for Deepgram WebSocket errors — most often a missing or invalid `DEEPGRAM_API_KEY`.

## How it works

### Server (`server.js`)

A 60-line Node `http` server with two responsibilities:

- `GET /api/token?room=<name>&role=<presenter|viewer>` — mints a LiveKit access token using `livekit-server-sdk`'s `AccessToken`. The presenter token grants `canPublish` and `canPublishData`; the viewer token grants only `canSubscribe`.
- `GET /api/deepgram-token` — calls Deepgram's [`POST /v1/auth/grant`](https://developers.deepgram.com/docs/short-lived-tokens) using the master `DEEPGRAM_API_KEY` and returns the resulting **short-lived access token** (default TTL ~30s) to the browser. The master key never leaves the server.

### Presenter (`presenter.html`)

Three concurrent things happen on the presenter page:

1. **Publish mic to LiveKit** — `room.localParticipant.publishTrack(audioTrack)` sends the mic to all subscribers in the room.
2. **Stream mic to Deepgram** — a `MediaRecorder` chunks the same mic audio every 250ms and sends each chunk into a Deepgram WebSocket opened directly from the browser. The connection uses the `["bearer", accessToken]` sub-protocol with the short-lived token from `/api/deepgram-token`. (Long-lived API keys would use `["token", apiKey]`, but those should never reach the browser.)
3. **Forward transcripts** — on every Deepgram `Results` message where `is_final === true`, the page calls `room.localParticipant.publishData(...)` with a JSON `{ type: "transcript", text, ts }` payload, marked `reliable: true`.

The same `MediaStreamTrack` feeds both LiveKit and Deepgram; they're parallel consumers of one mic source.

### Viewer (`viewer.html`)

Two LiveKit room events do all the work:

```js
room.on( RoomEvent.TrackSubscribed, ( track ) => {
  if ( track.kind === Track.Kind.Audio ) track.attach( audio );
} );

room.on( RoomEvent.DataReceived, ( payload ) => {
  const msg = JSON.parse( decoder.decode( payload ) );
  if ( msg.type === "transcript" ) renderTranscript( msg.text );
} );
```

`DataReceived` fires for any data published in the room with no setup beyond joining. The viewer is purely a subscriber: `canPublish: false`, `canPublishData: false`.

## How to extend

This recipe is intentionally minimal. Here's where to go from here.

**Replace transcript broadcasts with structured events.** Transcripts are convenient but coarse. For richer downstream use cases — captions with timestamps, compliance flags, or *script alignment* — broadcast structured messages: `{ type: "captions", words: [{ text, start, end, confidence }] }` or `{ type: "position", lineIdx: 42 }`. The viewer chooses how to render. The full [Electron Teleprompter](https://github.com/reverentgeek/electron-teleprompter/tree/feat/live-session) repo this recipe came from uses this pattern: presenters broadcast a script position derived from a sliding-window aligner, viewers smooth-scroll their teleprompter to follow.

**Harden the token endpoint.** This recipe already mints short-lived Deepgram access tokens server-side instead of shipping the master `DEEPGRAM_API_KEY` to the browser. Two things to add for production: (1) authenticate `/api/deepgram-token` so only your real users can call it, and (2) handle the ~30-second token TTL — for our use case the WebSocket is opened immediately so the short TTL is a feature, but if you cache a token for later use you'll need a refresh path. Same shape applies to `/api/token` for LiveKit.

**Reconnect on drops.** Deepgram checks the access token only at the WebSocket handshake — once `dgSocket` is open, the connection persists for the session regardless of when the token expires. But neither side reconnects automatically here: if the Deepgram WS closes (network blip, idle timeout, server-side disconnect) the recipe just stops transcribing. In production, listen for `close` and `error` on `dgSocket`, fetch a fresh `/api/deepgram-token`, and reopen the WebSocket — the old token is unusable because it's already past its 30-second window. The same pattern applies to the LiveKit `Room`: hook `RoomEvent.Reconnecting` / `Reconnected` for visibility, and re-fetch a token if a long-disconnected room needs to fully re-join. Add a small backoff (e.g., 1s, 2s, 4s, capped at ~10s) so a flaky network doesn't hammer the token endpoint.

**Tune Deepgram options for your latency budget.** This recipe uses `interim_results: false` and `endpointing: 200` for stable, finals-only output (~500ms latency). If you need lower latency at the cost of jitter, set `interim_results: true` and reconcile interim words against finals on the receiving side. The full options list is at [Deepgram → Listen v1](https://developers.deepgram.com/reference/streaming).

**Replay history to late joiners.** `publishData` only reaches participants who are already in the room. A viewer who joins five minutes in misses the first five minutes of transcript. Two patterns work well:

1. **Welcome bundle from the presenter.** Keep an in-memory buffer of recent transcripts on the presenter side. On `RoomEvent.ParticipantConnected`, send a targeted message to the new identity using `publishData(payload, { destinationIdentities: [participant.identity], reliable: true })`. The viewer applies the buffer as backfill, then receives live updates normally. Fast to implement; no extra infra. Caveat: the buffer dies if the presenter disconnects.

2. **Server-side log + on-demand fetch.** Have the presenter (or a LiveKit Agent — see *Move STT off the presenter's machine* below) write transcripts to a tiny store keyed by room name. New viewers fetch `/api/transcript-history?room=…` on join, then subscribe to live updates. Persists across presenter disconnects; needs a store and slightly more code.

The full [Electron Teleprompter](https://github.com/reverentgeek/electron-teleprompter/tree/feat/live-session) uses pattern 1 for script content and current position — a single welcome message sent to each new participant on connect.

**Scale to many viewers.** LiveKit's data channel scales fan-out automatically — `publishData` with no `destinationIdentities` is a broadcast to all subscribers in the room. For room sizes beyond LiveKit Cloud's per-room limits, partition by room or use [LiveKit's simulcast](https://docs.livekit.io/home/get-started/intro-to-livekit/) for the audio track.

**Move STT off the presenter's machine.** The recipe runs Deepgram in the presenter's browser, which is simple but couples STT availability to the presenter's network. If you want STT to keep working through presenter network hiccups, run a [LiveKit Agent](https://docs.livekit.io/agents/) that subscribes to the presenter's audio track and runs Deepgram server-side. The data-channel broadcast pattern is identical — just published from the agent's `localParticipant` instead of the presenter's.

**Add a real aligner.** The transcript here is just text. To track *where* a known script is being read, swap in a fuzzy aligner: tokenize the script, keep a sliding window of recently recognized words, score multiset overlap against forward windows in the script. The Electron Teleprompter linked above ships one in ~80 lines (`src/client/aligner.js`) and broadcasts `{ type: "position", wordIdx }` instead of raw transcripts. The viewer side then becomes "scroll my copy of the script to the broadcast position" — robust to ad-libs, repeats, and skipped paragraphs.

## Files

```
recipe/
├── server.js              token + static server
├── package.json
├── .env.example
└── public/
    ├── presenter.html     mic → Deepgram → publishData
    └── viewer.html        DataReceived → render
```

## License

MIT.
