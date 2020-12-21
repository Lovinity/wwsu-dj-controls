"use strict";

// TODO: Incoming audio stream is still coming in as mono (2 channels, but equal) when it should be stereo.

// Initialize the audio manager with compression
let audioManager = new WWSUAudioManager(
	"assets/plugins/wwsu-audio/js/wwsu-limiter.js"
);

let audioSettings = window.settings.audio();

// Remote audio is initialized after remoteReady is emitted by this process to renderer, renderer queries for a credential, and renderer passes the credential here via remotePeerCredential.
let remote = new WWSUremoteaudio(
	audioManager.audioContext,
	audioManager.destination,
	audioSettings ? audioSettings.find((dev) => dev.output) : undefined
);

// silence states
let timer;
let timer2;

// Listen for when we receive available devices
audioManager.on("devices", "renderer", (devices) => {
	devices = devices.map((device) => {
		// Retrieve device settings if they exist
		let settings = window.settings
			.audio()
			.find(
				(dev) => dev.deviceId === device.deviceId && dev.kind === device.kind
			);

		// Connect device to recorder if device has remote set to true
		if (settings && settings.remote) {
			audioManager.connect(
				device.deviceId,
				device.kind,
				"assets/plugins/wwsu-audio/js/wwsu-meter.js"
			);
			window.ipc.renderer.console([
				"log",
				`Remote: Connected device ${device.kind} / ${device.deviceId}`,
			]);
		} else {
			audioManager.disconnect(device.deviceId, device.kind);
			window.ipc.renderer.console([
				"log",
				`Remote: Disconnected device ${device.kind} / ${device.deviceId}`,
			]);
		}
	});
});

window.ipc.renderer.console(["log", "remote: Process is ready"]);
window.ipc.renderer.remoteReady([]);

/*
		REMOTE TASKS
	*/

remote.on("audioVolume", "remote", (volume) => {
	// If silence detected, start delay timer, else remove it
	// Do not consider silence on the right channel unless we are actually reporting right channel volume. Always report silence on the left channel as it is the mono track.
	if (volume[0] <= 0.001 || (volume[1] > -1 && volume[1] <= 0.001)) {
		if (!timer) {
			timer = setTimeout(() => {
				window.ipc.renderer.peerOutgoingSilence([true]);
				timer = undefined;
			}, 15000);
		}
	} else if (timer) {
		clearTimeout(timer);
		timer = undefined;
		window.ipc.renderer.peerOutgoingSilence([false]);
	}
	console.log(`Peer outgoing volume: ${volume[0]}, ${volume[1]}.`);
});

remote.on("peerReady", "remote", (id) => {
	window.ipc.renderer.console([
		"log",
		`Remote: Peer is connected with id ${id}.`,
	]);
	window.ipc.renderer.remotePeerReady([id]);
});

remote.on("peerUnavailable", "remote", (id) => {
	window.ipc.renderer.console([
		"log",
		`Remote: Peer ${id} is unavailable to take the call.`,
	]);
	window.ipc.renderer.remotePeerUnavailable([id]);
});

remote.on("peerCall", "remote", (id) => {
	window.ipc.renderer.console(["log", `Remote: Incoming call from peer ${id}`]);
	window.ipc.renderer.remoteIncomingCall([id]);
});

remote.on("peerCallEstablished", "remote", (id) => {
	window.ipc.renderer.console([
		"log",
		`Remote: Call with ${id} was established.`,
	]);
	window.ipc.renderer.peerCallEstablished([id]);
});

remote.on("peerCallAnswered", "remote", (id) => {
	window.ipc.renderer.console(["log", `Remote: Call with ${id} was answered.`]);
	window.ipc.renderer.peerCallAnswered([id]);
});

remote.on("peerIncomingCallVolume", "renderer", (peer, volume) => {
	console.log(`Peer ${peer} incoming volume: ${volume[0]}, ${volume[1]}.`);
	if (volume[0] <= 0.001 || (volume[1] > -1 && volume[1] <= 0.001)) {
		if (!timer2) {
			timer2 = setTimeout(() => {
				window.ipc.renderer.peerQualityProblem([peer, 10, `incomingSilence`]);
				timer2 = undefined;
			}, 1000);
		}
	}
});

remote.on("peerIncomingCallClosed", "renderer", (id) => {
	window.ipc.renderer.console([
		"log",
		`Remote: Incoming call ${id} was closed!`,
	]);
	window.ipc.renderer.peerIncomingCallClosed([id]);
});

