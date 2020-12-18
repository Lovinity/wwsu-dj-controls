"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
	on: {
		notificationData: (fn) =>
			ipcRenderer.on("notificationData", (event, ...args) => {
				fn(null, ...args);
			}),
	},
});
