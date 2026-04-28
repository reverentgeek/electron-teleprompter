import { AccessToken } from "livekit-server-sdk";

const TOKEN_TTL = "2h";

const ROLE_GRANTS = {
	presenter: {
		canPublish: true,
		canPublishData: true,
		canSubscribe: true
	},
	viewer: {
		canPublish: false,
		canPublishData: false,
		canSubscribe: true
	}
};

export async function mintToken( { identity, roomName, role } ) {
	const apiKey = process.env.LIVEKIT_API_KEY;
	const apiSecret = process.env.LIVEKIT_API_SECRET;
	const url = process.env.LIVEKIT_URL;

	if ( !apiKey || !apiSecret || !url ) {
		throw new Error( "Missing LIVEKIT_URL, LIVEKIT_API_KEY, or LIVEKIT_API_SECRET in environment." );
	}

	const grants = ROLE_GRANTS[role];
	if ( !grants ) {
		throw new Error( `Unknown role: ${ role }` );
	}

	const at = new AccessToken( apiKey, apiSecret, {
		identity,
		ttl: TOKEN_TTL
	} );
	at.addGrant( {
		roomJoin: true,
		room: roomName,
		...grants
	} );

	const token = await at.toJwt();
	return { url, token, roomName, identity };
}
