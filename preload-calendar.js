// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener("DOMContentLoaded", () => {
  const { ipcRenderer, contextBridge } = require("electron");

  contextBridge.exposeInMainWorld("ipc", {
    // Calendar worker
    calendar: {
        send: (task, args) => ipcRenderer.send("renderer", [task, args]),
        on: (event, fn) => ipcRenderer.on(event, fn),
    },
  });
});
