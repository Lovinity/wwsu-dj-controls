/**
 * Manager for audio devices
 * // TODO: settings does not update as it should when they are changed; figure out another way to access settings.
 */
class WWSUAudioManager extends WWSUevents {
	/**
	 *
	 * @param {ipc} settings IPC to main process for settings
	 * @param {ipc} saveSettings IPC to main process to save new settings
	 * @param {WWSUrecorder} recorder Initialized WWSU recorder
	 * @param {WWSUsilence} silence Initialized WWSU silence detection
	 * @param {WWSUremote} remote initialized WWSU remote broadcasting
	 */
	constructor(settings, recorder, silence, remote) {
		super();

		this.inputs = new Map();
		this.outputs = new Map();

		this.settings = settings;
		this.recorder = recorder;
		this.silence = silence;
		this.remote = remote;

		// Create audio context
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		this.audioContext = new AudioContext();

		this.loadDevices();
	}

	/**
	 * Load / refresh available audio devices.
	 */
	loadDevices() {
		// Disconnect devices and reset
		if (this.inputs.size > 0) {
			this.inputs.forEach((device) => {
				device.disconnect();
				try {
					this.recorder.disconnectSource(device.outputNode);
					this.silence.disconnectSource(device.outputNode);
					this.remote.disconnectSource(device.outputNode);
				} catch (e) {}
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
				// Get saved device settings or add defaults if they do not exist
				let settings = this.getDeviceSettings(device.deviceId);
				// Input devices
				if (device.kind === "audioinput") {
					let wwsuaudio = new WWSUAudioInput(
						device,
						settings,
						this.audioContext
					);
					wwsuaudio.on("audioVolume", "WWSUAudioManager", (volume) => {
						this.emitEvent("audioVolume", [device.deviceId, volume]);
					});
					wwsuaudio.on("audioVolumeChanged", "WWSUAudioManager", (volume) => {
						let _settings = this.settings.audio.filter(
							(_dev) => _dev.deviceId !== device.deviceId
						);
						_settings.push(Object.assign(settings, { volume: volume }));
						this.settings.save(`audio`, _settings);
					});
					wwsuaudio.on("outputNodeReady", "WWSUAudioManager", (node) => {
						if (settings.recorder) {
							this.recorder.connect(node);
						}
						if (settings.silence) {
							this.silence.connect(node);
						}
						if (settings.remote) {
							this.remote.connect(node);
						}
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

				return { device: device, settings: settings };
			});
			this.emitEvent("devices", [_devices]);
		});
	}

	/**
	 * Get settings for specified device id, or create default settings.
	 *
	 * @param {string} deviceId webAPI device id
	 */
	getDeviceSettings(deviceId) {
		return (
			this.settings.audio.find((sett) => sett.deviceId === deviceId) ||
			((dev) => {
				let defaults = {
					deviceId: dev,
					volume: 1,
					silence: false,
					recorder: false,
					remote: false,
					output: false,
				};
				let _settings = this.settings.audio.filter(
					(_dev) => _dev.deviceId !== deviceId
				);
				_settings.push(defaults);
				this.settings.save(`audio`);
				return defaults;
			})(deviceId)
		);
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
	 * @param {object} settings Settings for this device
	 * @param {AudioContext} audioContext The audioContext to use for this device
	 */
	constructor(device, settings, audioContext) {
		super();

		this.device = device;
		this.settings = settings;
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
						this.analyser = this.audioContext.createMediaStreamSource(stream);
						this.outputNode = this.audioContext.createMediaStreamSource(stream);

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
