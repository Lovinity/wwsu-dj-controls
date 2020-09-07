"use strict";
const Store = require("electron-store");

module.exports = new Store({
	name: "wwsu-dj-controls",
	clearInvalidConfig: false,
	defaults: {
		recorder: {
			deviceId: undefined,
			delay: 10000,
			recordPath: "./OnAir Recordings",
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
