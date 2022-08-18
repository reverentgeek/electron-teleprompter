// console.log( "this is from teleprompter.js" );

let scriptIndex = 0;

function jumpToSection( index ) {
	console.log( index );
	const url = location.href;
	location.href = "#" + index;
	history.replaceState( null, null, url );
}

document.addEventListener( "keydown", ( event ) => {
	// console.log( event );

	if ( event.key === "ArrowRight" ) {
		const sections = document.getElementsByName( scriptIndex + 1 );
		if ( sections.length > 0 ) {
			scriptIndex++;
			jumpToSection( scriptIndex );
		}
		// Advance to next section
	} else if ( event.key === "ArrowLeft" ) {
		if ( scriptIndex > 0 ) {
			scriptIndex--;
			jumpToSection( scriptIndex );
		}
		// Go back to previous section
	}
} );
