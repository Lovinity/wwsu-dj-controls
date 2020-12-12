"use strict";
// Initialize the audio manager
let audioManager = new WWSUAudioManager();

// Listen for when we receive available devices
audioManager.on("devices", "renderer", (devices) => {
	devices = devices.map((device) => {
		// Generate media stream and VU meters for each device
		audioManager.connect(
			device.deviceId,
			device.kind,
			"assets/plugins/wwsu-audio/js/wwsu-meter.js"
		);

		// Retrieve device settings if they exist
		let settings = Object.assign(
			{ deviceId: device.deviceId, volume: 1 },
			window.settings
				.audio()
				.find(
					(dev) => dev.deviceId === device.deviceId && dev.kind === device.kind
				)
		);

		// Set volume
		audioManager.changeVolume(device.deviceId, device.kind, settings.volume);

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
});

// When a device reports volume information, send this to the main process to be sent out to other audio processes and the renderer
audioManager.on("audioVolume", "renderer", (volumes) => {
	console.log(`Sending volume`);
	volumes = Array.from(volumes, ([device, volume]) => {
		return { device, volume };
	});
	window.ipc.renderer.send("audioVolume", [volumes]);
});

/*
		AUDIO DEVICES
	*/

window.ipc.on("audioChangeVolume", (event, arg) => {
	console.log(`Audio: Changing volume for device ${arg[0]} to ${arg[2]}`);
	audioManager.changeVolume(arg[0], arg[1], arg[2]);
	window.ipc.renderer.send("console", [
		"log",
		`Audio: Changed audio volume for ${arg[0]} to ${arg[2]}`,
	]);
});

window.ipc.on("audioRefreshDevices", (event, arg) => {
	console.log(`Audio: Refreshing available audio devices`);
	audioManager.loadDevices();
});

// READY
window.ipc.renderer.send("console", ["log", "Audio: Process is ready"]);
window.ipc.renderer.send("audioReady", []);
