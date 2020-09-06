/**
 * Class for managing an input audio device.
 *
 * @requires WWSUevents WWSU event emitter
 * @requires window.AudioContext Web Audio API
 * @requires navigator Browser API
 */
class WWSUaudio extends WWSUevents {
  /**
   * Construct the audio class.
   *
   * @param {string} device Set the default device ID
   */
  constructor(device) {
    super();

    // Make the AudioContext
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    this.audioContext = new AudioContext();

    // Set default properties
    this.device = device;
    this.getStream();
  }

  /**
   * Change the device for this audio input.
   *
   * @param {string} device Device ID
   */
  changeDevice(device) {
    this.device = device;
    this.emitEvent("audioDeviceChanged", [device]);
    this.getStream();
  }

  /**
   * Create an audio stream from the device.
   *
   * @param {string?} device The audio device to use. Defaults to this.device.
   */
  getStream() {
    // Get the device
    navigator.mediaDevices
      .getUserMedia({
        audio: {
          deviceId: this.device ? { exact: this.device } : undefined,
          echoCancellation: false,
          channelCount: 2,
        },
        video: false,
      })
      .then((stream) => {
        // Reset stuff
        try {
          this.audioMeter.shutdown();
          this.audioMeter = undefined;
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = undefined;
          this.analyser = undefined;
        } catch (eee) {
          // ignore errors
        }

        // Set properties and make the media stream / audio analyser.
        this.stream = stream;
        this.analyser = this.audioContext.createMediaStreamSource(stream);

        this.audioMeter = (() => {
          var processor = this.audioContext.createScriptProcessor(512);
          processor.onaudioprocess = (event) => {
            var buf = event.inputBuffer.getChannelData(0);
            var bufLength = buf.length;
            var sum = 0;
            var x;
            var clippingNow = false;
            var maxVolume = 0;

            // Do a root-mean-square on the samples: sum up the squares...
            for (var i = 0; i < bufLength; i++) {
              x = buf[i];
              if (Math.abs(x) > maxVolume) {
                maxVolume = Math.abs(x);
              }
              if (Math.abs(x) >= processor.clipLevel) {
                processor.clipping = true;
                processor.lastClip = window.performance.now();
                clippingNow = true;
              }
              sum += x * x;
            }

            if (
              !clippingNow &&
              processor.lastClip + processor.clipLag < window.performance.now()
            ) {
              processor.clipping = false;
            }

            // ... then take the square root of the sum.
            var rms = Math.sqrt(sum / bufLength);

            // Now smooth this out with the averaging factor applied
            // to the previous sample - take the max here because we
            // want "fast attack, slow release."
            processor.volume = Math.max(
              rms,
              processor.volume * processor.averaging
            );
            processor.maxVolume = Math.max(
              maxVolume,
              processor.maxVolume * processor.averaging
            );

            this.emitEvent("audioVolume", [
              processor.volume,
              processor.clipping,
              processor.maxVolume,
            ]);
          };
          
          // States
          processor.clipping = false;
          processor.lastClip = 0;
          processor.volume = 0;
          processor.maxVolume = 0;

          // Config
          processor.clipLevel = 0.98;
          processor.averaging = 0.95;
          processor.clipLag = 750;

          // this will have no effect, since we don't copy the input to the output,
          // but works around a current Chrome bug.
          processor.connect(this.audioContext.destination);

          processor.checkClipping = () => {
            if (!processor.clipping) {
              return false;
            }
            if (
              processor.lastClip + processor.clipLag <
              window.performance.now()
            ) {
              processor.clipping = false;
            }
            return processor.clipping;
          };

          processor.shutdown = () => {
            processor.disconnect();
            processor.onaudioprocess = null;
          };

          return processor;
        })();

        this.analyser.connect(this.audioMeter);
      });
  }
}
