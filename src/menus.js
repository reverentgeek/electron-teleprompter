import { Menu, dialog } from "electron";
import path from "node:path";

export function buildMenus( browserWindow, openScriptFile, recentFiles ) {
	const isMac = process.platform === "darwin";

	const recentSubmenu = recentFiles.map( filePath => ( {
		label: path.basename( filePath ),
		click: () => openScriptFile( filePath )
	} ) );

	if ( recentSubmenu.length > 0 ) {
		recentSubmenu.push( { type: "separator" } );
		recentSubmenu.push( {
			label: "Clear Recent",
			click: () => {
				recentFiles.length = 0;
				buildMenus( browserWindow, openScriptFile, recentFiles );
			}
		} );
	}

	const template = [
		...( isMac ? [ { role: "appMenu" } ] : [] ),
		{ label: "File", submenu: [
			{
				label: "Open",
				accelerator: "CmdOrCtrl+O",
				click: async () => {
					const results = await dialog.showOpenDialog( browserWindow, {
						properties: [ "openFile" ],
						filters: [
							{ name: "Markdown", extensions: [ "md", "txt" ] },
							{ name: "All Files", extensions: [ "*" ] }
						]
					} );
					if ( !results.canceled ) {
						openScriptFile( results.filePaths[0] );
					}
				} },
			{
				label: "Open Recent",
				submenu: recentSubmenu.length > 0
					? recentSubmenu
					: [ { label: "No Recent Files", enabled: false } ]
			},
			{ type: "separator" },
			{ role: "quit" }
		] },
		{ role: "viewMenu" }
	];

	const menu = Menu.buildFromTemplate( template );
	Menu.setApplicationMenu( menu );
}
