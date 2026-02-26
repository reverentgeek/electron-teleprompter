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

const DEFAULT_OPACITY = 0.07;
const OPACITY_STEP = 0.05;
let opacity = DEFAULT_OPACITY;

function setOpacity( value, save = true ) {
	opacity = Math.min( 1, Math.max( 0, Math.round( value * 100 ) / 100 ) );
	document.body.style.backgroundColor = `rgba(0, 0, 0, ${ opacity })`;
	if ( save ) {
		window.electron.saveOpacity( opacity );
	}
}

window.electron.onOpacity( ( value ) => {
	setOpacity( value, false );
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
	} else if ( ( event.metaKey || event.ctrlKey ) && !event.shiftKey && ( event.key === "=" || event.key === "+" ) ) {
		event.preventDefault();
		setFontSize( fontSize + FONT_SIZE_STEP );
	} else if ( ( event.metaKey || event.ctrlKey ) && !event.shiftKey && event.key === "-" ) {
		event.preventDefault();
		setFontSize( fontSize - FONT_SIZE_STEP );
	} else if ( ( event.metaKey || event.ctrlKey ) && !event.shiftKey && event.key === "0" ) {
		event.preventDefault();
		setFontSize( DEFAULT_FONT_SIZE );
	} else if ( ( event.metaKey || event.ctrlKey ) && event.key === "m" ) {
		event.preventDefault();
		setMirrored( !mirrored );
	} else if ( ( event.metaKey || event.ctrlKey ) && event.shiftKey && event.key === "ArrowUp" ) {
		event.preventDefault();
		setOpacity( opacity + OPACITY_STEP );
	} else if ( ( event.metaKey || event.ctrlKey ) && event.shiftKey && event.key === "ArrowDown" ) {
		event.preventDefault();
		setOpacity( opacity - OPACITY_STEP );
	} else if ( ( event.metaKey || event.ctrlKey ) && event.shiftKey && ( event.key === ")" || event.key === "0" ) ) {
		event.preventDefault();
		setOpacity( DEFAULT_OPACITY );
	}
} );

// Resize handle
const resizeHandle = document.getElementById( "resize-handle" );
if ( resizeHandle ) {
	resizeHandle.addEventListener( "mousedown", ( e ) => {
		e.preventDefault();
		const startX = e.screenX;
		const startY = e.screenY;
		const startWidth = window.outerWidth;
		const startHeight = window.outerHeight;

		function onMouseMove( moveEvent ) {
			const newWidth = Math.max( 200, startWidth + moveEvent.screenX - startX );
			const newHeight = Math.max( 150, startHeight + moveEvent.screenY - startY );
			window.electron.resizeWindow( newWidth, newHeight );
		}

		function onMouseUp() {
			document.removeEventListener( "mousemove", onMouseMove );
			document.removeEventListener( "mouseup", onMouseUp );
		}

		document.addEventListener( "mousemove", onMouseMove );
		document.addEventListener( "mouseup", onMouseUp );
	} );
}

// Handle content loaded from main process
window.electron.onContent( ( content ) => {
	if ( md ) {
		md.innerHTML = content;
		scriptIndex = 0;
	}
} );
