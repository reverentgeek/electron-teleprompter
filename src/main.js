import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import chokidar from "chokidar";
import stateFactory from "./utils/state.js";
import { convertMarkdown, readAndConvertMarkdown, readRawMarkdown } from "./utils/content.js";
import { buildMenus } from "./menus.js";

const __dirname = import.meta.dirname;

const MAX_RECENT_FILES = 10;

const defaultConfig = {
	width: 800,
	height: 600,
	fontSize: 3,
	opacity: 0.07,
	mirrored: false,
	recentFiles: [],
	deepgramApiKey: null,
	autoScrollSpeed: 1
};

const stateManager = stateFactory( defaultConfig );
let watcher;
let watcherPaused = false;

let currentFontSize = defaultConfig.fontSize;
let currentOpacity = defaultConfig.opacity;
let currentMirrored = defaultConfig.mirrored;
let currentDeepgramApiKey = null;
let currentAutoScrollSpeed = defaultConfig.autoScrollSpeed;
let recentFiles = [];
let currentFilePath = null;
let hasUnsavedChanges = false;
let isClosing = false;
let moduleOpenScriptFile = null;

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
		deepgramApiKey: currentDeepgramApiKey,
		autoScrollSpeed: currentAutoScrollSpeed
	} );
};

const createWindow = ( state ) => {
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
		callback( permission === "media" );
	} );

	win.loadFile( path.join( __dirname, "client", "teleprompter.html" ) );

	win.webContents.on( "did-finish-load", () => {
		win.webContents.send( "fontSize", state.fontSize || defaultConfig.fontSize );
		win.webContents.send( "opacity", state.opacity ?? defaultConfig.opacity );
		win.webContents.send( "mirrored", state.mirrored || false );
		win.webContents.send( "autoScrollSpeed", state.autoScrollSpeed ?? defaultConfig.autoScrollSpeed );
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

app.whenReady().then( async () => {
	const state = await stateManager.readAppState();
	currentFontSize = state.fontSize || defaultConfig.fontSize;
	currentOpacity = state.opacity ?? defaultConfig.opacity;
	currentMirrored = state.mirrored || false;
	recentFiles = state.recentFiles || [];
	currentDeepgramApiKey = state.deepgramApiKey || null;
	currentAutoScrollSpeed = state.autoScrollSpeed ?? defaultConfig.autoScrollSpeed;

	ipcMain.on( "fontSize", ( _event, size ) => {
		currentFontSize = size;
	} );

	ipcMain.on( "opacity", ( _event, value ) => {
		currentOpacity = value;
	} );

	ipcMain.on( "mirrored", ( _event, value ) => {
		currentMirrored = value;
	} );

	ipcMain.on( "autoScrollSpeed", ( _event, value ) => {
		if ( Number.isFinite( value ) ) {
			currentAutoScrollSpeed = value;
		}
	} );

	const { win, openScriptFile } = createWindow( state );

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

	ipcMain.on( "getDeepgramKey", () => {
		win.webContents.send( "deepgramKey", {
			key: currentDeepgramApiKey,
			error: currentDeepgramApiKey ? null : "No Deepgram API key saved."
		} );
	} );

	ipcMain.on( "setDeepgramKey", async ( _event, key ) => {
		const trimmed = typeof key === "string" ? key.trim() : "";
		currentDeepgramApiKey = trimmed || null;
		await saveState( win );
		win.webContents.send( "deepgramKeySaved", { hasKey: !!currentDeepgramApiKey } );
	} );

	// Auto-load most recent file on startup
	if ( recentFiles.length > 0 ) {
		win.webContents.on( "did-finish-load", () => {
			openScriptFile( recentFiles[0] );
		} );
	}
} );
