let scriptIndex = 0;

function jumpToSection( index ) {
	console.log( index );
	const url = location.href;
	location.href = "#" + index;
	history.replaceState( null, null, url );
}

document.addEventListener( "keydown", ( event ) => {
	if ( event.key === "ArrowRight" ) {
		// Advance to next section
		const sections = document.getElementsByName( scriptIndex + 1 );
		if ( sections.length > 0 ) {
			scriptIndex++;
			jumpToSection( scriptIndex );
		}
	} else if ( event.key === "ArrowLeft" ) {
		// Go back to previous section
		if ( scriptIndex > 0 ) {
			scriptIndex--;
			jumpToSection( scriptIndex );
		}
	}
} );
