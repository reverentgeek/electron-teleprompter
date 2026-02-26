import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import chokidar from "chokidar";
import stateFactory from "./utils/state.js";
import { readAndConvertMarkdown } from "./utils/content.js";
import { buildMenus } from "./menus.js";

const __dirname = import.meta.dirname;

const MAX_RECENT_FILES = 10;

const defaultConfig = {
	width: 800,
	height: 600,
	fontSize: 3,
	opacity: 0.07,
	mirrored: false,
	recentFiles: []
};

const stateManager = stateFactory( defaultConfig );
let watcher;

let currentFontSize = defaultConfig.fontSize;
let currentOpacity = defaultConfig.opacity;
let currentMirrored = defaultConfig.mirrored;
let recentFiles = [];

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
		recentFiles
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

	win.loadFile( path.join( __dirname, "client", "teleprompter.html" ) );

	win.webContents.on( "did-finish-load", () => {
		win.webContents.send( "fontSize", state.fontSize || defaultConfig.fontSize );
		win.webContents.send( "opacity", state.opacity ?? defaultConfig.opacity );
		win.webContents.send( "mirrored", state.mirrored || false );
	} );

	win.on( "close", async () => {
		await saveState( win );
	} );

	async function watchScriptFile( scriptFile ) {
		if ( watcher ) {
			await watcher.close();
		}
		watcher = chokidar.watch( scriptFile );
		watcher.on( "change", async () => {
			const md = await readAndConvertMarkdown( scriptFile );
			win.webContents.send( "content", md );
		} );
	}

	async function openScriptFile( scriptFile ) {
		const md = await readAndConvertMarkdown( scriptFile );
		if ( md ) {
			win.webContents.send( "content", md );
			addRecentFile( scriptFile );
			watchScriptFile( scriptFile );
			buildMenus( win, openScriptFile, recentFiles );
		}
		return md;
	}

	buildMenus( win, openScriptFile, recentFiles );

	return { win, openScriptFile };
};

app.whenReady().then( async () => {
	const state = await stateManager.readAppState();
	currentFontSize = state.fontSize || defaultConfig.fontSize;
	currentOpacity = state.opacity ?? defaultConfig.opacity;
	currentMirrored = state.mirrored || false;
	recentFiles = state.recentFiles || [];

	ipcMain.on( "fontSize", ( _event, size ) => {
		currentFontSize = size;
	} );

	ipcMain.on( "opacity", ( _event, value ) => {
		currentOpacity = value;
	} );

	ipcMain.on( "mirrored", ( _event, value ) => {
		currentMirrored = value;
	} );

	const { win, openScriptFile } = createWindow( state );

	ipcMain.on( "resizeWindow", ( _event, width, height ) => {
		win.setSize( width, height, false );
	} );

	// Auto-load most recent file on startup
	if ( recentFiles.length > 0 ) {
		win.webContents.on( "did-finish-load", () => {
			openScriptFile( recentFiles[0] );
		} );
	}
} );
