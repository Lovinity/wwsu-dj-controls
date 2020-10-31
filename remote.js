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
		// If remote detected, start delay timer, else remove it
		if (volume[0] <= 0 || volume[1] <= 0) {
			// TODO
		}
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
});
