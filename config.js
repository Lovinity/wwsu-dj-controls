"use strict";
const Store = require("electron-store");

module.exports = new Store({
	name: "wwsu-dj-controls",
	encryptionKey: "(b8mGXxW=859[}}ivV-Cyeq)3U5i", // We do not care if this is in plain text; we are only using it for config file integrity
	clearInvalidConfig: true,
	defaults: {
		recorder: {
			deviceId: undefined,
			delay: 10000,
			recordPath: ".",
		},
		silence: {
			deviceId: undefined,
			threshold: 0.1,
			delay: 15000,
		},
		skyway: {
			api: ``
		}
	},

	// TODO: Keep this updated
	migrations: {},
});
