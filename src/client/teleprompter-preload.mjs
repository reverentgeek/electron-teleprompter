import { contextBridge, ipcRenderer } from "electron";

self.addEventListener( "DOMContentLoaded", () => {
	try {
		ipcRenderer.on( "content", ( _event, content ) => {
			console.log( "received content..." );
			const el = document.getElementById( "md" );
			if ( el ) {
				el.innerHTML = content;
				ipcRenderer.send( "refresh" );
			}
		} );
	} catch ( err ) {
		ipcRenderer.send( "error-messages", err );
	}
} );

contextBridge.exposeInMainWorld( "electron", {
	refresh: () => ipcRenderer.send( "refresh" )
} );
