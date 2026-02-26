let scriptIndex = 0;
const md = document.getElementById( "md" );

const DEFAULT_FONT_SIZE = 3;
const FONT_SIZE_STEP = 0.25;
const MIN_FONT_SIZE = 1;
const MAX_FONT_SIZE = 8;
let fontSize = DEFAULT_FONT_SIZE;

function setFontSize( size, save = true ) {
	fontSize = Math.min( MAX_FONT_SIZE, Math.max( MIN_FONT_SIZE, size ) );
	document.body.style.fontSize = `${ fontSize }em`;
	if ( save ) {
		window.electron.saveFontSize( fontSize );
	}
}

window.electron.onFontSize( ( size ) => {
	setFontSize( size, false );
} );

let mirrored = false;

function setMirrored( value, save = true ) {
	mirrored = value;
	document.body.style.transform = mirrored ? "scaleX(-1)" : "";
	if ( save ) {
		window.electron.saveMirrored( mirrored );
	}
}

window.electron.onMirrored( ( value ) => {
	setMirrored( value, false );
} );

function jumpToSection( index ) {
	const url = location.href;
	location.href = "#" + index;
	history.replaceState( null, null, url );
}

document.addEventListener( "keydown", ( event ) => {
	if ( event.key === "ArrowRight" ) {
		event.preventDefault();
		// Advance to next section
		const sections = document.getElementsByName( scriptIndex + 1 );
		if ( sections.length > 0 ) {
			scriptIndex++;
			jumpToSection( scriptIndex );
		}
	} else if ( event.key === "ArrowLeft" ) {
		event.preventDefault();
		// Go back to previous section
		if ( scriptIndex > 0 ) {
			scriptIndex--;
			jumpToSection( scriptIndex );
		}
	} else if ( ( event.metaKey || event.ctrlKey ) && ( event.key === "=" || event.key === "+" ) ) {
		event.preventDefault();
		setFontSize( fontSize + FONT_SIZE_STEP );
	} else if ( ( event.metaKey || event.ctrlKey ) && event.key === "-" ) {
		event.preventDefault();
		setFontSize( fontSize - FONT_SIZE_STEP );
	} else if ( ( event.metaKey || event.ctrlKey ) && event.key === "0" ) {
		event.preventDefault();
		setFontSize( DEFAULT_FONT_SIZE );
	} else if ( ( event.metaKey || event.ctrlKey ) && event.key === "m" ) {
		event.preventDefault();
		setMirrored( !mirrored );
	}
} );

// Handle content loaded from main process
window.electron.onContent( ( content ) => {
	if ( md ) {
		md.innerHTML = content;
		scriptIndex = 0;
	}
} );
