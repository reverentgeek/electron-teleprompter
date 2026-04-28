const startBtn = document.getElementById( "start-btn" );
const joinBtn = document.getElementById( "join-btn" );
const roomInput = document.getElementById( "room-code" );

function setBusy( busy ) {
	startBtn.disabled = busy;
	joinBtn.disabled = busy;
	roomInput.disabled = busy;
}

startBtn.addEventListener( "click", () => {
	setBusy( true );
	window.electronLauncher.start();
} );

function tryJoin() {
	const code = roomInput.value.trim();
	if ( !code ) {
		roomInput.focus();
		return;
	}
	setBusy( true );
	window.electronLauncher.join( code );
}

joinBtn.addEventListener( "click", tryJoin );
roomInput.addEventListener( "keydown", ( e ) => {
	if ( e.key === "Enter" ) tryJoin();
} );

window.electronLauncher.onResetButtons( () => setBusy( false ) );

setTimeout( () => roomInput.focus(), 0 );
