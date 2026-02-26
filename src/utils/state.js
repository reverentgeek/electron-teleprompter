import { app } from "electron";
import { join } from "node:path";
import fs from "node:fs/promises";

export default ( defaultConfig ) => {
	const userFolder = app.getPath( "userData" );
	const appStateFile = join( userFolder, "app-state.json" );

	async function readAppState() {
		try {
			const data = await fs.readFile( appStateFile, "utf-8" );
			return JSON.parse( data );
		} catch ( err ) {
			if ( err.code !== "ENOENT" ) {
				console.log( "Error reading state file." );
				console.log( err );
			}
			return defaultConfig;
		}
	}

	async function writeAppState( state ) {
		await fs.writeFile( appStateFile, JSON.stringify( state ) );
	}

	return {
		readAppState,
		writeAppState
	};
};
