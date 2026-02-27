import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorState } from "@codemirror/state";

const editorTheme = EditorView.theme( {
	"&": {
		height: "100%",
		fontSize: "14px"
	},
	".cm-scroller": {
		overflow: "auto",
		fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace"
	},
	".cm-content": {
		padding: "8px 0"
	},
	".cm-gutters": {
		border: "none"
	}
} );

export function createEditor( parent, content, onChange ) {
	const view = new EditorView( {
		state: EditorState.create( {
			doc: content,
			extensions: [
				basicSetup,
				markdown( { codeLanguages: languages } ),
				oneDark,
				editorTheme,
				EditorView.lineWrapping,
				EditorView.updateListener.of( ( update ) => {
					if ( update.docChanged && onChange ) {
						onChange();
					}
				} )
			]
		} ),
		parent
	} );
	return view;
}

export function setEditorContent( view, content ) {
	view.dispatch( {
		changes: {
			from: 0,
			to: view.state.doc.length,
			insert: content
		}
	} );
}

export function getEditorContent( view ) {
	return view.state.doc.toString();
}

export function getCursorLine( view ) {
	const pos = view.state.selection.main.head;
	return view.state.doc.lineAt( pos ).number;
}
