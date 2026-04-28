import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld( "electronLauncher", {
	start: () => ipcRenderer.send( "launcherStart" ),
	join: roomName => ipcRenderer.send( "launcherJoin", { roomName } ),
	onResetButtons: callback => ipcRenderer.on( "launcherResetButtons", () => callback() )
} );
