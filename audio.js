"use strict";

// WARNING: We should never directly close this process. Instead, send ipc "shutDown" to shut down gracefully and save the current recording.

window.addEventListener("DOMContentLoaded", () => {
	let closingDown = false;

	// Initialize the recorder
	var recorder = new WWSUrecorder(
		"assets/plugins/mediarecorder/mp3-mediarecorder-worker.js"
	);

	// TODO: Initialize the silence detection
	var silence = new WWSUsilence(window.settings);

	// TODO: Initialize the skywayjs remote broadcasting
	var remote = new WWSUsilence(window.settings);

	// Initialize the audio manager
	var audioManager = new WWSUAudioManager(
		window.settings,
		window.saveSettings,
		recorder,
		silence,
		remote
	);

	window.ipc.renderer.send("console", ["log", "Audio: Process is ready"]);
	window.ipc.renderer.send("audioReady", []);



	/**
	 *	RECORDER
	 */



	recorder.on("recorderStopped", "recorder", (file) => {
		console.log(`Audio: Recording ${file} ended.`);
		window.ipc.renderer.send("console", [
			"log",
			`Audio: Recording ${file} ended.`,
		]);

		// Close the process if we are pending closing and no file was returned (aka no file to save).
		if (!file && closingDown) {
			window.close();
		}
	});
	recorder.on("recorderStarted", "recorder", (file) => {
		console.log(`Audio: Recording ${file} started.`);
		window.ipc.renderer.send("console", [
			"log",
			`Audio: Recording ${file} started.`,
		]);
	});

	// Pass volume info to main process to be passed to renderer
	// TODO
	recorder.audio.on("audioVolume", "recorder", (volume) => {
		window.ipc.renderer.send("recorderVolume", [volume]);
	});

	// Pass encoded info to main process to be saved
	recorder.on("recorderEncoded", "recorder", (file, reader) => {
		console.log(`Audio: Recording ${file} finished encoding.`);
		window.ipc.renderer.send("console", [
			"log",
			`Audio: Recording ${file} finished encoding.`,
		]);
		window.ipc.main.send("recorderEncoded", [file, reader]);
	});

	// Listen for device change requests
	// TODO
	window.ipc.on("recorderChangeDevice", (event, arg) => {
		console.log(`Audio: Changing recording device to ${arg[0]}`);
		recorder.audio.changeDevice(arg[0]);
		window.ipc.renderer.send("console", [
			"log",
			`Audio: Changed recording device to ${arg[0]}`,
		]);
	});

	// listen for audio recordings saved
	window.ipc.on("recorderSaved", (event, arg) => {
		console.log(`Audio file saved: ${arg[0]}`);
		window.ipc.renderer.send("console", [
			"log",
			`Audio: Audio file saved to ${arg[0]}`,
		]);

		// Close the process if we are pending closing
		if (closingDown) {
			window.close();
		}
	});

	// Start a new recording
	window.ipc.on("recorderStart", (event, arg) => {
		recorder.newRecording(arg[0], arg[1] || window.settings.delay);
		window.ipc.renderer.send("console", [
			"log",
			`Audio: Recording ${arg[0]} will start in ${
				arg[1] || window.settings.delay
			} milliseconds.`,
		]);
	});

	// Stop current recording
	window.ipc.on("recorderStop", (arg) => {
		recorder.stopRecording(arg[0] || window.settings.delay);
		window.ipc.renderer.send("console", [
			"log",
			`Audio: Recording ${arg[0]} will stop in ${
				arg[0] || window.settings.delay
			} milliseconds.`,
		]);
	});

	window.ipc.on("shutDown", (arg) => {
		closingDown = true;
		console.log(`Audio: shut down requested.`);
		recorder.stopRecording(-1);
	});

	
});
