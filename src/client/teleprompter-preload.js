const { ipcRenderer } = require( "electron" );
const path = require( "path" );
const fs = require( "fs-extra" );
const showdown = require( "showdown" );

async function getContent() {
	const fileName = path.join( __dirname, "content.md" );
	const content = await fs.readFile( fileName, { encoding: "utf-8" } );
	console.log( content );
	return content;
}

async function convertMDtoHTML( md ) {
	const converter = new showdown.Converter();
	return converter.makeHtml( md );
}

window.addEventListener( "DOMContentLoaded", async () => {
	try {
		const md = await getContent();
		// convert the md to html
		const html = await convertMDtoHTML( md );
		const el = document.getElementById( "md" );
		if ( el ) {
			el.innerHTML = html;
		}
	} catch( err ) {
		ipcRenderer.send( "error-messages", err );
	}
} );
