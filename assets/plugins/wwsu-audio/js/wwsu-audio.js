/**
 * Manager for audio devices
 * // TODO: settings does not update as it should when they are changed; figure out another way to access settings.
 */
class WWSUAudioManager extends WWSUevents {
	/**
	 *
	 * @param {ipc} settings IPC to main process for settings
	 */
	constructor(settings) {
		super();

		this.settings = settings;

		this.inputs = new Map();
		this.outputs = new Map();

		// Create audio context
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		this.audioContext = new AudioContext();
	}

	/**
	 * Load / refresh available audio devices.
	 */
	loadDevices() {
		// Disconnect devices and reset
		if (this.inputs.size > 0) {
			this.inputs.forEach((device) => {
				device.disconnect();
			});
		}
		if (this.outputs.size > 0) {
			this.outputs.forEach((device) => {
				device.disconect();
			});
		}
		this.inputs = new Map();
		this.outputs = new Map();

		// Grab available devices
		navigator.mediaDevices.enumerateDevices().then((devices) => {
			let _devices = devices.map((device) => {
				// Input devices
				if (device.kind === "audioinput") {
					let wwsuaudio = new WWSUAudioInput(
						device,
						this.audioContext
					);
					wwsuaudio.on("audioVolume", "WWSUAudioManager", (volume) => {
						this.emitEvent("audioVolume", [device.deviceId, volume]);
					});
					wwsuaudio.on("outputNodeReady", "WWSUAudioManager", (node) => {
						// TODO
					});

					this.inputs.set(device.deviceId, wwsuaudio);

					// Output devices
				} else if (device.kind === "audiooutput") {
					// Get saved device settings or add defaults if they do not exist
					// TODO
					// let settings = this.getDeviceSettings(deviceId);
					// let wwsuaudio = new WWSUAudioOutput(device, settings);
					//this.inputs.set(device.deviceId, wwsuaudio);
				}

				return device;
			});
			this.emitEvent("devices", [_devices]);
		});
	}

	/**
	 * Change the volume of a device.
	 *
	 * @param {string} deviceId The device ID to change volume.
	 * @param {number} volume The new volume to set at (between 0 and 1);
	 */
	changeVolume(deviceId, volume) {
		let device = this.inputs.get(deviceId) || this.outputs.get(deviceId);
		if (device) {
			device.changeVolume(volume);
		}
	}
}

// Class for an audio input device.
class WWSUAudioInput extends WWSUevents {
	/**
	 * Construct the device.
	 *
	 * @param {MediaDeviceInfo} device The device
	 * @param {AudioContext} audioContext The audioContext to use for this device
	 */
	constructor(device, audioContext) {
		super();

		this.device = device;
		this.audioContext = audioContext;
		this.node;
		this.mediaStream;
		this.analyser;
		this.outputNode;

		// Create gain, and set to setting volume.
		this.gain = this.audioContext.createGain();
		this.gain.gain.setValueAtTime(
			settings.volume,
			this.audioContext.currentTime
		);

		// Add VU meter audio worklet
		this.audioContext.audioWorklet
			.addModule("assets/plugins/wwsu-audio/js/wwsu-meter.js")
			.then(() => {
				this.node = new AudioWorkletNode(this.audioContext, "wwsu-meter");
				this.node.port.onmessage = (event) => {
					let _volume = [0, 0];
					if (event.data.volume) _volume = event.data.volume;
					this.emitEvent("audioVolume", [_volume]);
				};

				// Get the device media stream
				navigator.mediaDevices
					.getUserMedia({
						audio: {
							deviceId: this.device
								? { exact: this.device.deviceId }
								: undefined,
							echoCancellation: false,
							channelCount: 2,
						},
						video: false,
					})
					.then((stream) => {
						// Set properties and make the media stream / audio analyser.
						this.mediaStream = stream;
						this.analyser = this.audioContext.createMediaStreamSource(
							this.mediaStream
						);
						this.outputNode = this.audioContext.createMediaStreamSource(
							this.mediaStream
						);

						this.outputNode.connect(this.gain);
						this.emitEvent("outputNodeReady", [this.outputNode]);

						this.analyser
							.connect(this.gain)
							.connect(this.node)
							.connect(this.audioContext.destination);
					});
			});
	}

	/**
	 * Disconnect media.
	 */
	disconnect() {
		// Reset stuff
		console.log(`Disconnecting ${this.device.deviceId}`);
		try {
			this.mediaStream.getTracks().forEach((track) => track.stop());
			this.mediaStream = undefined;
			this.analyser
				.disconnect(this.gain)
				.disconnect(this.node)
				.disconnect(this.audioContext.destination);
			this.outputNode.disconnect(this.gain);

			this.analyser = undefined;
			this.outputNode = undefined;
			this.node = undefined;
		} catch (eee) {
			// ignore errors
		}
	}

	/**
	 * Change device volume / gain.
	 *
	 * @param {number} gain New gain value
	 */
	changeVolume(gain) {
		this.gain.gain.setValueAtTime(gain, this.audioContext.currentTime);
		this.emitEvent("audioVolumeChanged", [gain]);
	}
}
