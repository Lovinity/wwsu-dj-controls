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
		} else {
			audioManager.disconnect(device.deviceId, device.kind);
		}
	});
});

window.ipc.renderer.send("console", ["log", "Recorder: Process is ready"]);
window.ipc.renderer.send("recorderReady", []);

/*
		AUDIO DEVICES
	*/

window.ipc.on("audioChangeVolume", (event, arg) => {
	console.log(`Audio: Changing volume for device ${arg[0]} to ${arg[2]}`);
	audioManager.changeVolume(arg[0], arg[1], arg[2]);
	window.ipc.renderer.send("console", [
		"log",
		`Recorder: Changed audio volume for ${arg[0]} to ${arg[2]}`,
	]);
});

window.ipc.on("audioRefreshDevices", (event, arg) => {
	console.log(`Recorder: Refreshing available audio devices`);
	audioManager.loadDevices();
});

window.ipc.on("audioRecorderSetting", (event, arg) => {
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
	} else {
		audioManager.disconnect(arg[0], arg[1]);
	}
	window.ipc.renderer.send("console", [
		"log",
		`Recorder: Changing recorder setting for device ${arg[0]} to ${arg[2]}`,
	]);
});

/**
 *	RECORDER
 */

recorder.on("recorderStopped", "recorder", (file) => {
	console.log(`Recorder: Recording ${file} ended.`);
	window.ipc.renderer.send("console", [
		"log",
		`Recorder: Recording ${file} ended.`,
	]);

	window.ipc.renderer.send("recorderStopped", []);

	// Close the process if we are pending closing and no file was returned (aka no file to save).
	if (!file && closingDown) {
		window.close();
	}
});

recorder.on("recorderStarted", "recorder", (file) => {
	console.log(`Recorder: Recording ${file} started.`);
	window.ipc.renderer.send("console", [
		"log",
		`Recorder: Recording ${file} started.`,
	]);
	window.ipc.renderer.send("recorderStarted", []);
});

// Pass encoded info to main process to be saved
recorder.on("recorderEncoded", "recorder", (file, reader) => {
	console.log(`Recorder: Recording ${file} finished encoding.`);
	window.ipc.renderer.send("console", [
		"log",
		`Recorder: Recording ${file} finished encoding.`,
	]);
	window.ipc.main.send("recorderEncoded", [file, reader]);
});

// listen for audio recordings saved
window.ipc.on("recorderSaved", (event, arg) => {
	console.log(`Recorder: Audio file saved to ${arg[0]}`);
	window.ipc.renderer.send("console", [
		"log",
		`Recorder: Audio file saved to ${arg[0]}`,
	]);

	// Close the process if we are pending closing
	if (closingDown) {
		window.close();
	}
});

// Start a new recording
window.ipc.on("recorderStart", (event, arg) => {
	recorder.newRecording(arg[0], arg[1] || window.settings.recorder().delay);
	window.ipc.renderer.send("console", [
		"log",
		`Recorder: Recording ${arg[0]} will start in ${
			arg[1] || window.settings.recorder().delay
		} milliseconds.`,
	]);
});

// Stop current recording
window.ipc.on("recorderStop", (arg) => {
	recorder.stopRecording(arg[0] || window.settings.recorder().delay);
	window.ipc.renderer.send("console", [
		"log",
		`Recorder: Recording ${arg[0]} will stop in ${
			arg[0] || window.settings.recorder().delay
		} milliseconds.`,
	]);
});

window.ipc.on("shutDown", (arg) => {
	closingDown = true;
	console.log(`Recorder: shut down requested.`);
	recorder.stopRecording(-1);
});
