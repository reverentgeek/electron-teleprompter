import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import chokidar from "chokidar";
import stateFactory from "./utils/state.js";
import { readAndConvertMarkdown } from "./utils/content.js";
import { buildMenus } from "./menus.js";

const __dirname = import.meta.dirname;

const defaultConfig = {
	width: 800,
	height: 600,
	x: 0,
	y: 0,
	fontSize: 3
};

const stateManager = stateFactory( defaultConfig );
let watcher;

let currentFontSize = defaultConfig.fontSize;

const saveState = async ( win ) => {
	const position = win.getPosition();
	const size = win.getSize();

	stateManager.writeAppState( {
		width: size[0],
		height: size[1],
		x: position[0],
		y: position[1],
		fontSize: currentFontSize
	} );
};

const createWindow = ( state ) => {
	const win = new BrowserWindow( {
		width: state.width,
		height: state.height,
		x: state.x,
		y: state.y,
		center: true,
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
	} );

	win.on( "close", async () => {
		await saveState( win );
	} );

	async function watchFile( scriptFile ) {
		if ( watcher ) {
			await watcher.close();
		}
		watcher = chokidar.watch( scriptFile );
		watcher.on( "change", async () => {
			const md = await readAndConvertMarkdown( scriptFile );
			win.webContents.send( "content", md );
		} );
	}

	buildMenus( win, watchFile );

	return win;
};

app.whenReady().then( async () => {
	const state = await stateManager.readAppState();
	currentFontSize = state.fontSize || defaultConfig.fontSize;

	ipcMain.on( "fontSize", ( _event, size ) => {
		currentFontSize = size;
	} );

	createWindow( state );
} );
