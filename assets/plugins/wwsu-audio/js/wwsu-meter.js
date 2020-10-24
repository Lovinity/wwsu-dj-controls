// Create an Audio node and meter/processor from the audio worklet

const SMOOTHING_FACTOR = 0.94;
const MINIMUM_VALUE = 0.00001;

// This is the way to register an AudioWorkletProcessor
// it's necessary to declare a name, in this case
// the name is "vumeter"
registerProcessor(
	"wwsu-meter",
	class extends AudioWorkletProcessor {
		_volume;
		_updateIntervalInMS;
		_nextUpdateFrame;

		constructor() {
			super();
			this._volume = [0, 0];
			this._updateIntervalInMS = 250;
			this._nextUpdateFrame = this._updateIntervalInMS;
			this.port.onmessage = (event) => {
				if (event.data.updateIntervalInMS)
					this._updateIntervalInMS = event.data.updateIntervalInMS;
			};
		}

		get intervalInFrames() {
			return (this._updateIntervalInMS / 1000) * sampleRate;
		}

		process(inputs, outputs, parameters) {
			const input = inputs[0];

			// Note that the input will be down-mixed to mono; however, if no inputs are
			// connected then zero channels will be passed in.
			if (input.length > 0) {

				for (var inp in input) {
					let samples = input[inp];
					let sum = 0;
					let rms = 0;

					// Calculated the squared-sum.
					for (let i = 0; i < samples.length; ++i)
						sum += samples[i] * samples[i];

					// Calculate the RMS level and update the volume.
					rms = Math.sqrt(sum / samples.length);
					this._volume[inp] = Math.max(
						rms,
						this._volume[inp] * SMOOTHING_FACTOR
					);

					this._nextUpdateFrame -= samples.length;
				}

				// Update and sync the volume property with the main thread.
				if (this._nextUpdateFrame < 0) {
					this._nextUpdateFrame += this.intervalInFrames;
					this.port.postMessage({ volume: this._volume });
				}
			}

			return true;
		}
	}
);
