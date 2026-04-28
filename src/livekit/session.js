import { randomBytes } from "node:crypto";

let current = null;

export function getSession() {
	return current;
}

export function setSession( session ) {
	current = session;
}

export function clearSession() {
	current = null;
}

export function generateRoomName() {
	return `tp-${ randomBytes( 3 ).toString( "hex" ) }`;
}

export function generateIdentity( role ) {
	return `${ role }-${ randomBytes( 2 ).toString( "hex" ) }`;
}
