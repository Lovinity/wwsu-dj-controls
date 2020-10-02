"use strict";

import { IpcRendererEvent, ipcRenderer, contextBridge } from "electron";

// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener("DOMContentLoaded", () => {
	contextBridge.exposeInMainWorld("ipc", {
		on: (
			event: string,
			fn: (event: IpcRendererEvent, arg0: Array<any>) => void
		) => ipcRenderer.on(event, fn),
		renderer: {
			send: (task: string, args: Array<any>) => ipcRenderer.send("renderer", [task, args]),
		},
	});
});
