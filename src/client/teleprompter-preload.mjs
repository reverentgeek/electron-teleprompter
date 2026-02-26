import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld( "electron", {
	onContent: callback => ipcRenderer.on( "content", ( _event, content ) => callback( content ) ),
	onFontSize: callback => ipcRenderer.on( "fontSize", ( _event, size ) => callback( size ) ),
	saveFontSize: size => ipcRenderer.send( "fontSize", size ),
	onMirrored: callback => ipcRenderer.on( "mirrored", ( _event, value ) => callback( value ) ),
	saveMirrored: value => ipcRenderer.send( "mirrored", value ),
	onOpacity: callback => ipcRenderer.on( "opacity", ( _event, value ) => callback( value ) ),
	saveOpacity: value => ipcRenderer.send( "opacity", value ),
	resizeWindow: ( width, height ) => ipcRenderer.send( "resizeWindow", width, height ),

	// Editor IPC
	requestRawMarkdown: () => ipcRenderer.send( "requestRawMarkdown" ),
	onRawMarkdown: callback => ipcRenderer.on( "rawMarkdown", ( _event, content, filePath ) => callback( content, filePath ) ),
	saveFile: content => ipcRenderer.send( "saveFile", content ),
	saveFileAs: content => ipcRenderer.send( "saveFileAs", content ),
	onSaveResult: callback => ipcRenderer.on( "saveResult", ( _event, success, filePath ) => callback( success, filePath ) ),
	onToggleEditor: callback => ipcRenderer.on( "toggleEditor", () => callback() ),
	setEditorDirty: dirty => ipcRenderer.send( "editorDirty", dirty ),
	pauseWatcher: () => ipcRenderer.send( "pauseWatcher" ),
	resumeWatcher: () => ipcRenderer.send( "resumeWatcher" ),
	onRequestSaveBeforeClose: callback => ipcRenderer.on( "requestSaveBeforeClose", () => callback() ),
	saveAndClose: () => ipcRenderer.send( "saveAndClose" ),
	onMenuSave: callback => ipcRenderer.on( "menuSave", () => callback() ),
	onMenuSaveAs: callback => ipcRenderer.on( "menuSaveAs", () => callback() ),
	onNewFile: callback => ipcRenderer.on( "newFile", () => callback() ),
	previewMarkdown: markdown => ipcRenderer.send( "previewMarkdown", markdown ),
	reloadContent: () => ipcRenderer.send( "reloadContent" )
} );
