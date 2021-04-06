"use strict";
// Initialize the audio manager
let audioManager = new WWSUAudioManager();

// Initialize silence detection
let silence = new WWSUsilenceaudio(
	audioManager.audioContext,
	audioManager.destination
);

let silenceSettings = window.settings.silence();

// Silence states
let timer;
let timer2;

// Do not monitor for silence if there are no audio devices selected for silence monitoring
let silenceDeviceActive = false;

// Listen for when we receive available devices
audioManager.on("devices", "renderer", (devices) => {
	silenceDeviceActive = false;
	devices = devices.map((device) => {
		// Retrieve device settings if they exist
		let settings = window.settings
			.audio()
			.find(
				(dev) => dev.deviceId === device.deviceId && dev.kind === device.kind
			);

		// Connect device to recorder if device has silence set to true
		if (settings && settings.silence) {
			silenceDeviceActive = true;
			audioManager.connect(
				device.deviceId,
				device.kind,
				"assets/plugins/wwsu-audio/js/wwsu-meter.js"
			);
			window.ipc.renderer.console([
				"log",
				`Silence: Connected device ${device.kind} / ${device.deviceId}`,
			]);
		} else {
			audioManager.disconnect(device.deviceId, device.kind);
			window.ipc.renderer.console([
				"log",
				`Silence: Disconnected device ${device.kind} / ${device.deviceId}`,
			]);
		}
	});
});

window.ipc.renderer.console(["log", "Silence: Process is ready"]);
window.ipc.renderer.silenceReady([]);

silence.on("audioVolume", "silence", (volume) => {
	if (!silenceSettings || !silenceDeviceActive) {
		clearInterval(timer);
		clearTimeout(timer);
		timer = undefined;
		return;
	}

	// If silence detected, start delay timer, else remove it
	if (
		volume[0] <= silenceSettings.threshold ||
		volume[1] <= silenceSettings.threshold
	) {
		if (!timer) {
			window.ipc.renderer.silenceState([1]);
			console.log(`Silence`);

			// Delay timer should trigger active silence and then keep triggering it every minute until silence no longer detected.
			timer = setTimeout(() => {
				window.ipc.renderer.silenceState([2]);
				clearTimeout(timer2);
				console.log(`Silence trigger activated`);
				timer = setInterval(() => {
					window.ipc.renderer.silenceState([2]);
					console.log(`Silence re-triggered`);
				}, 60000);
			}, silenceSettings.delay);
		}
	} else if (timer) {
		console.log(`No more silence`);
		window.ipc.renderer.silenceState([0]);

		// Trigger good status every minute so the system knows silence detection is still running / active
		timer2 = setInterval(() => {
			window.ipc.renderer.silenceState([0]);
			console.log(`Silence good`);
		}, 60000);
		
		clearInterval(timer);
		clearTimeout(timer);
		timer = undefined;
	}
});

/*
		AUDIO DEVICES
	*/

window.ipc.on.audioChangeVolume((event, arg) => {
	console.log(`Silence: Changing volume for device ${arg[0]} to ${arg[2]}`);
	audioManager.changeVolume(arg[0], arg[1], arg[2]);
	window.ipc.renderer.console([
		"log",
		`Silence: Changed audio volume for ${arg[0]} to ${arg[2]}`,
	]);
});

window.ipc.on.audioRefreshDevices((event, arg) => {
	console.log(`Silence: Refreshing available audio devices`);
	window.ipc.renderer.console([
		"log",
		`Silence: Received request to refresh devices`,
	]);
	audioManager.loadDevices();
});

window.ipc.on.audioSilenceSetting((event, arg) => {
	console.log(
		`Silence: Changing silence setting for device ${arg[0]} to ${arg[2]}`
	);
	if (arg[2]) {
		audioManager.connect(
			arg[0],
			arg[1],
			"assets/plugins/wwsu-audio/js/wwsu-meter.js"
		);
		window.ipc.renderer.console([
			"log",
			`Silence: Connected device ${arg[1]} / ${arg[0]}`,
		]);
	} else {
		audioManager.disconnect(arg[0], arg[1]);
		window.ipc.renderer.console([
			"log",
			`Silence: Disconnected device ${arg[1]} / ${arg[0]}`,
		]);
	}
	window.ipc.renderer.console([
		"log",
		`Silence: Changing silence setting for device ${arg[0]} to ${arg[2]}`,
	]);
});

window.ipc.on.silenceSetting((event) => {
	window.ipc.renderer.console([
		"log",
		`Silence: Updating settings`,
	]);
	silenceSettings = window.settings.silence();
});
