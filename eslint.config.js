"use strict";

const rgConfig = require( "eslint-config-reverentgeek" );
module.exports = [
	...rgConfig.configs.node,
	{
		rules: {
			"n/no-unpublished-require": [ "error", {
				allowModules: [ "eslint-config-reverentgeek", "electron" ]
			} ]
		}
	}
];
