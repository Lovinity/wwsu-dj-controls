"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener("DOMContentLoaded", () => {
  const { ipcRenderer, contextBridge } = require("electron");

  contextBridge.exposeInMainWorld("ipc", {
    on: (event, fn) => ipcRenderer.on(event, fn),
    renderer: {
      send: (task, args) => ipcRenderer.send("renderer", [task, args]),
    }
  });

  // Skyway config
  contextBridge.exposeInMainWorld("config", ipcRenderer.sendSync("config", "skyway"));
});