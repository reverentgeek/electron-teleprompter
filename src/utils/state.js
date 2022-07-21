"use strict";

const { app } = require( "electron" );
const path = require( "path" );
const fs = require( "fs-extra" );

module.exports = ( defaultConfig ) => {
	const userFolder = app.getPath( "userData" );
	const appStateFile = path.join( userFolder, "app-state.json" );

	async function readAppState() {
		const exists = await fs.pathExists( appStateFile );
		if ( exists ) {
			const config = await fs.readJSON( appStateFile );
			console.log( config );
			return config;
		}
		console.log( "state file does not exist!" );
		return defaultConfig;
	}

	async function writeAppState( state ) {
		await fs.writeJSON( appStateFile, state );
	}

	return {
		readAppState,
		writeAppState
	};
};
