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
	y: 0
};

const stateManager = stateFactory( defaultConfig );
let watcher;

const saveState = async ( win ) => {
	const position = win.getPosition();
	const size = win.getSize();

	stateManager.writeAppState( {
		width: size[0],
		height: size[1],
		x: position[0],
		y: position[1]
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
			nodeIntegration: true,
			preload: path.join( __dirname, "client", "teleprompter-preload.mjs" )
		},
		transparent: true,
		frame: false
	} );

	win.loadFile( path.join( __dirname, "client", "teleprompter.html" ) );

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

};

app.whenReady().then( async () => {

	const state = await stateManager.readAppState();
	createWindow( state );

	ipcMain.on( "error-messages", ( event, args ) => {
		console.log( event, args );
	} );

} );
