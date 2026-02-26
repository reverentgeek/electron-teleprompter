let scriptIndex = 0;
const md = document.getElementById( "md" );

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
	}
} );

// Handle content loaded from main process
window.electron.onContent( ( content ) => {
	if ( md ) {
		md.innerHTML = content;
		scriptIndex = 0;
	}
} );
