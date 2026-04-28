// Entry point for the LiveKit + Deepgram client bundle.
// Exposes window.LiveKitModule via esbuild's --global-name flag.
//
// Presenter:    mic → Deepgram → aligner → publish position over data channel.
// Viewer:       subscribe to audio + data channel → smooth-scroll to position.

import { Room, RoomEvent, createLocalAudioTrack, Track } from "livekit-client";
import { buildWordIndex, scrollToWord, cancelScroll } from "./word-index.js";
import { createAligner } from "./aligner.js";

const POSITION_PUBLISH_MIN_INTERVAL_MS = 100;

// Deepgram streaming options. Connect directly to the WebSocket rather than
// pulling in the full @deepgram/sdk in the browser bundle (the SDK's
// reconnecting websocket layer imports `ws`, which is Node-only).
const DEEPGRAM_QUERY = new URLSearchParams( {
	model: "nova-3",
	smart_format: "true",
	interim_results: "false",
	endpointing: "200",
	punctuate: "true",
	language: "en"
} ).toString();
const DEEPGRAM_URL = `wss://api.deepgram.com/v1/listen?${ DEEPGRAM_QUERY }`;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

let presenterCtx = null;
let viewerCtx = null;

function encodeJson( payload ) {
	return encoder.encode( JSON.stringify( payload ) );
}

function decodeJson( bytes ) {
	try {
		return JSON.parse( decoder.decode( bytes ) );
	} catch ( err ) {
		console.warn( "[livekit] failed to decode data message", err );
		return null;
	}
}

export async function startPresenter( { url, token, deepgramKey, scriptEl, onStatus } ) {
	if ( presenterCtx ) {
		throw new Error( "Presenter session already active." );
	}
	if ( !scriptEl ) {
		throw new Error( "scriptEl is required." );
	}
	if ( !deepgramKey ) {
		throw new Error( "Deepgram API key is required." );
	}

	const wordIndex = buildWordIndex( scriptEl );
	const aligner = createAligner( wordIndex.words );
	const scriptHtml = scriptEl.innerHTML;

	const room = new Room();
	let lastPublishedPos = -1;
	let lastPublishedTime = 0;

	function publishPosition() {
		const pos = aligner.currentPosition();
		const now = Date.now();
		if ( pos === lastPublishedPos ) return;
		if ( now - lastPublishedTime < POSITION_PUBLISH_MIN_INTERVAL_MS ) return;
		lastPublishedPos = pos;
		lastPublishedTime = now;
		room.localParticipant.publishData(
			encodeJson( { type: "position", wordIdx: pos, ts: now } ),
			{ reliable: true }
		).catch( err => console.warn( "[livekit] publishData failed:", err ) );
	}

	function publishWelcome( targetIdentity ) {
		const opts = { reliable: true };
		if ( targetIdentity ) {
			opts.destinationIdentities = [ targetIdentity ];
		}
		room.localParticipant.publishData(
			encodeJson( {
				type: "welcome",
				scriptHtml,
				currentWordIdx: aligner.currentPosition(),
				ts: Date.now()
			} ),
			opts
		);
	}

	room.on( RoomEvent.ParticipantConnected, ( participant ) => {
		publishWelcome( participant.identity );
		onStatus?.( { type: "viewer-joined", identity: participant.identity, count: room.numParticipants } );
	} );

	room.on( RoomEvent.ParticipantDisconnected, ( participant ) => {
		onStatus?.( { type: "viewer-left", identity: participant.identity, count: room.numParticipants } );
	} );

	room.on( RoomEvent.Disconnected, ( reason ) => {
		onStatus?.( { type: "disconnected", reason } );
	} );

	console.log( "[livekit] connecting to", url );
	await room.connect( url, token );
	console.log( "[livekit] connected as", room.localParticipant.identity, "in room", room.name );

	const audioTrack = await createLocalAudioTrack( {
		echoCancellation: true,
		noiseSuppression: true
	} );
	await room.localParticipant.publishTrack( audioTrack );
	console.log( "[livekit] mic track published" );

	const dgSocket = new WebSocket( DEEPGRAM_URL, [ "token", deepgramKey ] );

	console.log( "[presenter] script word count:", wordIndex.words.length );

	await new Promise( ( resolve, reject ) => {
		const timeout = setTimeout( () => reject( new Error( "Deepgram open timeout" ) ), 5000 );
		dgSocket.addEventListener( "open", () => {
			clearTimeout( timeout );
			console.log( "[deepgram] websocket open" );
			resolve();
		}, { once: true } );
		dgSocket.addEventListener( "error", ( evt ) => {
			clearTimeout( timeout );
			reject( new Error( "Deepgram websocket error: " + ( evt?.message || "unknown" ) ) );
		}, { once: true } );
	} );

	let transcriptCount = 0;
	dgSocket.addEventListener( "message", ( event ) => {
		let data;
		try {
			data = JSON.parse( event.data );
		} catch ( err ) {
			console.warn( "[deepgram] invalid JSON", err );
			return;
		}
		if ( data.type === "Metadata" ) {
			console.log( "[deepgram] metadata:", data );
			return;
		}
		if ( data.type !== "Results" ) return;
		if ( !data.is_final ) return;
		const alt = data.channel?.alternatives?.[0];
		if ( !alt?.words?.length ) return;
		transcriptCount++;
		const prevPos = aligner.currentPosition();
		for ( const w of alt.words ) {
			aligner.addRecognized( w.word );
		}
		const newPos = aligner.step();
		const moved = newPos !== prevPos;
		console.log(
			`[deepgram] final #${ transcriptCount }: "${ alt.transcript }" — words=${ alt.words.length } pos ${ prevPos }→${ newPos }${ moved ? "" : " (no match)" }`
		);
		publishPosition();
		// Renderer drives the local scroll via onStatus so it can honor a
		// manual-scroll grace period.
		onStatus?.( { type: "position", wordIdx: newPos, transcript: alt.transcript, moved } );
	} );

	dgSocket.addEventListener( "error", ( err ) => {
		console.warn( "[deepgram] error", err );
		onStatus?.( { type: "deepgram-error", error: err?.message || "websocket error" } );
	} );

	const mediaStream = new MediaStream( [ audioTrack.mediaStreamTrack ] );
	const mimeType = MediaRecorder.isTypeSupported( "audio/webm;codecs=opus" )
		? "audio/webm;codecs=opus"
		: "audio/webm";
	const recorder = new MediaRecorder( mediaStream, { mimeType } );
	recorder.ondataavailable = async ( event ) => {
		if ( event.data && event.data.size > 0 && dgSocket.readyState === WebSocket.OPEN ) {
			try {
				const buf = await event.data.arrayBuffer();
				dgSocket.send( buf );
			} catch ( err ) {
				console.warn( "[deepgram] send failed", err );
			}
		}
	};
	recorder.start( 250 );

	publishWelcome();

	presenterCtx = { room, audioTrack, recorder, dgSocket };

	onStatus?.( { type: "connected", role: "presenter" } );

	return {
		getPosition: () => aligner.currentPosition(),
		getWordCount: () => wordIndex.words.length,
		wordIndex
	};
}

