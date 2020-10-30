"use strict";

window.addEventListener("DOMContentLoaded", () => {
	// Initialize the audio manager
	var audioManager = new WWSUAudioManager();

	// Initialize silence detection
	var silence = new WWSUsilence(
		audioManager.audioContext,
		audioManager.destination
	);

	var silenceSettings = window.settings.silence();

	// Silence states
	var timer;
	var triggered = false;

	// Listen for when we receive available devices
	audioManager.on("devices", "renderer", (devices) => {
		devices = devices.map((device) => {
			// Retrieve device settings if they exist
			let settings = window.settings
				.audio()
				.find((dev) => dev.deviceId === device.deviceId);

			// Connect device to recorder if device has silence set to true
			if (settings && settings.silence) {
				audioManager.connect(
					device.deviceId,
					"assets/plugins/wwsu-audio/js/wwsu-meter.js"
				);
			} else {
				audioManager.disconnect(device.deviceId);
			}
		});
	});

	window.ipc.renderer.send("console", ["log", "Silence: Process is ready"]);

	silence.on("audioVolume", "silence", (volume) => {
		console.dir(volume);

		if (!silenceSettings) return;

		// If silence detected, start delay timer, else remove it
		if (
			(volume[0] <= silenceSettings.threshold ||
				_volume[1] <= silenceSettings.threshold) &&
			!timer
		) {
			window.ipc.renderer.send("silence", [true]);

			// Delay timer should trigger active silence and then keep triggering it every minute until silence no longer detected.
			timer = setTimeout(() => {
				triggered = true;
				window.ipc.renderer.send("silenceTrigger", [true]);
				timer = setInterval(() => {
					window.ipc.renderer.send("silenceTrigger", [true]);
				}, 60000);
			}, silenceSettings.delay);
		} else if (timer) {
			window.ipc.renderer.send("silence", [false]);
			if (triggered) window.ipc.renderer.send("silenceTrigger", [false]);
			triggered = false;
			clearInterval(timer);
			clearTimeout(timer);
			timer = undefined;
		}
	});

	/*
		AUDIO DEVICES
	*/

	window.ipc.on("audioChangeVolume", (event, arg) => {
		console.log(`Silence: Changing volume for device ${arg[0]} to ${arg[1]}`);
		audioManager.changeVolume(arg[0], arg[1]);
		window.ipc.renderer.send("console", [
			"log",
			`Silence: Changed audio volume for ${arg[0]} to ${arg[1]}`,
		]);
	});

	window.ipc.on("audioRefreshDevices", (event, arg) => {
		console.log(`Silence: Refreshing available audio devices`);
		audioManager.loadDevices();
	});

	window.ipc.on("audioRecorderSetting", (event, arg) => {
		console.log(
			`Silence: Changing recorder setting for device ${arg[0]} to ${arg[1]}`
		);
		audioManager.shouldRecord(arg[0], arg[1]);
		window.ipc.renderer.send("console", [
			"log",
			`Silence: Changing recorder setting for device ${arg[0]} to ${arg[1]}`,
		]);
	});

	window.ipc.on("audioRemoteSetting", (event, arg) => {
		console.log(
			`Silence: Changing remote setting for device ${arg[0]} to ${arg[1]}`
		);
		audioManager.shouldRemote(arg[0], arg[1]);
		window.ipc.renderer.send("console", [
			"log",
			`Silence: Changing remote setting for device ${arg[0]} to ${arg[1]}`,
		]);
	});

	window.ipc.on("audioSilenceSetting", (event, arg) => {
		console.log(
			`Silence: Changing silence setting for device ${arg[0]} to ${arg[1]}`
		);
		if (arg[1]) {
			audioManager.connect(
				arg[0],
				"assets/plugins/wwsu-audio/js/wwsu-meter.js"
			);
		} else {
			audioManager.disconnect(arg[0]);
		}
		window.ipc.renderer.send("console", [
			"log",
			`Silence: Changing silence setting for device ${arg[0]} to ${arg[1]}`,
		]);
	});

	/*
		SILENCE
	*/

	silence.on("silence", "renderer", (silence) => {
		window.ipc.renderer.send("silence", [silence]);
	});

	silence.on("silenceTrigger", "renderer", (silenceTrigger) => {
		window.ipc.renderer.send("silenceTrigger", [silenceTrigger]);
	});
});
