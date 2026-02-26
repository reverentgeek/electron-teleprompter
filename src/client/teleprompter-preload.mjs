import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld( "electron", {
	refresh: () => ipcRenderer.send( "refresh" ),
	onContent: callback => ipcRenderer.on( "content", ( _event, content ) => callback( content ) )
} );
