const { ipcRenderer } = require( "electron" );

window.addEventListener( "DOMContentLoaded", async () => {
	try {
		ipcRenderer.on( "content", ( event, content ) => {
			const el = document.getElementById( "md" );
			if ( el ) {
				el.innerHTML = content;
			}
		} );
	} catch( err ) {
		ipcRenderer.send( "error-messages", err );
	}
} );
