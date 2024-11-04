import rg from "eslint-config-reverentgeek";
import globals from "globals";

export default [
	...rg.configs[ "node-esm" ],
	{
		rules: {
			"n/no-unpublished-import": [ "error", {
				allowModules: [ "eslint-config-reverentgeek", "electron" ]
			} ],
			"n/no-extraneous-import": [ "error", {
				allowModules: [ "globals" ]
			} ]
		}
	}, {
		files: [ "src/client/**/*.js", "src/client/**/*.mjs" ],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: globals.browser
		}
	}
];
