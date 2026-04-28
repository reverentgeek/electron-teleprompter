// Token + static server for the LiveKit + Deepgram observer recipe.
//
// Endpoints:
//   GET  /api/token?room=<name>&role=<presenter|viewer>
//   GET  /api/deepgram-token                            (mints a short-lived Deepgram access token)
//   GET  /presenter.html, /viewer.html, /lib.js         (static)
//
// The Deepgram master API key never leaves the server. The browser receives
// only a temporary access token (default TTL 30s) used to authenticate the
// streaming WebSocket. See https://developers.deepgram.com/docs/short-lived-tokens.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";
import { AccessToken } from "livekit-server-sdk";

const __dirname = path.dirname( fileURLToPath( import.meta.url ) );
const PORT = Number( process.env.PORT || 3000 );
const PUBLIC_DIR = path.join( __dirname, "public" );

const ROLE_GRANTS = {
	presenter: { canPublish: true, canPublishData: true, canSubscribe: true },
	viewer:    { canPublish: false, canPublishData: false, canSubscribe: true }
};

const STATIC_TYPES = {
	".html": "text/html; charset=utf-8",
	".js":   "application/javascript; charset=utf-8",
	".css":  "text/css; charset=utf-8"
};

function jsonResponse( res, status, body ) {
	res.writeHead( status, { "content-type": "application/json" } );
	res.end( JSON.stringify( body ) );
}

async function fetchDeepgramAccessToken() {
	const apiKey = process.env.DEEPGRAM_API_KEY;
	if ( !apiKey ) {
		throw new Error( "DEEPGRAM_API_KEY not set in .env" );
	}
	const res = await fetch( "https://api.deepgram.com/v1/auth/grant", {
		method: "POST",
		headers: { Authorization: `Token ${ apiKey }` }
	} );
	if ( !res.ok ) {
		const body = await res.text();
		if ( res.status === 403 ) {
			throw new Error(
				"Deepgram /v1/auth/grant returned 403. Your API key needs the 'keys:write' " +
				"scope (Admin or Owner role) to mint short-lived tokens. Create a new key " +
				"at https://console.deepgram.com/ with the Admin role and put it in .env. " +
				`Raw response: ${ body }`
			);
		}
		throw new Error( `Deepgram /v1/auth/grant failed: ${ res.status } ${ body }` );
	}
	return res.json();
}

async function mintToken( { room, role } ) {
	const apiKey = process.env.LIVEKIT_API_KEY;
	const apiSecret = process.env.LIVEKIT_API_SECRET;
	const url = process.env.LIVEKIT_URL;
	if ( !apiKey || !apiSecret || !url ) {
		throw new Error( "Missing LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET in .env" );
	}
	const grants = ROLE_GRANTS[role];
	if ( !grants ) throw new Error( `Unknown role: ${ role }` );

	const identity = `${ role }-${ Math.random().toString( 36 ).slice( 2, 8 ) }`;
	const at = new AccessToken( apiKey, apiSecret, { identity, ttl: "2h" } );
	at.addGrant( { roomJoin: true, room, ...grants } );
	return { url, token: await at.toJwt(), room, identity };
}

async function serveStatic( req, res ) {
	const urlPath = req.url === "/" ? "/presenter.html" : req.url.split( "?" )[0];
	const filePath = path.join( PUBLIC_DIR, urlPath );
	if ( !filePath.startsWith( PUBLIC_DIR ) ) {
		res.writeHead( 403 ); res.end(); return;
	}
	try {
		const data = await readFile( filePath );
		const ext = path.extname( filePath );
		res.writeHead( 200, { "content-type": STATIC_TYPES[ext] || "application/octet-stream" } );
		res.end( data );
	} catch {
		res.writeHead( 404 ); res.end( "Not found" );
	}
}

const server = createServer( async ( req, res ) => {
	try {
		const u = new URL( req.url, `http://${ req.headers.host }` );
		if ( u.pathname === "/api/token" ) {
			const room = u.searchParams.get( "room" );
			const role = u.searchParams.get( "role" );
			if ( !room || !role ) return jsonResponse( res, 400, { error: "room and role required" } );
			const creds = await mintToken( { room, role } );
			return jsonResponse( res, 200, creds );
		}
		if ( u.pathname === "/api/deepgram-token" ) {
			const data = await fetchDeepgramAccessToken();
			return jsonResponse( res, 200, { token: data.access_token, expiresIn: data.expires_in } );
		}
		await serveStatic( req, res );
	} catch ( err ) {
		jsonResponse( res, 500, { error: err.message } );
	}
} );

server.listen( PORT, () => {
	console.log( `LiveKit + Deepgram recipe running at http://localhost:${ PORT }` );
	console.log( "Open /presenter.html and /viewer.html in two tabs." );
} );
