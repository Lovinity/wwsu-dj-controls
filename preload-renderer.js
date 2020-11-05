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

		getSerialPorts: () => ipcRenderer.sendSync("getSerialPorts"),

		// Delay system
		restartDelay: (status) => ipcRenderer.send("delayRestart", status),
		dumpDelay: () => ipcRenderer.send("delayDump"),

		// Listen for messages
		on: (event, fn) => ipcRenderer.on(event, fn),

		// Calendar process
		calendar: {
			send: (task, args) => ipcRenderer.send("calendar", [task, args]),
		},

		// audio process
		audio: {
			send: (task, args) => ipcRenderer.send("audio", [task, args]),
		},

		// recorder process
		recorder: {
			send: (task, args) => ipcRenderer.send("recorder", [task, args]),
		},

		// Main process
		main: {
			send: (task, args) => ipcRenderer.send("main", [task, args]),
		},

		// Silence process
		silence: {
			send: (task, args) => ipcRenderer.send("silence", [task, args]),
		},

		// Process control
		process: {
			send: (task, args) => ipcRenderer.send("process", [task, args]),
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
		audio: ipcRenderer.sendSync("settings", "audio"),
		recorder: ipcRenderer.sendSync("settings", "recorder"),
		silence: ipcRenderer.sendSync("settings", "silence"),
		skyway: ipcRenderer.sendSync("settings", "skyway"),
		delay: ipcRenderer.sendSync("settings", "delay"),
	});

	// Saving settings
	contextBridge.exposeInMainWorld("saveSettings", {
		recorder: (key, value) =>
			ipcRenderer.send("saveSettings", [`recorder.${key}`, value]),
		silence: (object) => ipcRenderer.send("saveSettings", ["silence", object]),
		skyway: (object) => ipcRenderer.send("saveSettings", ["skyway", object]),
		delay: (key, value) => ipcRenderer.send("saveSettings", [`delay.${key}`, value]),
	});
});
