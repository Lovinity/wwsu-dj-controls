"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener("DOMContentLoaded", () => {
	const { ipcRenderer, contextBridge } = require("electron");

	contextBridge.exposeInMainWorld("ipc", {
		// Get Data
		getMachineId: () => ipcRenderer.sendSync("get-machine-id"),
		getAppVersion: () => ipcRenderer.sendSync("get-app-version"),

		// Check for update
		checkVersion: (latestVersion) =>
			ipcRenderer.sendSync("check-version", latestVersion),

		// Status
		flashMain: (arg) => ipcRenderer.send("flashMain", arg),
		progressMain: (progress) => ipcRenderer.send("progressMain", progress),

		// Listen for messages
		on: (event, fn) => ipcRenderer.on(event, fn),

		// Calendar process
		calendar: {
			send: (task, args) => ipcRenderer.send("calendar", [task, args]),
		},

		// Recorder process
		recorder: {
			send: (task, args) => ipcRenderer.send("recorder", [task, args]),
		},

		// Main process
		main: {
			send: (task, args) => ipcRenderer.send("main", [task, args]),
		},
	});

	// Function for sanitizing filenames for audio recordings
	contextBridge.exposeInMainWorld("sanitize", {
		string: (str) => {
			if (!str) {
				return ``;
			}
			str = ipcRenderer.sendSync("sanitize", str);
			str = str.replace(` - `, `_SPLITTERDJSHOW_`);
			str = str.replace(new RegExp("-", "g"), "_");
			str = str.replace(`_SPLITTERDJSHOW_`, ` - `);
			return str;
		},
	});

	// Getting settings
	contextBridge.exposeInMainWorld("settings", {
		recorder: ipcRenderer.sendSync("settings", "recorder"),
		silence: ipcRenderer.sendSync("settings", "silence"),
		skyway: ipcRenderer.sendSync("settings", "skyway"),
	});

	// Saving settings
	contextBridge.exposeInMainWorld("saveSettings", {
		recorder: (key, value) =>
			ipcRenderer.send("saveSettings", [`recorder.${key}`, value]),
		silence: (object) => ipcRenderer.send("saveSettings", ["silence", object]),
		skyway: (object) => ipcRenderer.send("saveSettings", ["skyway", object]),
	});
});
