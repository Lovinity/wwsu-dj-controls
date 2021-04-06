"use strict";
// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.

const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("ipc", {
	// Get Data
	getMachineId: () => ipcRenderer.sendSync("get-machine-id"),
	getAppVersion: () => ipcRenderer.sendSync("get-app-version"),

	// Check for update
	checkVersion: (latestVersion) =>
		ipcRenderer.sendSync("check-version", latestVersion),

	// Status
	flashMain: (arg) => ipcRenderer.send("flashMain", arg),
	progressMain: (progress) => ipcRenderer.send("progressMain", progress),

	getSerialPorts: () => ipcRenderer.sendSync("getSerialPorts"),

	// Delay system
	restartDelay: (status) => ipcRenderer.send("delayRestart", status),
	dumpDelay: () => ipcRenderer.send("delayDump"),

	// Discord window
	loadDiscord: (inviteLink) => ipcRenderer.send("loadDiscord", inviteLink),

	// Refresh audio devices
	audioRefreshDevices: (args) => ipcRenderer.send("audioRefreshDevices", args),

	// Change the volume of an audio device
	audioChangeVolume: (args) => ipcRenderer.send("audioChangeVolume", args),

	// Save remote broadcast settings for a device
	audioRemoteSetting: (args) => ipcRenderer.send("audioRemoteSetting", args),

	// Save recording settings for a device
	audioRecorderSetting: (args) =>
		ipcRenderer.send("audioRecorderSetting", args),

	// Save silence detection settings for a device
	audioSilenceSetting: (args) => ipcRenderer.send("audioSilenceSetting", args),

	// Save output settings for a device
	audioOutputSetting: (args) => ipcRenderer.send("audioOutputSetting", args),

	// Save audio queue settings for a device
	audioQueueSetting: (args) => ipcRenderer.send("audioQueueSetting", args),

	// Pop up a notification window
	makeNotification: (args) => ipcRenderer.send("makeNotification", args),

	// Calendar process
	calendar: {
		updateClockwheel: (args) =>
			ipcRenderer.send("calendar", ["update-clockwheel", args]),
	},

	// audio process
	audio: {
		// Nothing right now
	},

	// recorder process
	recorder: {
		start: (args) => ipcRenderer.send("recorder", ["recorderStart", args]),
		stop: (args) => ipcRenderer.send("recorder", ["recorderStop", args]),
	},

	// Silence process
	silence: {
		setting: (args) => ipcRenderer.send("silence", ["silenceSetting", args]),
	},

	// remote process
	remote: {
		restartSilenceTimer: (args) =>
			ipcRenderer.send("remote", ["restartSilenceTimer", args]),
		confirmActiveCall: (args) =>
			ipcRenderer.send("remote", ["confirmActiveCall", args]),
		startCall: (args) => ipcRenderer.send("remote", ["remoteStartCall", args]),
		answerCall: (args) =>
			ipcRenderer.send("remote", ["remoteAnswerCall", args]),
		peerCredential: (args) =>
			ipcRenderer.send("remote", ["remotePeerCredential", args]),
		mute: (args) => ipcRenderer.send("remote", ["remoteMute", args]),
	},

	// TEMP until Electron fixes the click bug
	renderer: {
        delayError: (args) => ipcRenderer.send("renderer", ["delayError", args]),
        console: (args) => ipcRenderer.send("renderer", ["console", args]),
        delayReady: (args) => ipcRenderer.send("renderer", ["delayReady", args]),
        delay: (args) => ipcRenderer.send("renderer", ["delay", args]),
	},

	// delay process
	delay: {
		dump: (args) => ipcRenderer.send("delay", ["dump", args]),
	},

	// Process control
	process: {
		silence: (args) => ipcRenderer.send("process", ["silence", args]),
		recorder: (args) => ipcRenderer.send("process", ["recorder", args]),
		remote: (args) => ipcRenderer.send("process", ["remote", args]),
		delay: (args) => ipcRenderer.send("process", ["delay", args]),
	},

	// On events; specifying specific ones to prevent security issues. Also, stripping "event" to prevent memory leaks.
	on: {

		// TEMP until Electron fixes the click bug
		dump: (fn) =>
		ipcRenderer.on("dump", (event, ...args) => {
			fn(null, ...args);
		}),


		console: (fn) =>
			ipcRenderer.on("console", (event, ...args) => {
				fn(null, ...args);
			}),
		recorderReady: (fn) =>
			ipcRenderer.on("recorderReady", (event, ...args) => {
				fn(null, ...args);
			}),
		recorderStarted: (fn) =>
			ipcRenderer.on("recorderStarted", (event, ...args) => {
				fn(null, ...args);
			}),
		recorderStopped: (fn) =>
			ipcRenderer.on("recorderStopped", (event, ...args) => {
				fn(null, ...args);
			}),
		recorderFailed: (fn) =>
			ipcRenderer.on("recorderFailed", (event, ...args) => {
				fn(null, ...args);
			}),
		silenceReady: (fn) =>
			ipcRenderer.on("silenceReady", (event, ...args) => {
				fn(null, ...args);
			}),
		silenceState: (fn) =>
			ipcRenderer.on("silenceState", (event, ...args) => {
				fn(null, ...args);
			}),
		audioVolume: (fn) =>
			ipcRenderer.on("audioVolume", (event, ...args) => {
				fn(null, ...args);
			}),
		recorderSaved: (fn) =>
			ipcRenderer.on("recorderSaved", (event, ...args) => {
				fn(null, ...args);
			}),
		audioDevices: (fn) =>
			ipcRenderer.on("audioDevices", (event, ...args) => {
				fn(null, ...args);
			}),
		processClosed: (fn) =>
			ipcRenderer.on("processClosed", (event, ...args) => {
				fn(null, ...args);
			}),
		delay: (fn) =>
			ipcRenderer.on("delay", (event, ...args) => {
				fn(null, ...args);
			}),
		delayReady: (fn) =>
			ipcRenderer.on("delayReady", (event, ...args) => {
				fn(null, ...args);
			}),
		updateClockwheel: (fn) =>
			ipcRenderer.on("update-clockwheel", (event, ...args) => {
				fn(null, ...args);
			}),
		remoteReady: (fn) =>
			ipcRenderer.on("remoteReady", (event, ...args) => {
				fn(null, ...args);
			}),
		remotePeerReady: (fn) =>
			ipcRenderer.on("remotePeerReady", (event, ...args) => {
				fn(null, ...args);
			}),
		remotePeerUnavailable: (fn) =>
			ipcRenderer.on("remotePeerUnavailable", (event, ...args) => {
				fn(null, ...args);
			}),
		remoteIncomingCall: (fn) =>
			ipcRenderer.on("remoteIncomingCall", (event, ...args) => {
				fn(null, ...args);
			}),
		peerCallEstablished: (fn) =>
			ipcRenderer.on("peerCallEstablished", (event, ...args) => {
				fn(null, ...args);
			}),
		peerCallAnswered: (fn) =>
			ipcRenderer.on("peerCallAnswered", (event, ...args) => {
				fn(null, ...args);
			}),
		peerOutgoingSilence: (fn) =>
			ipcRenderer.on("peerOutgoingSilence", (event, ...args) => {
				fn(null, ...args);
			}),
		peerIncomingCallClosed: (fn) =>
			ipcRenderer.on("peerIncomingCallClosed", (event, ...args) => {
				fn(null, ...args);
			}),
		peerCallClosed: (fn) =>
			ipcRenderer.on("peerCallClosed", (event, ...args) => {
				fn(null, ...args);
			}),
		peerDestroyed: (fn) =>
			ipcRenderer.on("peerDestroyed", (event, ...args) => {
				fn(null, ...args);
			}),
		peerNoCalls: (fn) =>
			ipcRenderer.on("peerNoCalls", (event, ...args) => {
				fn(null, ...args);
			}),
		peerQualityProblem: (fn) =>
			ipcRenderer.on("peerQualityProblem", (event, ...args) => {
				fn(null, ...args);
			}),
		serialPorts: (fn) =>
			ipcRenderer.on("serialPorts", (event, ...args) => {
				fn(null, ...args);
			}),
	},
});

