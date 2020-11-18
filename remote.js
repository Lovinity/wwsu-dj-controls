"use strict";

// TODO: Incoming audio stream is still coming in as mono (2 channels, but equal) when it should be stereo.

window.addEventListener("DOMContentLoaded", () => {
	// Initialize the audio manager with compression
	var audioManager = new WWSUAudioManager(
		"assets/plugins/wwsu-audio/js/wwsu-limiter.js"
	);

	let audioSettings = window.settings.audio();

	let quality = 100;

	setInterval(() => {
		if (quality < 100) {
			quality += 1;
			if (quality === 100) {
				window.ipc.renderer.send("remoteQuality", [100]);
			} else if (quality === 66) {
				window.ipc.renderer.send("remoteQuality", [66]);
			} else if (quality === 33) {
				window.ipc.renderer.send("remoteQuality", [33]);
			}
		}
	}, 1000);

	// Remote audio is initialized after remoteReady is emitted by this process to renderer, renderer queries for a credential, and renderer passes the credential here via remotePeerCredential.
	var remote = new WWSUremoteaudio(
		audioManager.audioContext,
		audioManager.destination,
		audioSettings ? audioSettings.find((dev) => dev.output) : undefined
	);

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

	/*
		REMOTE TASKS
	*/

	remote.on("audioVolume", "remote", (volume) => {
		// If silence detected, start delay timer, else remove it
		// Do not consider silence on the right channel unless we are actually reporting right channel volume. Always report silence on the left channel as it is the mono track.
		if (volume[0] <= 0.001 || (volume[1] > -1 && volume[1] <= 0.001)) {
			if (!timer) {
				timer = setTimeout(() => {
					window.ipc.renderer.send("peerOutgoingSilence", [true]);
					timer = undefined;
				}, 15000);
			}
		} else if (timer) {
			clearTimeout(timer);
			timer = undefined;
			window.ipc.renderer.send("peerOutgoingSilence", [false]);
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
		quality = 100;
	});

	remote.on("peerCallAnswered", "remote", (id) => {
		window.ipc.renderer.send("console", [
			"log",
			`Remote: Call with ${id} was answered.`,
		]);
		window.ipc.renderer.send("peerCallAnswered", [id]);
		quality = 100;
	});

	remote.on("peerIncomingCallVolume", "renderer", (peer, volume) => {
		console.log(`Peer ${peer} incoming volume: ${volume[0]}, ${volume[1]}.`);
		if (volume[0] <= 0.001 || (volume[1] > -1 && volume[1] <= 0.001)) {
			decreaseQuality();
		}
	});

	remote.on("peerIncomingCallClosed", "renderer", () => {
		window.ipc.renderer.send("peerIncomingCallClosed", [true]);
	});

	remote.on("peerCallClosed", "renderer", () => {
		window.ipc.renderer.send("peerCallClosed", [true]);
	});

	remote.on("peerDestroyed", "renderer", () => {
		window.ipc.renderer.send("peerDestroyed", [true]);
	});

	remote.on("peerDisconnected", "renderer", () => {
		// TODO
	});

	remote.on("peerPLC", "renderer", (connection, value) => {
		console.log(`PeerPLC ${connection}: ${value}`);
		decreaseQuality(value);
	});

	// Init Skyway.js with credentials
	window.ipc.on("remotePeerCredential", (event, arg) => {
		let peerId = arg[0];
		let apiKey = arg[1];
		let credential = arg[2];

		remote.init(peerId, apiKey, credential);
	});

	/*
		AUDIO DEVICES
	*/

	window.ipc.on("audioChangeVolume", (event, arg) => {
		console.log(`remote: Changing volume for device ${arg[0]} to ${arg[2]}`);
		audioManager.changeVolume(arg[0], arg[1], arg[2]);
		if (arg[1] === "audiooutput") remote.changeVolume(arg[2]);
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

	window.ipc.on("restartSilenceTimer", (event, arg) => {
		clearTimeout(timer);
		timer = undefined;
	});

	function decreaseQuality(amount = 1) {
		quality -= amount;
		if (quality < 0) quality = 0;
		window.ipc.renderer.send("remoteQuality", [quality]);
	}
});
