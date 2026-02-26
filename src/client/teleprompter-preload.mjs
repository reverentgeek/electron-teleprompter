import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld( "electron", {
	onContent: callback => ipcRenderer.on( "content", ( _event, content ) => callback( content ) ),
	onFontSize: callback => ipcRenderer.on( "fontSize", ( _event, size ) => callback( size ) ),
	saveFontSize: size => ipcRenderer.send( "fontSize", size ),
	onMirrored: callback => ipcRenderer.on( "mirrored", ( _event, value ) => callback( value ) ),
	saveMirrored: value => ipcRenderer.send( "mirrored", value ),
	onOpacity: callback => ipcRenderer.on( "opacity", ( _event, value ) => callback( value ) ),
	saveOpacity: value => ipcRenderer.send( "opacity", value )
} );
