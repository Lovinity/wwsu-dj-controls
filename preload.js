// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

window.addEventListener('DOMContentLoaded', () => {
    const { webFrame, ipcRenderer } = require('electron')

    window.webFrame = webFrame;
    window.ipcRenderer = ipcRenderer;
})
