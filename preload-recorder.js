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

  contextBridge.exposeInMainWorld("config", {
    delay: ipcRenderer.sendSync("config", "recorder").delay,
  });
});