remote.on("peerCallClosed", "renderer", (id) => {
	window.ipc.renderer.console([
		"log",
		`Remote: Outgoing call ${id} was closed!`,
	]);
	window.ipc.renderer.peerCallClosed([id]);
});

remote.on("peerDestroyed", "renderer", () => {
	window.ipc.renderer.console(["log", `Remote: Peer was destroyed!`]);
	window.ipc.renderer.peerDestroyed([true]);
});

remote.on("peerDisconnected", "renderer", () => {
	window.ipc.renderer.console(["log", `Remote: Peer was disconnected!`]);
});

remote.on("peerError", "renderer", (err) => {
	window.ipc.renderer.console(["error", err]);
	window.ipc.renderer.peerDestroyed([true]); // Do the same as destroyed peer when there is an error
});

remote.on("peerPLC", "renderer", (connection, value) => {
	console.log(`PeerPLC ${connection}: ${value}`);
	window.ipc.renderer.peerQualityProblem([connection, value, `PLC`]);
});

// Init Skyway.js with credentials
window.ipc.on.remotePeerCredential((event, arg) => {
	let peerId = arg[0];
	let apiKey = arg[1];
	let credential = arg[2];
	console.dir(arg);

	remote.init(peerId, apiKey, credential);
});

/*
		AUDIO DEVICES
	*/

window.ipc.on.audioChangeVolume((event, arg) => {
	console.log(`remote: Changing volume for device ${arg[0]} to ${arg[2]}`);
	audioManager.changeVolume(arg[0], arg[1], arg[2]);
	if (arg[1] === "audiooutput") remote.changeVolume(arg[2]);
	window.ipc.renderer.console([
		"log",
		`remote: Changed audio volume for ${arg[0]} to ${arg[2]}`,
	]);
});

window.ipc.on.audioRefreshDevices((event, arg) => {
	console.log(`remote: Refreshing available audio devices`);
	audioManager.loadDevices();
});

window.ipc.on.audioRemoteSetting((event, arg) => {
	console.log(
		`remote: Changing remote setting for device ${arg[0]} to ${arg[2]}`
	);
	if (arg[2]) {
		audioManager.connect(
			arg[0],
			arg[1],
			"assets/plugins/wwsu-audio/js/wwsu-meter.js"
		);
		window.ipc.renderer.console([
			"log",
			`Remote: Connected device ${arg[1]} / ${arg[0]}`,
		]);
	} else {
		audioManager.disconnect(arg[0], arg[1]);
		window.ipc.renderer.console([
			"log",
			`Remote: Disconnected device ${arg[1]} / ${arg[0]}`,
		]);
	}
	window.ipc.renderer.console([
		"log",
		`remote: Changing remote setting for device ${arg[0]} to ${arg[2]}`,
	]);
});

window.ipc.on.audioOutputSetting((event, arg) => {
	if (arg[2]) {
		console.log(`remote: setting output device to ${arg[0]}`);
		remote.changeOutputDevice(arg[0]);
		window.ipc.renderer.console([
			"log",
			`remote: setting output device to ${arg[0]}`,
		]);
	}
});

/*
		REMOTE TASKS
	*/

window.ipc.on.remoteStartCall((event, arg) => {
	console.log(`Received request to start a call with ${arg[0]}`);
	window.ipc.renderer.console([
		"log",
		`Remote: Starting call with peer ${arg[0]}`,
	]);
	remote.call(arg[0]);
});

window.ipc.on.remoteAnswerCall((event, arg) => {
	console.log(`Received request to answer a call from ${arg[0]}`);
	window.ipc.renderer.console([
		"log",
		`Remote: Answering incoming call with peer ${arg[0]}`,
	]);
	remote.answer(arg[0]);
});

window.ipc.on.remoteMute((event, arg) => {
	console.log(`Setting incoming call audio mute status to ${arg[0]}`);
	window.ipc.renderer.console([
		"log",
		`remote: muting incoming audio? ${arg[0]}`,
	]);
	remote.mute(arg[0]);
});

window.ipc.on.restartSilenceTimer((event, arg) => {
	window.ipc.renderer.console(["log", `Remote: Restarting silence timer`]);
	clearTimeout(timer);
	timer = undefined;
});

window.ipc.on.confirmActiveCall((event, arg) => {
	if (
		!remote.outgoingCall &&
		(!remote.incomingCalls || remote.incomingCalls.size === 0)
	) {
		window.ipc.renderer.console(["log", `Remote: No active calls!`]);
		window.ipc.renderer.peerNoCalls([]);
	} else {
		window.ipc.renderer.console(["log", `Remote: A call is active`]);
	}
});
