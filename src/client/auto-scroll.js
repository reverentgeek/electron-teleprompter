// Deepgram-driven auto-scroll: capture mic, stream to Deepgram, align recognized
// words against the rendered script, and smooth-scroll to the speaker's position.

import {
	buildWordIndex,
	scrollToWord,
	cancelScroll,
	setScrollSpeed,
	getScrollSpeed,
	SCROLL_SPEED_MIN,
	SCROLL_SPEED_MAX,
	SCROLL_SPEED_DEFAULT,
	SCROLL_SPEED_STEP
} from "./word-index.js";
import { createAligner } from "./aligner.js";

const DEEPGRAM_QUERY = new URLSearchParams( {
	model: "nova-3",
	smart_format: "true",
	interim_results: "false",
	endpointing: "200",
	punctuate: "true",
	language: "en"
} ).toString();
const DEEPGRAM_URL = `wss://api.deepgram.com/v1/listen?${ DEEPGRAM_QUERY }`;

let activeCtx = null;

export function isActive() {
	return activeCtx !== null;
}

export async function startAutoScroll( { deepgramKey, scriptEl, onStatus, onScroll, audioDeviceId } ) {
	if ( activeCtx ) {
		throw new Error( "Auto-scroll already active." );
	}
	if ( !scriptEl ) {
		throw new Error( "scriptEl is required." );
	}
	if ( !deepgramKey ) {
		throw new Error( "Deepgram API key is required." );
	}

	const wordIndex = buildWordIndex( scriptEl );
	const aligner = createAligner( wordIndex.words );

	const baseAudio = {
		echoCancellation: true,
		noiseSuppression: true
	};
	let stream;
	let usedFallback = false;
	if ( audioDeviceId ) {
		try {
			stream = await navigator.mediaDevices.getUserMedia( {
				audio: { ...baseAudio, deviceId: { exact: audioDeviceId } }
			} );
		} catch ( err ) {
			// Saved device is gone (unplugged, USB hub removed, etc) — fall back
			// to the system default rather than failing the whole session.
			if ( err.name === "OverconstrainedError" || err.name === "NotFoundError" ) {
				usedFallback = true;
				stream = await navigator.mediaDevices.getUserMedia( { audio: baseAudio } );
			} else {
				throw err;
			}
		}
	} else {
		stream = await navigator.mediaDevices.getUserMedia( { audio: baseAudio } );
	}
	if ( usedFallback ) {
		onStatus?.( { type: "device-fallback", requestedDeviceId: audioDeviceId } );
	}

	const dgSocket = new WebSocket( DEEPGRAM_URL, [ "token", deepgramKey ] );

	await new Promise( ( resolve, reject ) => {
		const timeout = setTimeout( () => reject( new Error( "Deepgram open timeout" ) ), 5000 );
		dgSocket.addEventListener( "open", () => {
			clearTimeout( timeout );
			resolve();
		}, { once: true } );
		dgSocket.addEventListener( "error", ( evt ) => {
			clearTimeout( timeout );
			reject( new Error( "Deepgram websocket error: " + ( evt?.message || "unknown" ) ) );
		}, { once: true } );
	} );

	dgSocket.addEventListener( "message", ( event ) => {
		let data;
		try {
			data = JSON.parse( event.data );
		} catch ( err ) {
			console.warn( "[deepgram] invalid JSON", err );
			return;
		}
		if ( data.type !== "Results" || !data.is_final ) return;
		const alt = data.channel?.alternatives?.[0];
		if ( !alt?.words?.length ) return;
		const prevPos = aligner.currentPosition();
		for ( const w of alt.words ) {
			aligner.addRecognized( w.word );
		}
		const newPos = aligner.step();
		const moved = newPos !== prevPos;
		if ( moved ) {
			onScroll?.( newPos, wordIndex.ranges );
		}
		onStatus?.( { type: "transcript", wordIdx: newPos, transcript: alt.transcript, moved } );
	} );

	dgSocket.addEventListener( "error", ( err ) => {
		onStatus?.( { type: "error", error: err?.message || "websocket error" } );
	} );

	dgSocket.addEventListener( "close", () => {
		onStatus?.( { type: "closed" } );
	} );

	const mimeType = MediaRecorder.isTypeSupported( "audio/webm;codecs=opus" )
		? "audio/webm;codecs=opus"
		: "audio/webm";
	const recorder = new MediaRecorder( stream, { mimeType } );
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

	activeCtx = { stream, recorder, dgSocket, wordIndex };
	onStatus?.( { type: "started", wordCount: wordIndex.words.length } );

	return {
		getPosition: () => aligner.currentPosition(),
		wordIndex
	};
}

export async function stopAutoScroll() {
	if ( !activeCtx ) return;
	const { stream, recorder, dgSocket } = activeCtx;
	activeCtx = null;
	cancelScroll();
	try {
		if ( recorder.state !== "inactive" ) recorder.stop();
	} catch ( err ) {
		console.warn( "[auto-scroll] recorder.stop error", err );
	}
	try {
		if ( dgSocket.readyState === WebSocket.OPEN ) {
			dgSocket.send( JSON.stringify( { type: "CloseStream" } ) );
		}
		dgSocket.close();
	} catch ( err ) {
		console.warn( "[auto-scroll] deepgram close error", err );
	}
	try {
		stream.getTracks().forEach( t => t.stop() );
	} catch ( err ) {
		console.warn( "[auto-scroll] stream stop error", err );
	}
}

export {
	scrollToWord,
	cancelScroll,
	setScrollSpeed,
	getScrollSpeed,
	SCROLL_SPEED_MIN,
	SCROLL_SPEED_MAX,
	SCROLL_SPEED_DEFAULT,
	SCROLL_SPEED_STEP
};
