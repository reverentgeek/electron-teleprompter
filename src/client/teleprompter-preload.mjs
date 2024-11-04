import { ipcRenderer } from "electron";

window.addEventListener( "DOMContentLoaded", async () => {
	try {
		ipcRenderer.on( "content", ( event, content ) => {
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
