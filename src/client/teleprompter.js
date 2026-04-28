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

// --- Editor mode state ---
let isEditMode = false;
let isDirty = false;
let isLoadingContent = false;
let isNewFile = false;
let isSaving = false;
let editorView = null;
let previewManuallyScrolled = false;
let pendingScrollToCursor = false;
let savedScrollY = 0;

// --- Session state ---
let sessionMode = null; // null | "presenter" | "viewer"
let sessionRoomName = null;
let pendingPresenterCredentials = null;
let pendingDeepgramKey = null;
let presenterCtx = null;
let pendingStartSession = false;
let lastManualScrollTs = 0;
const MANUAL_SCROLL_GRACE_MS = 3000;

const previewContainer = document.getElementById( "preview-container" );
const editorContainer = document.getElementById( "editor-container" );
const editorDiv = document.getElementById( "editor" );
const toolbarFilename = document.getElementById( "toolbar-filename" );
const toolbarDirty = document.getElementById( "toolbar-dirty" );
const btnSave = document.getElementById( "btn-save" );
const btnSaveAs = document.getElementById( "btn-save-as" );
const btnCancel = document.getElementById( "btn-cancel" );
const resizeHandle = document.getElementById( "resize-handle" );
const connectionIndicator = document.getElementById( "connection-indicator" );
const viewerToolbar = document.getElementById( "viewer-toolbar" );
const viewerRoomLabel = document.getElementById( "viewer-room-label" );
const viewerMuteBtn = document.getElementById( "viewer-mute-btn" );
const viewerLeaveBtn = document.getElementById( "viewer-leave-btn" );
const presenterAudio = document.getElementById( "presenter-audio" );
const joinModal = document.getElementById( "join-modal" );
const joinModalInput = document.getElementById( "join-modal-input" );
const joinModalCancel = document.getElementById( "join-modal-cancel" );
const joinModalConfirm = document.getElementById( "join-modal-confirm" );
const presenterLeaveBtn = document.getElementById( "presenter-leave-btn" );

// Track manual scrolling in preview mode
let ignoreNextScroll = false;
window.addEventListener( "scroll", () => {
	if ( isEditMode ) return;
	if ( ignoreNextScroll ) {
		ignoreNextScroll = false;
		return;
	}
	if ( window.scrollY > 0 ) {
		previewManuallyScrolled = true;
	}
} );

