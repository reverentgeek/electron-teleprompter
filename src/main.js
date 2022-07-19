"use strict";

const { app, BrowserWindow, ipcMain } = require( "electron" );
const path = require( "path" );

const saveState = async ( win ) => {
	const position = win.getPosition();
	const size = win.getSize();
	console.log( "position: ", position, "size: ", size );
};

const createWindow = () => {
	const win = new BrowserWindow( {
		width: 800,
		height: 600,
		// x: -1905,
		// y: 58,
		center: true,
		webPreferences: {
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

app.whenReady().then( () => {
	createWindow();

	ipcMain.on( "error-messages", ( event, args ) => {
		console.log( event, args );
	} );
} );
