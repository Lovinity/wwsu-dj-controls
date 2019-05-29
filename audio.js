/* global moment */

window.AudioContext = window.AudioContext || window.webkitAudioContext;
var { ipcRenderer } = require('electron');
var settings = require('electron-settings');
var Sanitize = require('sanitize-filename');
const EventEmitter = require('events');

var Meta = { state: 'unknown', playing: false };

window.mainStream = undefined;
window.mainDevice = undefined;
window.mainVolume = -100;

var analyserStream2;
var recorder;
var recorderTitle;
var recorderTitle2;
var recorderDialog = false;
var silenceTimer;
var silenceState = 0;
var newRecorder = false;
var recorderPending = false;
var meterLoop = false;
var closeDialog = false;
var recordAudio;

var audioContext2 = new AudioContext();
var audioMeter;

ipcRenderer.send('audio-ready', null);

ipcRenderer.on('new-meta', (event, arg) => {
    var startRecording = null;
    var preText = ``;
    for (var key in arg) {
        if (arg.hasOwnProperty(key)) {
            if (key === 'state' && arg[key] !== Meta[key]) {
                console.log(Meta.state);
                console.log(arg[key]);
                if (arg[key] === 'live_on' || arg[key] === 'live_prerecord') {
                    startRecording = 'live';
                    preText = `${sanitize(Meta.show)}${arg[key] === 'live_prerecord' ? ` PRERECORDED` : ``}`;
                } else if (arg[key] === 'remote_on') {
                    startRecording = 'remote';
                    preText = sanitize(Meta.show);
                } else if (arg[key] === 'sports_on' || arg[key] === 'sportsremote_on') {
                    startRecording = 'sports';
                    preText = sanitize(Meta.show);
                } else if (arg[key] === `automation_on` || arg[key] === `automation_genre` || arg[key] === `automation_playlist`) {
                    startRecording = 'automation';
                    preText = sanitize(Meta.genre);
                } else if (arg[key].includes("_break") || arg[key].includes("_returning") || arg[key].includes("_halftime")) {
                    if (recordAudio) {
                        stopRecording();
                    }
                }
            }
            Meta[key] = arg[key];
        }
    }
    console.log(preText);
    console.log(startRecording);
    console.log(recordAudio);
    if (startRecording !== null) {
        if (recordAudio) {
            newRecording(`${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`);
        }
    }
});

ipcRenderer.on('audio-change-input-device', (event, arg) => {
    console.log(`Main wants us to change to audio input device ${arg}`);
    getAudioMain(arg);
});

ipcRenderer.on('audio-should-record', (event, arg) => {
    console.log(`Main wants us to record? ${arg}`);
    recordAudio = arg;
    getAudioMain();
});

ipcRenderer.on('audio-file-saved', (event, arg) => {
    console.log(`Main reports the file was saved.`);
    if (newRecorder) {
        newRecorder = false;
        recorder.destroyWorker();
    }
});

ipcRenderer.on('audio-shut-down', (event, arg) => {
    console.log(`Main wants us to shut down.`);
    if (recorder && recorder.isRecording()) {
        stopRecording(true);
    } else {
        ipcRenderer.send(`audio-nothing-to-save`, null);
    }
});

ipcRenderer.on('audio-start-new-recording', (event, arg) => {
    var startRecording = null;
    var preText = ``;
    if (Meta.state === 'live_on' || Meta.state === 'live_prerecord') {
        startRecording = 'live';
        preText = `${sanitize(Meta.show)}${Meta.state === 'live_prerecord' ? ` PRERECORDED` : ``}`;
    } else if (Meta.state === 'remote_on') {
        startRecording = 'remote';
        preText = sanitize(Meta.show);
    } else if (Meta.state === 'sports_on' || Meta.state === 'sportsremote_on') {
        startRecording = 'sports';
        preText = sanitize(Meta.show);
    } else if (Meta.state === `automation_on` || Meta.state === `automation_genre` || Meta.state === `automation_playlist`) {
        startRecording = 'automation';
        preText = sanitize(Meta.genre);
    } else if (Meta.state.includes("_break") || Meta.state.includes("_returning") || Meta.state.includes("_halftime")) {
        if (recordAudio) {
            stopRecording();
        }
    } else {
        startRecording = 'automation';
        preText = sanitize(Meta.genre);
    }
    if (startRecording !== null) {
        if (recordAudio) {
            newRecording(`${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`);
        }
    }
});

