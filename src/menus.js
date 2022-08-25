"use strict";

const { app, Menu, dialog } = require( "electron" );

function buildMenus( browserWindow ) {

	const template = [
		{ role: "appMenu" },
		{ 	label: "File", submenu: [
			{
				label: "Open",
				accelerator: "Cmd+O",
				click: async () => {
					const results = await dialog.showOpenDialog( browserWindow, {
						properties: [ "openFile" ]
					} );
					if ( !results.canceled ) {
						const scriptFile = results.filePaths[0];
						console.log( "The file: ", scriptFile );
					} else {
						console.log( "User cancelled!" );
					}
				} },
			{ role: "quit" }
		] }
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

