// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener("DOMContentLoaded", () => {
  const { webFrame, ipcRenderer, contextBridge } = require("electron");

  window.webFrame = webFrame;
  window.ipcRenderer = ipcRenderer;

  contextBridge.exposeInMainWorld("ipc", {
    // Get Data
    getMachineId: () => ipcRenderer.sendSync("get-machine-id"),
    getAppVersion: () => ipcRenderer.sendSync("get-app-version"),

    // Status
    flashMain: (arg) => ipcRenderer.send("flashMain", arg),
    progressMain: (progress) => ipcRenderer.send("progressMain", progress),

    // Calendar worker
    calendar: {
        send: (task, args) => ipcRenderer.send("calendar", [task, args]),
        on: (event, fn) => ipcRenderer.on(event, fn),
    },
  });
});
