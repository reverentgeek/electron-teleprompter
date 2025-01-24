import { ipcRenderer } from "electron";

self.addEventListener( "DOMContentLoaded", () => {
	try {
		ipcRenderer.on( "content", ( _event, content ) => {
			console.log( "received content..." );
			const el = document.getElementById( "md" );
			if ( el ) {
				el.innerHTML = content;
			}
		} );
	} catch ( err ) {
		ipcRenderer.send( "error-messages", err );
	}
} );
