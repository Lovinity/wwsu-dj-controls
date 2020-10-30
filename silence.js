"use strict";

window.addEventListener("DOMContentLoaded", () => {
	// Initialize the audio manager
	var audioManager = new WWSUAudioManager();

	// Initialize silence detection
	var silence = new WWSUsilenceaudio(
		audioManager.audioContext,
		audioManager.destination
	);

	var silenceSettings = window.settings.silence();

	// Silence states
	var timer;

	// Listen for when we receive available devices
	audioManager.on("devices", "renderer", (devices) => {
		devices = devices.map((device) => {
			// Retrieve device settings if they exist
			let settings = window.settings
				.audio()
				.find((dev) => dev.deviceId === device.deviceId && dev.kind === device.kind);

			// Connect device to recorder if device has silence set to true
			if (settings && settings.silence) {
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

	window.ipc.renderer.send("console", ["log", "Silence: Process is ready"]);
	window.ipc.renderer.send("silenceReady", []);

	silence.on("audioVolume", "silence", (volume) => {
		console.dir(volume);

		if (!silenceSettings) return;

		// If silence detected, start delay timer, else remove it
		if (
			volume[0] <= silenceSettings.threshold ||
			volume[1] <= silenceSettings.threshold
		) {
			if (!timer) {
				window.ipc.renderer.send("silenceState", [1]);
				console.log(`Silence`);

				// Delay timer should trigger active silence and then keep triggering it every minute until silence no longer detected.
				timer = setTimeout(() => {
					window.ipc.renderer.send("silenceState", [2]);
					console.log(`Silence trigger activated`);
					timer = setInterval(() => {
						window.ipc.renderer.send("silenceState", [2]);
						console.log(`Silence re-triggered`);
					}, 60000);
				}, silenceSettings.delay);
			}
		} else if (timer) {
			console.log(`No more silence`);
			window.ipc.renderer.send("silenceState", [0]);
			clearInterval(timer);
			clearTimeout(timer);
			timer = undefined;
		}
	});

	/*
		AUDIO DEVICES
	*/

	window.ipc.on("audioChangeVolume", (event, arg) => {
		console.log(`Silence: Changing volume for device ${arg[0]} to ${arg[2]}`);
		audioManager.changeVolume(arg[0], arg[1], arg[2]);
		window.ipc.renderer.send("console", [
			"log",
			`Silence: Changed audio volume for ${arg[0]} to ${arg[2]}`,
		]);
	});

	window.ipc.on("audioRefreshDevices", (event, arg) => {
		console.log(`Silence: Refreshing available audio devices`);
		audioManager.loadDevices();
	});

	window.ipc.on("audioSilenceSetting", (event, arg) => {
		console.log(
			`Silence: Changing silence setting for device ${arg[0]} to ${arg[2]}`
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
			`Silence: Changing silence setting for device ${arg[0]} to ${arg[2]}`,
		]);
	});
});
