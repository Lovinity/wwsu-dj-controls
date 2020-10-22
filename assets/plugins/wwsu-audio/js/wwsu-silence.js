/**
 * This class implements the silence detection system.
 *
 * @requires WWSUaudio The WWSUaudio class for making an input device
 * @requires WWSUevents WWSU event emitter.
 */
class WWSUsilence extends WWSUevents {
	/**
	 * Construct the class.
	 */
	constructor(settings) {
		super();

		this.settings = settings;

		// Create audio context
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		this.audioContext = new AudioContext();

		// Add VU meter audio worklet
		this.audioContext.audioWorklet
			.addModule("assets/plugins/wwsu-audio/js/wwsu-meter.js")
			.then(() => {
				this.node = new AudioWorkletNode(this.audioContext, "wwsu-meter");
				this.node.port.onmessage = (event) => {
					let _volume = [0, 0];
					if (event.data.volume) {
						_volume = event.data.volume;

						// If silence detected, start delay timer, else remove it
						if (
							(_volume[0] <= this.settings.threshold ||
								_volume[1] <= this.settings.threshold) &&
							!this.timer
						) {
							this.emitEvent("silence", [true]);

							// Delay timer should trigger active silence and then keep triggering it every minute until silence no longer detected.
							this.timer = setTimeout(() => {
								this.triggered = true;
								this.emitEvent("silenceTrigger", [true]);
								this.timer = setInterval(() => {
									this.emitEvent("silenceTrigger", [true]);
								}, 60000);
							}, this.settings.delay);
						} else if (this.timer) {
							this.emitEvent("silence", [false]);
							if (this.triggered) this.emitEvent("silenceTrigger", [false]);
							this.triggered = false;
							clearInterval(this.timer);
							clearTimeout(this.timer);
							this.timer = undefined;
						}
					}
				};
			});

		this.triggered = false;

		this.timer;
	}

	/**
	 * Connect an input node to the silence detection.
	 *
	 * @param {AudioNode} node The audio node to connect
	 */
	connectSource(node) {
		node.connect(this.audioContext.destination);
	}

	/**
	 * Disconnect an input node from the silence detection.
	 *
	 * @param {AudioNode} node The audio node to disconnect
	 */
	disconnectSource(node) {
		node.disconnect(this.audioContext.destination);
    }
    
    /**
     * Change settings for silence detection
     * 
     * @param {object} settings New settings
     */
    changeSettings(settings) {
        this.settings = settings;
    }
}
