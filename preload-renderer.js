// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener("DOMContentLoaded", () => {
  const { ipcRenderer, contextBridge } = require("electron");

  contextBridge.exposeInMainWorld("ipc", {
    // Get Data
    getMachineId: () => ipcRenderer.sendSync("get-machine-id"),
    getAppVersion: () => ipcRenderer.sendSync("get-app-version"),

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
});