function noteManualScroll() {
	if ( sessionMode === "presenter" ) {
		lastManualScrollTs = Date.now();
		window.LiveKitModule?.cancelScroll?.();
	}
}
window.addEventListener( "wheel", noteManualScroll, { passive: true } );
window.addEventListener( "mousedown", noteManualScroll );
const SCROLL_KEYS = new Set( [ "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " " ] );
document.addEventListener( "keydown", ( e ) => {
	if ( SCROLL_KEYS.has( e.key ) ) noteManualScroll();
}, true );

function scrollPreviewToCursorLine() {
	if ( !editorView || !md ) return;
	const cursorLine = window.EditorModule.getCursorLine( editorView );
	const totalLines = editorView.state.doc.lines;
	if ( totalLines <= 1 ) return;

	// Use cursor line ratio to scroll the preview to the same relative position
	const ratio = ( cursorLine - 1 ) / ( totalLines - 1 );
	const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
	if ( maxScroll > 0 ) {
		ignoreNextScroll = true;
		window.scrollTo( 0, Math.round( ratio * maxScroll ) );
	}
}

function setDirty( dirty ) {
	isDirty = dirty;
	window.electron.setEditorDirty( dirty );
	if ( toolbarDirty ) {
		toolbarDirty.classList.toggle( "hidden", !dirty );
	}
}

function showEditor() {
	previewContainer.classList.add( "hidden" );
	editorContainer.classList.remove( "hidden" );
	if ( resizeHandle ) resizeHandle.classList.add( "hidden" );
	document.body.style.backgroundColor = "#282c34";
	document.body.style.overflow = "hidden";
}

function showPreview() {
	editorContainer.classList.add( "hidden" );
	previewContainer.classList.remove( "hidden" );
	if ( resizeHandle ) resizeHandle.classList.remove( "hidden" );
	document.body.style.backgroundColor = `rgba(0, 0, 0, ${ opacity })`;
	document.body.style.overflow = "";
}

function enterEditMode() {
	if ( isEditMode ) return;
	savedScrollY = window.scrollY;
	isEditMode = true;

	window.electron.pauseWatcher();
	window.electron.requestRawMarkdown();
}

function loadEditorContent( content, filePath ) {
	const rawContent = content ?? "";

	showEditor();

	if ( toolbarFilename ) {
		toolbarFilename.textContent = filePath ? filePath.split( "/" ).pop() : "New file";
	}
	setDirty( false );

	isLoadingContent = true;
	if ( editorView ) {
		window.EditorModule.setEditorContent( editorView, rawContent );
	} else {
		editorView = window.EditorModule.createEditor( editorDiv, rawContent, () => {
			if ( !isDirty && !isLoadingContent ) {
				setDirty( true );
			}
		} );
	}
	isLoadingContent = false;
	editorView.focus();
}

window.electron.onRawMarkdown( ( content, filePath ) => {
	if ( !isEditMode ) return;
	loadEditorContent( content, filePath );
} );

function discardAndExitEditor() {
	if ( !isEditMode ) return;
	isEditMode = false;
	isNewFile = false;

	showPreview();
	setDirty( false );
	window.electron.resumeWatcher();
	window.electron.reloadContent();
}

function toggleEditMode() {
	if ( isEditMode ) {
		// Switch to preview without discarding — keep editor state intact
		isEditMode = false;
		pendingScrollToCursor = !previewManuallyScrolled;
		// Update preview with current editor content
		if ( editorView ) {
			const content = window.EditorModule.getEditorContent( editorView );
			window.electron.previewMarkdown( content );
		}
		showPreview();
	} else if ( editorView ) {
		// Save preview scroll position before switching to editor
		savedScrollY = window.scrollY;
		// Resume editing — just swap visibility back
		isEditMode = true;
		window.electron.pauseWatcher();
		showEditor();
		editorView.focus();
	} else {
		enterEditMode();
	}
}

function saveEditorContent() {
	if ( !editorView ) return;
	isSaving = true;
	const content = window.EditorModule.getEditorContent( editorView );
	if ( isNewFile ) {
		window.electron.saveFileAs( content );
	} else {
		window.electron.saveFile( content );
	}
}

function saveEditorContentAs() {
	if ( !editorView ) return;
	isSaving = true;
	const content = window.EditorModule.getEditorContent( editorView );
	window.electron.saveFileAs( content );
}

// Close coordination — save editor content then signal main to close
let pendingSaveAndClose = false;

// Listen for save result
window.electron.onSaveResult( ( success, filePath ) => {
	isSaving = false;
	if ( success ) {
		setDirty( false );
		isNewFile = false;
		if ( filePath && toolbarFilename ) {
			toolbarFilename.textContent = filePath.split( "/" ).pop();
		}
	}
	if ( pendingSaveAndClose ) {
		pendingSaveAndClose = false;
		window.electron.saveAndClose();
	}
} );

// Listen for toggle editor from menu
window.electron.onToggleEditor( () => {
	if ( sessionMode ) {
		alert( "Leave the live session before opening the editor." );
		return;
	}
	toggleEditMode();
} );

// New file — enter edit mode with empty content
window.electron.onNewFile( () => {
	if ( isDirty ) {
		const discard = confirm( "You have unsaved changes. Discard and create a new file?" );
		if ( !discard ) return;
	}
	isNewFile = true;
	isEditMode = true;
	window.electron.pauseWatcher();
	loadEditorContent( "", null );
} );

// Listen for menu save/save-as (works from editor or preview with pending edits)
window.electron.onMenuSave( () => {
	if ( isDirty ) {
		saveEditorContent();
	}
} );

window.electron.onMenuSaveAs( () => {
	if ( editorView ) {
		saveEditorContentAs();
	}
} );

window.electron.onRequestSaveBeforeClose( () => {
	if ( editorView && isDirty ) {
		pendingSaveAndClose = true;
		saveEditorContent();
	}
} );

// Toolbar buttons
if ( btnSave ) {
	btnSave.addEventListener( "click", saveEditorContent );
}
if ( btnSaveAs ) {
	btnSaveAs.addEventListener( "click", saveEditorContentAs );
}
if ( btnCancel ) {
	btnCancel.addEventListener( "click", () => {
		if ( isDirty ) {
			const discard = confirm( "You have unsaved changes. Discard changes?" );
			if ( !discard ) return;
		}
		discardAndExitEditor();
	} );
}

// --- Keyboard handling ---
document.addEventListener( "keydown", ( event ) => {
	// Suppress teleprompter shortcuts when in edit mode
	if ( isEditMode ) return;
	// In viewer mode, scrolling is driven by the presenter — block manual nav.
	if ( sessionMode === "viewer" ) {
		if ( event.key === "ArrowRight" || event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "ArrowDown" ) {
			event.preventDefault();
			return;
		}
	}

	if ( event.key === "ArrowDown" || event.key === "ArrowUp" ) {
		// Allow default scroll behavior, but track it
		previewManuallyScrolled = true;
	} else if ( event.key === "ArrowRight" ) {
		event.preventDefault();
		// Advance to next section
		const sections = document.getElementsByName( scriptIndex + 1 );
		if ( sections.length > 0 ) {
			scriptIndex++;
			previewManuallyScrolled = true;
			jumpToSection( scriptIndex );
		}
	} else if ( event.key === "ArrowLeft" ) {
		event.preventDefault();
		// Go back to previous section
		if ( scriptIndex > 0 ) {
			scriptIndex--;
			previewManuallyScrolled = true;
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
		if ( pendingScrollToCursor ) {
			pendingScrollToCursor = false;
			requestAnimationFrame( () => scrollPreviewToCursorLine() );
		} else if ( previewManuallyScrolled && !isSaving ) {
			// Restore saved scroll position after layout completes
			requestAnimationFrame( () => {
				ignoreNextScroll = true;
				window.scrollTo( 0, savedScrollY );
			} );
		} else if ( !isSaving ) {
			scriptIndex = 0;
			previewManuallyScrolled = false;
		}
	}
	// If in edit mode, reload the editor with the new file's raw markdown
	// (skip if the content update was triggered by our own save)
	if ( isEditMode && !isSaving ) {
		window.electron.requestRawMarkdown();
	}
	// Auto-start a session if the launcher requested one. Wait one frame so
	// the new content is laid out before we build the word index.
	if ( pendingStartSession && !sessionMode && !isEditMode ) {
		pendingStartSession = false;
		requestAnimationFrame( () => startPresenterSession() );
	}
} );

// --- Live session orchestration ---

function setIndicator( text, variant ) {
	if ( !connectionIndicator ) return;
	if ( !text ) {
		connectionIndicator.classList.add( "hidden" );
		connectionIndicator.textContent = "";
		return;
	}
	connectionIndicator.textContent = text;
	connectionIndicator.classList.remove( "hidden", "viewer", "disconnected" );
	if ( variant ) connectionIndicator.classList.add( variant );
}

function setViewerToolbar( visible ) {
	if ( !viewerToolbar ) return;
	viewerToolbar.classList.toggle( "hidden", !visible );
}

function setPresenterToolbar( visible ) {
	if ( !presenterLeaveBtn ) return;
	presenterLeaveBtn.classList.toggle( "hidden", !visible );
}

if ( connectionIndicator ) {
	connectionIndicator.addEventListener( "click", () => {
		if ( sessionMode === "presenter" && sessionRoomName ) {
			window.electron.copyToClipboard( sessionRoomName );
			const orig = connectionIndicator.textContent;
			connectionIndicator.textContent = "Copied!";
			setTimeout( () => {
				if ( sessionMode === "presenter" ) {
					connectionIndicator.textContent = orig;
				}
			}, 1200 );
		}
	} );
}

function showJoinModal() {
	return new Promise( ( resolve ) => {
		if ( !joinModal ) {
			resolve( null );
			return;
		}
		joinModalInput.value = "";
		joinModal.classList.remove( "hidden" );
		setTimeout( () => joinModalInput.focus(), 0 );

		function cleanup() {
			joinModal.classList.add( "hidden" );
			joinModalConfirm.removeEventListener( "click", onConfirm );
			joinModalCancel.removeEventListener( "click", onCancel );
			joinModalInput.removeEventListener( "keydown", onKey );
		}
		function onConfirm() {
			const v = joinModalInput.value.trim();
			cleanup();
			resolve( v || null );
		}
		function onCancel() {
			cleanup();
			resolve( null );
		}
		function onKey( e ) {
			if ( e.key === "Enter" ) onConfirm();
			else if ( e.key === "Escape" ) onCancel();
		}
		joinModalConfirm.addEventListener( "click", onConfirm );
		joinModalCancel.addEventListener( "click", onCancel );
		joinModalInput.addEventListener( "keydown", onKey );
	} );
}

if ( viewerLeaveBtn ) {
	viewerLeaveBtn.addEventListener( "click", () => {
		leaveSession();
	} );
}

if ( presenterLeaveBtn ) {
	presenterLeaveBtn.addEventListener( "click", () => {
		leaveSession();
	} );
}

if ( viewerMuteBtn && presenterAudio ) {
	presenterAudio.muted = true;
	viewerMuteBtn.textContent = "Unmute";
	viewerMuteBtn.addEventListener( "click", () => {
		presenterAudio.muted = !presenterAudio.muted;
		viewerMuteBtn.textContent = presenterAudio.muted ? "Unmute" : "Mute";
	} );
}

async function startPresenterSession() {
	if ( sessionMode ) {
		alert( `Already in a ${ sessionMode } session.` );
		return;
	}
	if ( isEditMode ) {
		alert( "Exit the editor before starting a session." );
		return;
	}
	if ( !window.LiveKitModule ) {
		alert( "LiveKit module not loaded." );
		return;
	}
	pendingPresenterCredentials = null;
	pendingDeepgramKey = null;
	window.electron.startLiveKitSession();
}

async function tryStartPresenterFlow() {
	if ( !pendingPresenterCredentials || !pendingDeepgramKey ) return;
	const creds = pendingPresenterCredentials;
	const dgKey = pendingDeepgramKey;
	pendingPresenterCredentials = null;
	pendingDeepgramKey = null;

	if ( !dgKey.key ) {
		alert( `Cannot start session: ${ dgKey.error || "Deepgram key missing." }` );
		window.electron.leaveLiveKitSession();
		return;
	}

	try {
		presenterCtx = await window.LiveKitModule.startPresenter( {
			url: creds.url,
			token: creds.token,
			deepgramKey: dgKey.key,
			scriptEl: md,
			onStatus: handlePresenterStatus
		} );
		sessionMode = "presenter";
		sessionRoomName = creds.roomName;
		lastManualScrollTs = 0;
		setIndicator( `Live: ${ creds.roomName }` );
		setPresenterToolbar( true );
	} catch ( err ) {
		console.error( "[presenter] failed to start", err );
		alert( `Failed to start session: ${ err.message }` );
		window.electron.leaveLiveKitSession();
	}
}

function handlePresenterStatus( status ) {
	if ( status.type === "position" && presenterCtx?.wordIndex ) {
		// Honor a manual-scroll grace period — when the presenter scrolls or
		// uses arrow/page keys, suppress auto-scroll briefly so they can look
		// ahead. Auto-scroll resumes naturally once they keep talking past
		// the grace window.
		if ( Date.now() - lastManualScrollTs >= MANUAL_SCROLL_GRACE_MS ) {
			window.LiveKitModule.scrollToWord( status.wordIdx, presenterCtx.wordIndex.ranges );
		}
		return;
	}
	if ( status.type === "disconnected" ) {
		sessionMode = null;
		sessionRoomName = null;
		setIndicator( "Disconnected", "disconnected" );
		setPresenterToolbar( false );
		setTimeout( () => {
			if ( sessionMode === null ) setIndicator( null );
		}, 2000 );
	}
}

async function joinPresenterSession() {
	if ( sessionMode ) {
		alert( `Already in a ${ sessionMode } session.` );
		return;
	}
	if ( isEditMode ) {
		alert( "Exit the editor before joining a session." );
		return;
	}
	const roomName = await showJoinModal();
	if ( !roomName ) return;
	window.electron.joinLiveKitSession( roomName );
}

async function tryJoinViewerFlow( creds ) {
	try {
		await window.LiveKitModule.joinViewer( {
			url: creds.url,
			token: creds.token,
			scriptEl: md,
			audioEl: presenterAudio,
			onStatus: handleViewerStatus,
			onWelcome: () => {},
			onPosition: () => {}
		} );
		sessionMode = "viewer";
		sessionRoomName = creds.roomName;
		setIndicator( `Viewing: ${ creds.roomName }`, "viewer" );
		if ( viewerRoomLabel ) viewerRoomLabel.textContent = creds.roomName;
		setViewerToolbar( true );
	} catch ( err ) {
		console.error( "[viewer] failed to join", err );
		alert( `Failed to join session: ${ err.message }` );
		window.electron.leaveLiveKitSession();
	}
}

function handleViewerStatus( status ) {
	if ( status.type === "presenter-disconnected" ) {
		setIndicator( "Presenter disconnected", "disconnected" );
	} else if ( status.type === "disconnected" ) {
		sessionMode = null;
		sessionRoomName = null;
		setIndicator( null );
		setViewerToolbar( false );
	}
}

async function leaveSession() {
	const wasPresenter = sessionMode === "presenter";
	const wasViewer = sessionMode === "viewer";
	sessionMode = null;
	sessionRoomName = null;
	presenterCtx = null;
	setIndicator( null );
	setViewerToolbar( false );
	setPresenterToolbar( false );
	try {
		if ( wasPresenter ) {
			await window.LiveKitModule.stopPresenter();
		} else if ( wasViewer ) {
			await window.LiveKitModule.leaveViewer();
		}
	} catch ( err ) {
		console.warn( "leaveSession error", err );
	}
	window.electron.leaveAndShowLauncher();
}

window.electron.onMenuStartSession( startPresenterSession );
window.electron.onMenuJoinSession( joinPresenterSession );
window.electron.onMenuLeaveSession( leaveSession );

window.electron.onLiveKitSessionStarted( ( credentials ) => {
	pendingPresenterCredentials = credentials;
	window.electron.getDeepgramKey();
} );
window.electron.onDeepgramKey( ( payload ) => {
	pendingDeepgramKey = payload;
	tryStartPresenterFlow();
} );
window.electron.onLiveKitSessionJoined( ( credentials ) => {
	tryJoinViewerFlow( credentials );
} );
window.electron.onLiveKitSessionLeft( () => {
	// Main has cleared session state; renderer cleanup already done in leaveSession.
} );
window.electron.onLiveKitSessionError( ( payload ) => {
	pendingPresenterCredentials = null;
	pendingDeepgramKey = null;
	alert( `Session error: ${ payload.message }` );
} );

window.electron.onBootstrapJoin( ( { roomName } ) => {
	if ( sessionMode || isEditMode || !roomName ) return;
	window.electron.joinLiveKitSession( roomName );
} );

window.electron.onBootstrapStartSession( () => {
	pendingStartSession = true;
} );