function getAudioMain(device) {
    console.log(`getting audio main`);
    navigator.mediaDevices.getUserMedia({
        "audio": {
            deviceId: device ? { exact: device } : undefined,
            echoCancellation: false,
            channelCount: 2
        },
        video: false
    })
        .then((stream) => {
            console.log(`getUserMedia initiated`);
            var restartRecorder = false;
            // Reset stuff
            try {
                audioMeter.shutdown();
                audioMeter = undefined;
                window.mainStream.getTracks().forEach(track => track.stop());
                analyserStream2 = undefined;
                window.mainStream = undefined;
            } catch (eee) {
                // ignore errors
            }

            window.mainStream = stream;
            window.mainDevice = device;
            window.mainVolume = -100;

            analyserStream2 = audioContext2.createMediaStreamSource(stream);
            audioMeter = createAudioMeter(audioContext2);
            analyserStream2.connect(audioMeter);
            audioMeter.events.on(`volume-processed`, (volume, clipping, maxVolume) => {
                // Silence detection
                if (maxVolume <= 0.1) {
                    if (silenceState === 0 || silenceState === -1) {
                        silenceState = 1;
                        silenceTimer = setTimeout(function () {
                            silenceState = 2;
                            ipcRenderer.send(`audio-silence`, true);
                        }, settings.get(`silence.time`) || 10000);
                    }
                } else {
                    if (silenceState === 2 || silenceState === -1)
                        ipcRenderer.send(`audio-silence`, false);
                    silenceState = 0;
                    clearTimeout(silenceTimer);
                }

                ipcRenderer.send(`audio-audio-info`, [maxVolume, clipping, silenceState]);
            });

            setupRecorder(analyserStream2);

            settings.set(`audio.input.main`, device);
        })
        .catch((err) => {
            console.error(err);
            ipcRenderer.send(`audio-device-input-error`, null);
        });
}

function setupRecorder(node) {
    // Stop any active recordings
    try {
        if (recorder.isRecording()) {
            recorderTitle2 = recorderTitle;
            recorder.finishRecording();
            console.log(`Finished recording`);
            newRecorder = true;
        } else {
            recorder.destroyWorker();
        }
    } catch (eee) {
        // ignore errors
    }

    // Reset the recorder
    recorder = undefined;
    recorder = new WebAudioRecorder(node, {
        workerDir: "assets/js/workers/",
        encoding: "mp3",
        options: {
            timeLimit: (60 * 60 * 3),
            mp3: {
                bitRate: 192
            },
            bufferSize: 4096
        }
    });

    recorder.onEncoderLoaded = function (recorder, encoding) {
        var startRecording = null;
        var preText = ``;
        console.log(`Encoder Loaded.`);
        if (Meta.state === 'live_on' || Meta.state === `live_prerecord`) {
            startRecording = 'live';
            preText = `${sanitize(Meta.show)}${Meta.state === `live_prerecord` ? ` PRERECORDED` : ``}`;
        } else if (Meta.state === 'remote_on') {
            startRecording = 'remote';
            preText = sanitize(Meta.show);
        } else if (Meta.state === 'sports_on' || Meta.state === 'sportsremote_on') {
            startRecording = 'sports';
            preText = sanitize(Meta.show);
        } else if (Meta.state.startsWith("automation_") && (!Meta.state.includes("_break") && !Meta.state.includes("_returning") && !Meta.state.includes("_halftime"))) {
            startRecording = 'automation';
            preText = sanitize(Meta.genre);
        }
        if (startRecording !== null) {
            if (recordAudio) {
                newRecording(`${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`, true);
            }
        }
    };

    recorder.onComplete = function (recorder, blob) {
        console.log(`Finished encoding. Saving to ${settings.get(`recorder.path`) || ``}/${recorderTitle2}`);
        var arrayBuffer;
        var fileReader = new FileReader();
        fileReader.onload = function () {
            arrayBuffer = Buffer.from(new Uint8Array(this.result));
            ipcRenderer.send(`audio-save-file`, [`${settings.get(`recorder.path`) || ``}/${recorderTitle2}`, arrayBuffer]);
        };
        fileReader.readAsArrayBuffer(blob);
    };

    recorder.onTimeout = function () {
        var startRecording = null;
        var preText = ``;
        if (Meta.state === 'live_on' || Meta.state === 'live_prerecord') {
            startRecording = 'live';
            preText = `${sanitize(Meta.show)}${Meta.state === 'live_prerecord' ? ` PRERECORDED` : ``}`;
        } else if (Meta.state === 'remote_on') {
            startRecording = 'remote';
            preText = sanitize(Meta.show);
        } else if (Meta.state === 'sports_on' || Meta.state === 'sportsremote_on') {
            startRecording = 'sports';
            preText = sanitize(Meta.show);
        } else if (Meta.state === `automation_on` || Meta.state === `automation_genre` || Meta.state === `automation_playlist`) {
            startRecording = 'automation';
            preText = sanitize(Meta.genre);
        } else if (Meta.state.includes("_break") || Meta.state.includes("_returning") || Meta.state.includes("_halftime")) {
            if (recordAudio) {
                stopRecording();
            }
        } else {
            startRecording = 'automation';
            preText = sanitize(Meta.genre);
        }
        if (startRecording !== null) {
            if (recordAudio) {
                newRecording(`${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`);
            }
        }
    }

}

