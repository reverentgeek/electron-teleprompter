import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld( "electron", {
	onContent: callback => ipcRenderer.on( "content", ( _event, content ) => callback( content ) )
} );
