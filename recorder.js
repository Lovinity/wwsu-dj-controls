"use strict";

// WARNING: We should never directly close this process. Instead, send ipc "shutDown" to shut down gracefully and save the current recording.
let closingDown = false;

// Initialize the audio manager
var audioManager = new WWSUAudioManager();

// Initialize recorder
var recorder = new WWSUrecorder(
	audioManager.destination,
	"assets/plugins/wwsu-audio/js/wwsu-recorder-worker.js"
);

// Listen for when we receive available devices
audioManager.on("devices", "renderer", (devices) => {
	devices = devices.map((device) => {
		// Retrieve device settings if they exist
		let settings = window.settings
			.audio()
			.find(
				(dev) => dev.deviceId === device.deviceId && dev.kind === device.kind
			);

		// Connect device to recorder if device has recorder set to true
		if (settings && settings.recorder) {
			audioManager.connect(
				device.deviceId,
				device.kind,
				"assets/plugins/wwsu-audio/js/wwsu-meter.js"
			);
			window.ipc.renderer.console(["log", `Recorder: connected device ${device.kind} / ${device.deviceId}`]);
		} else {
			audioManager.disconnect(device.deviceId, device.kind);
			window.ipc.renderer.console(["log", `Recorder: Disconnected device ${device.kind} / ${device.deviceId}`]);
		}
	});
});

window.ipc.renderer.console(["log", "Recorder: Process is ready"]);
window.ipc.renderer.recorderReady([]);

/*
		AUDIO DEVICES
	*/

window.ipc.on.audioChangeVolume((event, arg) => {
	console.log(`Audio: Changing volume for device ${arg[0]} to ${arg[2]}`);
	audioManager.changeVolume(arg[0], arg[1], arg[2]);
	window.ipc.renderer.console([
		"log",
		`Recorder: Changed audio volume for ${arg[0]} to ${arg[2]}`,
	]);
});

window.ipc.on.audioRefreshDevices((event, arg) => {
	console.log(`Recorder: Refreshing available audio devices`);
	window.ipc.renderer.console(["log", `Recorder: Received request to refresh devices`]);
	audioManager.loadDevices();
});

window.ipc.on.audioRecorderSetting((event, arg) => {
	console.log(
		`Recorder: Changing recorder setting for device ${arg[0]} to ${arg[2]}`
	);
	// Connect device to recorder if device has recorder set to true
	if (arg[2]) {
		audioManager.connect(
			arg[0],
			arg[1],
			"assets/plugins/wwsu-audio/js/wwsu-meter.js"
		);
		window.ipc.renderer.console(["log", `Recorder: connected device ${arg[1]} / ${arg[0]}`]);
	} else {
		audioManager.disconnect(arg[0], arg[1]);
		window.ipc.renderer.console(["log", `Recorder: Disconnected device ${arg[1]} / ${arg[0]}`]);
	}
	window.ipc.renderer.console([
		"log",
		`Recorder: Changing recorder setting for device ${arg[0]} to ${arg[2]}`,
	]);
});

/**
 *	RECORDER
 */

recorder.on("recorderStopped", "recorder", (file) => {
	console.log(`Recorder: Recording ${file} ended.`);
	window.ipc.renderer.console(["log", `Recorder: Recording ${file} ended.`]);

	window.ipc.renderer.recorderStopped([]);

	// Close the process if we are pending closing and no file was returned (aka no file to save).
	if (!file && closingDown) {
		window.close();
	}
});

recorder.on("recorderStarted", "recorder", (file) => {
	console.log(`Recorder: Recording ${file} started.`);
	window.ipc.renderer.console(["log", `Recorder: Recording ${file} started.`]);
	window.ipc.renderer.recorderStarted([]);
});

// Pass encoded info to main process to be saved
recorder.on("recorderEncoded", "recorder", (file, reader) => {
	console.log(`Recorder: Recording ${file} finished encoding.`);
	window.ipc.renderer.console([
		"log",
		`Recorder: Recording ${file} finished encoding.`,
	]);
	window.ipc.recorderEncoded([file, reader], (path) => {
		console.log(`Recorder: Audio file saved to ${path}`);
		window.ipc.renderer.console([
			"log",
			`Recorder: Audio file saved to ${path}`,
		]);
		window.ipc.renderer.recorderSaved([path]);

		// Close the process if we are pending closing
		if (closingDown) {
			window.close();
		}
	});
});

// Start a new recording
window.ipc.on.recorderStart((event, arg) => {
	recorder.newRecording(arg[0], arg[1] || window.settings.recorder().delay);
	window.ipc.renderer.console([
		"log",
		`Recorder: Recording ${arg[0]} will start in ${
			arg[1] || window.settings.recorder().delay
		} milliseconds.`,
	]);
});

// Stop current recording
window.ipc.on.recorderStop((event, arg) => {
	recorder.stopRecording(arg[0] || window.settings.recorder().delay);
	window.ipc.renderer.console([
		"log",
		`Recorder: Recording ${arg[0]} will stop in ${
			arg[0] || window.settings.recorder().delay
		} milliseconds.`,
	]);
});

window.ipc.on.shutDown((event, arg) => {
	closingDown = true;
	console.log(`Recorder: shut down requested.`);
	window.ipc.renderer.console(["log", `Recorder: Shut-down requested`]);
	recorder.stopRecording(-1);
});
