"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
	on: {
		remotePeerCredential: (fn) =>
			ipcRenderer.on("remotePeerCredential", (event, ...args) => {
				fn(null, ...args);
			}),
		audioChangeVolume: (fn) =>
			ipcRenderer.on("audioChangeVolume", (event, ...args) => {
				fn(null, ...args);
			}),
		audioRefreshDevices: (fn) =>
			ipcRenderer.on("audioRefreshDevices", (event, ...args) => {
				fn(null, ...args);
			}),
		audioRemoteSetting: (fn) =>
			ipcRenderer.on("audioRemoteSetting", (event, ...args) => {
				fn(null, ...args);
			}),
		audioOutputSetting: (fn) =>
			ipcRenderer.on("audioOutputSetting", (event, ...args) => {
				fn(null, ...args);
			}),
		remoteStartCall: (fn) =>
			ipcRenderer.on("remoteStartCall", (event, ...args) => {
				fn(null, ...args);
			}),
		remoteAnswerCall: (fn) =>
			ipcRenderer.on("remoteAnswerCall", (event, ...args) => {
				fn(null, ...args);
			}),
		remoteMute: (fn) =>
			ipcRenderer.on("remoteMute", (event, ...args) => {
				fn(null, ...args);
			}),
		restartSilenceTimer: (fn) =>
			ipcRenderer.on("restartSilenceTimer", (event, ...args) => {
				fn(null, ...args);
			}),
		confirmActiveCall: (fn) =>
			ipcRenderer.on("confirmActiveCall", (event, ...args) => {
				fn(null, ...args);
			}),
	},
	renderer: {
		console: (args) => ipcRenderer.send("renderer", ["console", args]),
		remoteReady: (args) => ipcRenderer.send("renderer", ["remoteReady", args]),
		peerOutgoingSilence: (args) =>
			ipcRenderer.send("renderer", ["peerOutgoingSilence", args]),
		remotePeerReady: (args) =>
			ipcRenderer.send("renderer", ["remotePeerReady", args]),
		remotePeerUnavailable: (args) =>
			ipcRenderer.send("renderer", ["remotePeerUnavailable", args]),
		remoteIncomingCall: (args) =>
			ipcRenderer.send("renderer", ["remoteIncomingCall", args]),
		peerCallEstablished: (args) =>
			ipcRenderer.send("renderer", ["peerCallEstablished", args]),
		peerCallAnswered: (args) =>
			ipcRenderer.send("renderer", ["peerCallAnswered", args]),
		peerQualityProblem: (args) =>
			ipcRenderer.send("renderer", ["peerQualityProblem", args]),
		peerIncomingCallClosed: (args) =>
			ipcRenderer.send("renderer", ["peerIncomingCallClosed", args]),
		peerCallClosed: (args) =>
			ipcRenderer.send("renderer", ["peerCallClosed", args]),
		peerDestroyed: (args) =>
			ipcRenderer.send("renderer", ["peerDestroyed", args]),
		peerQualityProblem: (args) =>
			ipcRenderer.send("renderer", ["peerQualityProblem", args]),
		peerNoCalls: (args) => ipcRenderer.send("renderer", ["peerNoCalls", args]),
	},
});

// Skyway config
contextBridge.exposeInMainWorld(
	"settings",
	ipcRenderer.sendSync("settings", "skyway")
);
