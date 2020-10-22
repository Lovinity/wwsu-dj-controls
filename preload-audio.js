"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener("DOMContentLoaded", () => {
	const { ipcRenderer, contextBridge } = require("electron");

	contextBridge.exposeInMainWorld("ipc", {
		on: (event, fn) => ipcRenderer.on(event, fn),
		renderer: {
			send: (task, args) => ipcRenderer.send("renderer", [task, args]),
		},
		main: {
			send: (task, args) => ipcRenderer.send("main", [task, args]),
		},
	});

	contextBridge.exposeInMainWorld("settings", {
		audio: ipcRenderer.sendSync("settings", "audio"),
		silence: ipcRenderer.sendSync("settings", "silence"),
		recorder: ipcRenderer.sendSync("settings", "recorder"),
		skyway: ipcRenderer.sendSync("settings", "skyway"),
		save: (key, value) => ipcRenderer.send("saveSettings", [key, value]),
	});
});
