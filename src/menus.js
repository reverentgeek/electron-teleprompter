"use strict";

const { app, Menu, dialog, ipcMain } = require( "electron" );
const content = require( "./utils/content" );

function buildMenus( browserWindow ) {

	const isMac = process.platform === "darwin";

	const template = [
		...( isMac ? [ { role: "appMenu" } ] : [] ),
		{ 	label: "File", submenu: [
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
						const md = await content.readAndConvertMarkdown( scriptFile );
						if ( md ) {
							// send md to browserWindow
							// console.log( md );
							browserWindow.webContents.send( "content", md );
							// console.log( "browserWindow", browserWindow );
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

	// const isMac = process.platform === "darwin";

	// const template = [
	// 	// { role: 'appMenu' }
	// 	...( isMac ? [ {
	// 		label: app.name,
	// 		submenu: [
	// 			{ role: "about" },
	// 			{ type: "separator" },
	// 			{ role: "services" },
	// 			{ type: "separator" },
	// 			{ role: "hide" },
	// 			{ role: "hideOthers" },
	// 			{ role: "unhide" },
	// 			{ type: "separator" },
	// 			{ role: "quit" }
	// 		]
	// 	} ] : [] ),
	// 	// { role: 'fileMenu' }
	// 	{
	// 		label: "File",
	// 		submenu: [
	// 			isMac ? { role: "close" } : { role: "quit" }
	// 		]
	// 	},
	// 	// { role: 'editMenu' }
	// 	{
	// 		label: "Edit",
	// 		submenu: [
	// 			{ role: "undo" },
	// 			{ role: "redo" },
	// 			{ type: "separator" },
	// 			{ role: "cut" },
	// 			{ role: "copy" },
	// 			{ role: "paste" },
	// 			...( isMac ? [
	// 				{ role: "pasteAndMatchStyle" },
	// 				{ role: "delete" },
	// 				{ role: "selectAll" },
	// 				{ type: "separator" },
	// 				{
	// 					label: "Speech",
	// 					submenu: [
	// 						{ role: "startSpeaking" },
	// 						{ role: "stopSpeaking" }
	// 					]
	// 				}
	// 			] : [
	// 				{ role: "delete" },
	// 				{ type: "separator" },
	// 				{ role: "selectAll" }
	// 			] )
	// 		]
	// 	},
	// 	// { role: 'viewMenu' }
	// 	{
	// 		label: "View",
	// 		submenu: [
	// 			{ role: "reload" },
	// 			{ role: "forceReload" },
	// 			{ role: "toggleDevTools" },
	// 			{ type: "separator" },
	// 			{ role: "resetZoom" },
	// 			{ role: "zoomIn" },
	// 			{ role: "zoomOut" },
	// 			{ type: "separator" },
	// 			{ role: "togglefullscreen" }
	// 		]
	// 	},
	// 	// { role: 'windowMenu' }
	// 	{
	// 		label: "Window",
	// 		submenu: [
	// 			{ role: "minimize" },
	// 			{ role: "zoom" },
	// 			...( isMac ? [
	// 				{ type: "separator" },
	// 				{ role: "front" },
	// 				{ type: "separator" },
	// 				{ role: "window" }
	// 			] : [
	// 				{ role: "close" }
	// 			] )
	// 		]
	// 	},
	// 	{
	// 		role: "help",
	// 		submenu: [
	// 			{
	// 				label: "Learn More",
	// 				click: async () => {
	// 					const { shell } = require( "electron" );
	// 					await shell.openExternal( "https://electronjs.org" );
	// 				}
	// 			}
	// 		]
	// 	}
	// ];

	const menu = Menu.buildFromTemplate( template );
	Menu.setApplicationMenu( menu );
}

module.exports = {
	buildMenus
};

