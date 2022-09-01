const { ipcRenderer } = require( "electron" );
const path = require( "path" );
const content = require( "../utils/content" );

async function getContent() {
	const fileName = path.join( __dirname, "content.md" );
	const md = await content.readAndConvertMarkdown( fileName );
	return md;
}

window.addEventListener( "DOMContentLoaded", async () => {
	try {
		// const md = await getContent();
		// const el = document.getElementById( "md" );
		// if ( el ) {
		// 	el.innerHTML = md; // updatedHtml;
		// }

		ipcRenderer.on( "content", ( event, content ) => {
			const el = document.getElementById( "md" );
			if ( el ) {
				el.innerHTML = content;
			}
		} );

	} catch( err ) {
		ipcRenderer.send( "error-messages", err );
	}
} );
