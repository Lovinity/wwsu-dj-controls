"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
	on: {
		audioChangeVolume: (fn) =>
			ipcRenderer.on("audioChangeVolume", (event, ...args) => {
				fn(null, ...args);
			}),
		audioRefreshDevices: (fn) =>
			ipcRenderer.on("audioRefreshDevices", (event, ...args) => {
				fn(null, ...args);
			}),
		audioRecorderSetting: (fn) =>
			ipcRenderer.on("audioRecorderSetting", (event, ...args) => {
				fn(null, ...args);
			}),
		audioSilenceSetting: (fn) =>
			ipcRenderer.on("audioSilenceSetting", (event, ...args) => {
				fn(null, ...args);
			}),
		recorderStart: (fn) =>
			ipcRenderer.on("recorderStart", (event, ...args) => {
				fn(null, ...args);
			}),
		recorderStop: (fn) =>
			ipcRenderer.on("recorderStop", (event, ...args) => {
				fn(null, ...args);
			}),
		shutDown: (fn) =>
			ipcRenderer.on("shutDown", (event, ...args) => {
				fn(null, ...args);
			}),
		silenceSetting: (fn) =>
			ipcRenderer.on("silenceSetting", (event, ...args) => {
				fn(null, ...args);
			}),
		remotePeerCredential: (fn) =>
			ipcRenderer.on("remotePeerCredential", (event, ...args) => {
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
		audioDevices: (args) =>
			ipcRenderer.send("renderer", ["audioDevices", args]),
		audioVolume: (args) => ipcRenderer.send("renderer", ["audioVolume", args]),
		console: (args) => ipcRenderer.send("renderer", ["console", args]),
		audioReady: (args) => ipcRenderer.send("renderer", ["audioReady", args]),
		recorderReady: (args) =>
			ipcRenderer.send("renderer", ["recorderReady", args]),
		recorderStarted: (args) =>
			ipcRenderer.send("renderer", ["recorderStarted", args]),
		recorderStopped: (args) =>
			ipcRenderer.send("renderer", ["recorderStopped", args]),
		recorderSaved: (args) =>
			ipcRenderer.send("renderer", ["recorderSaved", args]),
		recorderFailed: (args) =>
			ipcRenderer.send("renderer", ["recorderFailed", args]),
		silenceReady: (args) =>
			ipcRenderer.send("renderer", ["silenceReady", args]),
		silenceState: (args) =>
			ipcRenderer.send("renderer", ["silenceState", args]),
		peerOutgoingSilence: (args) =>
			ipcRenderer.send("renderer", ["peerOutgoingSilence", args]),
		remoteReady: (args) => ipcRenderer.send("renderer", ["remoteReady", args]),
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
		peerNoCalls: (args) => ipcRenderer.send("renderer", ["peerNoCalls", args]),
	},

	recorderEncoded: (args, cb) =>
		ipcRenderer.invoke("recorderEncoded", args).then((path) => {
			cb(path);
		}),
});

contextBridge.exposeInMainWorld("settings", {
	audio: () => ipcRenderer.sendSync("settings", "audio"),
	silence: () => ipcRenderer.sendSync("settings", "silence"),
	recorder: () => ipcRenderer.sendSync("settings", "recorder"),
	skyway: () => ipcRenderer.sendSync("settings", "skyway"),
	save: (key, value) => ipcRenderer.send("saveSettings", [key, value]),
});
