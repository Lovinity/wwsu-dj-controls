/**
 * Manager for audio devices
 */
class WWSUAudioManager {
	/**
	 *
	 * @param {ipc} settings IPC to main process for settings
	 * @param {ipc} saveSettings IPC to main process to save new settings
	 * @param {WWSUrecorder} recorder Initialized WWSU recorder
	 * @param {WWSUsilence} silence Initialized WWSU silence detection
	 * @param {WWSUremote} remote initialized WWSU remote broadcasting
	 */
	constructor(settings, saveSettings, recorder, silence, remote) {
		this.inputs = new Map();
		this.outputs = new Map();

		this.settings = settings;
		this.saveSettings = saveSettings;
		this.recorder = recorder;
		this.silence = silence;
		this.remote = remote;

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
				try {
					this.recorder.disconnect(device.outputNode);
					this.silence.disconnect(device.outputNode);
					this.remote.disconnect(device.outputNode);
				} catch (e) {

				}
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
			// Start with inputs
			devices
				.filter((device) => device.kind === "audioinput")
				.map((device) => {
					// Get saved device settings or add defaults if they do not exist
					let settings = this.getDeviceSettings(deviceId);

					let wwsuaudio = new WWSUAudioInput(
						device,
						settings,
						this.audioContext
					);
					wwsuaudio.on("audioVolumeChanged", "WWSUAudioManager", (volume) => {
						this.saveSettings(
							`audio`,
							this.settings
								.filter((_dev) => _dev.deviceId !== device.deviceId)
								.push(Object.assign(settings, { volume: volume }))
						);
					});
					wwsuaudio.on("outputNodeReady", "WWSUAudioManager", (node) => {
						if (settings.recorder) {
							this.recorder.connect(node);
						}
					});

					this.inputs.set(device.deviceId, wwsuaudio);
				});

			// Outputs
			devices
				.filter((device) => device.kind === "audiooutput")
				.map((device) => {
					// Get saved device settings or add defaults if they do not exist
					let settings = this.getDeviceSettings(deviceId);

					this.inputs.set(
						device.deviceId,
						new WWSUAudioOutput(device, settings)
					);
				});
		});
	}

	/**
	 * Get settings for specified device id, or create default settings.
	 *
	 * @param {string} deviceId webAPI device id
	 */
	getDeviceSettings(deviceId) {
		return (
			this.settings.find((sett) => sett.deviceId === deviceId) ||
			((dev) => {
				let defaults = {
					deviceId: dev,
					volume: 1,
					silence: false,
					recorder: false,
					remote: false,
					output: false,
				};
				this.saveSettings(
					`audio`,
					this.settings.filter((_dev) => _dev.deviceId !== dev).push(defaults)
				);
				return defaults;
			})(deviceId)
		);
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
		this.gain.setValueAtTime(settings.volume, this.audioContext.currentTime);

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
			this.analyser = undefined;
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
		this.gain.setValueAtTime(gain, this.audioContext.currentTime);
		this.emitEvent("audioVolumeChanged", [gain]);
	}
}
