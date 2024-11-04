import { app } from "electron";
import { join } from "node:path";
import fs from "fs-extra";

export default ( defaultConfig ) => {
	const userFolder = app.getPath( "userData" );
	const appStateFile = join( userFolder, "app-state.json" );

	async function readAppState() {
		const exists = await fs.pathExists( appStateFile );
		if ( exists ) {
			try {
				const config = await fs.readJSON( appStateFile );
				return config;
			} catch ( err ) {
				console.log( "Error reading state file." );
				console.log( err );
				return defaultConfig;
			}
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
