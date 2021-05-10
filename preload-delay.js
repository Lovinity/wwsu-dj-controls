"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
	// TODO: Workaround for electron user gesture bug
	getDelayPort: () => ipcRenderer.sendSync("getDelayPort"),

	on: {
		dump: fn =>
			ipcRenderer.on("dump", (event, ...args) => {
				fn(null, ...args);
			})
	},

	renderer: {
		delayError: args => ipcRenderer.send("renderer", ["delayError", args]),
		console: args => ipcRenderer.send("renderer", ["console", args]),
		delayReady: args => ipcRenderer.send("renderer", ["delayReady", args]),
		delay: args => ipcRenderer.send("renderer", ["delay", args])
	}
});

// Getting settings
contextBridge.exposeInMainWorld("settings", {
	delay: () => ipcRenderer.sendSync("settings", "delay")
});
