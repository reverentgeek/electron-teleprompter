"use strict";

const { app, BrowserWindow, ipcMain } = require( "electron" );
const path = require( "path" );

const defaultConfig = {
	width: 800,
	height: 600,
	x: 0,
	y: 0
};
const stateManager = require( "./utils/state" )( defaultConfig );

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
			preload: path.join( __dirname, "client", "teleprompter-preload.js" )
		},
		transparent: true,
		frame: false
	} );

	win.loadFile( path.join( __dirname, "client", "teleprompter.html" ) );

	win.on( "close", async () => {
		await saveState( win );
	} );
};

app.whenReady().then( async () => {
	const state = await stateManager.readAppState();
	createWindow( state );

	ipcMain.on( "error-messages", ( event, args ) => {
		console.log( event, args );
	} );
} );
