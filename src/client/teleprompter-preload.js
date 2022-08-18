const { ipcRenderer } = require( "electron" );
const path = require( "path" );
const fs = require( "fs-extra" );
const showdown = require( "showdown" );

async function getContent() {
	const fileName = path.join( __dirname, "content.md" );
	const content = await fs.readFile( fileName, { encoding: "utf-8" } );
	return content;
}

async function convertMDtoHTML( md ) {
	const converter = new showdown.Converter();
	return converter.makeHtml( md );
}

function injectHeadingAnchors( html ) {
	const regex = /<h2 [^>]*>/gm;
	const matches = html.match( regex );
	for( let i = 0; i < matches.length; i++ ) {
		html = html.replace( matches[i], `${ matches[i] }<a name="${ i }"></a>` );
	}
	html += "<p>&nbsp;</p>".repeat( 10 );
	return html;
}

window.addEventListener( "DOMContentLoaded", async () => {
	try {
		const md = await getContent();
		// convert the md to html
		const html = await convertMDtoHTML( md );
		const updatedHtml = injectHeadingAnchors( html );
		const el = document.getElementById( "md" );
		if ( el ) {
			el.innerHTML = updatedHtml;
		}
	} catch( err ) {
		ipcRenderer.send( "error-messages", err );
	}
} );
