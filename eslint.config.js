import { defineConfig } from "eslint/config"; // eslint-disable-line n/no-unpublished-import
import rg from "eslint-config-reverentgeek"; // eslint-disable-line n/no-unpublished-import

export default defineConfig( [ {
	ignores: [ "dist/", "src/client/editor-bundle.js" ]
}, {
	extends: [ rg.configs["node-esm"] ],
	rules: {
		"n/no-unpublished-import": [ "error", {
			// codemirror packages are bundled into editor-bundle.js by esbuild,
			// so they're devDependencies rather than runtime dependencies
			allowModules: [
				"electron",
				"codemirror",
				"@codemirror/lang-markdown",
				"@codemirror/language-data",
				"@codemirror/theme-one-dark",
				"@codemirror/state"
			]
		} ]
	}
}, {
	files: [ "src/client/**/*.js", "src/client/**/*.mjs" ],
	extends: [ rg.configs.browser ],
	rules: {
		"n/no-unsupported-features/node-builtins": "off"
	}
} ] );