// Function for sanitizing filenames for audio recordings
contextBridge.exposeInMainWorld("sanitize", {
	string: (str) => {
		if (!str) {
			return ``;
		}
		str = ipcRenderer.sendSync("sanitize", str);
		str = str.replace(` - `, `_SPLITTERDJSHOW_`);
		str = str.replace(new RegExp("-", "g"), "_");
		str = str.replace(`_SPLITTERDJSHOW_`, ` - `);
		return str;
	},
});

// Getting settings
contextBridge.exposeInMainWorld("settings", {
	audio: () => ipcRenderer.sendSync("settings", "audio"),
	recorder: () => ipcRenderer.sendSync("settings", "recorder"),
	silence: () => ipcRenderer.sendSync("settings", "silence"),
	skyway: () => ipcRenderer.sendSync("settings", "skyway"),
	delay: () => ipcRenderer.sendSync("settings", "delay"),
});

// Saving settings
contextBridge.exposeInMainWorld("saveSettings", {
	recorder: (key, value) =>
		ipcRenderer.send("saveSettings", [`recorder.${key}`, value]),
	silence: (key, value) =>
		ipcRenderer.send("saveSettings", [`silence.${key}`, value]),
	skyway: (object) => ipcRenderer.send("saveSettings", ["skyway", object]),
	delay: (key, value) =>
		ipcRenderer.send("saveSettings", [`delay.${key}`, value]),
});
