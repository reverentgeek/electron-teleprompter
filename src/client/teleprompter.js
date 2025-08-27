let scriptIndex = 0;

// Debounce utility function
function debounce( func, delay ) {
	let timeoutId;
	return function ( ...args ) {
		clearTimeout( timeoutId );
		timeoutId = setTimeout( () => func.apply( this, args ), delay );
	};
}

function jumpToSection( index ) {
	console.log( index );
	const url = location.href;
	location.href = "#" + index;
	history.replaceState( null, null, url );
	// window.electron.refresh();
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

// Debounced scroll handler
const debouncedScrollHandler = debounce( () => {
	window.electron.refresh();
}, 50 );

document.addEventListener( "scroll", debouncedScrollHandler );
