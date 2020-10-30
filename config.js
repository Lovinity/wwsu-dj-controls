"use strict";
const Store = require("electron-store");

module.exports = new Store({
	name: "wwsu-dj-controls",
	clearInvalidConfig: true,
	defaults: {
		recorder: {
			delay: 10000,
			recordPath: "./OnAir Recordings",
		},
		silence: {
			threshold: 0.1,
			delay: 15000,
		},
		skyway: {
			api: ``,
		},
		audio: [],
	},

	// TODO: Keep this updated
	// TODO: Waiting for https://github.com/sindresorhus/electron-store/issues/142
	migrations: {
		">=8.0.0-alpha.18": (store) => {
			store.delete("recorder.deviceId");
			store.delete("silence.deviceId");
		},
	},

	schema: {
		recorder: {
			type: "object",
			additionalProperties: false,
			properties: {
				delay: {
					type: "number",
					minimum: 0,
				},
				recordPath: {
					type: "string",
				},
			},
		},
		silence: {
			type: "object",
			additionalProperties: false,
			properties: {
				threshold: {
					type: "number",
					minimum: 0,
					maximum: 1,
				},
				delay: {
					type: "number",
					minimum: 0,
				},
			},
		},
		skyway: {
			type: "object",
			additionalProperties: false,
			properties: {
				api: {
					type: "string",
				},
			},
		},
		audio: {
			type: "array",
			items: {
				type: "object",
				additionalProperties: false,
				required: ["deviceId", "volume"],
				properties: {
					deviceId: {
						type: "string",
					},
					volume: {
						type: "number",
						minimum: 0,
						maximum: 2,
						default: 1
					},
					silence: {
						type: "boolean",
					},
					recorder: {
						type: "boolean",
					},
					remote: {
						type: "boolean",
					},
					output: {
						type: "boolean",
					},
				},
			},
		},
	},
});
