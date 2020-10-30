"use strict";

window.addEventListener("DOMContentLoaded", () => {
	// Initialize the audio manager
	var audioManager = new WWSUAudioManager();

	// Listen for when we receive available devices
	audioManager.on("devices", "renderer", (devices) => {
		devices = devices.map((device) => {
			// Generate media stream and VU meters for each device
			audioManager.connect(
				device.deviceId,
				"assets/plugins/wwsu-audio/js/wwsu-meter.js"
			);

			// Retrieve device settings if they exist
			let settings = Object.assign(
				{ deviceId: device.deviceId, volume: 1 },
				window.settings.audio().find((dev) => dev.deviceId === device.deviceId)
			);

			// Return device info and settings for renderer process
			return {
				device: {
					deviceId: device.deviceId,
					label: device.label,
					kind: device.kind,
				},
				settings: settings,
			};
		});

		console.log(`Audio: Sending audio devices to renderer`);
		console.dir(devices);

		// Emit devices to renderer
		window.ipc.renderer.send("audioDevices", [devices]);
		window.ipc.renderer.send("audioReady", []);
	});

	// When a device reports volume information, send this to the main process to be sent out to other audio processes and the renderer
	audioManager.on("audioVolume", "renderer", (device, volume) => {
		window.ipc.main.send("audioVolume", [device, volume]);
	});

	window.ipc.renderer.send("console", ["log", "Audio: Process is ready"]);

	/*
		AUDIO DEVICES
	*/

	window.ipc.on("audioChangeVolume", (event, arg) => {
		console.log(`Audio: Changing volume for device ${arg[0]} to ${arg[1]}`);
		audioManager.changeVolume(arg[0], arg[1]);
		window.ipc.renderer.send("console", [
			"log",
			`Audio: Changed audio volume for ${arg[0]} to ${arg[1]}`,
		]);
	});

	window.ipc.on("audioRefreshDevices", (event, arg) => {
		console.log(`Audio: Refreshing available audio devices`);
		audioManager.loadDevices();
	});
});
