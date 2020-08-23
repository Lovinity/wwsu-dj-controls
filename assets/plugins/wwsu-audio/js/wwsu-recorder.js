/**
 * This class constructs an input audio device and uses it as an audio recorder for on-air programming.
 *
 * @requires WebAudioRecorder WebAudioRecorder.js class. Must also have the MP3 encoder loaded.
 * @requires WWSUaudio The WWSUaudio class for making an input device
 * @requires WWSUevents WWSU event emitter.
 */
class WWSUrecorder extends WWSUevents {
  /**
   * Construct the audio device.
   *
   * @param {string} workerDir Directory path to the WebAudioRecorder encoding workers
   * @param {string} device The input device to use initially.
   */
  constructor(workerDir, device) {
    super();

    this.workerDir = workerDir;
    this.device = device;
    this.encodingTitle;
    this.currentTitle;
    this.pendingTitle;
    this.recorderPending = false;

    this.audio = new WWSUaudio(this.device);
  }

  /**
   * Initialize the Web Audio Recorder.
   */
  initRecorder() {
    // Construct the recorder
    this.recorder = new WebAudioRecorder(this.audio.audioContext, {
      workerDir: this.workerDir,
      encoding: "mp3",
      options: {
        timeLimit: 60 * 60 * 3,
        mp3: {
          bitRate: 192,
        },
        bufferSize: 4096,
      },
    });

    this.recorder.onEncoderLoaded = (recorder, encoding) => {
      // Emit recorderReady when the encoder is loaded
      this.emitEvent("recorderReady", [true]);
    };

    // When recorder is finished encoding, read the blob as an arrayBuffer and emit as recorderBuffer event.
    this.recorder.onComplete = (recorder, blob) => {
      var arrayBuffer;
      var fileReader = new FileReader();
      fileReader.onload = (e) => {
        arrayBuffer = Buffer.from(new Uint8Array(e.target.result));
        this.emitEvent("recorderBuffer", [encodingTitle, arrayBuffer]);
      };
      fileReader.readAsArrayBuffer(blob);
    };
  }

  /**
   * Start a new recording
   *
   * @param {string} file File path for the new recording
   * @param {number} delay Delay starting the new recording by this many milliseconds
   */
  newRecording(file, delay = 0) {
    var _newRecording = () => {
      // Stop current recording if active
      try {
        if (this.recorder.isRecording()) {
          this.encodingTitle = this.currentTitle;
          this.recorder.finishRecording();
        }
      } catch (eee) {
        // Ignore errors
      }

      // Start new recording
      try {
        if (this.pendingTitle) {
          this.currentTitle = this.pendingTitle;
          this.recorder.startRecording();
          this.emitEvent("recorderStarted", [this.pendingTitle]);
        }
      } catch (eee) {
        // Ignore errors
      }
    };

    this.pendingTitle = file;

    // Delay if provided
    if (delay <= 0) {
      _newRecording();
    } else if (!this.recorderPending) {
      this.recorderPending = true;
      setTimeout(() => {
        _newRecording();
        this.recorderPending = false;
      }, delay);
    }
  }

  /**
   * Stop recording.
   *
   * @param {number} delay Number of milliseconds to delay until recording is stopped.
   */
  stopRecording(delay = 0) {
    var _stopRecording = () => {
      try {
          // Stop recording if not pending to start a new one
        if (this.recorder.isRecording() && (!this.recorderPending || delay <= 0)) {
          this.encodingTitle = this.currentTitle;
          this.recorder.finishRecording();
          this.emitEvent("recorderStopped", [this.encodingTitle]);
        }
      } catch (eee) {
        // ignore errors
      }
    };

    if (delay <= 0) {
      _stopRecording();
    } else {
      setTimeout(() => {
        _stopRecording();
      }, delay);
    }
  }
}