export async function stopPresenter() {
	if ( !presenterCtx ) return;
	const { room, audioTrack, recorder, dgSocket } = presenterCtx;
	presenterCtx = null;
	try {
		if ( recorder.state !== "inactive" ) recorder.stop();
	} catch ( err ) {
		console.warn( "[presenter] recorder.stop error", err );
	}
	try {
		if ( dgSocket.readyState === WebSocket.OPEN ) {
			dgSocket.send( JSON.stringify( { type: "CloseStream" } ) );
		}
		dgSocket.close();
	} catch ( err ) {
		console.warn( "[presenter] deepgram close error", err );
	}
	try {
		audioTrack.stop();
	} catch ( err ) {
		console.warn( "[presenter] audio track stop error", err );
	}
	try {
		await room.disconnect();
	} catch ( err ) {
		console.warn( "[presenter] room disconnect error", err );
	}
}

export async function joinViewer( { url, token, scriptEl, audioEl, onStatus, onWelcome, onPosition } ) {
	if ( viewerCtx ) {
		throw new Error( "Viewer session already active." );
	}

	const room = new Room();
	let firstAudioAttach = true;

	room.on( RoomEvent.TrackSubscribed, ( track, _publication, participant ) => {
		if ( track.kind === Track.Kind.Audio && audioEl ) {
			track.attach( audioEl );
			// LiveKit's attachToElement forces element.muted = false. Re-mute on
			// the first attach so viewers default to silent and must opt in.
			if ( firstAudioAttach ) {
				audioEl.muted = true;
				firstAudioAttach = false;
			}
			onStatus?.( { type: "audio-attached", identity: participant.identity } );
		}
	} );

	room.on( RoomEvent.DataReceived, ( payload ) => {
		const msg = decodeJson( payload );
		if ( !msg || !msg.type ) return;
		if ( msg.type === "welcome" ) {
			if ( scriptEl ) {
				scriptEl.innerHTML = msg.scriptHtml;
				const idx = buildWordIndex( scriptEl );
				viewerCtx.wordIndex = idx;
				onWelcome?.( { wordIdx: msg.currentWordIdx, wordIndex: idx } );
				if ( typeof msg.currentWordIdx === "number" ) {
					scrollToWord( msg.currentWordIdx, idx.ranges, { smooth: false } );
				}
			}
		} else if ( msg.type === "position" ) {
			onPosition?.( msg.wordIdx );
			if ( viewerCtx?.wordIndex ) {
				scrollToWord( msg.wordIdx, viewerCtx.wordIndex.ranges );
			}
		}
	} );

	room.on( RoomEvent.ParticipantDisconnected, ( participant ) => {
		onStatus?.( { type: "presenter-disconnected", identity: participant.identity } );
	} );

	room.on( RoomEvent.Disconnected, ( reason ) => {
		onStatus?.( { type: "disconnected", reason } );
	} );

	await room.connect( url, token );

	viewerCtx = { room, wordIndex: null, audioEl };
	onStatus?.( { type: "connected", role: "viewer" } );
}

export async function leaveViewer() {
	if ( !viewerCtx ) return;
	const { room, audioEl } = viewerCtx;
	viewerCtx = null;
	try {
		if ( audioEl ) audioEl.srcObject = null;
	} catch ( err ) {
		console.warn( "[viewer] detach audio error", err );
	}
	try {
		await room.disconnect();
	} catch ( err ) {
		console.warn( "[viewer] room disconnect error", err );
	}
}

export {
	buildWordIndex,
	scrollToWord,
	cancelScroll,
	createAligner
};
