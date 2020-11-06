"use strict";

window.addEventListener("DOMContentLoaded", () => {
	// Initialize the audio manager with compression
	var audioManager = new WWSUAudioManager(true);

	let audioSettings = window.settings.audio();

	// Initialize remote audio
	var remote = new WWSUremoteaudio(
		audioManager.audioContext,
		audioManager.destination,
		window.settings.skyway().api,
		audioSettings ? audioSettings.find((dev) => dev.output) : undefined
	);

	remote.init();

	// silence states
	var timer;

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
			} else {
				audioManager.disconnect(device.deviceId, device.kind);
			}
		});
	});

	window.ipc.renderer.send("console", ["log", "remote: Process is ready"]);
	window.ipc.renderer.send("remoteReady", []);

	remote.on("audioVolume", "remote", (volume) => {
		// If silence detected, start delay timer, else remove it
		if (volume[0] <= 0.001 || volume[1] <= 0.001) {
			// TODO
		}
		console.log(`Peer outgoing volume: ${volume[0]}, ${volume[1]}.`);
	});

	remote.on("peerReady", "remote", (id) => {
		window.ipc.renderer.send("console", [
			"log",
			`Remote: Peer is connected with id ${id}.`,
		]);
		window.ipc.renderer.send("remotePeerReady", [id]);
	});

	remote.on("peerUnavailable", "remote", (id) => {
		window.ipc.renderer.send("console", [
			"log",
			`Remote: Peer ${id} is unavailable to take the call.`,
		]);
		window.ipc.renderer.send("remotePeerUnavailable", [id]);
	});

	remote.on("peerCall", "remote", (id) => {
		window.ipc.renderer.send("console", [
			"log",
			`Remote: Incoming call from peer ${id}`,
		]);
		window.ipc.renderer.send("remoteIncomingCall", [id]);
	});

	remote.on("peerCallEstablished", "remote", (id) => {
		window.ipc.renderer.send("console", [
			"log",
			`Remote: Call with ${id} was established.`,
		]);
		window.ipc.renderer.send("peerCallEstablished", [id]);
	});

	remote.on("peerIncomingCallVolume", "renderer", (peer, volume) => {
		// TODO
		console.log(`Peer ${peer} incoming volume: ${volume[0]}, ${volume[1]}.`);
	});

	remote.on("peerIncomingCallClosed", "renderer", (peer, volume) => {
		// TODO
	});

	remote.on("peerCallClosed", "renderer", (peer, volume) => {
		// TODO
	});

	remote.on("peerDestroyed", "renderer", (peer, volume) => {
		// TODO
	});

	remote.on("peerDisconnected", "renderer", (peer, volume) => {
		// TODO
	});

	remote.on("peerPLC", "renderer", (peer, volume) => {
		// TODO
	});

	/*
		AUDIO DEVICES
	*/

	window.ipc.on("audioChangeVolume", (event, arg) => {
		console.log(`remote: Changing volume for device ${arg[0]} to ${arg[2]}`);
		audioManager.changeVolume(arg[0], arg[1], arg[2]);
		window.ipc.renderer.send("console", [
			"log",
			`remote: Changed audio volume for ${arg[0]} to ${arg[2]}`,
		]);
	});

	window.ipc.on("audioRefreshDevices", (event, arg) => {
		console.log(`remote: Refreshing available audio devices`);
		audioManager.loadDevices();
	});

	window.ipc.on("audioRemoteSetting", (event, arg) => {
		console.log(
			`remote: Changing remote setting for device ${arg[0]} to ${arg[2]}`
		);
		if (arg[2]) {
			audioManager.connect(
				arg[0],
				arg[1],
				"assets/plugins/wwsu-audio/js/wwsu-meter.js"
			);
		} else {
			audioManager.disconnect(arg[0], arg[1]);
		}
		window.ipc.renderer.send("console", [
			"log",
			`remote: Changing remote setting for device ${arg[0]} to ${arg[2]}`,
		]);
	});

	window.ipc.on("audioOutputSetting", (event, arg) => {
		if (arg[2]) {
			console.log(`remote: setting output device to ${arg[0]}`);
			remote.changeOutputDevice(arg[0]);
			window.ipc.renderer.send("console", [
				"log",
				`remote: setting output device to ${arg[0]}`,
			]);
		}
	});

	/*
		REMOTE TASKS
	*/

	window.ipc.on("remoteStartCall", (event, arg) => {
		console.log(`Received request to start a call with ${arg[0]}`);
		remote.call(arg[0]);
	});

	window.ipc.on("remoteAnswerCall", (event, arg) => {
		console.log(`Received request to answer a call from ${arg[0]}`);
		remote.answer(arg[0]);
	});

	window.ipc.on("remoteMute", (event, arg) => {
		console.log(`Setting incoming call audio mute status to ${arg[0]}`);
		remote.mute(arg[0]);
	});
});
