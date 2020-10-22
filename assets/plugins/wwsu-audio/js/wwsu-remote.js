/**
 * This class implements remote broadcasting.
 *
 * @requires WWSUaudio The WWSUaudio class for making an input device
 * @requires WWSUevents WWSU event emitter.
 * @requires skywayjs The peer-to-peer system for audio calling.
 */
class WWSUremote extends WWSUevents {
	constructor(settings) {
		super();

        this.settings = settings;
        
        this.peer;

		// Create audio context and destination
		window.AudioContext = window.AudioContext || window.webkitAudioContext;
		this.audioContext = new AudioContext();
		this.destination = this.audioContext.createMediaStreamDestination();

		// Create compressor; necessary for VOIP calls to help prevent digital clipping
		this.compressor = this.audioContext.createDynamicsCompressor();
		this.compressor.threshold.setValueAtTime(
			-18.0,
			this.audioContext.currentTime
		);
		this.compressor.knee.setValueAtTime(18.0, this.audioContext.currentTime);
		this.compressor.ratio.setValueAtTime(4.0, this.audioContext.currentTime);
		this.compressor.attack.setValueAtTime(0.01, this.audioContext.currentTime);
		this.compressor.release.setValueAtTime(0.05, this.audioContext.currentTime);

		this.compressor.connect(this.audioContext.destination);
	}

	/**
	 * Connect an input node to the remote broadcast compressor.
	 *
	 * @param {AudioNode} node The audio node to connect
	 */
	connectSource(node) {
		node.connect(this.compressor);
	}

	/**
	 * Disconnect an input node from the remote broadcast compressor.
	 *
	 * @param {AudioNode} node The audio node to disconnect
	 */
	disconnectSource(node) {
		node.disconnect(this.compressor);
	}

	/**
	 * Change settings for remote broadcast
	 *
	 * @param {object} settings New settings
	 */
	changeSettings(settings) {
		this.settings = settings;
	}
}