function getMaxVolume(analyser, fftBins) {
    var maxVolume = -100;
    analyser.getFloatFrequencyData(fftBins);

    for (var i = 4, ii = fftBins.length; i < ii; i++) {
        if (fftBins[i] > maxVolume && fftBins[i] < 0) {
            maxVolume = fftBins[i];
        }
    }
    ;

    return maxVolume;
}

function createAudioMeter(audioContext, clipLevel, averaging, clipLag) {
    var processor = audioContext.createScriptProcessor(512);
    processor.onaudioprocess = volumeAudioProcess;
    processor.clipping = false;
    processor.lastClip = 0;
    processor.volume = 0;
    processor.maxVolume = 0;
    processor.clipLevel = clipLevel || 0.98;
    processor.averaging = averaging || 0.95;
    processor.clipLag = clipLag || 750;
    processor.events = new EventEmitter();

    // this will have no effect, since we don't copy the input to the output,
    // but works around a current Chrome bug.
    processor.connect(audioContext.destination);

    processor.checkClipping =
        function () {
            if (!this.clipping)
                return false;
            if ((this.lastClip + this.clipLag) < window.performance.now())
                this.clipping = false;
            return this.clipping;
        };

    processor.shutdown =
        function () {
            this.disconnect();
            this.onaudioprocess = null;
        };

    return processor;
}

function volumeAudioProcess(event) {
    var buf = event.inputBuffer.getChannelData(0);
    var bufLength = buf.length;
    var sum = 0;
    var x;
    var clippingNow = false;
    var maxVolume = 0;

    // Do a root-mean-square on the samples: sum up the squares...
    for (var i = 0; i < bufLength; i++) {
        x = buf[i];
        if (Math.abs(x) > maxVolume)
            maxVolume = Math.abs(x);
        if (Math.abs(x) >= this.clipLevel) {
            this.clipping = true;
            this.lastClip = window.performance.now();
            clippingNow = true;
        }
        sum += x * x;
    }

    if (!clippingNow && (this.lastClip + this.clipLag) < window.performance.now())
        this.clipping = false;

    // ... then take the square root of the sum.
    var rms = Math.sqrt(sum / bufLength);

    // Now smooth this out with the averaging factor applied
    // to the previous sample - take the max here because we
    // want "fast attack, slow release."
    this.volume = Math.max(rms, this.volume * this.averaging);
    this.maxVolume = Math.max(maxVolume, this.maxVolume * this.averaging);

    this.events.emit(`volume-processed`, this.volume, this.clipping, this.maxVolume);
}

function sanitize(str) {
    if (!str)
        return ``;
    str = Sanitize(str);
    str = str.replace(` - `, `_SPLITTERDJSHOW_`);
    str = str.replace('-', '_');
    str = str.replace('/', '_');
    str = str.replace(`\\`, '_');
    str = str.replace(`_SPLITTERDJSHOW_`, ` - `);
    return str;
}

function getRecordingPath() {
    if (Meta.state.startsWith("automation_"))
        return `automation/${sanitize(Meta.genre)} (${moment().format("YYYY_MM_DD hh_mm_ss")})`;
    if (Meta.state === "live_on")
        return `live/${sanitize(Meta.show)} (${moment().format("YYYY_MM_DD hh_mm_ss")})`;
    if (Meta.state === "live_prerecord")
        return `live/${sanitize(Meta.show)} (prerecorded) (${moment().format("YYYY_MM_DD hh_mm_ss")})`;
    if (Meta.state === "remote_on")
        return `remote/${sanitize(Meta.show)} (${moment().format("YYYY_MM_DD hh_mm_ss")})`;
    if (Meta.state === "sportsremote_on" || Meta.state === "sports_on")
        return `sports/${sanitize(Meta.show)} (${moment().format("YYYY_MM_DD hh_mm_ss")})`;
    return undefined;
}

function newRecording(filename, forced = false) {
    var _newRecording = () => {
        recorderTitle = filename;
        try {
            if (recorder.isRecording()) {
                recorder.finishRecording();
                console.log(`Finished recording`);
            }
        } catch (eee) {
            // ignore errors
        }
        try {
            if (recorderTitle) {
                recorder.startRecording();
                console.log(`Started recording at ${recorderTitle}`);
            }
        } catch (eee) {
            // ignore errors
        }
    };

    recorderTitle2 = recorderTitle;
    if (forced) {
        _newRecording();
    } else if (!recorderPending) {
        console.log(`Making new recording after delay`);
        recorderPending = true;
        setTimeout(function () {
            _newRecording();
            recorderPending = false;
        }, settings.get(`recorder.delay`) || 1);
    }
}

function stopRecording(forced = false) {
    var _stopRecording = () => {
        try {
            if (recorder.isRecording()) {
                recorder.finishRecording();
                console.log(`Finished recording`);
            }
        } catch (eee) {
            // ignore errors
        }
    };

    recorderTitle2 = recorderTitle;
    if (forced) {
        _stopRecording();
    } else {
        console.log(`Finishing recording after delay`);
        setTimeout(function () {
            _stopRecording();
        }, settings.get(`recorder.delay`) || 1);
    }
}