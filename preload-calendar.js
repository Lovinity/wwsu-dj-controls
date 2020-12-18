"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
	on: {
		updateClockwheel: (fn) =>
			ipcRenderer.on("update-clockwheel", (event, ...args) => {
				fn(null, ...args);
			}),
	},
	renderer: {
		console: (args) => ipcRenderer.send("renderer", ["console", args]),
		updateClockwheel: (args) =>
			ipcRenderer.send("renderer", ["update-clockwheel", args]),
	},
});
