import { Menu, dialog } from "electron";
import { readAndConvertMarkdown } from "./utils/content.js";

export function buildMenus( browserWindow, watchFile ) {
	const isMac = process.platform === "darwin";

	const template = [
		...( isMac ? [ { role: "appMenu" } ] : [] ),
		{ label: "File", submenu: [
			{
				label: "Open",
				accelerator: "Cmd+O",
				click: async () => {
					const results = await dialog.showOpenDialog( browserWindow, {
						properties: [ "openFile" ],
						filters: [
							{ name: "Markdown", extensions: [ "md", "txt" ] },
							{ name: "All Files", extensions: [ "*" ] }
						]
					} );
					if ( !results.canceled ) {
						const scriptFile = results.filePaths[0];
						console.log( "The file: ", scriptFile );
						const md = await readAndConvertMarkdown( scriptFile );
						if ( md ) {
							// send md to browserWindow
							console.log( "Sending content to browserWindow..." );
							browserWindow.webContents.send( "content", md );
							watchFile( scriptFile );
						} else {
							// display error message loading file
							console.log( "There was an error converting markdown" );
						}
					} else {
						console.log( "User cancelled!" );
					}
				} },
			{ role: "quit" }
		] },
		{ role: "viewMenu" }
	];

	const menu = Menu.buildFromTemplate( template );
	Menu.setApplicationMenu( menu );
}
