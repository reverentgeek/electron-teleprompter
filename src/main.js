import { app, BrowserWindow, clipboard, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import chokidar from "chokidar";
import "dotenv/config";
import stateFactory from "./utils/state.js";
import { convertMarkdown, readAndConvertMarkdown, readRawMarkdown } from "./utils/content.js";
import { buildMenus } from "./menus.js";
import { mintToken } from "./livekit/tokens.js";
import { generateRoomName, generateIdentity, setSession, clearSession, getSession } from "./livekit/session.js";

const __dirname = import.meta.dirname;

const MAX_RECENT_FILES = 10;

const defaultConfig = {
	width: 800,
	height: 600,
	fontSize: 3,
	opacity: 0.07,
	mirrored: false,
	recentFiles: [],
	lastSession: { roomName: null, role: null }
};

const stateManager = stateFactory( defaultConfig );
let watcher;
let watcherPaused = false;

let currentFontSize = defaultConfig.fontSize;
let currentOpacity = defaultConfig.opacity;
let currentMirrored = defaultConfig.mirrored;
let recentFiles = [];
let currentFilePath = null;
let hasUnsavedChanges = false;
let isClosing = false;
let moduleOpenScriptFile = null;
let currentLastSession = defaultConfig.lastSession;

function addRecentFile( filePath ) {
	recentFiles = [ filePath, ...recentFiles.filter( f => f !== filePath ) ].slice( 0, MAX_RECENT_FILES );
}

const saveState = async ( win ) => {
	const position = win.getPosition();
	const size = win.getSize();

	stateManager.writeAppState( {
		width: size[0],
		height: size[1],
		x: position[0],
		y: position[1],
		fontSize: currentFontSize,
		opacity: currentOpacity,
		mirrored: currentMirrored,
		recentFiles,
		lastSession: currentLastSession
	} );
};

const createWindow = ( state, bootstrap = {} ) => {
	const win = new BrowserWindow( {
		width: state.width,
		height: state.height,
		...( state.x != null && state.y != null ? { x: state.x, y: state.y } : {} ),
		center: state.x == null,
		webPreferences: {
			nodeIntegration: false,
			sandbox: false,
			preload: path.join( __dirname, "client", "teleprompter-preload.mjs" )
		},
		transparent: true,
		frame: false
	} );

	win.webContents.session.setPermissionRequestHandler( ( _wc, permission, callback ) => {
		if ( permission === "media" ) {
			callback( true );
			return;
		}
		callback( false );
	} );

	win.loadFile( path.join( __dirname, "client", "teleprompter.html" ) );

	win.webContents.on( "did-finish-load", () => {
		win.webContents.send( "fontSize", state.fontSize || defaultConfig.fontSize );
		win.webContents.send( "opacity", state.opacity ?? defaultConfig.opacity );
		win.webContents.send( "mirrored", state.mirrored || false );
		if ( bootstrap.joinRoom ) {
			win.webContents.send( "bootstrapJoin", { roomName: bootstrap.joinRoom } );
		}
		if ( bootstrap.startSession ) {
			win.webContents.send( "bootstrapStartSession" );
		}
	} );

	win.on( "close", async ( event ) => {
		if ( isClosing ) {
			await saveState( win );
			return;
		}
		if ( hasUnsavedChanges ) {
			event.preventDefault();
			const result = await dialog.showMessageBox( win, {
				type: "warning",
				buttons: [ "Save", "Don't Save", "Cancel" ],
				defaultId: 0,
				cancelId: 2,
				message: "You have unsaved changes.",
				detail: "Do you want to save your changes before closing?"
			} );
			if ( result.response === 0 ) {
				// Save — tell renderer to save, then we'll close via saveAndClose IPC
				win.webContents.send( "requestSaveBeforeClose" );
			} else if ( result.response === 1 ) {
				// Don't Save — close without saving
				isClosing = true;
				win.close();
			}
			// Cancel (2) — do nothing, window stays open
		} else {
			await saveState( win );
		}
	} );

	async function watchScriptFile( scriptFile ) {
		if ( watcher ) {
			await watcher.close();
		}
		watcherPaused = false;
		watcher = chokidar.watch( scriptFile );
		watcher.on( "change", async () => {
			if ( watcherPaused ) return;
			const md = await readAndConvertMarkdown( scriptFile );
			win.webContents.send( "content", md );
		} );
	}

	async function openScriptFile( scriptFile ) {
		if ( hasUnsavedChanges ) {
			const result = await dialog.showMessageBox( win, {
				type: "warning",
				buttons: [ "Save", "Don't Save", "Cancel" ],
				defaultId: 0,
				cancelId: 2,
				message: "You have unsaved changes.",
				detail: "Do you want to save your changes before opening a new file?"
			} );
			if ( result.response === 0 ) {
				// Tell renderer to save, then return — user can re-open after saving
				win.webContents.send( "menuSave" );
				return null;
			} else if ( result.response === 2 ) {
				return null;
			}
			// Don't Save — proceed
			hasUnsavedChanges = false;
		}

		const md = await readAndConvertMarkdown( scriptFile );
		if ( md ) {
			currentFilePath = scriptFile;
			win.webContents.send( "content", md );
			addRecentFile( scriptFile );
			watchScriptFile( scriptFile );
			buildMenus( win, openScriptFile, recentFiles );
		}
		return md;
	}

	moduleOpenScriptFile = openScriptFile;
	buildMenus( win, openScriptFile, recentFiles );

	return { win, openScriptFile };
};

let launcherWin = null;
let teleprompterWin = null;
let teleprompterBooted = false;

function showLauncher() {
	launcherWin = new BrowserWindow( {
		width: 480,
		height: 420,
		resizable: false,
		minimizable: false,
		maximizable: false,
		fullscreenable: false,
		center: true,
		title: "Electron Teleprompter",
		webPreferences: {
			nodeIntegration: false,
			sandbox: false,
			preload: path.join( __dirname, "client", "launcher-preload.mjs" )
		}
	} );
	launcherWin.loadFile( path.join( __dirname, "client", "launcher.html" ) );
	launcherWin.on( "closed", () => {
		launcherWin = null;
		if ( !teleprompterBooted ) {
			app.quit();
		}
	} );
}

function closeLauncher() {
	if ( launcherWin ) {
		const w = launcherWin;
		launcherWin = null;
		w.destroy();
	}
}

function bootTeleprompter( state, bootstrap ) {
	if ( teleprompterBooted ) return;
	teleprompterBooted = true;
	const { win, openScriptFile } = createWindow( state, bootstrap );
	teleprompterWin = win;
	win.on( "closed", () => {
		teleprompterWin = null;
		teleprompterBooted = false;
	} );
	registerTeleprompterIpc( win );
	if ( bootstrap.filePath ) {
		win.webContents.once( "did-finish-load", () => {
			openScriptFile( bootstrap.filePath );
		} );
	}
	closeLauncher();
}

function registerTeleprompterIpc( win ) {
	ipcMain.on( "resizeWindow", ( _event, width, height ) => {
		win.setSize( width, height, false );
	} );

	// Editor IPC handlers
	ipcMain.on( "requestRawMarkdown", async () => {
		if ( currentFilePath ) {
			const raw = await readRawMarkdown( currentFilePath );
			win.webContents.send( "rawMarkdown", raw, currentFilePath );
		} else {
			win.webContents.send( "rawMarkdown", "", null );
		}
	} );

	async function saveFileAs( content ) {
		const result = await dialog.showSaveDialog( win, {
			defaultPath: currentFilePath || "untitled.md",
			filters: [
				{ name: "Markdown", extensions: [ "md", "txt" ] },
				{ name: "All Files", extensions: [ "*" ] }
			]
		} );
		if ( !result.canceled && result.filePath ) {
			try {
				await fs.writeFile( result.filePath, content, { encoding: "utf-8" } );
				currentFilePath = result.filePath;
				hasUnsavedChanges = false;
				addRecentFile( result.filePath );
				buildMenus( win, moduleOpenScriptFile, recentFiles );
				const md = await readAndConvertMarkdown( result.filePath );
				win.webContents.send( "content", md );
				win.webContents.send( "saveResult", true, result.filePath );
			} catch ( err ) {
				console.log( "Save As error:", err );
				win.webContents.send( "saveResult", false, null );
			}
		}
	}

	ipcMain.on( "saveFile", async ( _event, content ) => {
		if ( currentFilePath ) {
			try {
				await fs.writeFile( currentFilePath, content, { encoding: "utf-8" } );
				hasUnsavedChanges = false;
				const md = await readAndConvertMarkdown( currentFilePath );
				win.webContents.send( "content", md );
				win.webContents.send( "saveResult", true, currentFilePath );
			} catch ( err ) {
				console.log( "Save error:", err );
				win.webContents.send( "saveResult", false, currentFilePath );
			}
		} else {
			await saveFileAs( content );
		}
	} );

	ipcMain.on( "saveFileAs", async ( _event, content ) => {
		await saveFileAs( content );
	} );

	ipcMain.on( "editorDirty", ( _event, dirty ) => {
		hasUnsavedChanges = dirty;
	} );

	ipcMain.on( "pauseWatcher", () => {
		watcherPaused = true;
	} );

	ipcMain.on( "resumeWatcher", () => {
		watcherPaused = false;
	} );

	ipcMain.on( "previewMarkdown", async ( _event, markdown ) => {
		const html = await convertMarkdown( markdown );
		win.webContents.send( "content", html );
	} );

	ipcMain.on( "reloadContent", async () => {
		if ( currentFilePath ) {
			const md = await readAndConvertMarkdown( currentFilePath );
			if ( md ) {
				win.webContents.send( "content", md );
			}
		}
	} );

	ipcMain.on( "saveAndClose", async () => {
		isClosing = true;
		await saveState( win );
		win.close();
	} );

	// --- LiveKit session IPC ---
	ipcMain.on( "startLiveKitSession", async () => {
		try {
			const roomName = generateRoomName();
			const identity = generateIdentity( "presenter" );
			const credentials = await mintToken( { identity, roomName, role: "presenter" } );
			setSession( { role: "presenter", roomName, startedAt: Date.now() } );
			currentLastSession = { roomName, role: "presenter" };
			win.webContents.send( "liveKitSessionStarted", credentials );
		} catch ( err ) {
			console.log( "startLiveKitSession error:", err );
			win.webContents.send( "liveKitSessionError", { message: err.message } );
		}
	} );

	ipcMain.on( "joinLiveKitSession", async ( _event, payload ) => {
		try {
			const roomName = ( ( payload && payload.roomName ) || "" ).trim();
			if ( !roomName ) {
				throw new Error( "Room name is required to join a session." );
			}
			const identity = generateIdentity( "viewer" );
			const credentials = await mintToken( { identity, roomName, role: "viewer" } );
			setSession( { role: "viewer", roomName, startedAt: Date.now() } );
			currentLastSession = { roomName, role: "viewer" };
			win.webContents.send( "liveKitSessionJoined", credentials );
		} catch ( err ) {
			console.log( "joinLiveKitSession error:", err );
			win.webContents.send( "liveKitSessionError", { message: err.message } );
		}
	} );

	ipcMain.on( "leaveLiveKitSession", () => {
		clearSession();
		win.webContents.send( "liveKitSessionLeft" );
	} );

	ipcMain.on( "leaveAndShowLauncher", () => {
		clearSession();
		showLauncher();
		if ( teleprompterWin ) {
			teleprompterWin.destroy();
		}
	} );

	ipcMain.on( "copyToClipboard", ( _event, text ) => {
		try {
			clipboard.writeText( String( text ) );
		} catch ( err ) {
			console.log( "copyToClipboard error:", err );
		}
	} );

	ipcMain.on( "getDeepgramKey", () => {
		const session = getSession();
		if ( !session || session.role !== "presenter" ) {
			win.webContents.send( "deepgramKey", { key: null, error: "Deepgram key only available to presenter." } );
			return;
		}
		const key = process.env.DEEPGRAM_API_KEY || null;
		win.webContents.send( "deepgramKey", { key, error: key ? null : "DEEPGRAM_API_KEY not set in environment." } );
	} );
}

app.whenReady().then( async () => {
	const state = await stateManager.readAppState();
	currentFontSize = state.fontSize || defaultConfig.fontSize;
	currentOpacity = state.opacity ?? defaultConfig.opacity;
	currentMirrored = state.mirrored || false;
	recentFiles = state.recentFiles || [];
	currentLastSession = state.lastSession || defaultConfig.lastSession;

	ipcMain.on( "fontSize", ( _event, size ) => {
		currentFontSize = size;
	} );

	ipcMain.on( "opacity", ( _event, value ) => {
		currentOpacity = value;
	} );

	ipcMain.on( "mirrored", ( _event, value ) => {
		currentMirrored = value;
	} );

	ipcMain.on( "launcherStart", async () => {
		if ( !launcherWin ) return;
		const result = await dialog.showOpenDialog( launcherWin, {
			properties: [ "openFile" ],
			filters: [
				{ name: "Markdown", extensions: [ "md", "txt" ] },
				{ name: "All Files", extensions: [ "*" ] }
			]
		} );
		if ( result.canceled || !result.filePaths.length ) {
			launcherWin?.webContents.send( "launcherResetButtons" );
			return;
		}
		bootTeleprompter( state, { filePath: result.filePaths[0], startSession: true } );
	} );

	ipcMain.on( "launcherJoin", ( _event, payload ) => {
		const roomName = ( ( payload && payload.roomName ) || "" ).trim();
		if ( !roomName ) {
			launcherWin?.webContents.send( "launcherResetButtons" );
			return;
		}
		bootTeleprompter( state, { joinRoom: roomName } );
	} );

	showLauncher();
} );

app.on( "window-all-closed", () => {
	app.quit();
} );
