import fs from "fs-extra";
import showdown from "showdown";

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

export async function readAndConvertMarkdown( filePath ) {
	try {
		// read the markdown
		const md = await fs.readFile( filePath, { encoding: "utf-8" } );
		// console.log( md );
		// convert the md to html
		const html = await convertMDtoHTML( md );
		// console.log( html );
		// inject anchors for keyboard/clicker support
		const updatedHtml = injectHeadingAnchors( html );
		// console.log( updatedHtml );
		return updatedHtml;
	} catch ( err ) {
		console.log( err );
		return null;
	}
}
