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
let editorView = null;

const previewContainer = document.getElementById( "preview-container" );
const editorContainer = document.getElementById( "editor-container" );
const editorDiv = document.getElementById( "editor" );
const toolbarFilename = document.getElementById( "toolbar-filename" );
const toolbarDirty = document.getElementById( "toolbar-dirty" );
const btnSave = document.getElementById( "btn-save" );
const btnSaveAs = document.getElementById( "btn-save-as" );
const btnCancel = document.getElementById( "btn-cancel" );
const resizeHandle = document.getElementById( "resize-handle" );

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
	isEditMode = true;

	window.electron.pauseWatcher();
	window.electron.requestRawMarkdown();
}

function loadEditorContent( content, filePath ) {
	const rawContent = content ?? "";

	showEditor();

	if ( toolbarFilename ) {
		toolbarFilename.textContent = filePath ? filePath : "New file";
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
		// Update preview with current editor content
		if ( editorView ) {
			const content = window.EditorModule.getEditorContent( editorView );
			window.electron.previewMarkdown( content );
		}
		showPreview();
	} else if ( editorView && isDirty ) {
		// Resume editing — just swap visibility back
		isEditMode = true;
		showEditor();
		editorView.focus();
	} else {
		enterEditMode();
	}
}

function saveEditorContent() {
	if ( !editorView ) return;
	const content = window.EditorModule.getEditorContent( editorView );
	if ( isNewFile ) {
		window.electron.saveFileAs( content );
	} else {
		window.electron.saveFile( content );
	}
}

function saveEditorContentAs() {
	if ( !editorView ) return;
	const content = window.EditorModule.getEditorContent( editorView );
	window.electron.saveFileAs( content );
}

// Close coordination — save editor content then signal main to close
let pendingSaveAndClose = false;

// Listen for save result
window.electron.onSaveResult( ( success, filePath ) => {
	if ( success ) {
		setDirty( false );
		isNewFile = false;
		if ( filePath && toolbarFilename ) {
			toolbarFilename.textContent = filePath;
		}
	}
	if ( pendingSaveAndClose ) {
		pendingSaveAndClose = false;
		window.electron.saveAndClose();
	}
} );

// Listen for toggle editor from menu
window.electron.onToggleEditor( toggleEditMode );

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
	// If in edit mode, reload the editor with the new file's raw markdown
	if ( isEditMode ) {
		window.electron.requestRawMarkdown();
	}
} );
