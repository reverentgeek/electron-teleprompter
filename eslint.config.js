import { defineConfig } from "eslint/config"; // eslint-disable-line n/no-unpublished-import
import rg from "eslint-config-reverentgeek"; // eslint-disable-line n/no-unpublished-import

export default defineConfig( [ {
	ignores: [ "dist/" ]
}, {
	extends: [ rg.configs["node-esm"] ],
	rules: {
		"n/no-unpublished-import": [ "error", {
			allowModules: [ "electron" ]
		} ]
	}
}, {
	files: [ "src/client/**/*.js", "src/client/**/*.mjs" ],
	extends: [ rg.configs.browser ]
} ] );
