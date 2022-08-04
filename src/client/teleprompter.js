// console.log( "this is from teleprompter.js" );

document.addEventListener( "keydown", ( event ) => {
	console.log( event );

	if ( event.key === "ArrowRight" ) {
		// Advance to next section
	} else if ( event.key === "ArrowLeft" ) {
		// Go back to previous section
	}
} );
