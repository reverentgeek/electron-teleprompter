# Stream Deepgram transcripts over LiveKit data packets

Use LiveKit data packets to send Deepgram speech-to-text results from one participant to other participants in a room.

This recipe demonstrates a browser-based transcription flow for applications where one participant speaks and other participants receive transcript updates. Example use cases include live captions, meeting transcription, coaching tools, compliance monitoring, and teleprompter synchronization.

This recipe does not use LiveKit Agents. The presenter streams microphone audio directly to Deepgram from the browser, then publishes final transcript results to the room using `localParticipant.publishData(...)`.

## How it works

The presenter joins a LiveKit room and publishes two outputs from the same microphone source:

- An audio track, published to LiveKit for subscribed participants.
- Audio chunks, sent to Deepgram over a WebSocket for speech-to-text.

When Deepgram returns a final transcript result, the presenter publishes a reliable data packet to the LiveKit room. Viewers receive the packet with `RoomEvent.DataReceived` and render the transcript.

```text
presenter microphone
├── LiveKit audio track ───────────────► viewers
└── Deepgram WebSocket ─► transcript ─► LiveKit data packet ─► viewers
````

## What this recipe includes

The recipe includes:

- `server.js`: Node.js server for LiveKit and Deepgram token endpoints.
- `public/presenter.html`: Captures microphone audio, connects to LiveKit, streams audio to Deepgram, and publishes transcript data.
- `public/viewer.html`: Connects to the same LiveKit room, subscribes to audio, and receives transcript data packets.

## Requirements

You need the following:

- Node.js 20 or later.
- A LiveKit Cloud project or self-hosted LiveKit server.
- A Deepgram API key that can create short-lived tokens.

Set the following environment variables in `.env`:

```bash
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
DEEPGRAM_API_KEY=
```

The Deepgram API key is used only by the local server. Browser clients receive short-lived Deepgram access tokens from `/api/deepgram-token`.

## Run the example

Install dependencies and start the server:

```bash
cd recipe
cp .env.example .env
npm install
npm start
```

The server starts at:

```text
http://localhost:3000
```

## Test the flow

Open the presenter page:

```text
http://localhost:3000/presenter.html
```

Click **Start session** and allow microphone access. The page creates a room name such as:

```text
recipe-x7j2k
```

Open the viewer page in another browser tab:

```text
http://localhost:3000/viewer.html
```

Paste the room name, click **Join**, then click **Unmute audio**.

Speak into the presenter tab. Final Deepgram transcript results appear in both tabs. The presenter displays transcripts received directly from Deepgram. The viewer displays transcripts received from LiveKit data packets.

## Server endpoints

The local server provides two endpoints.

### `GET /api/token?room=&role=`

Creates a LiveKit access token for the requested room and role.

Presenter tokens can publish audio and data. Viewer tokens can subscribe to tracks and receive data.

### `GET /api/deepgram-token`

Creates a short-lived Deepgram access token using the server-side `DEEPGRAM_API_KEY`.

The browser uses this token to open a Deepgram WebSocket connection. The long-lived Deepgram API key is never sent to the browser.

## Presenter flow

The presenter page performs three tasks.

### Publish microphone audio

The presenter creates a local audio track and publishes it to the room:

```js
await room.localParticipant.publishTrack(audioTrack);
```

Viewers subscribed to the room can receive and play this track.

### Stream microphone audio to Deepgram

The presenter also sends microphone audio to Deepgram.

A `MediaRecorder` reads from the microphone stream and sends audio chunks to a Deepgram WebSocket. The WebSocket connection uses the short-lived token returned by `/api/deepgram-token`.

### Publish transcript data

When Deepgram returns a final transcript result, the presenter publishes a data packet:

```js
const payload = encoder.encode(JSON.stringify({
  type: "transcript",
  text,
  ts: Date.now()
}));

await room.localParticipant.publishData(payload, {
  reliable: true
});
```

By default, the packet is sent to all participants in the room.

## Viewer flow

The viewer page listens for audio tracks and data packets.

### Subscribe to presenter audio

```js
room.on(RoomEvent.TrackSubscribed, (track) => {
  if (track.kind === Track.Kind.Audio) {
    track.attach(audioElement);
  }
});
```

### Receive transcript data

```js
room.on(RoomEvent.DataReceived, (payload) => {
  const message = JSON.parse(decoder.decode(payload));

  if (message.type === "transcript") {
    renderTranscript(message.text);
  }
});
```

The viewer does not need publish permissions.

## Data packet format

This recipe sends transcript messages in the following format:

```json
{
  "type": "transcript",
  "text": "Example transcript text.",
  "ts": 1712345678901
}
```

You can extend this format for other use cases. For example, captions might include word-level timestamps:

```json
{
  "type": "captions",
  "words": [
    {
      "text": "hello",
      "start": 0.32,
      "end": 0.58,
      "confidence": 0.98
    }
  ]
}
```

A teleprompter can publish the current script position instead of transcript text:

```json
{
  "type": "position",
  "wordIdx": 428
}
```

## Production considerations

This recipe is intended as a minimal implementation. For production applications, consider the following updates.

### Authenticate token endpoints

Protect both token endpoints before using this pattern in production:

- `/api/token`
- `/api/deepgram-token`

Only authenticated users should be able to create LiveKit or Deepgram tokens.

### Handle reconnects

If the Deepgram WebSocket closes, request a new short-lived token and reconnect.

For LiveKit reconnect handling, listen for room events such as `RoomEvent.Reconnecting` and `RoomEvent.Reconnected`.

Use a bounded retry delay to avoid repeatedly calling token endpoints during network instability.

### Choose reliable or lossy delivery

This recipe uses reliable data packets for transcript messages.

Reliable delivery is appropriate when each message should be delivered in order, such as captions or transcript updates. For high-frequency state updates where newer data replaces older data, lossy delivery might be preferable.

### Send targeted messages

To send transcript data to a specific participant instead of the entire room, include `destinationIdentities`:

```js
await room.localParticipant.publishData(payload, {
  reliable: true,
  destinationIdentities: [participant.identity]
});
```

This can be useful for sending transcript history to a participant when they join a room.

### Replay transcript history

LiveKit data packets are delivered to participants currently connected to the room. Participants who join later do not receive earlier transcript messages automatically.

To support late joiners, use one of the following approaches:

- Keep a recent transcript buffer on the presenter and send it to new participants with `destinationIdentities`.
- Store transcript history server-side and let viewers fetch it when they join.

### Move transcription server-side

This recipe sends audio to Deepgram from the presenter browser. This keeps the example small, but ties transcription to the presenter's browser session.

For production, you can move speech-to-text to a server-side participant or LiveKit Agent. The server-side participant subscribes to the presenter's audio track, sends audio to Deepgram, and publishes transcript data packets back to the room.

The viewer implementation can remain the same.

## Files

```text
recipe/
├── server.js
├── package.json
├── .env.example
└── public/
    ├── presenter.html
    └── viewer.html
```

## License

MIT
