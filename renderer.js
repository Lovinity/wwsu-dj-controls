/* global iziToast, io, moment, Infinity, err, ProgressBar, Taucharts, response, responsiveVoice, jdenticon, SIP, brutusin */

try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    var development = true;

    // Define hexrgb constants
    var hexChars = 'a-f\\d';
    var match3or4Hex = `#?[${hexChars}]{3}[${hexChars}]?`;
    var match6or8Hex = `#?[${hexChars}]{6}([${hexChars}]{2})?`;

    var nonHexChars = new RegExp(`[^#${hexChars}]`, 'gi');
    var validHexSize = new RegExp(`^${match3or4Hex}$|^${match6or8Hex}$`, 'i');

    // Define constants
    var fs = require("fs"); // file system
    var main = require('electron').remote.require('./main');
    const {remote} = window.require('electron');
    var notifier = require('./electron-notifications/index.js');
    var Sanitize = require("sanitize-filename");
    var settings = require('electron-settings');
    var {webFrame} = require('electron');

    // Define data variables
    var Meta = {time: moment().toISOString(), lastID: moment().toISOString(), state: 'unknown', line1: '', line2: '', queueFinish: null, trackFinish: null};
    var Calendar = TAFFY();
    var Discipline = TAFFY();
    var Status = TAFFY();
    var Messages = TAFFY();
    var Announcements = TAFFY();
    var Eas = TAFFY();
    var Recipients = TAFFY();
    var Directors = TAFFY();
    var Requests = TAFFY();
    var Logs = TAFFY();
    var Djs = TAFFY();
    var Hosts = TAFFY();
    var Config = {};
    var DJData = {};
    var Timesheets = [];
    var Notifications = [];

    // Define peerJS and stream variables. These will be set after getting information about this host's settings.
    var peer;
    window.peerStream = undefined;
    window.peerDevice = undefined;
    window.peerHost = undefined;
    window.mainStream = undefined;
    window.mainDevice = undefined;
    window.peerVolume = -100;
    window.mainVolume = -100;
    var outgoingPeer;
    var outgoingCall;
    var incomingCall;
    var incomingCloseIgnore = false;
    var outgoingCloseIgnore = false;
    var tryingCall;
    var waitingFor;
    var analyserStream;
    var analyserStream2;
    var callTimer;
    var callTimerSlot;
    var callDropTimer;
    var recorder;
    var recorderTitle;
    var recorderTitle2;
    var recorderDialog = false;
    var silenceTimer;
    var silenceState = 0;
    var newRecorder = false;
    var recorderPending = false;
    var meterLoop = false;

    var audioContext = new AudioContext();
    var gain = audioContext.createGain();
    gain.gain.value = 1;
    var analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.1;
    var fftBins = new Float32Array(analyser.frequencyBinCount);

    var audioContext2 = new AudioContext();
    var analyser2 = audioContext2.createAnalyser();
    analyser2.fftSize = 512;
    analyser2.smoothingTimeConstant = 0.1;
    var fftBins2 = new Float32Array(analyser2.frequencyBinCount);

    var meterLooper = function () {
        try {
            var temp = getMaxVolume(analyser, fftBins);
            var temp2 = getMaxVolume(analyser2, fftBins2);

            if (temp > window.peerVolume)
            {
                window.peerVolume = temp;
            } else {
                window.peerVolume -= ((window.peerVolume - temp) / 16);
            }

            if (temp2 > window.mainVolume)
            {
                window.mainVolume = temp2;
            } else {
                window.mainVolume -= ((window.mainVolume - temp2) / 16);
            }

            // Silence detection
            if (client.silenceDetection && window.mainVolume <= -49)
            {
                if (silenceState === 0 || silenceState === -1)
                {
                    silenceState = 1;
                    silenceTimer = setTimeout(function () {
                        silenceState = 2;
                        hostReq.request({method: 'POST', url: '/silence/active', data: {}}, function (body) {});
                    }, settings.get(`silence.time`) || 10000);
                }
            } else {
                if (silenceState === 2 || silenceState === -1)
                    hostReq.request({method: 'POST', url: '/silence/inactive', data: {}}, function (body) {});
                silenceState = 0;
                clearTimeout(silenceTimer);
            }

            // Gain control. Immediately decrease gain when above -25dB. Slowly increase gain if volume is less than -30dB.
            if (window.peerVolume > -25)
            {
                var gain1 = -50 - ((-50 - window.peerVolume) / gain.gain.value);
                var diffVolume = gain1 - window.peerVolume;
                var diffGain = gain.gain.value - 1;

                var changeVolume = -25 - window.peerVolume;

                var proportion = diffVolume / changeVolume;
                var adjustGain = diffGain / proportion;

                gain.gain.value = gain.gain.value - adjustGain;
            } else if (window.peerVolume < -30) {
                var proportion = window.peerVolume / -25;
                var adjustGain = (gain.gain.value / proportion) / 32;
                gain.gain.value += adjustGain;
                if (gain.gain.value > 3)
                    gain.gain.value = 3;
            }

            var temp = document.querySelector(`#remote-vu`);
            var temp2 = document.querySelector(`#sportsremote-vu`);
            var temp3 = document.querySelector(`#call-vu`);
            var temp4 = document.querySelector(`#main-vu`);

            if (temp !== null)
            {
                temp.style.width = `${window.peerVolume > -50 ? ((window.peerVolume + 50) * 4) : 0}%`;

                // check if we're currently clipping
                if (window.peerVolume > -25)
                    temp.className = "progress-bar bg-danger";
                else
                    temp.className = "progress-bar bg-success";
            }

            if (temp2 !== null)
            {
                temp2.style.width = `${window.peerVolume > -50 ? ((window.peerVolume + 50) * 4) : 0}%`;

                // check if we're currently clipping
                if (window.peerVolume > -25)
                    temp2.className = "progress-bar bg-danger";
                else
                    temp2.className = "progress-bar bg-success";
            }

            if (temp3 !== null)
            {
                temp3.style.width = `${window.peerVolume > -50 ? ((window.peerVolume + 50) * 4) : 0}%`;

                // check if we're currently clipping
                if (window.peerVolume > -25)
                    temp3.className = "progress-bar bg-danger";
                else
                    temp3.className = "progress-bar bg-success";
            }

            if (temp4 !== null)
            {
                temp4.style.width = `${window.mainVolume > -50 ? ((window.mainVolume + 50) * 4) : 0}%`;

                // check if we're currently clipping
                if (window.mainVolume > -25)
                    temp4.className = "progress-bar bg-danger";
                else
                    temp4.className = "progress-bar bg-success";
            }

            if (typeof outgoingCall !== 'undefined')
            {
                var temp5 = document.querySelector(`#audio-call-icon`);
                if (temp5 !== null)
                {
                    var percent = window.peerVolume > -50 ? ((window.peerVolume + 50) * 4) : 0;
                    temp5.style.color = `rgb(0, ${percent < 100 ? parseInt(percent + 155) : 255}, 0)`;
                }
            } else if (typeof waitingFor !== 'undefined') {
                var temp5 = document.querySelector(`#audio-call-icon`);
                if (temp5 !== null)
                    temp5.style.color = `rgb(255, 0, 0)`;
            } else if (typeof tryingCall !== 'undefined') {
                var temp5 = document.querySelector(`#audio-call-icon`);
                if (temp5 !== null)
                    temp5.style.color = `rgb(255, 255, 0)`;
            } else if (typeof incomingCall !== 'undefined') {
                var temp5 = document.querySelector(`#audio-call-icon`);
                if (temp5 !== null)
                    temp5.style.color = `rgb(0, 0, 255)`;
            } else {
                var temp5 = document.querySelector(`#audio-call-icon`);
                if (temp5 !== null)
                {
                    if (silenceState === 2)
                        temp5.style.color = `rgb(128, 0, 0)`;
                    if (silenceState === 1)
                        temp5.style.color = `rgb(128, 128, 0)`;
                    if (silenceState === 0)
                        temp5.style.color = `rgb(16, 16, 16)`;
                }
            }
            meterLoop = false;

        } catch (eee) {
            // ignore errors
            console.error(eee);
        }
    };

    setInterval(() => {
        if (!meterLoop)
        {
            meterLoop = true;
            meterLooper();
        }
    }, 1000 / 50);

    var processor;


    // Define a function that finishes any recordings when DJ Controls is closed
    window.onbeforeunload = function (e) {
        if (recorder && recorder.isRecording())
        {
            iziToast.show({
                titleColor: '#000000',
                messageColor: '#000000',
                color: 'red',
                close: false,
                overlay: true,
                overlayColor: 'rgba(0, 0, 0, 0.75)',
                zindex: 99999,
                layout: 1,
                imageWidth: 100,
                image: ``,
                maxWidth: 480,
                progressBarColor: `rgba(255, 0, 0, 0.5)`,
                closeOnClick: false,
                position: 'center',
                timeout: false,
                title: 'Recording in progress!',
                message: `An audio recording is currently in progress. DJ Controls cannot be exited until the audio recording ends. Do you want to end it now?`,
                buttons: [
                    ['<button><b>Finish Recording</b></button>', function (instance, toast) {
                            instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                            recorderDialog = true;
                            stopRecording(true);
                        }, true],
                    ['<button><b>Cancel</b></button>', function (instance, toast) {
                            instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                        }]
                ]
            });
            return false;
        }
    }

    function setupPeer() {
        try {
            peer.destroy();
            peer = undefined;
        } catch (ee) {
            // Ignore errors
        }

        /*
         peer = new Peer({key: `Peer4WWSU`, host: `server.wwsu1069.org`, path: '/webcaster', secure: true, debug: 3, config: {'iceServers': [{
         urls: 'turn:numb.viagenie.ca',
         credential: 'WineDine1069',
         username: 'engineer@wwsu1069.org'}]}});
         */

        // Currently, the WWSU peer-server does not support socket heart beat, and so disconnects after a minute.

        peer = new Peer({debug: 3, config: {'iceServers': [{
                        urls: 'turn:numb.viagenie.ca',
                        credential: 'WineDine1069',
                        username: 'engineer@wwsu1069.org'}]}});

        peer.on('open', (id) => {
            console.log(`peer opened with id ${id}`);
            // Update database with the peer ID
            hostReq.request({method: 'POST', url: '/recipients/register-peer', data: {peer: id}}, function (body) {
                if (tryingCall && tryingCall.host && tryingCall.cb)
                {
                    startCall(tryingCall.host, tryingCall.cb)
                }
                /*
                 getAudio(
                 function (MediaStream) {
                 console.log('now calling');
                 var call = peer.call(`wwsu-1`, MediaStream);
                 call.on('stream', onReceiveStream);
                 }
                 );
                 */
            });
        });

        peer.on('error', (err) => {
            console.error(err);
            if (err.type === `peer-unavailable`)
            {
                $("#connecting-modal").iziModal('close');

                if (document.querySelector(`.peerjs-waiting`) !== null)
                    iziToast.hide({}, document.querySelector(`.peerjs-waiting`));

                iziToast.show({
                    class: `peerjs-waiting`,
                    titleColor: '#000000',
                    messageColor: '#000000',
                    color: 'red',
                    close: false,
                    overlay: true,
                    overlayColor: 'rgba(0, 0, 0, 0.75)',
                    zindex: 1000,
                    layout: 1,
                    imageWidth: 100,
                    image: ``,
                    maxWidth: 480,
                    progressBarColor: `rgba(255, 0, 0, 0.5)`,
                    closeOnClick: false,
                    position: 'center',
                    timeout: false,
                    title: 'Error establishing audio call',
                    message: `${tryingCall.friendlyname} is not available at this time. I will wait for the host to report online and then start the broadcast. If you wish to cancel this, please click "cancel".`,
                    buttons: [
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                waitingFor = undefined;
                                tryingCall = undefined;
                            }]
                    ]
                });
                try {
                    waitingFor = tryingCall;
                    clearInterval(callTimer);
                    outgoingCloseIgnore = true;
                    console.log(`Closing call via peer-unavailable`);
                    outgoingCall.close();
                    outgoingCall = undefined;
                    outgoingCloseIgnore = false;
                } catch (ee) {
                    outgoingCloseIgnore = false;
                }
            }
        });

        peer.on(`disconnected`, () => {
            setTimeout(() => {
                if (peer && !peer.destroyed)
                {
                    peer.reconnect();
                } else {
                    setupPeer();
                }
            }, 2000);
        });

        peer.on('close', () => {
            console.log(`Peer destroyed.`);
            try {
                peer = undefined;
                hostReq.request({method: 'POST', url: '/recipients/register-peer', data: {peer: null}}, function (body) {});
            } catch (ee) {

            }
            setTimeout(() => {
                if (!peer || peer.destroyed)
                    setupPeer();
            }, 5000);
        });

        peer.on('call', (connection) => {
            console.log(`Incoming call from ${connection.peer}`);
            if (client.answerCalls)
            {
                console.log(`Allowed to answer. Checking hosts.`);
                try {
                    var recipient = Recipients({peer: connection.peer}).first();
                } catch (e) {
                    console.log(`The peer ${connection.peer} does not appear in the list of recipients. Not answering the call.`);
                }
                if (recipient && Hosts({host: recipient.host, authorized: true, makeCalls: true}).get().length >= 0)
                {
                    console.log(`Peer ${connection.peer} is authorized. Answering call...`);
                    try {
                        // Close any other active incoming calls
                        incomingCloseIgnore = true;
                        console.log(`Call ended via peer.on call`);
                        incomingCall.close();
                        incomingCall = undefined;
                        incomingCloseIgnore = false;
                    } catch (ee) {
                        incomingCloseIgnore = false;
                        // Ignore errors
                    }
                    incomingCall = connection;
                    incomingCall.answer();
                    clearTimeout(callDropTimer);
                    incomingCall.on('stream', onReceiveStream);
                    incomingCall.on(`close`, () => {
                        console.log(`CALL CLOSED.`);
                        incomingCall = undefined;

                        if (!incomingCloseIgnore)
                        {
                            console.log(`Not ignoring!`);
                            var callDropFn = () => {
                                if (Meta.state === 'sportsremote_on' || Meta.state === 'remote_on')
                                {
                                    goBreak(false);
                                } else if (Meta.state === 'automation_sportsremote' || Meta.state === 'automation_remote' || Meta.state === "sportsremote_returning" || Meta.state === "remote_returning")
                                {
                                    callDropTimer = setTimeout(() => {
                                        callDropFn();
                                    }, 5000);
                                }
                            };

                            callDropTimer = setTimeout(() => {
                                callDropFn();
                            }, 15000);
                        }

                        incomingCloseIgnore = false;
                    });
                } else {
                    console.log(`Peer ${connection.peer} is NOT authorized. Ignoring call.`);
                }
            }
        });
    }

    function startCall(hostID, cb, reconnect = false) {
        var callFailed = (me) => {
            try {
                outgoingCloseIgnore = true;
                console.log(`Closing call via startCall call failed`);
                outgoingCall.close();
                outgoingCall = undefined;
                outgoingCloseIgnore = false;
                cb(false);
            } catch (eee) {
                outgoingCloseIgnore = false;
                // ignore errors
            }

            clearInterval(callTimer);

            if (!reconnect)
            {
                $("#connecting-modal").iziModal('close');
                iziToast.show({
                    titleColor: '#000000',
                    messageColor: '#000000',
                    color: 'red',
                    close: true,
                    overlay: false,
                    overlayColor: 'rgba(0, 0, 0, 0.75)',
                    zindex: 100,
                    layout: 1,
                    imageWidth: 100,
                    image: ``,
                    progressBarColor: `rgba(255, 0, 0, 0.5)`,
                    closeOnClick: true,
                    position: 'center',
                    timeout: 30000,
                    title: 'Call not answered',
                    message: `The host you were trying to call did not answer. Please try again later.`
                });
            } else {
                waitingFor = {host: hostID, cb: cb};

                $("#connecting-modal").iziModal('close');
                var notification = notifier.notify('Lost Audio Call', {
                    message: `Please check DJ Controls for more information.`,
                    icon: 'http://pluspng.com/img-png/stop-png-hd-stop-sign-clipart-png-clipart-2400.png',
                    duration: 900000,
                });
                main.flashTaskbar();

                if (document.querySelector(`.peerjs-waiting`) !== null)
                    iziToast.hide({}, document.querySelector(`.peerjs-waiting`));

                iziToast.show({
                    id: `peerjs-waiting`,
                    titleColor: '#000000',
                    messageColor: '#000000',
                    color: 'red',
                    close: false,
                    overlay: true,
                    overlayColor: 'rgba(0, 0, 0, 0.75)',
                    zindex: 1000,
                    layout: 1,
                    imageWidth: 100,
                    image: ``,
                    maxWidth: 480,
                    progressBarColor: `rgba(255, 0, 0, 0.5)`,
                    closeOnClick: false,
                    position: 'center',
                    timeout: false,
                    title: 'Lost Audio Call',
                    message: `The audio call with ${tryingCall.friendlyname} was dropped. I tried sending you to break. I will wait until both you and the other DJ Controls is back online, and then try the call again. Click "cancel" to abort; clicking cancel will end the broadcast.`,
                    buttons: [
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                waitingFor = undefined;
                                tryingCall = undefined;
                                endShow();
                            }]
                    ]
                });

                if (!disconnected)
                    goBreak(false);
            }
        };

        try {
            var host = Hosts({host: hostID}).first();
        } catch (e) {
            console.log(`INVALID HOST`);
            callFailed(false);
        }

        console.log(`Trying to call ${host.friendlyname}`);

        tryingCall = {host: hostID, cb: cb, friendlyname: host.friendlyname};

        if (!reconnect)
            $("#connecting-modal").iziModal('open');

        try {
            var peerID = Recipients({host: host.host}).first().peer;
            if (peerID === null)
                callFailed(false);
        } catch (e) {
            callFailed(false);
        }

        try {
            // Terminate any existing outgoing calls first
            waitingFor = undefined;
            outgoingCloseIgnore = true;
            console.log(`Closing call via startCall`);
            outgoingCall.close();
            outgoingCall = undefined;
            outgoingCloseIgnore = false;
            clearInterval(callTimer);
        } catch (ee) {
            outgoingCloseIgnore = false;
            // Ignore errors
        }

        window.peerHost = hostID;
        outgoingCall = peer.call(peerID, window.peerStream);

        callTimerSlot = 15;

        callTimer = setInterval(() => {
            callTimerSlot -= 1;
            console.dir(outgoingCall);

            if (outgoingCall && outgoingCall.open)
            {
                clearInterval(callTimer);
                $("#connecting-modal").iziModal('close');

                tryingCall = undefined;

                if (document.querySelector(`.peerjs-waiting`) !== null)
                    iziToast.hide({}, document.querySelector(`.peerjs-waiting`));

                if (reconnect)
                {
                    iziToast.show({
                        titleColor: '#000000',
                        messageColor: '#000000',
                        color: 'green',
                        close: true,
                        overlay: false,
                        overlayColor: 'rgba(0, 0, 0, 0.75)',
                        zindex: 1000,
                        layout: 1,
                        imageWidth: 100,
                        image: ``,
                        progressBarColor: `rgba(255, 0, 0, 0.5)`,
                        closeOnClick: true,
                        position: 'center',
                        timeout: 10000,
                        title: 'Audio Call Re-Established',
                        message: `The audio call was re-established.`
                    });
                }

                outgoingCall.on(`close`, () => {
                    console.log(`CALL CLOSED.`);
                    // Premature close if we are still in remote or sportsremote state. Try to reconnect.
                    outgoingCall = undefined;

                    if (!outgoingCloseIgnore)
                    {
                        console.log(`Not ignoring!`);
                        if (Meta.state.startsWith(`remote_`) || Meta.state.startsWith(`sportsremote_`) || Meta.state === `automation_remote` || Meta.state === `automation_sportsremote`)
                        {
                            console.log(`Reconnecting...`);
                            startCall(host.host, (success) => {
                                if (success)
                                {
                                    console.log(`re-connected`);
                                }
                            }, true);
                        }
                    }
                    outgoingCloseIgnore = false;
                });

                cb(true);
            } else {
                if (callTimerSlot <= 1)
                {
                    callFailed(true);
                }
            }
        }, 1000);
    }

    function getAudio(device) {
        console.log(`getting audio`);
        navigator.mediaDevices.getUserMedia({
            "audio": {
                deviceId: device ? {exact: device} : undefined,
                echoCancellation: false,
                AutoGainControl: true,
                noiseSuppression: false,
                channelCount: 2
            },
            video: false
        })
                .then((stream) => {
                    console.log(`getUserMedia initiated`);

                    // Reset stuff
                    try {
                        gain.disconnect(analyser);
                        analyserStream.disconnect(gain);

                        window.peerStream.getTracks().forEach(track => track.stop());
                    } catch (eee) {
                        // ignore errors
                    }

                    gain.gain.value = 1;
                    window.peerStream = stream;
                    window.peerDevice = device;
                    window.peerVolume = -100;

                    analyserStream = audioContext.createMediaStreamSource(stream);
                    analyserStream.connect(gain);
                    gain.connect(analyser);
                })
                .catch((err) => {
                    iziToast.show({
                        titleColor: '#000000',
                        messageColor: '#000000',
                        color: 'red',
                        close: true,
                        overlay: false,
                        overlayColor: 'rgba(0, 0, 0, 0.75)',
                        zindex: 100,
                        layout: 1,
                        imageWidth: 100,
                        image: ``,
                        progressBarColor: `rgba(255, 0, 0, 0.5)`,
                        closeOnClick: true,
                        position: 'center',
                        timeout: 10000,
                        title: 'Audio Error',
                        message: `Error trying to load that audio device. Please choose another device instead.`
                    });
                })
    }

    function setupRecorder(node) {
        // Stop any active recordings
        try {
            if (recorder.isRecording())
            {
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
            if (Meta.state === 'live_on' || Meta.state === `live_prerecord`)
            {
                startRecording = 'live';
                preText = `${sanitize(Meta.show)}${Meta.state === `live_prerecord` ? ` PRERECORDED` : ``}`;
            } else if (Meta.state === 'remote_on')
            {
                startRecording = 'remote';
                preText = sanitize(Meta.show);
            } else if (Meta.state === 'sports_on' || Meta.state === 'sportsremote_on')
            {
                startRecording = 'sports';
                preText = sanitize(Meta.show);
            } else if (Meta.state.startsWith("automation_") && (!Meta.state.includes("_break") && !Meta.state.includes("_returning") && !Meta.state.includes("_halftime")))
            {
                startRecording = 'automation';
                preText = sanitize(Meta.genre);
            }
            if (startRecording !== null) {
                if (!development && client.recordAudio)
                {
                    newRecording(`${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`, true);
                    hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'recorder', logsubtype: 'automation', loglevel: 'info', event: `A recording was started.<br />Path: ${settings.get(`recorder.path`)}/${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
                    });
                }
            }
        }

        recorder.onComplete = function (recorder, blob) {
            var fileReader = new FileReader();
            fileReader.onload = function () {
                fs.writeFileSync(`${settings.get(`recorder.path`) || ``}/${recorderTitle2}`, Buffer.from(new Uint8Array(this.result)));
            };
            fileReader.readAsArrayBuffer(blob);

            if (recorderDialog)
            {
                iziToast.show({
                    titleColor: '#000000',
                    messageColor: '#000000',
                    color: 'green',
                    close: true,
                    overlay: true,
                    overlayColor: 'rgba(0, 0, 0, 0.75)',
                    zindex: 100,
                    layout: 1,
                    imageWidth: 100,
                    image: ``,
                    progressBarColor: `rgba(255, 0, 0, 0.5)`,
                    closeOnClick: true,
                    position: 'center',
                    timeout: 30000,
                    maxWidth: 480,
                    title: 'Recording finished',
                    message: `Recording was finished and saved. You may now quit DJ Controls.`
                });
                recorderDialog = false;
            }

            if (newRecorder)
            {
                newRecorder = false;
                recorder.destroyWorker();
            }
        }

    }

    function getAudioMain(device) {
        console.log(`getting audio main`);
        navigator.mediaDevices.getUserMedia({
            "audio": {
                deviceId: device ? {exact: device} : undefined,
                echoCancellation: false,
                AutoGainControl: true,
                noiseSuppression: false,
                channelCount: 2
            },
            video: false
        })
                .then((stream) => {
                    console.log(`getUserMedia initiated`);
                    var restartRecorder = false;
                    // Reset stuff
                    try {
                        analyserStream2.disconnect(analyser2);
                        window.mainStream.getTracks().forEach(track => track.stop());
                    } catch (eee) {
                        // ignore errors
                    }

                    window.mainStream = stream;
                    window.mainDevice = device;
                    window.mainVolume = -100;

                    analyserStream2 = audioContext2.createMediaStreamSource(stream);
                    analyserStream2.connect(analyser2);

                    setupRecorder(analyserStream2);

                    settings.set(`audio.input.main`, device);
                })
                .catch((err) => {
                    if (client.silenceDetection || client.recordAudio)
                    {
                        iziToast.show({
                            titleColor: '#000000',
                            messageColor: '#000000',
                            color: 'red',
                            close: true,
                            overlay: true,
                            overlayColor: 'rgba(0, 0, 0, 0.75)',
                            zindex: 100,
                            layout: 1,
                            imageWidth: 100,
                            image: ``,
                            progressBarColor: `rgba(255, 0, 0, 0.5)`,
                            closeOnClick: true,
                            position: 'center',
                            timeout: false,
                            maxWidth: 480,
                            title: 'Audio Error',
                            message: `There was an error trying to load the main input device for silence detection / recording. Please check your settings. Silence detection and audio recording will not work until this is fixed.`
                        });
                    }
                })
    }

    function sinkAudio(device)
    {
        var temp = document.querySelector(`#remoteAudio`);
        if (temp !== null)
        {
            if (typeof device !== 'undefined')
            {
                temp.setSinkId(device)
                        .then(() => {
                            settings.set(`audio.output.call`, device);
                        })
                        .catch((err) => {
                            if (client.receiveCalls)
                            {
                                iziToast.show({
                                    titleColor: '#000000',
                                    messageColor: '#000000',
                                    color: 'red',
                                    close: true,
                                    overlay: true,
                                    overlayColor: 'rgba(0, 0, 0, 0.75)',
                                    zindex: 100,
                                    layout: 1,
                                    imageWidth: 100,
                                    image: ``,
                                    progressBarColor: `rgba(255, 0, 0, 0.5)`,
                                    closeOnClick: true,
                                    position: 'center',
                                    timeout: false,
                                    maxWidth: 480,
                                    title: 'Audio Error',
                                    message: `There was an error trying to load the main output device. Please check your settings. Receiving audio calls will not work until this is fixed.`
                                });
                            }
                        })
            } else {
                temp.setSinkId(settings.get(`audio.output.call`))
                        .catch((err) => {
                            if (client.receiveCalls)
                            {
                                iziToast.show({
                                    titleColor: '#000000',
                                    messageColor: '#000000',
                                    color: 'red',
                                    close: true,
                                    overlay: true,
                                    overlayColor: 'rgba(0, 0, 0, 0.75)',
                                    zindex: 100,
                                    layout: 1,
                                    imageWidth: 100,
                                    image: ``,
                                    progressBarColor: `rgba(255, 0, 0, 0.5)`,
                                    closeOnClick: true,
                                    position: 'center',
                                    timeout: false,
                                    maxWidth: 480,
                                    title: 'Audio Error',
                                    message: `There was an error trying to load the main output device. Please check your settings. Receiving audio calls will not work until this is fixed.`
                                });
                            }
                        })
            }
        }
    }

    function onReceiveStream(stream) {
        console.log(`received stream`);
        var audio = document.querySelector('#remoteAudio');
        audio.srcObject = stream;
        audio.load();
        audio.oncanplay = function (e) {
            console.log('now playing the audio');
            audio.play();
        }
    }

    function getMaxVolume(analyser, fftBins) {
        var maxVolume = -50;
        analyser.getFloatFrequencyData(fftBins);

        for (var i = 4, ii = fftBins.length; i < ii; i++) {
            if (fftBins[i] > maxVolume && fftBins[i] < 0) {
                maxVolume = fftBins[i];
            }
        }
        ;

        return maxVolume;
    }

    function createAudioMeter(ac) {
        var analyser = ac.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.1;

        var terminate = false;

        analyser.destroy = () => {
            terminate = true;
        };

        var fftBins = new Float32Array(analyser.frequencyBinCount);

        meterLooper = function () {
            var temp = getMaxVolume(analyser, fftBins);

            if (temp > window.peerVolume)
            {
                window.peerVolume = temp;
            } else {
                window.peerVolume -= ((window.peerVolume - temp) / 8);
            }

            console.log(window.peerVolume);

            var temp = document.querySelector(`#remote-vu`);
            var temp2 = document.querySelector(`#sportsremote-vu`);

            if (temp !== null)
            {
                temp.style.width = `${window.peerVolume > -50 ? ((window.peerVolume + 50) * 4) : 0}%`;

                // check if we're currently clipping
                if (window.peerVolume > -25)
                    temp.className = "progress-bar bg-danger";
                else
                    temp.className = "progress-bar bg-success";
            }

            if (temp2 !== null)
            {
                temp2.style.width = `${window.peerVolume > -50 ? ((window.peerVolume + 50) * 4) : 0}%`;

                // check if we're currently clipping
                if (window.peerVolume > -25)
                    temp2.className = "progress-bar bg-danger";
                else
                    temp2.className = "progress-bar bg-success";
            }

            if (!terminate)
            {
                window.requestAnimationFrame(() => {
                    meterLooper();
                });
            }
        };

        window.requestAnimationFrame(() => {
            meterLooper();
        });

        return analyser;
    }


    // Define other variables
    var nodeURL = 'https://server.wwsu1069.org';
    //var nodeURL = 'http://localhost:1337';
    var recordPadPath = "C:\\Program Files (x86)\\NCH Software\\Recordpad\\recordpad.exe";
    var recordPath = "S:\\OnAir recordings";
    var delay = 9000; // Subtract 1 second from the amount of on-air delay, as it takes about a second to process the recorder.
    var activeToken = "";

    var listNew = function () {};
    var disconnected = true;
    var theStatus = 4;
    var calendar = []; // Contains calendar events for the next 24 hours
    var activeRecipient = null;
    var client = {};
    var totalUnread = 0;
    var totalRequests = 0;
    var breakNotified = false;
    var data = {
        size: 140,
        smallSize: 70,
        start: 0, // angle to rotate pie chart by
        sectors: [], // start (angle from start), size (amount of angle to cover), label, color
        smallSectors: []
    }
    var prevQueueLength = 0;
    var queueLength = 0;
    var trip;
    var metaTimer;
    var isHost = false;

    // These are used for keeping track of upcoming shows and notifying DJs to prevent people cutting into each other's shows.
    var calPriority = 0;
    var calType = '';
    var calHost = '';
    var calShow = '';
    var calTopic = '';
    var calNotified = false;
    var calStarts = null;
    var calHint = false;

    // Clock stuff
    var date = moment(Meta.time);
    var seconds = date.seconds();
    var secondsC = 0;
    var minutes = date.minutes();
    var minutesC = 0;
    var hours = date.hours();
    var hoursC = 0;
    var recorderHour = -1;
    var checkMinutes = -1;
    var clockInterval = setInterval(function () {
        date = moment(Meta.time);
        seconds = date.seconds();
        minutes = date.minutes();
        hours = date.hours();
        var angle = 0;
        var dateStamp = document.getElementById("datestamp");
        dateStamp.innerHTML = date.format("dddd MM/DD/YYYY hh:mm A");

        // First, do the hour hand
        angle = ((hours * (360 / 12)) + ((360 / 12) * (minutes / 60)));
        var containers = document.querySelectorAll('.hours-container');
        if (containers)
        {
            for (var i = 0; i < containers.length; i++) {
                containers[i].style.webkitTransform = 'rotateZ(' + angle + 'deg)';
                containers[i].style.transform = 'rotateZ(' + angle + 'deg)';
            }
        }

        // Now do the minutes hand
        angle = ((minutes * (360 / 60)) + ((360 / 60) * (seconds / 60)));
        var containers = document.querySelectorAll('.minutes-container');
        if (containers)
        {
            for (var i = 0; i < containers.length; i++) {
                containers[i].style.webkitTransform = 'rotateZ(' + angle + 'deg)';
                containers[i].style.transform = 'rotateZ(' + angle + 'deg)';
            }
        }

        // Now do the seconds hand
        angle = (seconds * (360 / 60));
        var containers = document.querySelectorAll('.seconds-container');
        if (containers)
        {
            for (var i = 0; i < containers.length; i++) {
                containers[i].style.webkitTransform = 'rotateZ(' + angle + 'deg)';
                containers[i].style.transform = 'rotateZ(' + angle + 'deg)';
            }
        }
    }, 100);

    // Connect the socket
    io.sails.url = nodeURL;
    io.sails.query = `host=${main.getMachineID()}`;
    var socket = io.sails.connect();


    // register requests
    var hostReq = new WWSUreq(socket, main.getMachineID(), 'host', '/auth/host', 'Host');
    var djReq = new WWSUreq(socket, main.getMachineID(), 'name', '/auth/dj', 'DJ');
    var directorReq = new WWSUreq(socket, main.getMachineID(), 'name', '/auth/director', 'Director');
    var adminDirectorReq = new WWSUreq(socket, main.getMachineID(), 'name', '/auth/admin-director', 'Administrator Director');
    var noReq = new WWSUreq(socket, main.getMachineID());


    socket.on('connect_error', function () {
        var noConnection = document.getElementById('no-connection');
        noConnection.style.display = "inline";
        noConnection.innerHTML = `<div class="text container-fluid" style="text-align: center;">
                <h2 style="text-align: center; font-size: 4em; color: #F44336">Failed to Connect!</h2>
                <h2 style="text-align: center; font-size: 2em; color: #F44336">Failed to connect to WWSU. Check your network connection, and ensure this DJ Controls is authorized to connect to WWSU.</h2>
                <h2 style="text-align: center; font-size: 2em; color: #F44336">Host: ${main.getMachineID()}</h2>
            </div>`;
    });

    socket.on('disconnect', function () {
        try {
            socket._raw.io._reconnection = true;
            socket._raw.io._reconnectionAttempts = Infinity;
            if (!disconnected)
            {
                var noConnection = document.getElementById('no-connection');
                noConnection.style.display = "inline";
                noConnection.innerHTML = `<div class="text container-fluid" style="text-align: center;">
                <h2 style="text-align: center; font-size: 4em; color: #F44336">Lost Connection!</h2>
                <h2 style="text-align: center; font-size: 2em; color: #F44336">Attempting to re-connect to WWSU...</h2>
            </div>`;
                disconnected = true;
                var notification = notifier.notify('DJ Controls Lost Connection', {
                    message: `DJ Controls lost connection to WWSU.`,
                    icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                    duration: 60000
                });
                if (Meta.state.startsWith("sports_") || Meta.state.startsWith("sportsremote_") || Meta.state.startsWith("remote_"))
                    responsiveVoice.speak(`DJ Controls connection has been lost`);
            }
        } catch (e) {
            iziToast.show({
                title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                message: 'Error occurred in the disconnect event.'
            });
            console.error(e);
        }
    });

    socket.on('connect', function () {
        try {
            if (disconnected)
            {
                var noConnection = document.getElementById('no-connection');
                noConnection.style.display = "none";
                disconnected = false;
                if (Meta.state.startsWith("sports_") || Meta.state.startsWith("sportsremote_") || Meta.state.startsWith("remote_"))
                    responsiveVoice.speak(`DJ Controls connection was re-established`);
            }
            doSockets();
        } catch (e) {
            iziToast.show({
                title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                message: 'Error occurred in the connect event. ' + e.message
            });
            console.error(e);
        }
    });

    socket.on('meta', function (data) {
        try {
            var startRecording = null;
            var preText = ``;
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    if (key === 'state')
                    {
                        if (((Meta[key].startsWith("automation_") || Meta[key] === 'unknown') && Meta[key] !== 'automation_break') || (Meta[key].includes("_returning") && !data[key].includes("_returning")))
                        {
                            if (data[key] === 'live_on' || data[key] === 'live_prerecord')
                            {
                                startRecording = 'live';
                                preText = `${sanitize(Meta.show)}${data[key] === 'live_prerecord' ? ` PRERECORDED` : ``}`;
                            } else if (data[key] === 'remote_on')
                            {
                                startRecording = 'remote';
                                preText = sanitize(Meta.show);
                            } else if (data[key] === 'sports_on' || data[key] === 'sportsremote_on')
                            {
                                startRecording = 'sports';
                                preText = sanitize(Meta.show);
                            }
                        } else if (!Meta[key].startsWith("automation_") && data[key].startsWith("automation_"))
                        {
                            startRecording = 'automation';
                            preText = sanitize(Meta.genre);
                        } else if (data[key].includes("_break") || data[key].includes("_returning") || data[key].includes("_halftime"))
                        {
                            if (!development && client.recordAudio)
                            {
                                stopRecording();
                            }
                        }
                    }
                    Meta[key] = data[key];
                }
            }
            doMeta(data);
            if (startRecording !== null) {
                if (!development && client.recordAudio)
                {
                    newRecording(`${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`);
                    hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'recorder', logsubtype: 'automation', loglevel: 'info', event: `A recording was started.<br />Path: ${settings.get(`recorder.path`)}/${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
                    });
                }
            }
        } catch (e) {
            iziToast.show({
                title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                message: 'Error occurred in the meta event. ' + e.message
            });
            console.error(e);
        }
    });

// On new eas data, update our eas memory and run the process function.
    socket.on('eas', function (data) {
        processEas(data);
    });

    socket.on('status', function (data) {
        processStatus(data);
    });

    socket.on('announcements', function (data) {
        processAnnouncements(data);
    });

    socket.on('calendar', function (data) {
        processCalendar(data);
    });

    socket.on('messages', function (data) {
        processMessages(data);
    });

    socket.on('requests', function (data) {
        processRequests(data);
    });

    socket.on('recipients', function (data) {
        processRecipients(data);
    });

    socket.on('djs', function (data) {
        processDjs(data);
    });

    socket.on('directors', function (data) {
        processDirectors(data);
    });

    socket.on('discipline', function (data) {
        processDiscipline(data);
    });

    socket.on('xp', function (data) {
        processXp(data);
    });

    socket.on('hosts', function (data) {
        processHosts(data);
    });

    socket.on('logs', function (data) {
        processLogs(data);
    });

    socket.on('config', function (data) {
        console.dir(data);
        processConfig(data.update);
    });

    socket.on('timesheet', function (data) {
        loadTimesheets(moment(document.querySelector("#options-timesheets-date").value));
    });

    var messageFlash2;
    var messageFlash = setInterval(function () {
        var messaging = document.querySelector("#messaging");
        if (totalUnread > 0 || totalRequests > 0)
        {
            if (messaging)
                messaging.className = "card p-1 m-3 text-white bg-info";
            messageFlash2 = setTimeout(function () {
                if (messaging)
                    messaging.className = "card p-1 m-3 text-white bg-dark";
            }, 500);
        } else {
            if (messaging)
                messaging.className = "card p-1 m-3 text-white bg-dark";
            clearTimeout(messageFlash2);
        }

        var flasher = document.querySelectorAll(".flash-bg");
        if (flasher !== null && flasher.length > 0)
        {
            document.querySelector("body").style.backgroundColor = '#ffffff';
            setTimeout(function () {
                document.querySelector("body").style.backgroundColor = '#000000';
            }, 500);
        }
    }, 3000);

    // Define default settings for iziToast (overlaying messages)
    iziToast.settings({
        titleColor: '#000000',
        messageColor: '#000000',
        color: 'red',
        close: true,
        overlay: true,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        zindex: 100,
        layout: 1,
        imageWidth: 100,
        image: ``,
        progressBarColor: `rgba(255, 0, 0, 0.5)`,
        closeOnClick: true,
        position: 'center',
        timeout: 30000
    });

    // iziToast color standard: Red is errors / problems, yellow is important, blue is information, green is success.

    // Pre-load all the modal windows
    $("#go-live-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#go-remote-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#go-sports-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#go-sportsremote-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#audio-call-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#log-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#messages-modal").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#options-modal").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 60
    });

    $("#options-modal-djs").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-directors").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-timesheets").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-announcements").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-dj").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 62
    });

    $("#options-modal-director").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 62
    });

    $("#options-modal-host").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 62
    });

    $("#options-modal-djcontrols").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-discipline").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-dj-logs").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 63
    });

    $("#options-modal-discipline-record").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 63
    });

    $("#options-modal-dj-xp").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 63
    });

    $("#options-modal-dj-xp-add").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 63
    });

    $("#options-modal-global-logs").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-calendar").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#announcement-view-modal").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-announcement").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 62
    });

    $("#options-modal-config").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 61
    });

    $("#options-modal-config-list").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 62
    });

    $("#options-modal-config-form").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 63
    });

    $("#modal-notifications").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    var quill = new Quill('#themessage', {
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike', {'color': []}],
                ['link'],
                ['clean']
            ],
            keyboard: {
                bindings: {
                    messageSend: {
                        key: 'enter',
                        shiftKey: false,
                        handler: function (range, context) {
                            try {
                                var host = Recipients({ID: activeRecipient}).first().host;
                                var label = Recipients({ID: activeRecipient}).first().label;
                                var message = quillGetHTML(this.quill.getContents());
                                hostReq.request({method: 'POST', url: nodeURL + '/messages/send', data: {from: client.host, to: host, to_friendly: label, message: message}}, (response) => {
                                    if (response === 'OK')
                                    {
                                        this.quill.setText('');
                                        markRead(null);
                                    } else {
                                        iziToast.show({
                                            title: `Failed to send!`,
                                            message: `There was an error trying to send your message.`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    }
                                });
                            } catch (e) {
                                console.error(e);
                                iziToast.show({
                                    title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                                    message: 'Error occurred during the keydown event of themessage.'
                                });
                            }
                        }
                    }
                }
            }
        },
        theme: 'snow',
        placeholder: 'Type / format your message here and then press enter to send. Shift+Enter adds a new line.'
    });

    var quill2 = new Quill('#theannouncement', {
        modules: {
            toolbar: [
                [{'size': ['small', false, 'large', 'huge']}, 'bold', 'italic', 'underline', 'strike', {'color': []}],
                ['link', {'indent': '-1'}, {'indent': '+1'}, {'list': 'ordered'}, {'list': 'bullet'}, {'align': []}],
                ['image', 'clean']
            ],
        },
        theme: 'snow',
        placeholder: 'Formatted announcement text goes here.'
    });

    function quillGetHTML(inputDelta) {
        var tempCont = document.createElement("div");
        (new Quill(tempCont)).setContents(inputDelta);
        return tempCont.getElementsByClassName("ql-editor")[0].innerHTML;
    }

    $("#connecting-modal").iziModal({
        width: 480,
        appendTo: `#operations`,
        appendToOverlay: `#operations`,
        focusInput: false,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)'
    });

    $("#wait-modal").iziModal({
        width: 480,
        appendTo: `#operations`,
        appendToOverlay: `#operations`,
        focusInput: false,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)'
    });

    $("#emergency-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeout: false,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#display-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#xp-modal").iziModal({
        width: 800,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: 180000,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    $("#requests-modal").iziModal({
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: false,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 50
    });

    // Create a seek progress bar in the Meta box
    // DEPRECATED: we no longer support Meta.percent
    /*
     var bar = new ProgressBar.Line(document.getElementById('nowplaying-seek'), {
     strokeWidth: 4,
     easing: 'easeInOut',
     duration: 500,
     color: '#FFFF00',
     trailColor: 'rgba(0, 0, 0, 0)',
     trailWidth: 1,
     svgStyle: {width: '100%', height: '100%'}
     });
     */


    $.fn.extend({
        // Add an animateCss function to JQuery to trigger an animation of an HTML element with animate.css
        animateCss: function (animationName, callback) {
            var animationEnd = (function (el) {
                var animations = {
                    animation: 'animationend',
                    OAnimation: 'oAnimationEnd',
                    MozAnimation: 'mozAnimationEnd',
                    WebkitAnimation: 'webkitAnimationEnd'
                };

                for (var t in animations) {
                    if (el.style[t] !== undefined) {
                        return animations[t];
                    }
                }
            })(document.createElement('div'));

            this.addClass('animated ' + animationName).one(animationEnd, function () {
                $(this).removeClass('animated ' + animationName);

                if (typeof callback === 'function')
                    callback();
            });

            return this;
        }
    });

    /*
     var flashInterval = setInterval(function () {
     var messaging = document.getElementById("messaging");
     messaging.className = "card p-1 m-3 text-white bg-warning-dark";
     setTimeout(function() {
     messaging.className = "card p-1 m-3 text-white bg-dark";
     }, 500);
     }, 3000);
     */


} catch (e) {
    iziToast.show({
        title: 'An error occurred - Please inform engineer@wwsu1069.org.',
        message: 'Error occurred when trying to load initial variables. ' + e.message
    });
    console.error(e);
}

// OnClick handlers

document.querySelector("#btn-return-b").onclick = function () {
    promptIfNotHost(`return from break`, function () {
        returnBreak();
    });
};

document.querySelector("#btn-psa15-b").onclick = function () {
    promptIfNotHost(`queue a 15 second PSA`, function () {
        queuePSA(15);
    });
};

document.querySelector("#btn-psa30-b").onclick = function () {
    promptIfNotHost(`queue a 30 second PSA`, function () {
        queuePSA(30);
    });
};

document.querySelector("#btn-golive-b").onclick = function () {
    prepareLive();
};

document.querySelector("#btn-goremote-b").onclick = function () {
    prepareRemote();
};

document.querySelector("#btn-gosports-b").onclick = function () {
    prepareSports();
};

document.querySelector("#btn-gosportsremote-b").onclick = function () {
    prepareSportsRemote();
};

document.querySelector("#btn-endshow-b").onclick = function () {
    promptIfNotHost(`end the show`, function () {
        endShow();
    });
};

document.querySelector("#btn-switchshow-b").onclick = function () {
    promptIfNotHost(`switch shows`, function () {
        switchShow();
    });
};

document.querySelector("#btn-resume-b").onclick = function () {
    promptIfNotHost(`return from break`, function () {
        returnBreak();
    });
};

document.querySelector("#btn-break-b").onclick = function () {
    promptIfNotHost(`take a break`, function () {
        goBreak(false);
    });
};

document.querySelector("#btn-halftime-b").onclick = function () {
    promptIfNotHost(`take an extended break`, function () {
        goBreak(true);
    });
};

document.querySelector("#btn-topadd-b").onclick = function () {
    promptIfNotHost(`play a Top Add`, function () {
        playTopAdd();
    });
};

document.querySelector("#btn-liner-b").onclick = function () {
    promptIfNotHost(`play a liner`, function () {
        playLiner();
    });
};

document.querySelector("#btn-log-b").onclick = function () {
    prepareLog();
};

document.querySelector("#btn-view-log-b").onclick = function () {
    document.querySelector('#dj-logs-listeners').innerHTML = '';
    document.querySelector('#dj-show-logs').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
    $("#options-modal-dj-logs").iziModal('open');
    hostReq.request({method: 'POST', url: nodeURL + '/logs/get', data: {attendanceID: Meta.attendanceID}}, function (response) {
        var logs = document.querySelector('#dj-show-logs');
        logs.scrollTop = 0;

        if (response.length > 0)
        {
            var newLog = ``;
            response.map(log => {

                newLog += `<div class="row m-1 bg-light-1 border-left border-${log.loglevel} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-3 text-primary">
                                    ${moment(log.createdAt).format("h:mm:ss A")}
                                </div>
                                <div class="col-9 text-secondary">
                                ${log.event}
                                ${log.trackArtist !== null && log.trackArtist !== "" ? `<br />Track: ${log.trackArtist}` : ``}${log.trackTitle !== null && log.trackTitle !== "" ? ` - ${log.trackTitle}` : ``}
                                ${log.trackAlbum !== null && log.trackAlbum !== "" ? `<br />Album: ${log.trackAlbum}` : ``}
                                ${log.trackLabel !== null && log.trackLabel !== "" ? `<br />Label: ${log.trackLabel}` : ``}
                                </div>
                            </div>`;
            });

            logs.innerHTML = newLog;
        }
    });
}

document.querySelector("#btn-emergency").onclick = function () {
    prepareEmergency();
};

document.querySelector("#emergency-go").onclick = function () {
    sendEmergency();
};

document.querySelector("#btn-display").onclick = function () {
    prepareDisplay();
};

document.querySelector("#display-go").onclick = function () {
    sendDisplay();
};

document.querySelector("#live-go").onclick = function () {
    goLive();
};

document.querySelector("#remote-go").onclick = function () {
    goRemote();
};

document.querySelector("#sports-go").onclick = function () {
    goSports();
};

document.querySelector("#sportsremote-go").onclick = function () {
    goSportsRemote();
};

document.querySelector("#log-add").onclick = function () {
    saveLog();
};

document.querySelector("#options-modal-config-list-add").onclick = function () {
    listNew();
};

document.querySelector("#btn-requests").onclick = function () {
    $("#requests-modal").iziModal('open');
};

document.querySelector("#options").onclick = function () {
    $("#options-modal").iziModal('open');
};

document.querySelector("#audio-call").onclick = () => {
    navigator.mediaDevices.enumerateDevices()
            .then((devices) => {
                var temp = document.querySelector("#main-input");
                if (temp !== null)
                {
                    temp.innerHTML = `<option value="">Choose an input device...</option>`;
                    temp.onchange = () => {
                        getAudioMain(temp.value);
                    };
                }
                var temp2 = document.querySelector("#call-input");
                if (temp2 !== null)
                {
                    temp2.innerHTML = `<option value="">Choose an input device...</option>`;
                    temp2.onchange = () => {
                        getAudio(temp2.value);
                    };
                }
                var temp3 = document.querySelector("#call-output");
                if (temp3 !== null)
                {
                    temp3.innerHTML = `<option value="">Choose an output device...</option>`;
                    temp3.onchange = () => {
                        sinkAudio(temp3.value);
                    };
                }
                var temp4 = document.querySelector("#recorder-path");
                if (temp4 !== null)
                {
                    temp4.className = `form-control${client.recordAudio ? `` : ` is-invalid`}`;
                    temp4.value = settings.get(`recorder.path`);
                    var dialogButton = document.querySelector("#recorder-path-browse");
                    if (dialogButton !== null)
                    {
                        dialogButton.onclick = () => {
                            temp4.value = main.directoryBrowse();
                            settings.set(`recorder.path`, temp4.value);
                        };
                    }
                    temp4.onchange = () => {
                        settings.set(`recorder.path`, temp4.value);
                        console.log(temp4.value);
                    };
                }
                var temp5 = document.querySelector("#recorder-delay");
                if (temp5 !== null)
                {
                    temp5.value = settings.get(`recorder.delay`);
                    temp5.onchange = () => {
                        settings.set(`recorder.delay`, temp5.value);
                    };
                }
                var temp6 = document.querySelector("#silence-time");
                if (temp6 !== null)
                {
                    temp6.className = `form-control${client.silenceDetection ? `` : ` is-invalid`}`;
                    temp6.value = settings.get(`silence.time`) || 10000;
                    temp6.onchange = () => {
                        settings.set(`silence.time`, temp6.value);
                    };
                }
                devices.map((device, index) => {
                    if (device.kind === 'audioinput') {
                        if (temp !== null)
                            temp.innerHTML += `<option value="${device.deviceId}">${device.label || 'Microphone ' + (index + 1)}</option>`;
                        if (temp2 !== null)
                            temp2.innerHTML += `<option value="${device.deviceId}">${device.label || 'Microphone ' + (index + 1)}</option>`;
                    } else if (device.kind === 'audiooutput')
                    {
                        if (temp3 !== null)
                            temp3.innerHTML += `<option value="${device.deviceId}">${device.label || 'Speaker ' + (index + 1)}</option>`;
                    }
                });

                if (temp !== null)
                    temp.value = settings.get(`audio.input.main`) || ``;

                if (temp2 !== null)
                    temp2.value = window.peerDevice || ``;

                if (temp3 !== null)
                    temp3.value = settings.get(`audio.output.call`) || ``;
            });

    $("#audio-call-modal").iziModal('open');
};

document.querySelector("#btn-options-djs").onclick = function () {
    try {
        $("#options-modal-djs").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-djs.'
        });
    }
};

document.querySelector("#btn-options-config").onclick = function () {
    try {
        $("#options-modal-config").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config.'
        });
    }
};

document.querySelector("#btn-options-config-basic").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "cWebsite": {
                    "title": "Station Website URL",
                    "description": "URL to WWSU's website; used by Status to check if the website goes offline.",
                    "type": "url"
                },
                "cStream": {
                    "title": "Station Radio Stream Server URL",
                    "description": "URL to the Shoutcast v2.6 radio stream server. Used to monitor status and record listener counts.",
                    "type": "url"
                },
                "cHostSecret": {
                    "title": "Change hostSecret",
                    "description": "Secret string used to encode the IP addresses of web and mobile visitors. Changing this will invalidate active discipline!",
                    "type": "password"
                },
                "cStartOfSemester": {
                    "title": "Start of Semester",
                    "description": "Specify the date and time when the current semester started; used to calculate remote credits earned.",
                    "type": "datetime-local"
                },
                "cLofi": {
                    "title": "Disable main CRON checks",
                    "description": "Disable a lot of the backend cron checking for development reasons.",
                    "type": "boolean",
                },
            },
            "value": {
                "cWebsite": Config.website || ``,
                "cStream": Config.stream || ``,
                "cHostSecret": ``,
                "cStartOfSemester": moment(Config.startOfSemester).format("YYYY-MM-DD\THH:mm"),
                "cLofi": Config.lofi
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/basic/set', data: {
                        website: values.cWebsite,
                        stream: values.cStream,
                        hostSecret: values.cHostSecret !== `` ? values.cHostSecret : undefined,
                        startOfSemester: moment(values.cStartOfSemester).toISOString(true),
                        lofi: values.cLofi
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Basic server configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save basic server configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Basic`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-basic.'
        });
    }
};

document.querySelector("#btn-options-config-display").onclick = function () {
    try {
        var iConfig;
        var pConfig;
        Config.displaysigns
                .filter((sign) => sign.name === `public`)
                .map((sign, index) => {
                    pConfig = sign;
                });
        Config.displaysigns
                .filter((sign) => sign.name === `internal`)
                .map((sign, index) => {
                    iConfig = sign;
                });
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "cIInstances": {
                    "title": "Number of Internal Display Instances",
                    "description": "How many display signs should be connected to display/internal for it to be considered operational?",
                    "type": "integer",
                    "minimum": 0
                },
                "cILevel": {
                    "title": "Internal Display Status Level",
                    "description": "When there are less than the above number of internal display signs connected, what level of error should be triggered? 5 = good, 4 = offline/OK, 3 = minor, 2 = significant, 1 = critical.",
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 5
                },
                "cPInstances": {
                    "title": "Number of Public Display Instances",
                    "description": "How many display signs should be connected to display/public for it to be considered operational?",
                    "type": "integer",
                    "minimum": 0
                },
                "cPLevel": {
                    "title": "Public Display Status Level",
                    "description": "When there are less than the above number of public display signs connected, what level of error should be triggered? 5 = good, 4 = offline/OK, 3 = minor, 2 = significant, 1 = critical.",
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 5
                },
            },
            "value": {
                "cIInstances": iConfig.instances || 0,
                "cILevel": iConfig.level || 4,
                "cPInstances": pConfig.instances || 0,
                "cPLevel": pConfig.level || 4,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/displaysigns/set', data: {
                        iLevel: values.cILevel,
                        iInstances: values.cIInstances,
                        pLevel: values.cPLevel,
                        pInstances: values.cPInstances
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Display sign configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save display sign configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Display Signs`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-display.'
        });
    }
};

document.querySelector("#btn-options-config-google").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "cCalendarId": {
                    "title": "ID of the WWSU Events Google Calendar",
                    "description": "Provide the Google Calendar ID of the calendar used for radio programming.",
                    "type": "string"
                },
                "cDirectorHoursId": {
                    "title": "ID of the Office Hours Google Calendar",
                    "description": "Provide the Google Calendar ID of the calendar used for director office hours.",
                    "type": "string"
                },
            },
            "value": {
                "cCalendarId": Config.GoogleAPI.calendarId || ``,
                "cDirectorHoursId": Config.GoogleAPI.directorHoursId || ``
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/google/set', data: {
                        calendarId: values.cCalendarId,
                        directorHoursId: values.cDirectorHoursId
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Google Calendar configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save google calendar configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Google Calendar`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-google.'
        });
    }
};

document.querySelector("#btn-options-config-meta").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "mClearTime": {
                    "title": "Clear Time (minutes)",
                    "description": "When manual metadata is set (eg. live shows via add a log), the metadata will be cleared automatically after this many minutes.",
                    "type": "number"
                },
            },
            "value": {
                "mClearTime": Config.meta.clearTime || 0,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/meta/set', data: {
                        clearTime: values.mClearTime
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Basic metadata configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save basic metadata configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Basic Metadata`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-meta.'
        });
    }
};

document.querySelector("#btn-options-config-meta-alt").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "mAutomation": {
                    "title": "Automation",
                    "description": "This text is displayed on metadata when playing noMeta / commercials during standard automation.",
                    "type": "string"
                },
                "mPlaylist": {
                    "title": "Playlist",
                    "description": "This text is displayed on metadata when playing noMeta / commercials during a playlist.",
                    "type": "string"
                },
                "mGenre": {
                    "title": "Genre",
                    "description": "This text is displayed on metadata when playing noMeta / commercials during a genre rotation.",
                    "type": "string"
                },
                "mLive": {
                    "title": "Live",
                    "description": "This text is displayed on metadata when playing noMeta / commercials during a live show.",
                    "type": "string"
                },
                "mPrerecord": {
                    "title": "Prerecord",
                    "description": "This text is displayed on metadata when playing noMeta / commercials during a prerecorded show.",
                    "type": "string"
                },
                "mRemote": {
                    "title": "Remote",
                    "description": "This text is displayed on metadata when playing noMeta / commercials during a remote broadcast.",
                    "type": "string"
                },
                "mSports": {
                    "title": "Sports",
                    "description": "This text is displayed on metadata when playing noMeta / commercials during sports broadcast.",
                    "type": "string"
                },
            },
            "value": {
                "mAutomation": Config.meta.alt.automation || ``,
                "mPlaylist": Config.meta.alt.playlist || ``,
                "mGenre": Config.meta.alt.genre || ``,
                "mLive": Config.meta.alt.live || ``,
                "mPrerecord": Config.meta.alt.prerecord || ``,
                "mRemote": Config.meta.alt.remote || ``,
                "mSports": Config.meta.alt.sports || ``,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/meta/alt/set', data: {
                        automation: values.mAutomation,
                        playlist: values.mPlaylist,
                        genre: values.mGenre,
                        live: values.mLive,
                        prerecord: values.mPrerecord,
                        remote: values.mRemote,
                        sports: values.mSports
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Alternate metadata configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save alternate metadata configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Alternate Metadata`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-meta-alt.'
        });
    }
};

document.querySelector("#btn-options-config-meta-prefix").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "mAutomation": {
                    "title": "Automation Tracks",
                    "description": "During automation, genre, and playlists, this prefix will appear before the currently playing track on line 1 of metadata.",
                    "type": "string"
                },
                "mGenre": {
                    "title": "Genre",
                    "description": "During genre rotations, this will appear before the genre currently airing on line 2 of metadata.",
                    "type": "string"
                },
                "mPlaylist": {
                    "title": "Playlist",
                    "description": "During a playlist, this will appear before the name of the playlist currently airing on line 2 of metadata.",
                    "type": "string"
                },
                "mRequest": {
                    "title": "Requested Tracks",
                    "description": "When playing a track request... this will appear before the name of the person who requestedd the track on line 2 of metadata.",
                    "type": "string"
                },
                "mPendLive": {
                    "title": "Going Live",
                    "description": "When a live show is about to begin, this will appear before the host - show on line 2 of metadata.",
                    "type": "string"
                },
                "mPendPrerecord": {
                    "title": "Prerecord Starting",
                    "description": "When a prerecorded show is about to begin, this will appear before the prerecord name on line 2 of metadata.",
                    "type": "string"
                },
                "mPendRemote": {
                    "title": "Starting a Remote Broadcast",
                    "description": "When a remote broadcast is about to begin, this will appear before the host - show on line 2 of metadata.",
                    "type": "string"
                },
                "mPendSports": {
                    "title": "Starting a Sports Broadcast",
                    "description": "When a sports broadcast is about to begin, this will appear before the sport on line 2 of metadata.",
                    "type": "string"
                },
                "mPrerecord": {
                    "title": "Prerecorded Show",
                    "description": "During a prerecorded show, this will appear before the name of the prerecord on line 1 of metadata.",
                    "type": "string"
                },
                "mLive": {
                    "title": "Live Show",
                    "description": "During a live show, this will appear before the host - show on line 1 of metadata.",
                    "type": "string"
                },
                "mRemote": {
                    "title": "Remote Broadcast",
                    "description": "During a remote broadcast, this will appear before the host - show on line 1 of metadata.",
                    "type": "string"
                },
                "mSports": {
                    "title": "Sports Broadcast",
                    "description": "During a sports broadcast, this will appear before the sport being aired on line 1 of metadata",
                    "type": "string"
                },
                "mPlaying": {
                    "title": "Track during a broadcast",
                    "description": "In a live, remote, sports, or prerecorded show... this will appear before the track name on line 2 of metadata when something is being played",
                    "type": "string"
                },
            },
            "value": {
                "mAutomation": Config.meta.prefix.automation || ``,
                "mGenre": Config.meta.prefix.genre || ``,
                "mPlaylist": Config.meta.prefix.playlist || ``,
                "mRequest": Config.meta.prefix.request || ``,
                "mPendLive": Config.meta.prefix.pendLive || ``,
                "mPendPrerecord": Config.meta.prefix.pendPrerecord || ``,
                "mPendRemote": Config.meta.prefix.pendRemote || ``,
                "mPendSports": Config.meta.prefix.pendSports || ``,
                "mPrerecord": Config.meta.prefix.prerecord || ``,
                "mLive": Config.meta.prefix.live || ``,
                "mRemote": Config.meta.prefix.remote || ``,
                "mSports": Config.meta.prefix.sports || ``,
                "mPlaying": Config.meta.prefix.playing || ``,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/meta/prefix/set', data: {
                        automation: values.mAutomation,
                        genre: values.mGenre,
                        playlist: values.mPlaylist,
                        request: values.mRequest,
                        pendLive: values.mPendLive,
                        pendPrerecordd: values.mPendPrerecord,
                        pendRemote: values.mPendRemote,
                        pendSports: values.mPendSports,
                        prerecord: values.mPrerecord,
                        live: values.mLive,
                        remote: values.mRemote,
                        sports: values.mSports,
                        playing: values.mPlaying
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Prefix metadata configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save prefix metadata configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Metadata Prefixes`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-meta-prefix.'
        });
    }
};

document.querySelector("#btn-options-config-onesignal").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "oRest": {
                    "title": "REST API Key",
                    "description": "Change the REST API key for the OneSignal app used to send push notifications to people who subscribe to WWSU / any of the shows.",
                    "type": "password"
                },
            },
            "value": {
                "oRest": ``,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/onesignal/set', data: {
                        rest: values.oRest
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `OneSignal configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save OneSignal configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - OneSignal`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-onesignal.'
        });
    }
};

document.querySelector("#btn-options-config-queue").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "qLive": {
                    "title": "Live Show Queue Limit (seconds)",
                    "description": "If trying to begin a live show, and the total queue time is greater than this in seconds, skip currently playing track and try clearing necessary tracks from the queue again.",
                    "type": "number"
                },
                "qPrerecord": {
                    "title": "Prerecord Queue Limit (seconds)",
                    "description": "If the amount of time between now and the first prerecord playlist track is greater than this many seconds, try clearing/skipping some tracks to get the prerecord on the air sooner.",
                    "type": "number"
                },
                "qSports": {
                    "title": "Sports Queue Limit (seconds)",
                    "description": "If trying to begin a sports broadcast, if the total queue is greater than this many seconds, skip current track, clear necessary tracks to try and get sports on sooner.",
                    "type": "number"
                },
                "qSportsReturn": {
                    "title": "Sports Breaks Queue Limit (seconds)",
                    "description": "When first returning from a break in a sports broadcast, if the queue is greater than this in seconds, clear out some tracks.",
                    "type": "number"
                },
                "qRemote": {
                    "title": "Sports Breaks Queue Limit (seconds)",
                    "description": "If trying to begin a remote broadcast, if the total queue is greater than this many seconds, skip current track, clear necessary tracks to try and get remote on sooner.",
                    "type": "number"
                },
            },
            "value": {
                "qLive": Config.queueCorrection.live,
                "qPrerecord": Config.queueCorrection.prerecord,
                "qSports": Config.queueCorrection.sports,
                "qSportsReturn": Config.queueCorrection.sportsReturn,
                "qRemote": Config.queueCorrection.remote,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/queue/set', data: {
                        live: values.qLive,
                        prerecord: values.qPrerecord,
                        sports: values.qSports,
                        sportsReturn: values.qSportsReturn,
                        remote: values.qRemote
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Queue correction configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save queue correction configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Queue Correction`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-queue.'
        });
    }
};

document.querySelector("#btn-options-config-requests").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "rDailyLimit": {
                    "title": "Daily Request Limit",
                    "description": "Each IP address is limited to making no more than the specified number of requests per day, reset at midnight. 0 disables the ability for anyone to request tracks.",
                    "type": "number"
                },
                "rPriorityBump": {
                    "title": "Priority Bump",
                    "description": "When a track is requested, by how much should the track's priority be bumped (or lowered, if a negative number) in RadioDJ? Decimals permitted.",
                    "type": "number"
                },
            },
            "value": {
                "rDailyLimit": Config.requests.dailyLimit,
                "rPriorityBump": Config.requests.priorityBump,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/requests/set', data: {
                        dailyLimit: values.rDailyLimit,
                        priorityBump: values.rPriorityBump
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Request configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save request configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Requests`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-requests.'
        });
    }
};

document.querySelector("#btn-options-config-songsliked").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "lLimit": {
                    "title": "Track Like Frequency",
                    "description": "When a listener likes a track, the same track cannot be liked by the same listener again for at least the specified number of days. If 0, listeners cannot ever like the track again.",
                    "type": "number"
                },
                "lPriorityBump": {
                    "title": "Priority Bump",
                    "description": "When a track is liked, by how much should the track's priority be bumped (or lowered, if a negative number) in RadioDJ?",
                    "type": "number"
                },
            },
            "value": {
                "lLimit": Config.songsliked.limit,
                "lPriorityBump": Config.songsliked.priorityBump,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/songsliked/set', data: {
                        limit: values.lLimit,
                        priorityBump: values.lPriorityBump
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Track liking configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save track liking configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Track Liking`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-songsliked.'
        });
    }
};

document.querySelector("#btn-options-config-status-music").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "sWarn": {
                    "title": "Warn / Minor Issue Threshold",
                    "description": "When the number of bad music tracks in RadioDJ exceeds the specified number, status 3 (minor) will be triggered for the music library.",
                    "type": "number"
                },
                "sError": {
                    "title": "Error / significant issue threshold",
                    "description": "When the number of bad music tracks in RadioDJ exceeds the specified number, status 2 (significant) will be triggered for the music library.",
                    "type": "number"
                },
                "sCritical": {
                    "title": "Critical / severe issue threshold",
                    "description": "When the number of bad music tracks in RadioDJ exceeds the specified number, status 1 (critical) will be triggered for the music library.",
                    "type": "number"
                },
            },
            "value": {
                "sWarn": Config.status.musicLibrary.verify.warn,
                "sError": Config.status.musicLibrary.verify.error,
                "sCritical": Config.status.musicLibrary.verify.critical,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/status/music/set-verify', data: {
                        warn: values.sWarn,
                        error: values.sError,
                        critical: values.sCritical
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Music library status configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save music library status configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Status: Music Library`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-status-music.'
        });
    }
};

document.querySelector("#btn-options-config-status-load1").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "sWarn": {
                    "title": "Warn / Minor Issue Threshold",
                    "description": "When the 1-minute CPU load exceeds this value, status 3 (minor) will be triggered for the server. Generally, this number should be the number of CPU cores * 4.",
                    "type": "number"
                },
                "sError": {
                    "title": "Error / significant issue threshold",
                    "description": "When the 1-minute CPU load exceeds this value, status 2 (significant) will be triggered for the server. Generally, this number should be the number of CPU cores * 8.",
                    "type": "number"
                },
                "sCritical": {
                    "title": "Critical / severe issue threshold",
                    "description": "When the 1-minute CPU load exceeds this value, status 1 (critical) will be triggered for the server. Generally, this number should be the number of CPU cores * 16.",
                    "type": "number"
                },
            },
            "value": {
                "sWarn": Config.status.server.load1.warn,
                "sError": Config.status.server.load1.error,
                "sCritical": Config.status.server.load1.critical,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/status/server/set-load1', data: {
                        warn: values.sWarn,
                        error: values.sError,
                        critical: values.sCritical
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Server 1-minute CPU load status configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save Server 1-minute CPU load status configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Status: 1-minute CPU Load`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-status-load1.'
        });
    }
};

document.querySelector("#btn-options-config-status-load5").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "sWarn": {
                    "title": "Warn / Minor Issue Threshold",
                    "description": "When the 5-minute CPU load exceeds this value, status 3 (minor) will be triggered for the server. Generally, this number should be the number of CPU cores * 3.",
                    "type": "number"
                },
                "sError": {
                    "title": "Error / significant issue threshold",
                    "description": "When the 5-minute CPU load exceeds this value, status 2 (significant) will be triggered for the server. Generally, this number should be the number of CPU cores * 6.",
                    "type": "number"
                },
                "sCritical": {
                    "title": "Critical / severe issue threshold",
                    "description": "When the 5-minute CPU load exceeds this value, status 1 (critical) will be triggered for the server. Generally, this number should be the number of CPU cores * 12.",
                    "type": "number"
                },
            },
            "value": {
                "sWarn": Config.status.server.load5.warn,
                "sError": Config.status.server.load5.error,
                "sCritical": Config.status.server.load5.critical,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/status/server/set-load5', data: {
                        warn: values.sWarn,
                        error: values.sError,
                        critical: values.sCritical
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Server 5-minute CPU load status configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save Server 5-minute CPU load status configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Status: 5-minute CPU Load`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-status-load5.'
        });
    }
};

document.querySelector("#btn-options-config-status-load15").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "sWarn": {
                    "title": "Warn / Minor Issue Threshold",
                    "description": "When the 15-minute CPU load exceeds this value, status 3 (minor) will be triggered for the server. Generally, this number should be the number of CPU cores * 2.",
                    "type": "number"
                },
                "sError": {
                    "title": "Error / significant issue threshold",
                    "description": "When the 15-minute CPU load exceeds this value, status 2 (significant) will be triggered for the server. Generally, this number should be the number of CPU cores * 4.",
                    "type": "number"
                },
                "sCritical": {
                    "title": "Critical / severe issue threshold",
                    "description": "When the 15-minute CPU load exceeds this value, status 1 (critical) will be triggered for the server. Generally, this number should be the number of CPU cores * 8.",
                    "type": "number"
                },
            },
            "value": {
                "sWarn": Config.status.server.load15.warn,
                "sError": Config.status.server.load15.error,
                "sCritical": Config.status.server.load15.critical,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/status/server/set-load15', data: {
                        warn: values.sWarn,
                        error: values.sError,
                        critical: values.sCritical
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Server 15-minute CPU load status configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to save Server 15-minute CPU load status configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Status: 15-minute CPU Load`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-status-load15.'
        });
    }
};

document.querySelector("#btn-options-config-status-memory").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "sWarn": {
                    "title": "Warn / Minor Issue Threshold",
                    "description": "When free memory drops below this value in bytes, status 3 (minor) will be triggered for the server. Recommendation is 20% of memory capacity.",
                    "type": "number"
                },
                "sError": {
                    "title": "Error / significant issue threshold",
                    "description": "When free memory drops below this value in bytes, status 2 (significant) will be triggered for the server. Recommendation is 10% of memory capacity.",
                    "type": "number"
                },
                "sCritical": {
                    "title": "Critical / severe issue threshold",
                    "description": "When free memory drops below this value in bytes, status 1 (critical) will be triggered for the server. Recommendation is 5% of installed memory.",
                    "type": "number"
                },
            },
            "value": {
                "sWarn": Config.status.server.memory.warn,
                "sError": Config.status.server.memory.error,
                "sCritical": Config.status.server.memory.critical,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/status/server/set-memory', data: {
                        warn: values.sWarn,
                        error: values.sError,
                        critical: values.sCritical
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Memory status configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to update Memory status configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Status: Memory`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-status-memory.'
        });
    }
};

document.querySelector("#btn-options-config-xp").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "xListenerMinutes": {
                    "title": "Live Listener Minutes = 1 XP",
                    "description": "For live and remove shows, DJs earn 1 XP for every specified listener minute during their show. Decimals are permitted. Minimum allowed value is 0.01. Changing this will NOT change previous XP earned.",
                    "type": "number"
                },
                "xPrerecordListenerMinutes": {
                    "title": "Prerecord Listener Minutes = 1 XP",
                    "description": "For prerecorded shows, DJs earn 1 XP for every specified listener minute during the airing of the prerecord. Decimals are permitted. Minimum allowed value is 0.01. Changing this will NOT change previous XP earned.",
                    "type": "number"
                },
                "xShowMinutes": {
                    "title": "On-Air Minutes = 1 XP",
                    "description": "For live shows and remotes, Earn 1 XP for every specified minutes a DJ was on the air. Can be a decimal. Minimum allowed value is 0.01. Changing this will NOT change previous XP earned.",
                    "type": "number"
                },
                "xPrerecordShowMinutes": {
                    "title": "Prerecord Minutes = 1 XP",
                    "description": "For prerecorded shows, Earn 1 XP for every specified minutes a prerecord was on the air. Can be a decimal. Minimum allowed value is 0.01. Changing this will NOT change previous XP earned.",
                    "type": "number"
                },
                "xID": {
                    "title": "XP for On-Time Top-Of-The-Hour ID Breaks",
                    "description": "For live shows and remotes, earn the specified number in XP for every on-time top of the hour break taken. Changing this will NOT change previous XP earned.",
                    "type": "number"
                },
                "xPrerecordBreak": {
                    "title": "XP for Prerecord Breaks",
                    "description": "For prerecords, earn the specified number in XP for every time the prerecord was divided into a separate track, thereby allowing the system to air a break. Changing this will NOT change previous XP earned.",
                    "type": "number"
                },
                "xTopAdd": {
                    "title": "XP for Top Adds",
                    "description": "For live shows and remotes, earn the specified number in XP for every time the DJ played a Top Add via the Play Top Add button. Changing this will NOT change previous XP earned.",
                    "type": "number"
                },
                "xWeb": {
                    "title": "XP for Messages Sent to Website / Mobile Listeners",
                    "description": "For live shows and remotes, earn the specified number in XP every time the DJ sent a message out to a website/mobile visitor (or publicly to all visitors). Changing this will NOT change previous XP earned.",
                    "type": "number"
                },
                "xRemoteCredit": {
                    "title": "XP for every Remote Credit Earned",
                    "description": "A DJ should have the specified number of XP added to their profile for every remote credit they earned. Changing this WILL change previous XP earned for remote credits.",
                    "type": "number"
                },
            },
            "value": {
                "xListenerMinutes": Config.XP.listenerMinutes,
                "xPrerecordListenerMinutes": Config.XP.prerecordListenerMinutes,
                "xShowMinutes": Config.XP.showMinutes,
                "xPrerecordShowMinutes": Config.XP.prerecordShowMinutes,
                "xID": Config.XP.ID,
                "xPrerecordBreak": Config.XP.prerecordBreak,
                "xTopAdd": Config.XP.topAdd,
                "xWeb": Config.XP.web,
                "xRemoteCredit": Config.XP.remoteCredit,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/xp/set', data: {
                        listenerMinutes: values.xListenerMinutes,
                        prerecordListenerMinutes: values.xPrerecordListenerMinutes,
                        showMinutes: values.xShowMinutes,
                        prerecordShowMinutes: values.xPrerecordShowMinutes,
                        ID: values.xID,
                        prerecordBreak: values.xPrerecordBreak,
                        topAdd: values.xTopAdd,
                        web: values.xWeb,
                        remoteCredit: values.xRemoteCredit
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `XP configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to update XP configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - XP`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-xp.'
        });
    }
};

document.querySelector("#btn-options-config-breaks-clock").onclick = function () {
    try {
        var temp = document.querySelector(`#options-modal-config-list-label`);
        if (temp !== null)
            temp.innerHTML = `Clockwheel Breaks (items are minutes of each hour)`;
        var temp2 = document.querySelector(`#options-modal-config-list-items`);
        if (temp2 !== null)
        {
            temp2.innerHTML = ``;
            for (var item in Config.breaks)
            {
                if (Config.breaks.hasOwnProperty(item))
                {
                    temp2.innerHTML += `<div class="row m-1 bg-light-1 shadow-2" title="This break executes at the ${item} minute every hour.">
                            <div class="col-10 text-primary">
                                ${item}
                            </div>
                            <div class="col-2 text-secondary">
                <button type="button" id="config-breaks-edit-${item}" class="close" aria-label="Edit :${item} break." title="Edit this break">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                ${item !== `0` ? `<button type="button" id="config-breaks-remove-${item}" class="close" aria-label="Remove :${item} break" title="Remove this break">
                <span aria-hidden="true"><i class="fas fa-trash text-dark"></i></span>
                </button>` : ``}
                            </div>
                        </div>`;
                }
            }

            listNew = function () {
                var categories = [""];
                for (var key in Config.categories)
                {
                    if (key !== `_doNotRemove` && Config.categories.hasOwnProperty(key))
                        categories.push(key);
                }
                $('#options-modal-config-form-form').html(``);
                $('#options-modal-config-form-extra').html(``);
                $('#options-modal-config-form-form').jsonForm({
                    "schema": {
                        "minute": {
                            "type": "integer",
                            "title": "Minute of the Hour",
                            "required": true,
                            "minimum": 1,
                            "maximum": 59,
                            "description": `Specify the minute of every hour that this break should execute during automation. CAUTION! If you specify an existing minute, it will be overwritten!`
                        },
                        "tasks": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "title": "task",
                                "properties": {
                                    "task": {
                                        "type": "string",
                                        "title": "Break Task",
                                        "required": true,
                                        "enum": ["", "log", "queueRequests", "queue", "queueDuplicates"],
                                        "description": `Choose the task. Log = save a log entry. queueRequests = queue requested tracks. queue = queue tracks from a chosen category. queueDuplicates = re-queue underwritings that were previously removed as duplicates.`
                                    },
                                    "event": {
                                        "type": "string",
                                        "title": "Event (log tasks only)",
                                        "description": `For log tasks, type what should be logged here.`
                                    },
                                    "category": {
                                        "type": "string",
                                        "title": "Category (queue tasks only)",
                                        "enum": categories,
                                        "description": "For queue tasks, choose the category which tracks should be queued from. These are categories that were configured from the categories server configuration."
                                    },
                                    "quantity": {
                                        "type": "integer",
                                        "title": "Number of Tracks to Queue (queueRequests and queue tasks only)",
                                        "description": "Number of tracks that should be queued, if queuing tracks."
                                    },
                                    "rules": {
                                        "type": "boolean",
                                        "title": "Rotation Rules (queue tasks only)",
                                        "description": "For queue tasks, should the system consider configured RadioDJ playlist rotation rules when deciding which tracks to queue?"
                                    }
                                }
                            }
                        }
                    },
                    "onSubmitValid": function (values) {
                        console.dir(values);
                        directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/breaks/set-clock', data: {
                                minute: values.minute,
                                tasks: values.tasks
                            }}, function (response) {
                            console.dir(response);
                            if (response === 'OK')
                            {
                                $("#options-modal-config-form").iziModal('close');
                                $("#options-modal-config-list-items").iziModal('close');
                                iziToast.show({
                                    title: `${item} break configuration added! Please re-open the break configuration window.`,
                                    message: ``,
                                    timeout: 10000,
                                    close: true,
                                    color: 'green',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: false,
                                    zindex: 1000
                                });
                            } else {
                                console.dir(response);
                                iziToast.show({
                                    title: `Failed to add ${item} break configuration`,
                                    message: response,
                                    timeout: 10000,
                                    close: true,
                                    color: 'red',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: false,
                                    zindex: 1000
                                });
                            }
                        });
                    }
                });
                $("#options-modal-config-form-label").html(`Server Configuration - ${item} break`);
                $("#options-modal-config-form").iziModal('open');
            };

            $(`#options-modal-config-list`).iziModal(`open`);
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-breaks-clock.'
        });
    }
};

document.querySelector("#btn-options-config-breaks-live").onclick = function () {
    try {
        var temp = document.querySelector(`#options-modal-config-list-label`);
        if (temp !== null)
            temp.innerHTML = `Live Show Breaks`;
        var temp2 = document.querySelector(`#options-modal-config-list-items`);
        if (temp2 !== null)
        {
            temp2.innerHTML = ``;
            for (var item in Config.specialBreaks.live)
            {
                if (Config.specialBreaks.live.hasOwnProperty(item))
                {
                    var description = `Unknown`;
                    switch (item)
                    {
                        case "start":
                            description = `Start (Queued when a show starts)`;
                            break;
                        case "before":
                            description = `Before (Queued at the start of every break)`;
                            break;
                        case "during":
                            description = `During (Queued whenever the queue empties during a break)`;
                            break;
                        case "after":
                            description = `After (Queued when the DJ/producer ends the break)`;
                            break;
                        case "end":
                            description = `End (Queued when the show ends)`;
                            break;
                    }
                    temp2.innerHTML += `<div class="row m-1 bg-light-1 shadow-2">
                            <div class="col-10 text-primary">
                                ${description}
                            </div>
                            <div class="col-2 text-secondary">
                <button type="button" id="config-breaks-live-edit-${item}" class="close" aria-label="Edit ${item}." title="Edit this break">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                            </div>
                        </div>`;
                }
            }

            listNew = function () {};

            $(`#options-modal-config-list`).iziModal(`open`);
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-breaks-live.'
        });
    }
};

document.querySelector("#btn-options-config-breaks-remote").onclick = function () {
    try {
        var temp = document.querySelector(`#options-modal-config-list-label`);
        if (temp !== null)
            temp.innerHTML = `Remote Broadcast Breaks`;
        var temp2 = document.querySelector(`#options-modal-config-list-items`);
        if (temp2 !== null)
        {
            temp2.innerHTML = ``;
            for (var item in Config.specialBreaks.remote)
            {
                if (Config.specialBreaks.remote.hasOwnProperty(item))
                {
                    var description = `Unknown`;
                    switch (item)
                    {
                        case "start":
                            description = `Start (Queued when a broadcast starts)`;
                            break;
                        case "before":
                            description = `Before (Queued at the start of every break)`;
                            break;
                        case "during":
                            description = `During (Queued whenever the queue empties during a break)`;
                            break;
                        case "after":
                            description = `After (Queued when the DJ/producer ends the break)`;
                            break;
                        case "end":
                            description = `End (Queued when the broadcast ends)`;
                            break;
                    }
                    temp2.innerHTML += `<div class="row m-1 bg-light-1 shadow-2">
                            <div class="col-10 text-primary">
                                ${description}
                            </div>
                            <div class="col-2 text-secondary">
                <button type="button" id="config-breaks-remote-edit-${item}" class="close" aria-label="Edit ${item}." title="Edit this break">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                            </div>
                        </div>`;
                }
            }

            listNew = function () {};

            $(`#options-modal-config-list`).iziModal(`open`);
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-breaks-remote.'
        });
    }
};

document.querySelector("#btn-options-config-breaks-sports").onclick = function () {
    try {
        var temp = document.querySelector(`#options-modal-config-list-label`);
        if (temp !== null)
            temp.innerHTML = `Sports Breaks`;
        var temp2 = document.querySelector(`#options-modal-config-list-items`);
        if (temp2 !== null)
        {
            temp2.innerHTML = ``;
            for (var item in Config.specialBreaks.sports)
            {
                if (Config.specialBreaks.sports.hasOwnProperty(item))
                {
                    var description = `Unknown`;
                    switch (item)
                    {
                        case "start":
                            description = `Start (Queued when a broadcast starts)`;
                            break;
                        case "before":
                            description = `Before (Queued at the start of every break)`;
                            break;
                        case "during":
                            description = `During (Queued whenever the queue empties during a regular break)`;
                            break;
                        case "duringHalftime":
                            description = `Halftime (Queued whenever the queue empties during an extended break)`;
                            break;
                        case "after":
                            description = `After (Queued when the DJ/producer ends the break)`;
                            break;
                        case "end":
                            description = `End (Queued when the broadcast ends)`;
                            break;
                    }
                    temp2.innerHTML += `<div class="row m-1 bg-light-1 shadow-2">
                            <div class="col-10 text-primary">
                                ${description}
                            </div>
                            <div class="col-2 text-secondary">
                <button type="button" id="config-breaks-sports-edit-${item}" class="close" aria-label="Edit ${item}." title="Edit this break">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                            </div>
                        </div>`;
                }
            }

            listNew = function () {};

            $(`#options-modal-config-list`).iziModal(`open`);
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-breaks-sports.'
        });
    }
};

document.querySelector("#btn-options-config-breaks-automation").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        var categories = [""];
        for (var key in Config.categories)
        {
            if (key !== `_doNotRemove` && Config.categories.hasOwnProperty(key))
                categories.push(key);
        }
        var tasks = [];
        Config.specialBreaks.automation.during.map((task) => {
            tasks.push({
                task: task.task || "",
                event: task.event || "",
                category: task.category || "",
                quantity: task.quantity || 0,
                rules: task.rules
            });
        });
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "tasks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "title": "task",
                        "properties": {
                            "task": {
                                "type": "string",
                                "title": "Break Task",
                                "required": true,
                                "enum": ["", "log", "queueRequests", "queue", "queueDuplicates"],
                                "description": `Choose the task. Log = save a log entry. queueRequests = queue requested tracks. queue = queue tracks from a chosen category. queueDuplicates = re-queue underwritings that were previously removed as duplicates.`
                            },
                            "event": {
                                "type": "string",
                                "title": "Event (log tasks only)",
                                "description": `For log tasks, type what should be logged here.`
                            },
                            "category": {
                                "type": "string",
                                "title": "Category (queue tasks only)",
                                "enum": categories,
                                "description": "For queue tasks, choose the category which tracks should be queued from. These are categories that were configured from the categories server configuration."
                            },
                            "quantity": {
                                "type": "integer",
                                "title": "Number of Tracks to Queue (queueRequests and queue tasks only)",
                                "description": "Number of tracks that should be queued, if queuing tracks."
                            },
                            "rules": {
                                "type": "boolean",
                                "title": "Rotation Rules (queue tasks only)",
                                "description": "For queue tasks, should the system consider configured RadioDJ playlist rotation rules when deciding which tracks to queue?"
                            }
                        }
                    }
                }
            },
            "value": {
                "tasks": tasks
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/breaks/set-automation', data: {
                        during: values.tasks
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Switch show break configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to update switch show break configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Breaks: Switch Show`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-breaks-automation.'
        });
    }
};

document.querySelector("#btn-options-config-breaks").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "bBreakCheck": {
                    "title": "Minimum Hourly Break Interval (Minutes)",
                    "description": `For hourly/clockwheel breaks, when considering when to queue breaks, if a break was queued less than this many minutes ago, hold off on queuing any other breaks until this many minutes have passed since. You MUST NOT have any intervals between breaks that are less than this. For example, if this is 10, and you have a break at 25 and another at 30 (5 minute difference), this will cause problems. The "0" break ignores this setting since it is required by the FCC. It has its own hard-coded check of 10 minutes that cannot be configured.`,
                    "type": "number"
                },
                "bLinerTime": {
                    "title": "Liner Interval (Minutes)",
                    "description": `A track from the defined "liners" categories will be queued during automation between music tracks during non-breaks. Do not play a liner more often than once every defined number of minutes. NOTE: This clock is reset when a break is played so as to avoid playing a liner too close to a break.`,
                    "type": "number"
                },
            },
            "value": {
                "bBreakCheck": Config.breakCheck,
                "bLinerTime": Config.linerTime,
            },
            "onSubmitValid": function (values) {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/status/breaks/set', data: {
                        breakCheck: values.bBreakCheck,
                        linerTime: values.bLinerTime
                    }}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-config-form").iziModal('close');
                        iziToast.show({
                            title: `Basic break configuration updated!`,
                            message: ``,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to update basic break configuration`,
                            message: response,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        });
        $("#options-modal-config-form-label").html(`Server Configuration - Breaks: Basic`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-breaks.'
        });
    }
};

document.querySelector("#btn-options-config-categories").onclick = function () {
    try {
        var temp = document.querySelector(`#options-modal-config-list-label`);
        if (temp !== null)
            temp.innerHTML = `Track Categories`;
        var temp2 = document.querySelector(`#options-modal-config-list-items`);
        if (temp2 !== null)
        {
            temp2.innerHTML = ``;
            for (var item in Config.categories)
            {
                if (Config.categories.hasOwnProperty(item) && item !== `_doNotRemove`)
                {
                    temp2.innerHTML += `<div class="row m-1 bg-light-1 shadow-2" title="Category ${item}">
                            <div class="col-10 text-primary">
                                ${item}
                            </div>
                            <div class="col-2 text-secondary">
                <button type="button" id="config-categories-edit-${item}" class="close" aria-label="Edit category ${item}." title="Edit this category">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                ${Config.categories['_doNotRemove'].indexOf(item) === -1 ? `<button type="button" id="config-categories-remove-${item}" class="close" aria-label="Remove category ${item}" title="Remove this category">
                <span aria-hidden="true"><i class="fas fa-trash text-dark"></i></span>
                </button>` : ``}
                            </div>
                        </div>`;
                }
            }

            listNew = function () {
                hostReq.request({method: 'post', url: nodeURL + '/config/categories/get-available', data: {}}, function serverResponded(body, JWR) {
                    //console.log(body);
                    try {
                        var categories = [];
                        for (var key in body)
                        {
                            if (body.hasOwnProperty(key))
                            {
                                categories.push(`${key} >>> [All Subcategories]`);
                                body[key].map((item) => {
                                    categories.push(`${key} >>> ${item}`);
                                });
                            }
                        }
                        $('#options-modal-config-form-form').html(``);
                        $('#options-modal-config-form-extra').html(``);
                        $('#options-modal-config-form-form').jsonForm({
                            "schema": {
                                "name": {
                                    "type": "string",
                                    "title": "Name of category",
                                    "required": true,
                                    "description": `Specify an alphanumeric name to use for this category in the system (no spaces / symbols are allowed!). WARNING! If you specify a name that already exists, it will be overwritten!`
                                },
                                "categories": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "title": "category",
                                        "properties": {
                                            "category": {
                                                "type": "string",
                                                "title": "RadioDJ Category >>> Subcategory",
                                                "required": true,
                                                "enum": categories,
                                                "description": `Choose a RadioDJ category >>> subcategory that should apply to this category. You can add multiple.`
                                            }
                                        }
                                    }
                                }
                            },
                            "onSubmitValid": function (values) {
                                var config = {};
                                if (values.categories.length > 0)
                                {
                                    values.categories.map((cat) => {
                                        var temp = cat.category.split(` >>> `);
                                        if (typeof config[temp[0]] === `undefined`)
                                            config[temp[0]] = [];
                                        if (temp[1] !== `[All Subcategories]`)
                                            config[temp[0]].push(temp[1]);
                                    });
                                }
                                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/categories/set', data: {
                                        name: values.name,
                                        config: config
                                    }}, function (response) {
                                    console.dir(response);
                                    if (response === 'OK')
                                    {
                                        $("#options-modal-config-form").iziModal('close');
                                        $("#options-modal-config-list-items").iziModal('close');
                                        iziToast.show({
                                            title: `${values.name} category added! Please re-open the category configuration window.`,
                                            message: ``,
                                            timeout: 10000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    } else {
                                        console.dir(response);
                                        iziToast.show({
                                            title: `Failed to add ${values.name} category.`,
                                            message: response,
                                            timeout: 10000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    }
                                });
                            }
                        });
                        $("#options-modal-config-form-label").html(`Server Configuration - New Category`);
                        $("#options-modal-config-form").iziModal('open');
                    } catch (e) {
                        console.error(e);
                        iziToast.show({
                            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                            message: 'Error occurred during the click event of #btn-options-config-breaks-categories listNew.'
                        });
                    }
                });
            };

            $(`#options-modal-config-list`).iziModal(`open`);
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-config-breaks-clock.'
        });
    }
};

document.querySelector("#options-modal-config-list-items").onclick = function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`config-breaks-edit-`))
            {
                var item = e.target.id.replace(`config-breaks-edit-`, ``);
                if (typeof Config.breaks[item] !== `undefined`)
                {
                    var categories = [""];
                    var values = [];
                    for (var key in Config.categories)
                    {
                        if (key !== `_doNotRemove` && Config.categories.hasOwnProperty(key))
                            categories.push(key);
                    }
                    Config.breaks[item].map((task) => {
                        values.push({
                            task: task.task || ``,
                            event: task.event || ``,
                            category: task.category || ``,
                            quantity: task.quantity || 0,
                            rules: task.rules
                        });
                    });
                    $('#options-modal-config-form-form').html(``);
                    $('#options-modal-config-form-extra').html(``);
                    $('#options-modal-config-form-form').jsonForm({
                        "schema": {
                            "tasks": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "title": "task",
                                    "properties": {
                                        "task": {
                                            "type": "string",
                                            "title": "Break Task",
                                            "required": true,
                                            "enum": ["", "log", "queueRequests", "queue", "queueDuplicates"],
                                            "description": `Choose the task. Log = save a log entry. queueRequests = queue requested tracks. queue = queue tracks from a chosen category. queueDuplicates = re-queue underwritings that were previously removed as duplicates.`
                                        },
                                        "event": {
                                            "type": "string",
                                            "title": "Event (log tasks only)",
                                            "description": `For log tasks, type what should be logged here.`
                                        },
                                        "category": {
                                            "type": "string",
                                            "title": "Category (queue tasks only)",
                                            "enum": categories,
                                            "description": "For queue tasks, choose the category which tracks should be queued from. These are categories that were configured from the categories server configuration."
                                        },
                                        "quantity": {
                                            "type": "integer",
                                            "title": "Number of Tracks to Queue (queueRequests and queue tasks only)",
                                            "description": "Number of tracks that should be queued, if queuing tracks."
                                        },
                                        "rules": {
                                            "type": "boolean",
                                            "title": "Rotation Rules (queue tasks only)",
                                            "description": "For queue tasks, should the system consider configured RadioDJ playlist rotation rules when deciding which tracks to queue?"
                                        }
                                    }
                                }
                            }
                        },
                        "value": {
                            "tasks": values,
                        },
                        "onSubmitValid": function (values) {
                            console.dir(values);
                            directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/breaks/set-clock', data: {
                                    minute: parseInt(item),
                                    tasks: values.tasks
                                }}, function (response) {
                                console.dir(response);
                                if (response === 'OK')
                                {
                                    $("#options-modal-config-form").iziModal('close');
                                    iziToast.show({
                                        title: `${item} break configuration updated!`,
                                        message: ``,
                                        timeout: 10000,
                                        close: true,
                                        color: 'green',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: false,
                                        zindex: 1000
                                    });
                                } else {
                                    console.dir(response);
                                    iziToast.show({
                                        title: `Failed to update ${item} break configuration`,
                                        message: response,
                                        timeout: 10000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: false,
                                        zindex: 1000
                                    });
                                }
                            });
                        }
                    });
                    $("#options-modal-config-form-label").html(`Server Configuration - ${item} break`);
                    $("#options-modal-config-form").iziModal('open');
                }
            }
            if (e.target.id.startsWith(`config-breaks-live-edit-`))
            {
                var item = e.target.id.replace(`config-breaks-live-edit-`, ``);
                if (typeof Config.specialBreaks.live[item] !== `undefined`)
                {
                    var categories = [""];
                    var values = [];
                    for (var key in Config.categories)
                    {
                        if (key !== `_doNotRemove` && Config.categories.hasOwnProperty(key))
                            categories.push(key);
                    }
                    Config.specialBreaks.live[item].map((task) => {
                        values.push({
                            task: task.task || ``,
                            event: task.event || ``,
                            category: task.category || ``,
                            quantity: task.quantity || 0,
                            rules: task.rules
                        });
                    });
                    $('#options-modal-config-form-form').html(``);
                    $('#options-modal-config-form-extra').html(`<strong>DO NOT include legal IDs, nor show openers/returns/closers; these are queued automatically.</strong>`);
                    $('#options-modal-config-form-form').jsonForm({
                        "schema": {
                            "tasks": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "title": "task",
                                    "properties": {
                                        "task": {
                                            "type": "string",
                                            "title": "Break Task",
                                            "required": true,
                                            "enum": ["", "log", "queueRequests", "queue", "queueDuplicates"],
                                            "description": `Choose the task. Log = save a log entry. queueRequests = queue requested tracks. queue = queue tracks from a chosen category. queueDuplicates = re-queue underwritings that were previously removed as duplicates.`
                                        },
                                        "event": {
                                            "type": "string",
                                            "title": "Event (log tasks only)",
                                            "description": `For log tasks, type what should be logged here.`
                                        },
                                        "category": {
                                            "type": "string",
                                            "title": "Category (queue tasks only)",
                                            "enum": categories,
                                            "description": "For queue tasks, choose the category which tracks should be queued from. These are categories that were configured from the categories server configuration."
                                        },
                                        "quantity": {
                                            "type": "integer",
                                            "title": "Number of Tracks to Queue (queueRequests and queue tasks only)",
                                            "description": "Number of tracks that should be queued, if queuing tracks."
                                        },
                                        "rules": {
                                            "type": "boolean",
                                            "title": "Rotation Rules (queue tasks only)",
                                            "description": "For queue tasks, should the system consider configured RadioDJ playlist rotation rules when deciding which tracks to queue?"
                                        }
                                    }
                                }
                            }
                        },
                        "value": {
                            "tasks": values,
                        },
                        "onSubmitValid": function (values) {
                            console.dir(values);
                            var data = {};
                            data[item] = values.tasks || [];
                            directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/breaks/set-live', data: data}, function (response) {
                                console.dir(response);
                                if (response === 'OK')
                                {
                                    $("#options-modal-config-form").iziModal('close');
                                    iziToast.show({
                                        title: `Live Show ${item} break configuration updated!`,
                                        message: ``,
                                        timeout: 10000,
                                        close: true,
                                        color: 'green',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: false,
                                        zindex: 1000
                                    });
                                } else {
                                    console.dir(response);
                                    iziToast.show({
                                        title: `Failed to update Live Show ${item} break configuration`,
                                        message: response,
                                        timeout: 10000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: false,
                                        zindex: 1000
                                    });
                                }
                            });
                        }
                    });
                    $("#options-modal-config-form-label").html(`Server Configuration - Live Show ${item} break`);
                    $("#options-modal-config-form").iziModal('open');
                }
            }
            if (e.target.id.startsWith(`config-breaks-remote-edit-`))
            {
                var item = e.target.id.replace(`config-breaks-remote-edit-`, ``);
                if (typeof Config.specialBreaks.remote[item] !== `undefined`)
                {
                    var categories = [""];
                    var values = [];
                    for (var key in Config.categories)
                    {
                        if (key !== `_doNotRemove` && Config.categories.hasOwnProperty(key))
                            categories.push(key);
                    }
                    Config.specialBreaks.remote[item].map((task) => {
                        values.push({
                            task: task.task || ``,
                            event: task.event || ``,
                            category: task.category || ``,
                            quantity: task.quantity || 0,
                            rules: task.rules
                        });
                    });
                    $('#options-modal-config-form-form').html(``);
                    $('#options-modal-config-form-extra').html(`<strong>DO NOT include legal IDs, nor show openers/returns/closers; these are queued automatically.</strong>`);
                    $('#options-modal-config-form-form').jsonForm({
                        "schema": {
                            "tasks": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "title": "task",
                                    "properties": {
                                        "task": {
                                            "type": "string",
                                            "title": "Break Task",
                                            "required": true,
                                            "enum": ["", "log", "queueRequests", "queue", "queueDuplicates"],
                                            "description": `Choose the task. Log = save a log entry. queueRequests = queue requested tracks. queue = queue tracks from a chosen category. queueDuplicates = re-queue underwritings that were previously removed as duplicates.`
                                        },
                                        "event": {
                                            "type": "string",
                                            "title": "Event (log tasks only)",
                                            "description": `For log tasks, type what should be logged here.`
                                        },
                                        "category": {
                                            "type": "string",
                                            "title": "Category (queue tasks only)",
                                            "enum": categories,
                                            "description": "For queue tasks, choose the category which tracks should be queued from. These are categories that were configured from the categories server configuration."
                                        },
                                        "quantity": {
                                            "type": "integer",
                                            "title": "Number of Tracks to Queue (queueRequests and queue tasks only)",
                                            "description": "Number of tracks that should be queued, if queuing tracks."
                                        },
                                        "rules": {
                                            "type": "boolean",
                                            "title": "Rotation Rules (queue tasks only)",
                                            "description": "For queue tasks, should the system consider configured RadioDJ playlist rotation rules when deciding which tracks to queue?"
                                        }
                                    }
                                }
                            }
                        },
                        "value": {
                            "tasks": values,
                        },
                        "onSubmitValid": function (values) {
                            console.dir(values);
                            var data = {};
                            data[item] = values.tasks || [];
                            directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/breaks/set-remote', data: data}, function (response) {
                                console.dir(response);
                                if (response === 'OK')
                                {
                                    $("#options-modal-config-form").iziModal('close');
                                    iziToast.show({
                                        title: `Remote broadcast ${item} break configuration updated!`,
                                        message: ``,
                                        timeout: 10000,
                                        close: true,
                                        color: 'green',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: false,
                                        zindex: 1000
                                    });
                                } else {
                                    console.dir(response);
                                    iziToast.show({
                                        title: `Failed to update remote broadcast ${item} break configuration`,
                                        message: response,
                                        timeout: 10000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: false,
                                        zindex: 1000
                                    });
                                }
                            });
                        }
                    });
                    $("#options-modal-config-form-label").html(`Server Configuration - Remote Broadcast ${item} break`);
                    $("#options-modal-config-form").iziModal('open');
                }
            }
            if (e.target.id.startsWith(`config-breaks-sports-edit-`))
            {
                var item = e.target.id.replace(`config-breaks-sports-edit-`, ``);
                if (typeof Config.specialBreaks.sports[item] !== `undefined`)
                {
                    var categories = [""];
                    var values = [];
                    for (var key in Config.categories)
                    {
                        if (key !== `_doNotRemove` && Config.categories.hasOwnProperty(key))
                            categories.push(key);
                    }
                    Config.specialBreaks.sports[item].map((task) => {
                        values.push({
                            task: task.task || ``,
                            event: task.event || ``,
                            category: task.category || ``,
                            quantity: task.quantity || 0,
                            rules: task.rules
                        });
                    });
                    $('#options-modal-config-form-form').html(``);
                    $('#options-modal-config-form-extra').html(`<strong>DO NOT include legal IDs, nor sports openers/returns/closers; these are queued automatically.</strong>`);
                    $('#options-modal-config-form-form').jsonForm({
                        "schema": {
                            "tasks": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "title": "task",
                                    "properties": {
                                        "task": {
                                            "type": "string",
                                            "title": "Break Task",
                                            "required": true,
                                            "enum": ["", "log", "queueRequests", "queue", "queueDuplicates"],
                                            "description": `Choose the task. Log = save a log entry. queueRequests = queue requested tracks. queue = queue tracks from a chosen category. queueDuplicates = re-queue underwritings that were previously removed as duplicates.`
                                        },
                                        "event": {
                                            "type": "string",
                                            "title": "Event (log tasks only)",
                                            "description": `For log tasks, type what should be logged here.`
                                        },
                                        "category": {
                                            "type": "string",
                                            "title": "Category (queue tasks only)",
                                            "enum": categories,
                                            "description": "For queue tasks, choose the category which tracks should be queued from. These are categories that were configured from the categories server configuration."
                                        },
                                        "quantity": {
                                            "type": "integer",
                                            "title": "Number of Tracks to Queue (queueRequests and queue tasks only)",
                                            "description": "Number of tracks that should be queued, if queuing tracks."
                                        },
                                        "rules": {
                                            "type": "boolean",
                                            "title": "Rotation Rules (queue tasks only)",
                                            "description": "For queue tasks, should the system consider configured RadioDJ playlist rotation rules when deciding which tracks to queue?"
                                        }
                                    }
                                }
                            }
                        },
                        "value": {
                            "tasks": values,
                        },
                        "onSubmitValid": function (values) {
                            console.dir(values);
                            var data = {};
                            data[item] = values.tasks || [];
                            directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/breaks/set-sports', data: data}, function (response) {
                                console.dir(response);
                                if (response === 'OK')
                                {
                                    $("#options-modal-config-form").iziModal('close');
                                    iziToast.show({
                                        title: `Sports ${item} break configuration updated!`,
                                        message: ``,
                                        timeout: 10000,
                                        close: true,
                                        color: 'green',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: false,
                                        zindex: 1000
                                    });
                                } else {
                                    console.dir(response);
                                    iziToast.show({
                                        title: `Failed to update sports ${item} break configuration`,
                                        message: response,
                                        timeout: 10000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: false,
                                        zindex: 1000
                                    });
                                }
                            });
                        }
                    });
                    $("#options-modal-config-form-label").html(`Server Configuration - Sports ${item} break`);
                    $("#options-modal-config-form").iziModal('open');
                }
            }
            if (e.target.id.startsWith(`config-breaks-remove-`))
            {
                var item = e.target.id.replace(`config-breaks-remove-`, ``);
                if (typeof Config.breaks[item] !== `undefined`)
                {
                    iziToast.show({
                        timeout: 60000,
                        overlay: true,
                        displayMode: 'once',
                        color: 'yellow',
                        id: 'inputs',
                        zindex: 999,
                        layout: 2,
                        image: `assets/images/trash.png`,
                        maxWidth: 480,
                        title: 'Remove Break',
                        message: 'THIS CANNOT BE UNDONE! Are you sure you want to remove break :' + item + '?',
                        position: 'center',
                        drag: false,
                        closeOnClick: false,
                        buttons: [
                            ['<button><b>Remove</b></button>', function (instance, toast) {
                                    instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                    directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/breaks/set-clock', data: {minute: parseInt(item), tasks: []}}, function (response) {
                                        if (response === 'OK')
                                        {
                                            $(`#options-modal-config-list`).iziModal(`close`);
                                            iziToast.show({
                                                title: `Break Removed!`,
                                                message: `Break was removed!`,
                                                timeout: 15000,
                                                close: true,
                                                color: 'green',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        } else {
                                            console.dir(response);
                                            iziToast.show({
                                                title: `Failed to remove break!`,
                                                message: `There was an error trying to remove the break.`,
                                                timeout: 10000,
                                                close: true,
                                                color: 'red',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        }
                                    });
                                }],
                            ['<button><b>Cancel</b></button>', function (instance, toast) {
                                    instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                }],
                        ]
                    });
                }
            }
            if (e.target.id.startsWith(`config-categories-edit-`))
            {
                var item = e.target.id.replace(`config-categories-edit-`, ``);
                if (typeof Config.categories[item] !== `undefined`)
                {
                    hostReq.request({method: 'post', url: nodeURL + '/config/categories/get-available', data: {}}, function serverResponded(body, JWR) {
                        try {
                            var categories = [];
                            for (var key in body)
                            {
                                if (body.hasOwnProperty(key))
                                {
                                    categories.push(`${key} >>> [All Subcategories]`);
                                    body[key].map((item) => {
                                        categories.push(`${key} >>> ${item}`);
                                    });
                                }
                            }

                            var values = [];
                            for (var key in Config.categories[item])
                            {
                                if (Config.categories[item].hasOwnProperty(key))
                                {
                                    if (Config.categories[item][key].length === 0)
                                    {
                                        values.push({category: `${key} >>> [All Subcategories]`});
                                    } else {
                                        Config.categories[item][key].map((item2) => {
                                            values.push({category: `${key} >>> ${item2}`});
                                        });
                                    }
                                }
                            }
                            $('#options-modal-config-form-form').html(``);
                            $('#options-modal-config-form-extra').html(``);
                            $('#options-modal-config-form-form').jsonForm({
                                "schema": {
                                    "categories": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "title": "category",
                                            "properties": {
                                                "category": {
                                                    "type": "string",
                                                    "title": "RadioDJ Category >>> Subcategory",
                                                    "required": true,
                                                    "enum": categories,
                                                    "description": `Choose a RadioDJ category >>> subcategory that should apply to this category. You can add multiple.`
                                                }
                                            }
                                        }
                                    }
                                },
                                "value": {
                                    "categories": values,
                                },
                                "onSubmitValid": function (values) {
                                    var config = {};
                                    if (values.categories.length > 0)
                                    {
                                        values.categories.map((cat) => {
                                            var temp = cat.category.split(` >>> `);
                                            if (typeof config[temp[0]] === `undefined`)
                                                config[temp[0]] = [];
                                            if (temp[1] !== `[All Subcategories]`)
                                                config[temp[0]].push(temp[1]);
                                        });
                                    }
                                    directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/categories/set', data: {
                                            name: item,
                                            config: config
                                        }}, function (response) {
                                        console.dir(response);
                                        if (response === 'OK')
                                        {
                                            $("#options-modal-config-form").iziModal('close');
                                            iziToast.show({
                                                title: `${values.name} category edited!`,
                                                message: ``,
                                                timeout: 10000,
                                                close: true,
                                                color: 'green',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        } else {
                                            console.dir(response);
                                            iziToast.show({
                                                title: `Failed to edit ${values.name} category.`,
                                                message: response,
                                                timeout: 10000,
                                                close: true,
                                                color: 'red',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        }
                                    });
                                }
                            });
                            $("#options-modal-config-form-label").html(`Server Configuration - Category ${item}`);
                            $("#options-modal-config-form").iziModal('open');
                        } catch (e) {
                            console.error(e);
                            iziToast.show({
                                title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                                message: 'Error occurred during the click event of #options-modal-config-list-items categories/get-available.'
                            });
                        }
                    });
                }
            }
            if (e.target.id.startsWith(`config-categories-remove-`))
            {
                var item = e.target.id.replace(`config-categories-remove-`, ``);
                if (typeof Config.categories[item] !== `undefined` && item !== `_doNotRemove`)
                {
                    iziToast.show({
                        timeout: 60000,
                        overlay: true,
                        displayMode: 'once',
                        color: 'yellow',
                        id: 'inputs',
                        zindex: 999,
                        layout: 2,
                        image: `assets/images/trash.png`,
                        maxWidth: 480,
                        title: 'Remove Category',
                        message: 'THIS CANNOT BE UNDONE! Are you sure you want to remove category' + item + '?',
                        position: 'center',
                        drag: false,
                        closeOnClick: false,
                        buttons: [
                            ['<button><b>Remove</b></button>', function (instance, toast) {
                                    instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                    directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/config/categories/remove', data: {name: item}}, function (response) {
                                        if (response === 'OK')
                                        {
                                            $(`#options-modal-config-list`).iziModal(`close`);
                                            iziToast.show({
                                                title: `Category Removed!`,
                                                message: `Category was removed! NOTE: If this category exists in any configuration (such a breaks), you may want to change/remove it!`,
                                                timeout: 20000,
                                                close: true,
                                                color: 'green',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        } else {
                                            console.dir(response);
                                            iziToast.show({
                                                title: `Failed to remove category!`,
                                                message: `There was an error trying to remove the category.`,
                                                timeout: 10000,
                                                close: true,
                                                color: 'red',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        }
                                    });
                                }],
                            ['<button><b>Cancel</b></button>', function (instance, toast) {
                                    instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                }],
                        ]
                    });
                }
            }
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-modal-config-list-items.'
        });
    }
};

document.querySelector("#btn-options-api").onclick = function () {
    try {
        $('#options-modal-config-form-form').html(``);
        $('#options-modal-config-form-extra').html(``);
        $('#options-modal-config-form-form').jsonForm({
            "schema": {
                "apiPath": {
                    "title": "API Path",
                    "description": "The path to call on WWSU's server (do not include the first part of the URL)",
                    "type": "string"
                },
                "jsonData": {
                    "title": "JSON formatted data",
                    "description": "Provide JSON to pass as data to this call",
                    "type": "textarea"
                },
                "apiAuth": {
                    "title": "Authentication",
                    "description": "Choose which type of authentication is required for this endpoint.",
                    "type": "string",
                    "enum": [
                        "none",
                        "host",
                        "dj",
                        "director",
                        "admin director"
                    ]
                },
            },
            "value": {
                "apiPath": ``,
                "jsonData": `{}`,
                "apiAuth": `none`,
            },
            "onSubmitValid": function (values) {
                var theReq;
                var db;
                switch (values.apiAuth)
                {
                    case "none":
                        theReq = noReq;
                        break;
                    case "host":
                        theReq = hostReq;
                        break;
                    case "dj":
                        theReq = djReq;
                        db = Djs();
                        break;
                    case "director":
                        theReq = directorReq;
                        db = Directors();
                        break;
                    case "admin director":
                        theReq = adminDirectorReq;
                        db = Directors({admin: true});
                        break;
                }
                theReq.request({db: db, method: 'POST', url: nodeURL + '/' + values.apiPath, data: JSON.parse(values.jsonData)}, function (response) {
                    iziToast.show({
                        title: `Query placed!`,
                        message: JSON.stringify(response) || response,
                        timeout: false,
                        close: true,
                        color: 'green',
                        drag: false,
                        position: 'center',
                        closeOnClick: true,
                        overlay: false,
                        zindex: 1000
                    });
                });
            }
        });
        $("#options-modal-config-form-label").html(`API Query`);
        $("#options-modal-config-form").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-api.'
        });
    }
};

document.querySelector("#btn-options-directors").onclick = function () {
    try {
        $("#options-modal-directors").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-directors.'
        });
    }
};

document.querySelector("#options-timesheets-filter").onclick = function () {
    loadTimesheets(moment(document.querySelector("#options-timesheets-date").value));
};

document.querySelector("#options-announcements-add").onclick = function () {
    document.querySelector("#options-announcement-starts").value = moment().format("YYYY-MM-DD\THH:mm");
    document.querySelector("#options-announcement-expires").value = moment().add(1, 'weeks').format("YYYY-MM-DD\THH:mm");
    document.querySelector("#options-announcement-type").value = "undefined";
    document.querySelector("#options-announcement-displaytime").value = 15;
    document.querySelector("#options-announcement-title").value = "";
    document.querySelector("#options-announcement-level").value = "undefined";
    quill2.setText("\n");
    document.querySelector("#options-announcement-button").innerHTML = `<button type="button" class="btn btn-success btn-lg" id="options-announcement-add" title="Add announcement">Add</button>`;
    $("#options-modal-announcement").iziModal('open');
};

document.querySelector("#btn-options-logs").onclick = function () {
    var att = document.querySelector('#global-logs');
    att.innerHTML = ``;
    $("#options-modal-global-logs").iziModal('open');
    $('#options-modal-global-logs').animateCss('flash slower', function () {});
};

document.querySelector("#filter-global-logs").onclick = function () {
    filterGlobalLogs(document.querySelector("#global-log-filter").value);
};

function filterGlobalLogs(date) {
    try {
        document.querySelector('#global-logs').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
        hostReq.request({method: 'POST', url: nodeURL + '/attendance/get', data: {date: moment(date).toISOString(true)}}, function (response) {
            var att = document.querySelector('#global-logs');
            att.innerHTML = ``;
            att.scrollTop = 0;
            if (response.length > 0)
            {
                var formatted = {};
                response.map(record => {
                    var theDate;
                    if (record.actualStart !== null)
                    {
                        theDate = moment(record.actualStart);
                    } else {
                        theDate = moment(record.scheduledStart);
                    }
                    var theClass = 'secondary';
                    if (typeof formatted[moment(theDate).format("MM/DD/YYYY")] === 'undefined')
                    {
                        formatted[moment(theDate).format("MM/DD/YYYY")] = [];
                    }
                    if (record.event.startsWith("Show: ") || record.event.startsWith("Prerecord: "))
                    {
                        theClass = "danger";
                    } else if (record.event.startsWith("Sports: "))
                    {
                        theClass = "success";
                    } else if (record.event.startsWith("Remote: "))
                    {
                        theClass = "purple";
                    } else if (record.event.startsWith("Genre: ") || record.event.startsWith("Playlist: "))
                    {
                        theClass = "info";
                    }
                    if (record.scheduledStart === null)
                    {
                        formatted[moment(theDate).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-7 text-info">
                                    ${record.event}
                                </div>
                                <div class="col-4">
                        <span class="text-secondary">UNSCHEDULED</span><br />
                        <span class="text-primary">${moment(record.actualStart).format("h:mm A")} - ${record.actualEnd !== null ? moment(record.actualEnd).format("h:mm A") : `ONGOING`}</span>
                                </div>
                                    <div class="col-1">
                                        <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the log for this program.">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                                        </div>
                            </div>`);
                    } else if (moment(record.scheduledStart).isAfter(moment(Meta.time)))
                    {
                        formatted[moment(theDate).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-7 text-info">
                                    ${record.event}
                                </div>
                                <div class="col-4">
                        <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                        <span class="text-primary">FUTURE EVENT</span>
                                </div>
                                    <div class="col-1">
                                        </div>
                            </div>`);
                    } else if (record.actualStart !== null && record.actualEnd !== null)
                    {
                        if (Math.abs(moment(record.scheduledStart).diff(moment(record.actualStart), 'minutes')) >= 10 || Math.abs(moment(record.scheduledEnd).diff(moment(record.actualEnd), 'minutes')) >= 10)
                        {
                            formatted[moment(theDate).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-7 text-info">
                                    ${record.event}
                                </div>
                                <div class="col-4">
                        <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                        <span class="text-primary">${moment(record.actualStart).format("h:mm A")} - ${record.actualEnd !== null ? moment(record.actualEnd).format("h:mm A") : `ONGOING`}</span>
                                </div>
                                    <div class="col-1">
                        <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the log for this program.">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                                        </div>
                            </div>`);
                        } else {
                            formatted[moment(theDate).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-7 text-info">
                                    ${record.event}
                                </div>
                                <div class="col-4">
                        <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                        <span class="text-primary">${moment(record.actualStart).format("h:mm A")} - ${record.actualEnd !== null ? moment(record.actualEnd).format("h:mm A") : `ONGOING`}</span>
                                </div>
                                    <div class="col-1">
                        <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the log for this program.">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                                        </div>
                            </div>`);
                        }
                    } else if (record.actualStart !== null && record.actualEnd === null)
                    {
                        formatted[moment(theDate).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-7 text-info">
                                    ${record.event}
                                </div>
                                <div class="col-4">
                        <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                        <span class="text-primary">${moment(record.actualStart).format("h:mm A")} - ${record.actualEnd !== null ? moment(record.actualEnd).format("h:mm A") : `ONGOING`}</span>
                                </div>
                                    <div class="col-1">
                        <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the log for this program.">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                                        </div>
                            </div>`);
                    } else if (record.actualStart === null && record.actualEnd === null) {
                        formatted[moment(theDate).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-7 text-info">
                                    ${record.event}
                                </div>
                                <div class="col-4">
                        <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                        <span class="text-primary">ABSENT / DID NOT AIR</span>
                                </div>
                                    <div class="col-1">
                                        </div>
                            </div>`);
                    } else {
                        formatted[moment(theDate).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-7 text-info">
                                    ${record.event}
                                </div>
                                <div class="col-4">
                        <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                        <span class="text-primary">NOT YET STARTED</span>
                                </div>
                                    <div class="col-1">
                                        </div>
                            </div>`);
                    }
                });

                for (var k in formatted) {
                    /*
                     att.innerHTML += `<div class="row bg-primary-dark m-1">
                     <div class="col-3 text-primary-light">
                     </div>
                     <div class="col-4 text-warning-light">
                     ${k}
                     </div>
                     <div class="col-4 text-success-light">
                     </div>
                     </div>`;
                     */

                    if (formatted[k].length > 0)
                        formatted[k].map(record => att.innerHTML += record);
                }
            }
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in filterGlobalLogs.'
        });
    }
}

document.querySelector("#btn-options-issues").onclick = function () {
    document.querySelector('#dj-show-logs').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
    document.querySelector('#dj-logs-listeners').innerHTML = '';
    $("#options-modal-dj-logs").iziModal('open');
    hostReq.request({method: 'POST', url: nodeURL + '/logs/get', data: {subtype: "ISSUES", start: moment().subtract(7, 'days').toISOString(true), end: moment().toISOString(true)}}, function (response) {
        var logs = document.querySelector('#dj-show-logs');
        logs.innerHTML = ``;
        logs.scrollTop = 0;
        if (response.length > 0)
        {
            response.reverse();
            var formatted = {};
            response.map(log => {
                if (typeof formatted[moment(log.createdAt).format("MM/DD/YYYY")] === 'undefined')
                {
                    formatted[moment(log.createdAt).format("MM/DD/YYYY")] = [];
                }
                formatted[moment(log.createdAt).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${log.loglevel} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-3 text-primary">
                                    ${moment(log.createdAt).format("h:mm:ss A")}
                                </div>
                                <div class="col-9 text-secondary">
                                ${log.event}
                                ${log.trackArtist !== null && log.trackArtist !== "" ? `<br />Track: ${log.trackArtist}` : ``}${log.trackTitle !== null && log.trackTitle !== "" ? ` - ${log.trackTitle}` : ``}
                                ${log.trackAlbum !== null && log.trackAlbum !== "" ? `<br />Album: ${log.trackAlbum}` : ``}
                                ${log.trackLabel !== null && log.trackLabel !== "" ? `<br />Label: ${log.trackLabel}` : ``}
                                </div>
                            </div>`);
            });

            for (var k in formatted) {

                logs.innerHTML += `<div class="row bg-info m-1">
                                <div class="col-12 text-light" style="text-align: center;">
                                ${k}
                                </div>
                            </div>`;


                if (formatted[k].length > 0)
                    formatted[k].map(record => logs.innerHTML += record);
            }
        }
    });
};

document.querySelector("#btn-options-calendar").onclick = function () {
    try {
        document.querySelector('#calendar-verify').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
        $("#options-modal-calendar").iziModal('open');
        var calendar = document.querySelector('#calendar-verify');
        calendar.innerHTML = ``;
        calendar.scrollTop = 0;

        // Define a comparison function that will order calendar events by start time when we run the iteration
        var compare = function (a, b) {
            try {
                if (moment(a.start).valueOf() < moment(b.start).valueOf())
                    return -1;
                if (moment(a.start).valueOf() > moment(b.start).valueOf())
                    return 1;
                return 0;
            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please check the logs',
                    message: `Error occurred in the compare function of Calendar.sort in the #btn-options-calendar call.`
                });
            }
        };
        var records = Calendar().get();
        if (records.length > 0)
            records = records.filter((event) => moment(event.start).isBefore(moment(Meta.time).startOf('day').add(8, 'days')));
        if (records.length > 0)
        {
            var formatted = {};
            records.sort(compare);
            records.map(event =>
            {
                if (typeof formatted[moment(event.start).format("MM/DD/YYYY")] === 'undefined')
                {
                    formatted[moment(event.start).format("MM/DD/YYYY")] = [];
                }
                var cell3 = ``;
                var theClass = `secondary`;
                var theTitle = `This event does not have a recognized prefix. Please check the prefix if this event was meant to trigger something.`;
                if (event.active === -1)
                {
                    cell3 = `<span class="badge badge-secondary">Cancelled</span>`;
                    theClass = `secondary`;
                    theTitle = `This event is cancelled.`;
                } else if (event.verify === 'Valid')
                {
                    cell3 = `<span class="badge badge-success">Valid</span>`;
                    theClass = `success`;
                    theTitle = `This event is good.`;
                } else if (event.verify === 'Invalid')
                {
                    cell3 = `<span class="badge badge-danger">Invalid</span>`;
                    theClass = `danger`;
                    theTitle = `This event will not trigger due to critical issues.`;
                } else if (event.verify === 'Check')
                {
                    cell3 = `<span class="badge badge-warning">Check</span>`;
                    theClass = `warning`;
                    theTitle = `This event is good, but has minor issues.`;
                } else {
                    cell3 = `<span class="badge badge-dark">Manual</span>`;
                    theClass = `secondary`;
                    theTitle = `This event does not have a recognized prefix. Please check the prefix if this event was meant to trigger something.`;
                }
                formatted[moment(event.start).format("MM/DD/YYYY")].push(`<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;" title="${theTitle}">
                                <div class="col-3 text-primary">
                                    ${moment(event.start).format("h:mm A")} - ${moment(event.end).format("h:mm A")}
                                </div>
                                <div class="col-3 text-secondary">
                                    ${event.verify_titleHTML}
                                </div>
                                    <div class="col-6 text-info">
                                        ${event.verify_message}
                                        </div>
                            </div>`);
            });

            for (var k in formatted) {

                calendar.innerHTML += `<div class="row m-1 bg-info">
                                <div class="col-12 text-light" style="text-align: center;">
                                    ${k}
                                </div>
                            </div>`;


                if (formatted[k].length > 0)
                    formatted[k].map(record => calendar.innerHTML += record);
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-calendar.'
        });
    }
};

document.querySelector("#btn-options-announcements").onclick = function () {
    try {
        document.querySelector('#options-announcements').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
        checkAnnouncements();
        $("#options-modal-announcements").iziModal('open');
    } catch (e) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-calendar.'
        });
    }
};

document.querySelector("#btn-options-djcontrols").onclick = function () {
    try {
        $("#options-modal-djcontrols").iziModal('open');
    } catch (e) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-djcontrols.'
        });
    }
};

document.querySelector("#btn-options-discipline").onclick = function () {
    try {
        $("#options-modal-discipline").iziModal('open');
    } catch (e) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-discipline.'
        });
    }
};

document.querySelector("#btn-options-radiodj").onclick = function () {
    try {
        iziToast.show({
            timeout: 60000,
            overlay: true,
            displayMode: 'once',
            color: 'yellow',
            id: 'inputs',
            zindex: 999,
            layout: 2,
            image: `assets/images/radio.png`,
            title: 'Switch RadioDJ',
            message: 'Are you sure you want the system to switch which RadioDJ is active?',
            position: 'center',
            drag: false,
            closeOnClick: false,
            buttons: [
                ['<button><b>Switch RadioDJ</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                        directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/state/change-radio-dj', data: {}}, function (response) {
                            if (response === 'OK')
                            {
                                iziToast.show({
                                    title: `RadioDJ changed!`,
                                    message: `RadioDJ instance was changed.`,
                                    timeout: 5000,
                                    close: true,
                                    color: 'green',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: false,
                                    zindex: 1000
                                });
                            } else {
                                console.dir(response);
                                iziToast.show({
                                    title: `Failed to change RadioDJ!`,
                                    message: `There was an error trying to change RadioDJ instances.`,
                                    timeout: 10000,
                                    close: true,
                                    color: 'red',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: false,
                                    zindex: 1000
                                });
                            }
                        });
                    }],
                ['<button><b>Cancel</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                    }],
            ]
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #btn-options-radiodj.'
        });
    }

};

document.querySelector(`#options-modal-djs`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`options-dj-`))
            {
                if (e.target.id === 'options-dj-mass-xp')
                {
                    document.querySelector("#options-xp-date").value = moment(Meta.time).format("YYYY-MM-DD\THH:mm");
                    document.querySelector("#options-xp-type").value = "undefined-undefined";
                    document.querySelector("#options-xp-description").value = "";
                    document.querySelector("#options-xp-amount").value = 0;
                    document.querySelector("#options-xp-djs").style.display = "inline-block";
                    document.querySelector("#options-xp-djs-none").style.display = "none";
                    document.querySelector("#options-xp-button").innerHTML = `<button type="button" class="btn btn-success btn-large" id="options-xp-add" title="Add Note/Remote/XP">Add</button>`;
                    Djs().each(dj => {
                        var temp = document.querySelector(`#options-xp-djs-i-${dj.ID}`);
                        if (temp)
                            temp.checked = false;
                    });
                    $("#options-modal-dj-xp-add").iziModal('open');
                } else if (e.target.id === 'options-dj-add') {
                    var inputData = "";
                    iziToast.show({
                        timeout: 180000,
                        overlay: true,
                        displayMode: 'once',
                        color: 'yellow',
                        id: 'inputs',
                        zindex: 999,
                        layout: 2,
                        image: `assets/images/renameDJ.png`,
                        maxWidth: 480,
                        title: 'Case-Sensitive DJ Name',
                        message: 'Make sure you type it correctly and it matches what you use on Google Calendar (if applicable)!',
                        position: 'center',
                        drag: false,
                        closeOnClick: false,
                        inputs: [
                            ['<input type="text">', 'keyup', function (instance, toast, input, e) {
                                    inputData = input.value;
                                }, true],
                        ],
                        buttons: [
                            ['<button><b>Submit</b></button>', function (instance, toast) {
                                    instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                    directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/djs/add', data: {name: inputData, login: null}}, function (response) {
                                        if (response === 'OK')
                                        {
                                            iziToast.show({
                                                title: `DJ Added!`,
                                                message: `DJ was added!`,
                                                timeout: 10000,
                                                close: true,
                                                color: 'green',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        } else {
                                            console.dir(response);
                                            iziToast.show({
                                                title: `Failed to add DJ!`,
                                                message: `There was an error trying to add the new DJ.`,
                                                timeout: 10000,
                                                close: true,
                                                color: 'red',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        }
                                    });
                                }],
                            ['<button><b>Cancel</b></button>', function (instance, toast) {
                                    instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                }],
                        ]
                    });
                }
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-modal-djs.'
        });
    }
});

document.querySelector(`#options-djs`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`options-dj-`))
            {
                if (e.target.id !== 'options-dj-add' && e.target.id !== 'options-dj-mass-xp')
                {
                    document.querySelector('#options-dj-name').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
                    document.querySelector('#dj-remotes').innerHTML = `???`;
                    document.querySelector('#dj-xp').innerHTML = `???`;
                    document.querySelector('#dj-showtime').innerHTML = `???`;
                    document.querySelector('#dj-listenertime').innerHTML = `???`;
                    document.querySelector('#options-dj-buttons').innerHTML = ``;
                    document.querySelector('#dj-attendance').innerHTML = ``;
                    $("#options-modal-dj").iziModal('open');
                    loadDJ(e.target.dataset.dj);
                } else if (e.target.id === 'options-dj-mass-xp')
                {
                    document.querySelector("#options-xp-date").value = moment(Meta.time).format("YYYY-MM-DD\THH:mm");
                    document.querySelector("#options-xp-type").value = "undefined-undefined";
                    document.querySelector("#options-xp-description").value = "";
                    document.querySelector("#options-xp-amount").value = 0;
                    document.querySelector("#options-xp-djs").style.display = "inline-block";
                    document.querySelector("#options-xp-djs-none").style.display = "none";
                    document.querySelector("#options-xp-button").innerHTML = `<button type="button" class="btn btn-success btn-large" id="options-xp-add" title="Add Note/Remote/XP">Add</button>`;
                    Djs().each(dj => {
                        var temp = document.querySelector(`#options-xp-djs-i-${dj.ID}`);
                        if (temp)
                            temp.checked = false;
                    });
                    $("#options-modal-dj-xp-add").iziModal('open');
                } else {
                    var inputData = "";
                    iziToast.show({
                        timeout: 180000,
                        overlay: true,
                        displayMode: 'once',
                        color: 'yellow',
                        id: 'inputs',
                        zindex: 999,
                        layout: 2,
                        image: `assets/images/renameDJ.png`,
                        maxWidth: 480,
                        title: 'Case-Sensitive DJ Name',
                        message: 'Make sure you type it correctly and it matches what you use on Google Calendar (if applicable)!',
                        position: 'center',
                        drag: false,
                        closeOnClick: false,
                        inputs: [
                            ['<input type="text">', 'keyup', function (instance, toast, input, e) {
                                    inputData = input.value;
                                }, true],
                        ],
                        buttons: [
                            ['<button><b>Submit</b></button>', function (instance, toast) {
                                    instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                    directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/djs/add', data: {name: inputData, login: null}}, function (response) {
                                        if (response === 'OK')
                                        {
                                            iziToast.show({
                                                title: `DJ Added!`,
                                                message: `DJ was added!`,
                                                timeout: 10000,
                                                close: true,
                                                color: 'green',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        } else {
                                            console.dir(response);
                                            iziToast.show({
                                                title: `Failed to add DJ!`,
                                                message: `There was an error trying to add the new DJ.`,
                                                timeout: 10000,
                                                close: true,
                                                color: 'red',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        }
                                    });
                                }],
                            ['<button><b>Cancel</b></button>', function (instance, toast) {
                                    instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                }],
                        ]
                    });
                }
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-djs.'
        });
    }
});

document.querySelector(`#options-timesheets-records`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`timesheet-t-`))
            {
                var timesheetID = parseInt(e.target.id.replace(`timesheet-t-`, ``));
                Timesheets
                        .filter(record => record.ID === timesheetID)
                        .map(record => {
                            document.querySelector(`#options-modal-config-form-form`).innerHTML = ``;
                            $('#options-modal-config-form-extra').html(``);
                            $('#options-modal-config-form-form').jsonForm({
                                "schema": {
                                    "tClockIn": {
                                        "title": "Clocked In",
                                        "description": "Date and time the director clocked in.",
                                        "type": "datetime-local"
                                    },
                                    "tClockOut": {
                                        "title": "Clocked Out",
                                        "description": "Date and time the director clocked out",
                                        "type": "datetime-local"
                                    },
                                    "tApproved": {
                                        "title": "Approved",
                                        "description": "Is this record approved / counting towards weekly hours?",
                                        "type": "boolean",
                                    },
                                },
                                "value": {
                                    "tClockIn": record.time_in !== null ? moment(record.time_in).format("YYYY-MM-DD\THH:mm") : ``,
                                    "tClockOut": record.time_out !== null ? moment(record.time_out).format("YYYY-MM-DD\THH:mm") : ``,
                                    "tApproved": record.approved,
                                },
                                "onSubmitValid": function (values) {
                                    adminDirectorReq.request({db: Directors({admin: true}), method: 'POST', url: nodeURL + '/timesheet/edit', data: {ID: record.ID, time_in: moment(values.tClockIn).toISOString(true), time_out: moment(values.tClockOut).toISOString(true), approved: values.tApproved}}, function (response) {
                                        if (response === 'OK')
                                        {
                                            $("#options-modal-config-form").iziModal('close');
                                            iziToast.show({
                                                title: `Timesheet Edited!`,
                                                message: `Timesheet record was edited!`,
                                                timeout: 10000,
                                                close: true,
                                                color: 'green',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        } else {
                                            console.dir(response);
                                            iziToast.show({
                                                title: `Failed to edit timesheet!`,
                                                message: `There was an error trying to edit the timesheet.`,
                                                timeout: 10000,
                                                close: true,
                                                color: 'red',
                                                drag: false,
                                                position: 'center',
                                                closeOnClick: true,
                                                overlay: false,
                                                zindex: 1000
                                            });
                                        }
                                    });
                                }
                            });
                            $(`#options-modal-config-form-extra`).html(`Record created: <strong>${moment(record.createdAt).format("LLLL")}</strong><br />Record last updated: <strong>${moment(record.updatedAt).format("LLLL")}</strong><br /><br />Scheduled time in: <strong>${record.scheduled_in !== null ? moment(record.scheduled_in).format("LLLL") : `not scheduled`}</strong><br />Scheduled time out: <strong>${record.scheduled_out !== null ? moment(record.scheduled_out).format("LLLL") : `not scheduled`}</strong>`);
                            $("#options-modal-config-form-label").html(`Edit Timesheet`);
                            $("#options-modal-config-form").iziModal('open');
                        });
            }
        }
    } catch (err) {
    }
});

document.querySelector(`#modal-notifications`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id === `modal-notifications-close`)
            {
                Notifications = [];
                var tempi2 = document.querySelector(`#notification-groups`);
                if (tempi2 !== null)
                {
                    tempi2.innerHTML = ``;
                }
                $('#modal-notifications').iziModal('close');
            } else if (e.target.id.startsWith(`notification-group-`))
            {
                var group = e.target.id.replace(`notification-group-`, ``);
                var notifications = Notifications.filter((note) => note.group === group);
                // TODO: finish this
                iziToast.show({
                    title: 'Working on it!',
                    message: `I do not have this done yet. See admin menu -> issues in the mean time.`
                });
            }
        }
    } catch (err) {
    }
});

document.querySelector(`#options-modal-directors`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`options-director-`))
            {
                if (e.target.id === 'options-director-new')
                {
                    document.querySelector("#options-director-name").value = "";
                    document.querySelector("#options-director-login").value = "";
                    document.querySelector("#options-director-position").value = "";
                    document.querySelector("#options-director-admin").checked = false;
                    document.querySelector("#options-director-assistant").checked = false;
                    document.querySelector("#options-director-button").innerHTML = `<button type="button" class="btn btn-success btn-lg" id="options-director-add" title="Add director into the system">Add</button>`;
                    $("#options-modal-director").iziModal('open');
                } else if (e.target.id === "options-director-timesheets")
                {
                    document.querySelector("#options-timesheets-date").value = moment(Meta.time).startOf('week').format("YYYY-MM-DD");
                    document.querySelector('#options-timesheets-records').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
                    $("#options-modal-timesheets").iziModal('open');
                    loadTimesheets(moment(Meta.time).startOf('week'));
                }
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-modal-directors.'
        });
    }
});

document.querySelector(`#options-directors`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`options-director-`))
            {
                var director = parseInt(e.target.id.replace("options-director-", ""));
                var director2 = Directors({ID: director}).first();
                document.querySelector("#options-director-name").value = director2.name;
                document.querySelector("#options-director-login").value = "";
                document.querySelector("#options-director-position").value = director2.position;
                document.querySelector("#options-director-admin").checked = director2.admin;
                document.querySelector("#options-director-assistant").checked = director2.assistant;
                document.querySelector("#options-director-button").innerHTML = `<button type="button" class="btn btn-urgent btn-lg" id="options-director-edit-${director}" title="Edit this director">Edit</button>
                <button type="button" class="btn btn-danger btn-lg" id="options-director-remove-${director}">Remove</button>`;
                $("#options-modal-director").iziModal('open');
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-directors.'
        });
    }
});

document.querySelector(`#options-dj-buttons`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id === 'btn-options-dj-edit')
            {
                var inputData = "";
                iziToast.show({
                    timeout: 180000,
                    overlay: true,
                    displayMode: 'once',
                    color: 'yellow',
                    id: 'inputs',
                    zindex: 999,
                    layout: 2,
                    image: `assets/images/renameDJ.png`,
                    maxWidth: 480,
                    title: 'Case-Sensitive DJ Name',
                    message: 'Make sure you type it correctly and it matches what you use on Google Calendar (if applicable)! If you provide the name of a DJ that already exists, all Notes, Remote Credits, XP, and logs from this DJ will be merged with the other DJ.',
                    position: 'center',
                    drag: false,
                    closeOnClick: false,
                    inputs: [
                        ['<input type="text">', 'keyup', function (instance, toast, input, e) {
                                inputData = input.value;
                            }, true],
                    ],
                    buttons: [
                        ['<button><b>Edit</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/djs/edit', data: {ID: e.target.dataset.dj, name: inputData}}, function (response) {
                                    if (response === 'OK')
                                    {
                                        iziToast.show({
                                            title: `DJ Edited!`,
                                            message: `DJ was edited!`,
                                            timeout: 15000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    } else {
                                        console.dir(response);
                                        iziToast.show({
                                            title: `Failed to edit DJ!`,
                                            message: `There was an error trying to edit the DJ.`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    }
                                });
                            }],
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                            }],
                    ]
                });
            } else if (e.target.id === 'btn-options-dj-remove')
            {
                var inputData = "";
                iziToast.show({
                    timeout: 60000,
                    overlay: true,
                    displayMode: 'once',
                    color: 'yellow',
                    id: 'inputs',
                    zindex: 999,
                    layout: 2,
                    image: `assets/images/trash.png`,
                    maxWidth: 480,
                    title: 'Remove DJ',
                    message: 'THIS CANNOT BE UNDONE! Are you sure you want to remove ' + e.target.dataset.dj + '? All notes, remote credits, and XP will be lost (but show logs will remain in the database)!',
                    position: 'center',
                    drag: false,
                    closeOnClick: false,
                    buttons: [
                        ['<button><b>Remove</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/djs/remove', data: {ID: e.target.dataset.dj}}, function (response) {
                                    if (response === 'OK')
                                    {
                                        $("#options-modal-dj").iziModal('close');
                                        iziToast.show({
                                            title: `DJ Removed!`,
                                            message: `DJ was removed!`,
                                            timeout: 15000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    } else {
                                        console.dir(response);
                                        iziToast.show({
                                            title: `Failed to remove DJ!`,
                                            message: `There was an error trying to remove the DJ.`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    }
                                });
                            }],
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                            }],
                    ]
                });
            } else if (e.target.id === 'btn-options-dj-xp')
            {
                $("#options-modal-dj-xp").iziModal('open');
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-djs.'
        });
    }
});

document.querySelector(`#dj-xp-add-div`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id === 'dj-xp-add')
            {
                document.querySelector("#options-xp-date").value = moment(Meta.time).format("YYYY-MM-DD\THH:mm");
                document.querySelector("#options-xp-type").value = "undefined-undefined";
                document.querySelector("#options-xp-description").value = "";
                document.querySelector("#options-xp-amount").value = 0;
                document.querySelector("#options-xp-djs").style.display = "inline-block";
                document.querySelector("#options-xp-djs-none").style.display = "none";
                document.querySelector("#options-xp-button").innerHTML = `<button type="button" class="btn btn-success btn-large" id="options-xp-add" title="Add Note/Remote/XP">Add</button>`;
                Djs().each(dj => {
                    var temp = document.querySelector(`#options-xp-djs-i-${dj.ID}`);
                    if (temp)
                        temp.checked = false;
                });
                var temp = document.querySelector(`#options-xp-djs-i-${e.target.dataset.dj}`);
                if (temp)
                    temp.checked = true;
                $("#options-modal-dj-xp-add").iziModal('open');
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #dj-xp-add-div.'
        });
    }
});

document.querySelector(`#dj-attendance`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            if (e.target.id.startsWith(`dj-show-logs-`))
            {
                document.querySelector('#dj-show-logs').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
                document.querySelector('#dj-logs-listeners').innerHTML = '';
                $("#options-modal-dj-logs").iziModal('open');
                hostReq.request({method: 'POST', url: nodeURL + '/logs/get', data: {attendanceID: parseInt(e.target.id.replace(`dj-show-logs-`, ``))}}, function (response) {
                    var logs = document.querySelector('#dj-show-logs');
                    logs.scrollTop = 0;

                    var newLog = ``;
                    if (response.length > 0)
                    {
                        response.map(log => {
                            newLog += `<div class="row m-1 bg-light-1 border-left border-${log.loglevel} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-3 text-primary">
                                    ${moment(log.createdAt).format("h:mm:ss A")}
                                </div>
                                <div class="col-9 text-secondary">
                                ${log.event}
                                ${log.trackArtist !== null && log.trackArtist !== "" ? `<br />Track: ${log.trackArtist}` : ``}${log.trackTitle !== null && log.trackTitle !== "" ? ` - ${log.trackTitle}` : ``}
                                ${log.trackAlbum !== null && log.trackAlbum !== "" ? `<br />Album: ${log.trackAlbum}` : ``}
                                ${log.trackLabel !== null && log.trackLabel !== "" ? `<br />Label: ${log.trackLabel}` : ``}
                                </div>
                            </div>`;
                        });
                        logs.innerHTML = newLog;
                        hostReq.request({method: 'POST', url: nodeURL + '/listeners/get', data: {start: moment(response[0].createdAt).toISOString(true), end: moment(response[response.length - 1].createdAt).toISOString(true)}}, function (response2) {

                            if (response2.length > 1)
                            {
                                var data = [];
                                response2.map(listener => {
                                    if (moment(listener.createdAt).isBefore(moment(response[0].createdAt)))
                                        listener.createdAt = response[0].createdAt;
                                    data.push({x: moment(listener.createdAt).toISOString(true), y: listener.listeners});
                                });
                                data.push({x: moment(response[response.length - 1].createdAt).toISOString(true), y: response[response.length - 1].listeners});
                                new Taucharts.Chart({
                                    data: data,
                                    type: 'line',
                                    x: 'x',
                                    y: 'y',
                                    color: 'wwsu-red',
                                    guide: {
                                        y: {label: {text: 'Online Listeners'}, autoScale: true, nice: true},
                                        x: {label: {text: 'Time'}, autoScale: true, nice: false},
                                        interpolate: 'step-after',
                                        showGridLines: 'xy',
                                    },
                                    dimensions: {
                                        x: {
                                            type: 'measure',
                                            scale: 'time'
                                        },
                                        y: {
                                            type: 'measure',
                                            scale: 'linear'
                                        }
                                    },
                                    plugins: [
                                        Taucharts.api.plugins.get('tooltip')({
                                            formatters: {
                                                x: {
                                                    label: "Time",
                                                    format: function (n) {
                                                        return moment(n).format("LT");
                                                    }
                                                },
                                                y: {
                                                    label: "Online Listeners",
                                                    format: function (n) {
                                                        return n;
                                                    }
                                                }

                                            }
                                        })
                                    ]
                                }).renderTo('#dj-logs-listeners');
                            }
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #dj-attendance.'
        });
    }
});

document.querySelector(`#global-logs`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            if (e.target.id.startsWith(`dj-show-logs-`))
            {
                document.querySelector('#dj-show-logs').innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
                document.querySelector('#dj-logs-listeners').innerHTML = '';
                $("#options-modal-dj-logs").iziModal('open');
                hostReq.request({method: 'POST', url: nodeURL + '/logs/get', data: {attendanceID: parseInt(e.target.id.replace(`dj-show-logs-`, ``))}}, function (response) {
                    var logs = document.querySelector('#dj-show-logs');
                    logs.scrollTop = 0;

                    var newLog = ``;
                    if (response.length > 0)
                    {
                        response.map(log => {
                            newLog += `<div class="row m-1 bg-light-1 border-left border-${log.loglevel} shadow-2" style="border-left-width: 5px !important;">
                                <div class="col-3 text-primary">
                                    ${moment(log.createdAt).format("h:mm:ss A")}
                                </div>
                                <div class="col-9 text-secondary">
                                ${log.event}
                                ${log.trackArtist !== null && log.trackArtist !== "" ? `<br />Track: ${log.trackArtist}` : ``}${log.trackTitle !== null && log.trackTitle !== "" ? ` - ${log.trackTitle}` : ``}
                                ${log.trackAlbum !== null && log.trackAlbum !== "" ? `<br />Album: ${log.trackAlbum}` : ``}
                                ${log.trackLabel !== null && log.trackLabel !== "" ? `<br />Label: ${log.trackLabel}` : ``}
                                </div>
                            </div>`;
                        });
                        logs.innerHTML = newLog;

                        hostReq.request({method: 'POST', url: nodeURL + '/listeners/get', data: {start: moment(response[0].createdAt).toISOString(true), end: moment(response[response.length - 1].createdAt).toISOString(true)}}, function (response2) {

                            if (response2.length > 1)
                            {
                                var data = [];
                                response2.map(listener => {
                                    if (moment(listener.createdAt).isBefore(moment(response[0].createdAt)))
                                        listener.createdAt = response[0].createdAt;
                                    data.push({x: moment(listener.createdAt).toISOString(true), y: listener.listeners});
                                });
                                data.push({x: moment(response[response.length - 1].createdAt).toISOString(true), y: response[response.length - 1].listeners});
                                new Taucharts.Chart({
                                    data: data,
                                    type: 'line',
                                    x: 'x',
                                    y: 'y',
                                    color: 'wwsu-red',
                                    guide: {
                                        y: {label: {text: 'Online Listeners'}, autoScale: true, nice: true},
                                        x: {label: {text: 'Time'}, autoScale: true, nice: false},
                                        interpolate: 'step-after',
                                        showGridLines: 'xy',
                                    },
                                    dimensions: {
                                        x: {
                                            type: 'measure',
                                            scale: 'time'
                                        },
                                        y: {
                                            type: 'measure',
                                            scale: 'linear'
                                        }
                                    },
                                    plugins: [
                                        Taucharts.api.plugins.get('tooltip')({
                                            formatters: {
                                                x: {
                                                    label: "Time",
                                                    format: function (n) {
                                                        return moment(n).format("LT");
                                                    }
                                                },
                                                y: {
                                                    label: "Online Listeners",
                                                    format: function (n) {
                                                        return n;
                                                    }
                                                }

                                            }
                                        })
                                    ]
                                }).renderTo('#dj-logs-listeners');
                            }
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #dj-attendance.'
        });
    }
});

document.querySelector(`#dj-xp-logs`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            if (e.target.id.startsWith(`dj-xp-remove-`))
            {
                var inputData = "";
                iziToast.show({
                    timeout: 60000,
                    overlay: true,
                    displayMode: 'once',
                    color: 'yellow',
                    id: 'inputs',
                    zindex: 999,
                    layout: 2,
                    image: `assets/images/trash.png`,
                    maxWidth: 480,
                    title: 'Remove Note/Remote/XP',
                    message: 'THIS CANNOT BE UNDONE! Are you sure you want to remove this note/remote/XP log?',
                    position: 'center',
                    drag: false,
                    closeOnClick: false,
                    buttons: [
                        ['<button><b>Remove</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/xp/remove', data: {ID: parseInt(e.target.id.replace(`dj-xp-remove-`, ``))}}, function (response) {
                                    if (response === 'OK')
                                    {
                                        iziToast.show({
                                            title: `Log removed!`,
                                            message: `Log was removed!`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    } else {
                                        console.dir(response);
                                        iziToast.show({
                                            title: `Failed to remove log!`,
                                            message: `There was an error trying to remove the log.`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    }
                                });
                            }],
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                            }],
                    ]
                });
            }
            if (e.target.id.startsWith(`dj-xp-edit-`))
            {
                var recordID = parseInt(e.target.id.replace(`dj-xp-edit-`, ``));
                DJData.XP
                        .filter(record => record.ID === recordID)
                        .map(record => {
                            document.querySelector("#options-xp-date").value = moment(record.createdAt).format("YYYY-MM-DD\THH:mm");
                            document.querySelector("#options-xp-type").value = `${record.type}-${record.subtype}`;
                            document.querySelector("#options-xp-description").value = record.description;
                            document.querySelector("#options-xp-amount").value = parseFloat(record.amount);
                            document.querySelector("#options-xp-djs").style.display = "none";
                            document.querySelector("#options-xp-djs-none").style.display = "inline-block";
                            document.querySelector("#options-xp-button").innerHTML = `<button type="button" class="btn btn-urgent btn-large" id="options-xp-edit-${recordID}" title="Edit Note/Remote/XP">Edit</button>`;
                            Djs().each(dj => {
                                var temp = document.querySelector(`#options-xp-djs-i-${dj.ID}`);
                                if (temp)
                                    temp.checked = false;
                            });
                            var temp = document.querySelector(`#options-xp-djs-i-${record.dj}`);
                            if (temp)
                                temp.checked = true;
                        });
                $("#options-modal-dj-xp-add").iziModal('open');
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #dj-xp-logs.'
        });
    }
});

document.querySelector(`#users`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`users-o-mute`))
            {
                var recipient = parseInt(e.target.id.replace(`users-o-mute-`, ``));
                prepareMute(recipient);
            }
            if (e.target.id.startsWith(`users-o-ban`))
            {
                var recipient = parseInt(e.target.id.replace(`users-o-ban-`, ``));
                prepareBan(recipient);
            }
            if (e.target.id.startsWith(`users-l`))
            {
                var recipient = parseInt(e.target.id.replace(`users-l-`, ``));
                selectRecipient(recipient);
                $('#navdrawerUsers').navdrawer('hide');
            }
            if (e.target.id.startsWith(`users-a`))
            {
                var recipient = parseInt(e.target.id.replace(`users-a-`, ``));
                selectRecipient(recipient);
                $('#navdrawerUsers').navdrawer('hide');
            }
            if (e.target.id.startsWith(`users-n`))
            {
                var recipient = parseInt(e.target.id.replace(`users-n-`, ``));
                selectRecipient(recipient);
                $('#navdrawerUsers').navdrawer('hide');
            }
            if (e.target.id.startsWith(`users-u`))
            {
                var recipient = parseInt(e.target.id.replace(`users-u-`, ``));
                selectRecipient(recipient);
                $('#navdrawerUsers').navdrawer('hide');
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #users.'
        });
    }
});

document.querySelector(`#messenger-buttons`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`users-o-mute`))
            {
                var recipient = parseInt(e.target.id.replace(`users-o-mute-`, ``));
                prepareMute(recipient);
            }
            if (e.target.id.startsWith(`users-o-ban`))
            {
                var recipient = parseInt(e.target.id.replace(`users-o-ban-`, ``));
                prepareBan(recipient);
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #messenger-buttons.'
        });
    }
});

document.querySelector(`#messages`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`message-o-delete`))
            {
                deleteMessage(e.target.id.replace(`message-o-delete-`, ``));
            }
            if (e.target.id.startsWith(`message-m`))
            {
                markRead(parseInt(e.target.id.replace(`message-m-`, ``)));
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #messages.'
        });
    }
});

document.querySelector(`#options-announcements`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith("options-announcements-remove-"))
            {
                var inputData = "";
                iziToast.show({
                    timeout: 60000,
                    overlay: true,
                    displayMode: 'once',
                    color: 'yellow',
                    id: 'inputs',
                    zindex: 999,
                    layout: 2,
                    image: `assets/images/trash.png`,
                    maxWidth: 480,
                    title: 'Remove announcement',
                    message: 'THIS CANNOT BE UNDONE! Are you sure you want to remove this announcement?',
                    position: 'center',
                    drag: false,
                    closeOnClick: false,
                    buttons: [
                        ['<button><b>Remove</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/announcements/remove', data: {ID: parseInt(e.target.id.replace(`options-announcements-remove-`, ``))}}, function (response) {
                                    if (response === 'OK')
                                    {
                                        checkAnnouncements();
                                        iziToast.show({
                                            title: `Announcement removed!`,
                                            message: `Announcement was removed!`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    } else {
                                        console.dir(response);
                                        iziToast.show({
                                            title: `Failed to remove announcement!`,
                                            message: `There was an error trying to remove the announcement.`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    }
                                });
                            }],
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                            }],
                    ]
                });
            }
            if (e.target.id.startsWith("options-announcements-edit-"))
            {
                var response = Announcements({ID: parseInt(e.target.id.replace(`options-announcements-edit-`, ``))}).first();
                document.querySelector("#options-announcement-starts").value = moment(response.starts).format("YYYY-MM-DD\THH:mm");
                document.querySelector("#options-announcement-expires").value = moment(response.expires).format("YYYY-MM-DD\THH:mm");
                document.querySelector("#options-announcement-type").value = response.type;
                document.querySelector("#options-announcement-displaytime").value = response.displayTime;
                document.querySelector("#options-announcement-title").value = response.title;
                document.querySelector("#options-announcement-level").value = response.level;
                quill2.clipboard.dangerouslyPasteHTML(response.announcement);
                document.querySelector("#options-announcement-button").innerHTML = `<button type="button" class="btn btn-urgent btn-lg" id="options-announcement-edit-${response.ID}" title="Edit Announcement">Edit</button>`;
                $("#options-modal-announcement").iziModal('open');
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-announcements.'
        });
    }
});

document.querySelector(`#options-djcontrols`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith("options-djcontrols-remove-"))
            {
                var inputData = "";
                var host = Hosts({ID: parseInt(e.target.id.replace(`options-djcontrols-remove-`, ``))}).first();
                iziToast.show({
                    timeout: 60000,
                    overlay: true,
                    displayMode: 'once',
                    color: 'yellow',
                    id: 'inputs',
                    zindex: 999,
                    layout: 2,
                    image: `assets/images/trash.png`,
                    maxWidth: 480,
                    title: 'Remove host',
                    message: 'THIS CANNOT BE UNDONE! Are you sure you want to remove host ' + host.friendlyname + '?',
                    position: 'center',
                    drag: false,
                    closeOnClick: false,
                    buttons: [
                        ['<button><b>Remove</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/hosts/remove', data: {ID: parseInt(e.target.id.replace(`options-djcontrols-remove-`, ``))}}, function (response) {
                                    if (response === 'OK')
                                    {
                                        checkAnnouncements();
                                        iziToast.show({
                                            title: `DJ Controls host removed!`,
                                            message: `DJ Controls host was removed!`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    } else {
                                        console.dir(response);
                                        iziToast.show({
                                            title: `Failed to remove DJ Controls host!`,
                                            message: `There was an error trying to remove the DJ Controls host. ${response}.`,
                                            timeout: 20000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000,
                                            maxWidth: 480
                                        });
                                    }
                                });
                            }],
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                            }],
                    ]
                });
            }
            if (e.target.id.startsWith("options-djcontrols-edit-"))
            {
                var checkCaution = () => {
                    if (document.querySelector("#options-host-makecalls").checked && (document.querySelector("#options-host-record").checked || document.querySelector("#options-host-silence").checked))
                    {
                        document.querySelector("#options-host-makecalls").classList.add("is-invalid");
                    } else {
                        document.querySelector("#options-host-makecalls").classList.remove("is-invalid");
                    }
                };
                document.querySelector("#options-host-makecalls").onchange = checkCaution;
                document.querySelector("#options-host-record").onchange = checkCaution;
                document.querySelector("#options-host-silence").onchange = checkCaution;

                var host = Hosts({ID: parseInt(e.target.id.replace(`options-djcontrols-edit-`, ``))}).first();
                document.querySelector("#options-host-name").value = host.friendlyname;
                document.querySelector("#options-host-authorized").checked = host.authorized;
                document.querySelector("#options-host-admin").checked = host.admin;
                document.querySelector("#options-host-makecalls").checked = host.makeCalls;
                document.querySelector("#options-host-answercalls").checked = host.answerCalls;
                document.querySelector("#options-host-record").checked = host.recordAudio;
                document.querySelector("#options-host-silence").checked = host.silenceDetection;
                document.querySelector("#options-host-requests").checked = host.requests;
                document.querySelector("#options-host-emergencies").checked = host.emergencies;
                document.querySelector("#options-host-webmessages").checked = host.webmessages;

                checkCaution();

                if (Hosts({authorized: true, admin: true}).get().length <= 1 && host.authorized && host.admin)
                {
                    document.querySelector("#options-host-authorized").disabled = true;
                    document.querySelector("#options-host-admin").disabled = true;
                    document.querySelector("#options-host-authorized").classList.add("is-invalid");
                    document.querySelector("#options-host-admin").classList.add("is-invalid");
                } else {
                    document.querySelector("#options-host-authorized").disabled = false;
                    document.querySelector("#options-host-admin").disabled = false;
                    document.querySelector("#options-host-authorized").classList.remove("is-invalid");
                    document.querySelector("#options-host-admin").classList.remove("is-invalid");
                }
                if (Hosts({silenceDetection: true}).get().length >= 1 && !host.silenceDetection)
                {
                    document.querySelector("#options-host-silence").disabled = true;
                    document.querySelector("#options-host-silence").classList.add("is-invalid");
                } else {
                    document.querySelector("#options-host-silence").disabled = false;
                    document.querySelector("#options-host-silence").classList.remove("is-invalid");
                }

                if (Hosts({recordAudio: true}).get().length >= 1 && !host.recordAudio)
                {
                    document.querySelector("#options-host-record").disabled = true;
                    document.querySelector("#options-host-record").classList.add("is-invalid");
                } else {
                    document.querySelector("#options-host-record").disabled = false;
                    document.querySelector("#options-host-record").classList.remove("is-invalid");
                }

                document.querySelector("#options-host-button").innerHTML = `<button type="button" class="btn btn-urgent btn-large" id="options-host-edit-${host.ID}" title="Edit host">Edit</button>`;
                $("#options-modal-host").iziModal('open');
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-djcontrols.'
        });
    }
});

document.querySelector(`#options-discipline`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith("options-discipline-remove-"))
            {
                var inputData = "";
                var discipline = Discipline({ID: parseInt(e.target.id.replace(`options-discipline-remove-`, ``))}).first();
                iziToast.show({
                    timeout: 60000,
                    overlay: true,
                    displayMode: 'once',
                    color: 'yellow',
                    id: 'inputs',
                    zindex: 999,
                    layout: 2,
                    image: `assets/images/trash.png`,
                    maxWidth: 480,
                    title: 'Remove discipline',
                    message: 'THIS CANNOT BE UNDONE! Are you sure you want to permanently remove discipline record ' + discipline.ID + '? Removing active discipline will cause it to no longer be in effect.',
                    position: 'center',
                    drag: false,
                    closeOnClick: false,
                    buttons: [
                        ['<button><b>Remove</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/discipline/remove', data: {ID: parseInt(e.target.id.replace(`options-discipline-remove-`, ``))}}, function (response) {
                                    if (response === 'OK')
                                    {
                                        iziToast.show({
                                            title: `Discipline removed!`,
                                            message: `Discipline record was removed!`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    } else {
                                        console.dir(response);
                                        iziToast.show({
                                            title: `Failed to remove discipline record!`,
                                            message: `There was an error trying to remove the discipline record. ${response}.`,
                                            timeout: 20000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000,
                                            maxWidth: 480
                                        });
                                    }
                                });
                            }],
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                            }],
                    ]
                });
            }
            if (e.target.id.startsWith("options-discipline-edit-"))
            {
                var discipline = Discipline({ID: parseInt(e.target.id.replace(`options-discipline-edit-`, ``))}).first();

                document.querySelector("#discipline-IP").value = discipline.IP;
                document.querySelector("#discipline-action").value = discipline.action;
                document.querySelector("#discipline-message").value = discipline.message;
                document.querySelector("#discipline-active").checked = discipline.active;

                document.querySelector("#options-discipline-button").innerHTML = `<button type="button" class="btn btn-urgent btn-large" id="options-discipline-button-edit-${discipline.ID}" title="Edit Discipline">Edit</button>`;

                $("#options-modal-discipline-record").iziModal('open');
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-discipline.'
        });
    }
});
document.querySelector(`#options-discipline-add`).addEventListener("click", function (e) {
    try {
        document.querySelector("#discipline-IP").value = "";
        document.querySelector("#discipline-action").value = "showban";
        document.querySelector("#discipline-message").value = "";
        document.querySelector("#discipline-active").checked = true;

        document.querySelector("#options-discipline-button").innerHTML = `<button type="button" class="btn btn-success btn-large" id="options-discipline-button-add" title="Edit Discipline">Add</button>`;

        $("#options-modal-discipline-record").iziModal('open');
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-discipline-add.'
        });
    }
});

document.querySelector(`#options-discipline-button`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith("options-discipline-button-edit-"))
            {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/discipline/edit', data: {ID: parseInt(e.target.id.replace(`options-discipline-button-edit-`, ``)), active: document.querySelector("#discipline-active").checked, IP: document.querySelector("#discipline-IP").value, action: document.querySelector("#discipline-action").value, message: document.querySelector("#discipline-message").value}}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-discipline-record").iziModal('close');
                        iziToast.show({
                            title: `Discipline edited!`,
                            message: `Discipline record was edited!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to edit discipline!`,
                            message: `There was an error trying to edit the discipline record.`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
            if (e.target.id === "options-discipline-button-add")
            {
                hostReq.request({db: Directors(), method: 'POST', url: nodeURL + '/discipline/add', data: {active: document.querySelector("#discipline-active").checked, IP: document.querySelector("#discipline-IP").value, action: document.querySelector("#discipline-action").value, message: document.querySelector("#discipline-message").value}}, function (response) {
                    if (response === 'OK')
                    {
                        checkAnnouncements();
                        $("#options-modal-discipline-record").iziModal('close');
                        iziToast.show({
                            title: `Discipline added!`,
                            message: `Discipline was added!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to add discipline!`,
                            message: `There was an error trying to add the discipline.`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-discipline-button.'
        });
    }
});

document.querySelector(`#options-announcement-button`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith("options-announcement-edit-"))
            {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/announcements/edit', data: {ID: parseInt(e.target.id.replace(`options-announcement-edit-`, ``)), starts: moment(document.querySelector("#options-announcement-starts").value).toISOString(true), expires: moment(document.querySelector("#options-announcement-expires").value).toISOString(true), type: document.querySelector("#options-announcement-type").value, level: document.querySelector("#options-announcement-level").value, title: document.querySelector("#options-announcement-title").value, announcement: quillGetHTML(quill2.getContents()), displayTime: document.querySelector("#options-announcement-displaytime").value}}, function (response) {
                    if (response === 'OK')
                    {
                        checkAnnouncements();
                        $("#options-modal-announcement").iziModal('close');
                        iziToast.show({
                            title: `Announcement edited!`,
                            message: `Announcement was edited!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to edit announcement!`,
                            message: `There was an error trying to edit the announcement.`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
            if (e.target.id === "options-announcement-add")
            {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/announcements/add', data: {starts: moment(document.querySelector("#options-announcement-starts").value).toISOString(true), expires: moment(document.querySelector("#options-announcement-expires").value).toISOString(true), displayTime: document.querySelector("#options-announcement-displaytime").value, type: document.querySelector("#options-announcement-type").value, level: document.querySelector("#options-announcement-level").value, title: document.querySelector("#options-announcement-title").value, announcement: quillGetHTML(quill2.getContents())}}, function (response) {
                    if (response === 'OK')
                    {
                        checkAnnouncements();
                        $("#options-modal-announcement").iziModal('close');
                        iziToast.show({
                            title: `Announcement added!`,
                            message: `Announcement was added!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to add announcement!`,
                            message: `There was an error trying to add the announcement.`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-announcement-button.'
        });
    }
});

document.querySelector(`#options-host-button`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith("options-host-edit-"))
            {
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/hosts/edit', data: {ID: parseInt(e.target.id.replace(`options-host-edit-`, ``)), friendlyname: document.querySelector("#options-host-name").value, authorized: document.querySelector("#options-host-authorized").checked, admin: document.querySelector("#options-host-admin").checked, requests: document.querySelector("#options-host-requests").checked, emergencies: document.querySelector("#options-host-emergencies").checked, webmessages: document.querySelector("#options-host-webmessages").checked, makeCalls: document.querySelector("#options-host-makecalls").checked, answerCalls: document.querySelector("#options-host-answercalls").checked, silenceDetection: document.querySelector("#options-host-silence").checked, recordAudio: document.querySelector("#options-host-record").checked}}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-host").iziModal('close');
                        iziToast.show({
                            title: `Host edited!`,
                            message: `DJ Controls host was edited!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to edit host!`,
                            message: `There was an error trying to edit the DJ Controls host. ${response}`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000,
                            maxWidth: 480
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-host-button.'
        });
    }
});

document.querySelector(`#options-xp-button`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith("options-xp-edit-"))
            {
                var types = document.querySelector("#options-xp-type").value.split("-");
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/xp/edit', data: {ID: parseInt(e.target.id.replace(`options-xp-edit-`, ``)), type: types[0], subtype: types[1], description: document.querySelector("#options-xp-description").value, amount: parseFloat(document.querySelector("#options-xp-amount").value), date: moment(document.querySelector("#options-xp-date").value).toISOString(true)}}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-dj-xp-add").iziModal('close');
                        iziToast.show({
                            title: `Note/remote/XP edited!`,
                            message: `Note/remote/XP was edited!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to edit Note/remote/XP!`,
                            message: `There was an error trying to edit the note/remote/XP.`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
            if (e.target.id === "options-xp-add")
            {
                var djs = [];
                Djs().each(dj => {
                    var temp = document.querySelector(`#options-xp-djs-i-${dj.ID}`);
                    if (temp && temp.checked)
                        djs.push(dj.ID);
                });
                var types = document.querySelector("#options-xp-type").value.split("-");
                directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/xp/add', data: {djs: djs, type: types[0], subtype: types[1], description: document.querySelector("#options-xp-description").value, amount: parseFloat(document.querySelector("#options-xp-amount").value), date: moment(document.querySelector("#options-xp-date").value).toISOString(true)}}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-dj-xp-add").iziModal('close');
                        iziToast.show({
                            title: `Note/remote/XP added!`,
                            message: `Note/remote/XP was added!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to add Note/remote/XP!`,
                            message: `There was an error trying to add the Note/remote/XP.`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-xp-button.'
        });
    }
});

document.querySelector(`#options-director-button`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith("options-director-edit-"))
            {
                adminDirectorReq.request({db: Directors({admin: true}), method: 'POST', url: nodeURL + '/directors/edit', data: {ID: parseInt(e.target.id.replace(`options-director-edit-`, ``)), name: document.querySelector("#options-director-name").value, login: document.querySelector("#options-director-login").value, position: document.querySelector("#options-director-position").value, admin: document.querySelector("#options-director-admin").checked, assistant: document.querySelector("#options-director-assistant").checked}}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-director").iziModal('close');
                        iziToast.show({
                            title: `Director edited!`,
                            message: `Director was edited!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to edit Director!`,
                            message: `There was an error trying to edit the Director.`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
            if (e.target.id === "options-director-add")
            {
                adminDirectorReq.request({db: Directors({admin: true}), method: 'POST', url: nodeURL + '/directors/add', data: {name: document.querySelector("#options-director-name").value, login: document.querySelector("#options-director-login").value, position: document.querySelector("#options-director-position").value, admin: document.querySelector("#options-director-admin").checked, assistant: document.querySelector("#options-director-assistant").checked}}, function (response) {
                    if (response === 'OK')
                    {
                        $("#options-modal-director").iziModal('close');
                        iziToast.show({
                            title: `Director added!`,
                            message: `Director was added!`,
                            timeout: 10000,
                            close: true,
                            color: 'green',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    } else {
                        console.dir(response);
                        iziToast.show({
                            title: `Failed to add Director!`,
                            message: `There was an error trying to add the Director.`,
                            timeout: 10000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: false,
                            zindex: 1000
                        });
                    }
                });
            }
            if (e.target.id.startsWith("options-director-remove-"))
            {
                iziToast.show({
                    timeout: 60000,
                    overlay: true,
                    displayMode: 'once',
                    color: 'yellow',
                    id: 'inputs',
                    zindex: 999,
                    layout: 2,
                    image: `assets/images/trash.png`,
                    maxWidth: 480,
                    title: 'Remove director',
                    message: 'THIS CANNOT BE UNDONE! Are you sure you want to remove this director? Timesheets records for this director will still remain in the system.',
                    position: 'center',
                    drag: false,
                    closeOnClick: false,
                    buttons: [
                        ['<button><b>Remove</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                                adminDirectorReq.request({db: Directors({admin: true}), method: 'POST', url: nodeURL + '/directors/remove', data: {ID: parseInt(e.target.id.replace(`options-director-remove-`, ``))}}, function (response) {
                                    if (response === 'OK')
                                    {
                                        $("#options-modal-director").iziModal('close');
                                        iziToast.show({
                                            title: `Director removed!`,
                                            message: `Director was removed! <br /><strong>WARNING!!!</strong> If you gave access for this director to run DJ Controls on their personal computer(s), you may want to revoke access by removing them from Manage Hosts.`,
                                            timeout: 30000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    } else {
                                        console.dir(response);
                                        iziToast.show({
                                            title: `Failed to remove director!`,
                                            message: `There was an error trying to remove the director.`,
                                            timeout: 10000,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: true,
                                            overlay: false,
                                            zindex: 1000
                                        });
                                    }
                                });
                            }],
                        ['<button><b>Cancel</b></button>', function (instance, toast) {
                                instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                            }],
                    ]
                });
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #options-director-button.'
        });
    }
});

document.querySelector(`#messages-unread`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            var target = null;
            if (e.target.offsetParent !== null && e.target.offsetParent.id !== `messages-unread` && !e.target.id.startsWith("message-n-x-"))
            {
                if (e.target.offsetParent.id.startsWith("message-n-m-"))
                {
                    target = parseInt(e.target.offsetParent.id.replace(`message-n-m-`, ``));
                    var message = Messages({ID: target}).first();
                    var host = (message.to === 'DJ' ? 'website' : message.from);
                    selectRecipient(Recipients({host: host}).first().ID || null);
                    $("#messages-modal").iziModal('open');
                }
            } else {
                if (e.target.id.startsWith("message-n-x-"))
                {
                    target = parseInt(e.target.id.replace(`message-n-x-`, ``));
                    markRead(target);
                }
                if (e.target.id.startsWith("message-n-m-"))
                {
                    target = parseInt(e.target.id.replace(`message-n-m-`, ``));
                    var message = Messages({ID: target}).first();
                    var host = (message.to === 'DJ' ? 'website' : message.from);
                    selectRecipient(Recipients({host: host}).first().ID || null);
                    $("#messages-modal").iziModal('open');
                }
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #messages.'
        });
    }
});

document.querySelector(`#announcements-body`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            var theId;
            if (e.target.id.startsWith(`attn-title-`))
            {
                theId = e.target.id.replace(`attn-title-`, ``);
            } else
            {
                theId = e.target.id.replace(`attn-`, ``);
            }

            var temp = document.querySelector(`#attn-title-${theId}`);
            var temp2 = document.querySelector(`#attn-body-${theId}`);
            if (temp !== null && temp2 !== null)
            {
                var temp3 = document.querySelector(`#announcement-view-modal-title`);
                var temp4 = document.querySelector(`#announcement-view-body`);
                if (temp3 !== null && temp4 !== null)
                {
                    temp3.innerHTML = temp.innerHTML;
                    temp4.innerHTML = temp2.innerHTML;
                    $("#announcement-view-modal").iziModal('open');
                }
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #announcements-body.'
        });
    }
});

document.querySelector("#btn-messenger").onclick = function () {
    $("#messages-modal").iziModal('open');
};

document.querySelector("#live-handle").onkeyup = function () {
    if (calType === 'Show' && document.querySelector("#live-handle").value === calHost)
    {
        document.querySelector("#live-handle").className = "form-control m-1";
    } else {
        document.querySelector("#live-handle").className = "form-control m-1 is-invalid";
    }
};

document.querySelector("#live-show").onkeyup = function () {
    if (calType === 'Show' && document.querySelector("#live-show").value === calShow)
    {
        document.querySelector("#live-show").className = "form-control m-1";
    } else {
        document.querySelector("#live-show").className = "form-control m-1 is-invalid";
    }
};

document.querySelector("#remote-handle").onkeyup = function () {
    if (calType === 'Remote' && document.querySelector("#remote-handle").value === calHost)
    {
        document.querySelector("#remote-handle").className = "form-control m-1";
    } else {
        document.querySelector("#remote-handle").className = "form-control m-1 is-invalid";
    }
};

document.querySelector("#remote-show").onkeyup = function () {
    if (calType === 'Remote' && document.querySelector("#remote-show").value === calShow)
    {
        document.querySelector("#remote-show").className = "form-control m-1";
    } else {
        document.querySelector("#remote-show").className = "form-control m-1 is-invalid";
    }
};

document.querySelector("#sports-sport").addEventListener("change", function () {
    if (calType === 'Sports' && document.querySelector("#sports-sport").value === calShow)
    {
        document.querySelector("#sports-sport").className = "form-control m-1";
    } else {
        document.querySelector("#sports-sport").className = "form-control m-1 is-invalid";
    }
});

document.querySelector("#sportsremote-sport").addEventListener("change", function () {
    if (calType === 'Sports' && document.querySelector("#sportsremote-sport").value === calShow)
    {
        document.querySelector("#sportsremote-sport").className = "form-control m-1";
    } else {
        document.querySelector("#sportsremote-sport").className = "form-control m-1 is-invalid";
    }
});

document.querySelector(`#track-requests`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`request-b-`))
            {
                var requestID = parseInt(e.target.id.replace(`request-b-`, ``));
                queueRequest(requestID);
            }
        }
    } catch (err) {
        console.error(err);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred during the click event of #track-requests.'
        });
    }
});

// FUNCTIONS FOR ANALOG CLOCK

/*
 * Set a timeout for the first minute hand movement (less than 1 minute), then rotate it every minute after that
 */
function setUpMinuteHands() {
    // Find out how far into the minute we are
    var containers = document.querySelectorAll('.minutes-container');
    var secondAngle = containers[0].getAttribute("data-second-angle");
    if (secondAngle > 0) {
        // Set a timeout until the end of the current minute, to move the hand
        var delay = (((360 - secondAngle) / 6) + 0.1) * 1000;
        setTimeout(function () {
            moveMinuteHands(containers);
        }, delay);
    }
}

/*
 * Do the first minute's rotation
 */
function moveHourHands(containers) {
    for (var i = 0; i < containers.length; i++) {
        containers[i].style.webkitTransform = 'rotateZ(6deg)';
        containers[i].style.transform = 'rotateZ(6deg)';
    }
    // Then continue with a 60 second interval
    setInterval(function () {
        for (var i = 0; i < containers.length; i++) {
            if (containers[i].angle === undefined) {
                containers[i].angle = 12;
            } else {
                containers[i].angle += 6;
            }
            containers[i].style.webkitTransform = 'rotateZ(' + containers[i].angle + 'deg)';
            containers[i].style.transform = 'rotateZ(' + containers[i].angle + 'deg)';
        }
    }, 60000);
}

/*
 * Do the first minute's rotation
 */
function moveMinuteHands(containers) {
    for (var i = 0; i < containers.length; i++) {
        containers[i].style.webkitTransform = 'rotateZ(6deg)';
        containers[i].style.transform = 'rotateZ(6deg)';
    }
    // Then continue with a 60 second interval
    setInterval(function () {
        for (var i = 0; i < containers.length; i++) {
            if (containers[i].angle === undefined) {
                containers[i].angle = 12;
            } else {
                containers[i].angle += 6;
            }
            containers[i].style.webkitTransform = 'rotateZ(' + containers[i].angle + 'deg)';
            containers[i].style.transform = 'rotateZ(' + containers[i].angle + 'deg)';
        }
    }, 60000);
}

/*
 * Move the second containers
 */
function moveSecondHands() {
    var containers = document.querySelectorAll('.seconds-container');
    setInterval(function () {
        for (var i = 0; i < containers.length; i++) {
            if (containers[i].angle === undefined) {
                containers[i].angle = 6;
            } else {
                containers[i].angle += 6;
            }
            containers[i].style.webkitTransform = 'rotateZ(' + containers[i].angle + 'deg)';
            containers[i].style.transform = 'rotateZ(' + containers[i].angle + 'deg)';
        }
    }, 1000);
}

// FUNCTIONS FOR PROGRAM

// Wait for a condition to be met, and then execute the callback. Fails after 1200 frames.
function waitFor(check, callback, count = 0)
{
    if (!check())
    {
        if (count < 1200)
        {
            count++;
            window.requestAnimationFrame(function () {
                waitFor(check, callback, count);
            });
        } else {
        }
    } else {
        callback();
}
}

// Called on connection to WWSU to get data and subscribe to notifications
function doSockets() {
    hostSocket(function (token) {
        if (token)
        {
            onlineSocket();
            metaSocket();
            easSocket();
            statusSocket();
            calendarSocket();
            messagesSocket();
            recipientsSocket();
        }
    });
}

function hostSocket(cb = function(token) {})
        {
            hostReq.request({method: 'POST', url: '/hosts/get', data: {host: main.getMachineID()}}, function (body) {
                //console.log(body);
                try {
                    client = body;
                    //authtoken = client.token;
                    if (!client.authorized)
                    {
                        var noConnection = document.getElementById('no-connection');
                        noConnection.style.display = "inline";
                        noConnection.innerHTML = `<div class="text container-fluid" style="text-align: center;">
                <h2 style="text-align: center; font-size: 4em; color: #F44336">Failed to Connect!</h2>
                <h2 style="text-align: center; font-size: 2em; color: #F44336">Failed to connect to WWSU. Check your network connection, and ensure this DJ Controls is authorized to connect to WWSU.</h2>
                <h2 style="text-align: center; font-size: 2em; color: #F44336">Host: ${main.getMachineID()}</h2>
            </div>`;
                        cb(false);
                    } else {
                        cb(true);

                        // Sink main audio devices
                        getAudioMain(settings.get(`audio.input.main`) || undefined);
                        sinkAudio();

                        // Determine if it is applicable to initiate the user media for audio calls
                        if (client.makeCalls)
                        {
                            console.log(`Initiating getUserMedia for makeCalls`);
                            getAudio();
                        }

                        // Disconnect current peer if it exists
                        try {
                            peer.destroy();
                        } catch (e) {
                            // Ignore errors
                        }

                        // Determine if we should start a new peer
                        if (client.makeCalls || client.answerCalls)
                        {
                            setupPeer();
                        }

                        // Reset silenceState
                        if (client.silenceDetection)
                            silenceState = -1;

                    }
                    if (client.admin)
                    {
                        if (client.otherHosts)
                            processHosts(client.otherHosts, true);
                        var temp = document.querySelector(`#options`);
                        var restarter;
                        if (temp)
                            temp.style.display = "inline";

                        // Subscribe to the logs socket
                        hostReq.request({method: 'POST', url: '/logs/get', data: {subtype: "ISSUES", start: moment().subtract(1, 'days').toISOString(true), end: moment().toISOString(true)}}, function (body) {
                            //console.log(body);
                            try {
                                // TODO
                                processLogs(body, true);
                            } catch (e) {
                                console.error(e);
                                console.log('FAILED logs CONNECTION');
                                clearTimeout(restarter);
                                restarter = setTimeout(hostSocket, 10000);
                            }
                        });

                        // Get djs and subscribe to the dj socket
                        noReq.request({method: 'post', url: nodeURL + '/djs/get', data: {}}, function serverResponded(body, JWR) {
                            //console.log(body);
                            try {
                                processDjs(body, true);
                            } catch (e) {
                                console.error(e);
                                console.log('FAILED DJs CONNECTION');
                                clearTimeout(restarter);
                                restarter = setTimeout(hostSocket, 10000);
                            }
                        });

                        // Get directors and subscribe to the directors socket
                        noReq.request({method: 'post', url: nodeURL + '/directors/get', data: {}}, function serverResponded(body, JWR) {
                            //console.log(body);
                            try {
                                processDirectors(body, true);
                            } catch (e) {
                                console.error(e);
                                console.log('FAILED directors CONNECTION');
                                clearTimeout(restarter);
                                restarter = setTimeout(hostSocket, 10000);
                            }
                        });

                        // Subscribe to the XP socket
                        hostReq.request({method: 'post', url: nodeURL + '/xp/get', data: {}}, function serverResponded(body, JWR) {
                            //console.log(body);
                            try {
                            } catch (e) {
                                console.error(e);
                                console.log('FAILED XP CONNECTION');
                                clearTimeout(restarter);
                                restarter = setTimeout(hostSocket, 10000);
                            }
                        });

                        // Subscribe to the timesheet socket
                        noReq.request({method: 'post', url: nodeURL + '/timesheet/get', data: {}}, function serverResponded(body, JWR) {
                            //console.log(body);
                            try {
                            } catch (e) {
                                console.error(e);
                                console.log('FAILED TIMESHEET CONNECTION');
                                clearTimeout(restarter);
                                restarter = setTimeout(hostSocket, 10000);
                            }
                        });

                        // Subscribe to the discipline socket
                        hostReq.request({method: 'POST', url: '/discipline/get', data: {}}, function (body) {
                            //console.log(body);
                            try {
                                processDiscipline(body, true);
                            } catch (e) {
                                console.error(e);
                                console.log('FAILED discipline CONNECTION');
                                clearTimeout(restarter);
                                restarter = setTimeout(hostSocket, 10000);
                            }
                        });

                        // Subscribe to the config socket
                        hostReq.request({method: 'POST', url: '/config/get', data: {}}, function (body) {
                            //console.log(body);
                            try {
                                processConfig(body);
                            } catch (e) {
                                console.error(e);
                                console.log('FAILED config CONNECTION');
                                clearTimeout(restarter);
                                restarter = setTimeout(hostSocket, 10000);
                            }
                        });

                    } else {
                        var temp = document.querySelector(`#options`);
                        if (temp)
                            temp.style.display = "none";
                    }
                } catch (e) {
                    console.error(e);
                    console.log('FAILED HOST CONNECTION');
                    restarter = setTimeout(hostSocket, 10000);
                }
            });
        }

// Registers this DJ Controls as a recipient
function onlineSocket()
{
    console.log('attempting online socket');
    hostReq.request({method: 'post', url: nodeURL + '/recipients/add-computers', data: {host: client.host}}, function (response) {
        try {
            //main.notification(true, "Loaded", "DJ Controls is now loaded", null, 10000);
        } catch (e) {
            console.error(e);
            console.log('FAILED ONLINE CONNECTION');
            setTimeout(onlineSocket, 10000);
        }
    });
}

// Gets wwsu metadata
function metaSocket() {
    console.log('attempting meta socket');
    noReq.request({method: 'POST', url: '/meta/get', data: {}}, function (body) {
        try {
            var startRecording = null;
            var preText = ``;
            for (var key in body)
            {
                if (body.hasOwnProperty(key))
                {
                    // Manage NCH Software RecordPad recordings
                    if (key === 'state')
                    {
                        if (((Meta[key].startsWith("automation_") || Meta[key] === 'unknown') && Meta[key] !== 'automation_break') || (Meta[key].includes("_returning") && !body[key].includes("_returning")))
                        {
                            if (body[key] === 'live_on' || body[key] === 'live_prerecord')
                            {
                                startRecording = 'live';
                                preText = `${sanitize(Meta.show)}${body[key] === 'live_prerecord' ? ` PRERECORDED` : ``}`;
                            } else if (body[key] === 'remote_on')
                            {
                                startRecording = 'remote';
                                preText = sanitize(Meta.show);
                            } else if (body[key] === 'sports_on' || body[key] === 'sportsremote_on')
                            {
                                startRecording = 'sports';
                                preText = sanitize(Meta.show);
                            } else if (body[key].startsWith("automation_"))
                            {
                                startRecording = 'automation';
                                preText = sanitize(Meta.genre);
                            }
                        } else if (!Meta[key].startsWith("automation_") && body[key].startsWith("automation_"))
                        {
                            startRecording = 'automation';
                            preText = sanitize(Meta.genre);
                        } else if (body[key].includes("_break") || body[key].includes("_returning"))
                        {
                            if (!development && client.recordAudio)
                            {
                                stopRecording();
                            }
                        }
                    }
                    Meta[key] = body[key];
                }
            }
            doMeta(body);
            if (startRecording !== null) {
                if (!development && client.recordAudio)
                {
                    newRecording(`${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`);
                    hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'recorder', logsubtype: 'automation', loglevel: 'info', event: `A recording was started.<br />Path: ${settings.get(`recorder.path`)}/${startRecording}/${preText} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
                    });
                }
            }
        } catch (e) {
            console.error(e);
            console.log(`FAILED META CONNECTION`);
            setTimeout(metaSocket, 10000);
        }
    });
}

// Internal emergency alerts
function easSocket()
{
    console.log('attempting eas socket');
    noReq.request({method: 'POST', url: '/eas/get', data: {}}, function (body) {
        try {
            processEas(body, true);
        } catch (e) {
            console.error(e);
            console.log('FAILED EAS CONNECTION');
            setTimeout(easSocket, 10000);
        }
    });
}

// Status checks
function statusSocket() {
    console.log('attempting statuc socket');
    noReq.request({method: 'POST', url: '/status/get', data: {}}, function (body) {
        //console.log(body);
        try {
            processStatus(body, true);
        } catch (e) {
            console.error(e);
            console.log('FAILED Status CONNECTION');
            setTimeout(statusSocket, 10000);
        }
    });
}

// Event calendar from Google
function calendarSocket() {
    console.log('attempting calendar socket');
    noReq.request({method: 'POST', url: '/calendar/get', data: {}}, function (body) {
        //console.log(body);
        try {
            processCalendar(body, true);
        } catch (e) {
            console.error(e);
            console.log('FAILED Calendar CONNECTION');
            setTimeout(calendarSocket, 10000);
        }
    });
}

// Messages system
function messagesSocket() {
    console.log('attempting messages socket');
    try {
        hostReq.request({method: 'post', url: nodeURL + '/messages/get', data: {host: client.host}}, function (body2) {
            //console.log(body);
            try {
                processMessages(body2, true);
            } catch (e) {
                //console.error(e);
                console.log(`FAILED messages CONNECTION via messages`);
                console.error(e);
                setTimeout(messagesSocket, 10000);
            }
        });

        hostReq.request({method: 'post', url: nodeURL + '/requests/get', data: {}}, function (body3) {
            //console.log(body);
            try {
                processRequests(body3, true);
            } catch (e) {
                //console.error(e);
                console.log(`FAILED messages CONNECTION via requests`);
                console.error(e);
                setTimeout(messagesSocket, 10000);
            }
        });
        noReq.request({method: 'POST', url: '/announcements/get', data: {type: client.admin ? 'all' : 'djcontrols'}}, function (body) {
            //console.log(body);
            try {
                processAnnouncements(body, true);
            } catch (e) {
                console.error(e);
                console.log('FAILED Announcements CONNECTION');
                setTimeout(messagesSocket, 10000);
            }
        });
    } catch (e) {
        console.log(`FAILED messages CONNECTION`);
        console.error(e);
        setTimeout(messagesSocket, 10000);
    }
}

// Retrieving a list of clients we can send/receive messages to/from
function recipientsSocket() {
    console.log('attempting recipients socket');
    hostReq.request({method: 'POST', url: '/recipients/get', data: {}}, function (body) {
        //console.log(body);
        try {
            processRecipients(body, true);
        } catch (e) {
            console.error(e);
            console.log('FAILED recipients CONNECTION');
            setTimeout(recipientsSocket, 10000);
        }
    });
}

// Called on change to any metadata info or by metaTick every second
function doMeta(metan) {
    try {

        // reset ticker timer on change to queue time
        if (typeof metan.queueFinish !== 'undefined')
        {
            clearInterval(metaTimer);
            clearTimeout(metaTimer);
            metaTimer = setTimeout(function () {
                metaTick();
                metaTimer = setInterval(metaTick, 1000);
            }, moment(Meta.queueFinish).diff(moment(Meta.queueFinish).startOf('second')));

            if (!Meta.state.startsWith("automation_") && Meta.state !== "live_prerecord")
                checkCalendar();
        }
        // Reset ticker when time is provided
        else if (typeof metan.time !== 'undefined')
        {
            clearInterval(metaTimer);
            clearTimeout(metaTimer);
            metaTimer = setInterval(metaTick, 1000);
        }

        // If changingState, display please wait overlay
        if (typeof metan.changingState !== 'undefined')
        {
            if (metan.changingState !== null)
            {
                $("#wait-modal").iziModal('open');
                document.querySelector("#wait-text").innerHTML = metan.changingState;
            } else {
                $("#wait-modal").iziModal('close');
            }
        }

        // April Fool's
        if (typeof metan.trackID !== `undefined` && parseInt(metan.trackID) >= 74255 && parseInt(metan.trackID) <= 74259)
        {
            iziToast.show({
                title: '',
                message: `<img src="assets/images/giphy.gif">`,
                timeout: 20000,
                close: true,
                color: 'blue',
                drag: false,
                position: 'center',
                closeOnClick: true,
                pauseOnHover: false,
                overlay: true,
                zindex: 250,
                layout: 2,
                image: ``,
                maxWidth: 480
            });
        }

        // Manage queueLength
        prevQueueLength = queueLength;
        queueLength = Meta.queueFinish !== null ? Math.round(moment(Meta.queueFinish).diff(moment(Meta.time), 'seconds')) : 0;
        if (queueLength < 0)
            queueLength = 0;

        if (isHost)
        {
            if (typeof metan.state !== 'undefined' && (metan.state === "sports_on" || metan.state === "sportsremote_on" || metan.state === "remote_on"))
                responsiveVoice.speak("On the air");

            if (typeof metan.state !== 'undefined' && (metan.state === "sports_break" || metan.state === "sports_halftime" || metan.state === "remote_break" || metan.state === "sportsremote_break" || metan.state === "sportsremote_halftime"))
                responsiveVoice.speak(`On break`);

            if (typeof metan.state !== 'undefined' && (metan.state === "sports_returning" || metan.state === "sportsremote_returning" || metan.state === "remote_returning"))
                responsiveVoice.speak(`Returning in ${moment.duration(queueLength, 'seconds').format("m [minutes], s [seconds]")}`);

            if (typeof metan.state !== 'undefined' && (metan.state === "automation_sports" || metan.state === "automation_sportsremote" || metan.state === "automation_remote"))
                responsiveVoice.speak(`Going on the air in ${moment.duration(queueLength, 'seconds').format("m [minutes], s [seconds]")}`);

            if (typeof metan.state === 'undefined')
            {
                if (Meta.state === 'sports_returning' || Meta.state === 'sportsremote_returning' || Meta.state === 'remote_returning' || Meta.state === 'automation_sports' || Meta.state === 'automation_sportsremote' || Meta.state === 'automation_remote')
                {
                    if (queueLength === 60)
                        responsiveVoice.speak("1 minute");
                    if (queueLength === 30)
                        responsiveVoice.speak("30 seconds");
                    if (queueLength === 15)
                        responsiveVoice.speak("15 seconds");
                    if (queueLength === 5)
                        responsiveVoice.speak("5 seconds");
                }
            }
        }

        document.querySelector("#nowplaying").innerHTML = `<div class="text-warning" style="position: absolute; top: -16px; left: 0px;">${Meta.trackFinish !== null ? moment.duration(moment(Meta.trackFinish).diff(moment(Meta.time), 'seconds'), "seconds").format() : ''}</div>${Meta.line1}<br />${Meta.line2}`;

        // Notify the DJ of a mandatory top of the hour break if they need to take one
        if (moment(Meta.time).minutes() >= 2 && moment(Meta.time).minutes() < 5 && moment(Meta.time).diff(moment(Meta.lastID), 'minutes') >= 10 && isHost)
        {
            if (document.querySelector("#iziToast-breakneeded") === null && !breakNotified)
            {
                breakNotified = true;
                var notification = notifier.notify(`Don't forget Top of Hour break!`, {
                    message: `Please take a break before :05 after the hour`,
                    icon: 'http://cdn.onlinewebfonts.com/svg/img_205852.png',
                    duration: 300000,
                });
                main.flashTaskbar();
                iziToast.show({
                    id: 'iziToast-breakneeded',
                    class: 'flash-bg',
                    title: `Do not forget Top of the Hour Break!`,
                    message: `Unless you are ending your show, you need to take a break before 5 minutes (:05) past the hour. Click "Take a Break" to take one now.`,
                    timeout: false,
                    close: true,
                    color: 'yellow',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 250,
                    layout: 2,
                    image: `assets/images/TopOfHourBreak.png`,
                    maxWidth: 480,
                    buttons: [
                        ['<button>Take a Break</button>', function (instance, toast, button, e, inputs) {
                                goBreak(false);
                                instance.hide({}, toast, 'button');
                            }]
                    ]
                });
            }
        } else {
            breakNotified = false;
            var temp = document.querySelector("#iziToast-breakneeded");
            if (temp !== null)
                iziToast.hide({}, temp);
        }

        if (typeof metan.playing !== 'undefined' && typeof metan.state === 'undefined')
            metan.state = Meta.state;

        // Make queue timer show current queue length (when visible)
        var queueTime = document.querySelector("#queue-seconds");
        queueTime.innerHTML = moment.duration(queueLength, "seconds").format("mm:ss");

        // Flash the WWSU Operations box when queue time goes below 15 seconds.
        if (queueLength < 15 && queueLength > 0 && document.querySelector('#queue').style.display !== "none")
        {
            var operations = document.querySelector("#operations");
            operations.className = "card p-1 m-3 text-white";
            operations.style.backgroundColor = "#ff6f00";
            setTimeout(function () {
                operations.className = "card p-1 m-3 text-white bg-dark";
                operations.style.backgroundColor = "";
            }, 250);
        }

        if (Meta.queueMusic)
        {
            document.querySelector('#queue-music').style.display = "inline";
        } else {
            document.querySelector('#queue-music').style.display = "none";
        }

        // Do stuff if the state changed
        if (typeof metan.state !== 'undefined' || typeof metan.playing !== 'undefined')
        {
            // Disconnect outgoing calls on breaks
            if (Meta.state === "remote_break" || Meta.state === "sportsremote_break" || Meta.state === "sportsremote_halftime")
            {
                try {
                    outgoingCloseIgnore = true;
                    console.log(`Closing call via doMeta break`);
                    outgoingCall.close();
                    outgoingCall = undefined;
                    outgoingCloseIgnore = false;
                } catch (eee) {
                    outgoingCloseIgnore = false;
                }
            }
            var temp = document.querySelector(`#remoteAudio`);
            // Mute incoming audio if something is playing
            if (Meta.state.startsWith("remote_") || Meta.state.startsWith("sportsremote_"))
            {
                if (!Meta.playing)
                {
                    if (temp !== null)
                        temp.muted = false;
                } else {
                    if (temp !== null)
                        temp.muted = true;
                }

                // Mute audio if not in any sportremote nor remote state
            } else {
                if (temp !== null)
                    temp.muted = true;
            }

            // Always re-do the calendar / clockwheel when states change.
            checkCalendar();

            // Have the WWSU Operations box display buttons and operations depending on which state we are in
            var badge = document.querySelector('#operations-state');
            badge.innerHTML = `<i class="chip-icon fas fa-question bg-secondary"></i>${Meta.state}`;
            var actionButtons = document.querySelectorAll(".btn-operation");
            for (var i = 0; i < actionButtons.length; i++) {
                actionButtons[i].style.display = "none";
            }
            //document.querySelector('#queue').style.display = "none";
            if (Meta.state === 'automation_on' || Meta.state === 'automation_break')
            {
                isHost = false;
                badge.innerHTML = `<i class="chip-icon fas fa-microphone-alt-slash bg-info"></i>${Meta.state}`;
                document.querySelector('#btn-golive').style.display = "inline";
                document.querySelector('#btn-goremote').style.display = "inline";
                document.querySelector('#btn-gosports').style.display = "inline";
                document.querySelector('#btn-gosportsremote').style.display = "inline";
            } else if (Meta.state === 'automation_playlist')
            {
                isHost = false;
                badge.innerHTML = `<i class="chip-icon fas fa-list bg-info"></i>${Meta.state}`;
                document.querySelector('#btn-golive').style.display = "inline";
                document.querySelector('#btn-goremote').style.display = "inline";
                document.querySelector('#btn-gosports').style.display = "inline";
                document.querySelector('#btn-gosportsremote').style.display = "inline";
            } else if (Meta.state === 'automation_genre')
            {
                isHost = false;
                badge.innerHTML = `<i class="chip-icon fas fa-music bg-info"></i>${Meta.state}`;
                document.querySelector('#btn-golive').style.display = "inline";
                document.querySelector('#btn-goremote').style.display = "inline";
                document.querySelector('#btn-gosports').style.display = "inline";
                document.querySelector('#btn-gosportsremote').style.display = "inline";
            } else if (Meta.state === 'live_prerecord' || Meta.state === 'automation_prerecord')
            {
                isHost = false;
                badge.innerHTML = `<i class="chip-icon fas fa-compact-disc bg-primary"></i>${Meta.state}`;
                document.querySelector('#btn-golive').style.display = "inline";
                document.querySelector('#btn-goremote').style.display = "inline";
                document.querySelector('#btn-gosports').style.display = "inline";
                document.querySelector('#btn-gosportsremote').style.display = "inline";
            } else if (Meta.state.startsWith('automation_') || (Meta.state.includes('_returning') && !Meta.state.startsWith('sports')))
            {
                badge.innerHTML = `<i class="chip-icon fas fa-coffee bg-warning"></i>${Meta.state}`;
                //document.querySelector('#queue').style.display = "inline";
                document.querySelector('#btn-psa15').style.display = "inline";
                document.querySelector('#btn-psa30').style.display = "inline";
            } else if (Meta.state.startsWith('sports') && Meta.state.includes('_returning'))
            {
                badge.innerHTML = `<i class="chip-icon fas fa-coffee bg-warning"></i>${Meta.state}`;
                //document.querySelector('#queue').style.display = "inline";
                document.querySelector('#btn-psa15').style.display = "inline";
                document.querySelector('#btn-psa30').style.display = "inline";
                // If the system goes into disconnected mode, the host client should be notified of that!
            } else if (Meta.state.includes('_break_disconnected') || Meta.state.includes('_halftime_disconnected') && isHost)
            {
                badge.innerHTML = `<i class="chip-icon fas fa-wifi bg-danger"></i>${Meta.state}`;
                if (document.querySelector("#iziToast-noremote") === null)
                    iziToast.show({
                        id: 'iziToast-noremote',
                        class: 'flash-bg',
                        title: 'Lost Remote Connection!',
                        message: `Please ensure you are streaming to the remote stream and that your internet connection is stable. Then, click "Resume Show".`,
                        timeout: false,
                        close: true,
                        color: 'red',
                        drag: false,
                        position: 'Center',
                        closeOnClick: false,
                        overlay: true,
                        zindex: 250,
                        layout: 2,
                        image: `assets/images/noRemote.png`,
                        maxWidth: 480,
                        buttons: [
                            ['<button>Resume Show</button>', function (instance, toast, button, e, inputs) {
                                    returnBreak();
                                    instance.hide({}, toast, 'button');
                                }]
                        ]
                    });
                var notification = notifier.notify('Lost Remote Connection', {
                    message: 'Check your connection to the remote stream, then resume broadcast in DJ Controls.',
                    icon: 'https://d30y9cdsu7xlg0.cloudfront.net/png/244853-200.png',
                    duration: 180000,
                });
                main.flashTaskbar();
                document.querySelector('#btn-resume').style.display = "inline";
            } else if (Meta.state.includes('_break') || Meta.state.includes('_halftime'))
            {
                badge.innerHTML = `<i class="chip-icon fas fa-coffee bg-warning"></i>${Meta.state}`;
                document.querySelector('#btn-return').style.display = "inline";
                document.querySelector('#btn-endshow').style.display = "inline";
                document.querySelector('#btn-switchshow').style.display = "inline";
            } else if (Meta.state.includes('live_'))
            {
                /*
                 if (trip)
                 {
                 trip.stop();
                 trip = new Trip([
                 {
                 sel: $("#operations"),
                 content: `You are now live! Here are what these buttons do: <br />
                 <strong>End Show</strong>: Click this when you are done with your show, and no one is going on after you. <br />
                 <strong>Switch Show:</strong>: Click this when you are done with your show and another DJ is going on after you. </br>
                 <strong>Take a Break</strong>: Click to go into break mode (plays PSAs). A "Resume Show" button will appear which when clicked brings you back on the air. <br />
                 <strong>Play Top Add</strong>: Immediately plays a random Top Add (music we get to promote on the air). You earn XP for playing Top Adds. <br />
                 <strong>Add a Log</strong>: It is mandatory to log all songs you play outside of RadioDJ (eg. Spotify, YouTube, iTunes, MP3s, etc). Click to log a song.`,
                 expose: true,
                 position: "s",
                 nextClickSelector: $("#operations")
                 }
                 ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
                 trip = null;
                 console.log("trip closed");
                 }, onTripEnd: (tripIndex, tripObject) => {
                 trip = null;
                 console.log("trip ended");
                 }});
                 trip.start();
                 }
                 */
                badge.innerHTML = `<i class="chip-icon fas fa-microphone-alt bg-primary"></i>${Meta.state}`;
                document.querySelector('#btn-endshow').style.display = "inline";
                document.querySelector('#btn-switchshow').style.display = "inline";
                document.querySelector('#btn-break').style.display = "inline";
                document.querySelector('#btn-topadd').style.display = "inline";
                document.querySelector('#btn-log').style.display = "inline";
                document.querySelector('#btn-view-log').style.display = "inline";
            } else if (Meta.state.includes('sports_') || Meta.state.includes('sportsremote_'))
            {
                /*
                 if (trip)
                 {
                 trip.stop();
                 trip = new Trip([
                 {
                 sel: $("#operations"),
                 content: `You are now live with sports! Here are what these buttons do: <br />
                 <strong>End Show</strong>: Click this when you are done with the sports broadcast. <br />
                 <strong>Take a Break</strong>: Click to go into break mode (plays PSAs). A "Resume Show" button will appear which when clicked brings you back on the air. <br />
                 <strong>Extended Break</strong>: Click for halftime / long breaks (plays halftime music). A "Resume Show" button will appear which when clicked brings you back on the air. <br />
                 <strong>Play Liner</strong>: Click to play a sports liner assigned to the sport being broadcast.`,
                 expose: true,
                 position: "s",
                 nextClickSelector: $("#operations")
                 }
                 ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
                 trip = null;
                 console.log("trip closed");
                 }, onTripEnd: (tripIndex, tripObject) => {
                 trip = null;
                 console.log("trip ended");
                 }});
                 trip.start();
                 }
                 */
                badge.innerHTML = `<i class="chip-icon fas fa-trophy bg-success"></i>${Meta.state}`;
                document.querySelector('#btn-liner').style.display = "inline";
                document.querySelector('#btn-endshow').style.display = "inline";
                document.querySelector('#btn-break').style.display = "inline";
                document.querySelector('#btn-halftime').style.display = "inline";
                document.querySelector('#btn-view-log').style.display = "inline";
            } else if (Meta.state.includes('remote_'))
            {
                /*
                 if (trip)
                 {
                 trip.stop();
                 trip = new Trip([
                 {
                 sel: $("#operations"),
                 content: `You are now live! Here are what these buttons do: <br />
                 <strong>End Show</strong>: Click this when you are done with your show, and no one is going on after you. <br />
                 <strong>Take a Break</strong>: Click to go into break mode (plays PSAs). A "Resume Show" button will appear which when clicked brings you back on the air. <br />
                 <strong>Play Top Add</strong>: Immediately plays a random Top Add (music we get to promote on the air). <br />
                 <strong>Add a Log</strong>: It is mandatory to log all songs you play outside of RadioDJ (eg. Spotify, YouTube, iTunes, MP3s, etc). Click to log a song.`,
                 expose: true,
                 position: "s",
                 nextClickSelector: $("#operations")
                 }
                 ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
                 trip = null;
                 console.log("trip closed");
                 }, onTripEnd: (tripIndex, tripObject) => {
                 trip = null;
                 console.log("trip ended");
                 }});
                 trip.start();
                 }
                 */
                badge.innerHTML = `<i class="chip-icon fas fa-broadcast-tower bg-purple"></i>${Meta.state}`;
                document.querySelector('#btn-topadd').style.display = "inline";
                document.querySelector('#btn-endshow').style.display = "inline";
                document.querySelector('#btn-break').style.display = "inline";
                document.querySelector('#btn-log').style.display = "inline";
                document.querySelector('#btn-view-log').style.display = "inline";

            } else {
            }
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the doMeta function.'
        });
    }
}

function metaTick()
{
    Meta.time = moment(Meta.time).add(1, 'seconds');
    doMeta({});
    checkCalendar();

    if (recorderHour !== moment(Meta.time).hours())
    {
        recorderHour = moment(Meta.time).hours();
        processDjs();
        // Start a new recording if we are in automation
        if (Meta.state.startsWith("automation_"))
        {
            if (!development && client.recordAudio)
            {
                newRecording(`automation/${sanitize(Meta.genre)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`);
                hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'recorder', logsubtype: 'automation', loglevel: 'info', event: `A recording was started.<br />Path: ${settings.get(`recorder.path`)}/automation/${sanitize(Meta.genre)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
                });
            }
        }
        // Start a new recording if we are playing a prerecord
        if (Meta.state === "live_prerecord")
        {
            if (!development && client.recordAudio)
            {
                newRecording(`live/${sanitize(Meta.show)} PRERECORDED (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`);
                hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'recorder', logsubtype: 'automation', loglevel: 'info', event: `A recording was started.<br />Path: ${settings.get(`recorder.path`)}/live/${sanitize(Meta.show)} PRERECORDED (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
                });
            }
        }
    }

    if (checkMinutes !== moment(Meta.time).minutes())
    {
        console.log(webFrame.getResourceUsage());
        checkMinutes = moment(Meta.time).minutes();
        checkAnnouncements();
        selectRecipient(activeRecipient);
    }
}

// Shows a please wait box.
function pleaseWait() {
    try {
        var temp = document.querySelector('#operations');
        var actionButtons = temp.querySelectorAll("#btn-float");
        for (var i = 0; i < actionButtons.length; i++) {
            actionButtons[i].style.display = "none";
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the pleaseWait function.'
        });
    }
}

// Check the current announcements from the Status system or the emergency alerts system. Color the Announcements box depending on the level of the most critical announcement.
function checkAnnouncementColor() {
    // DEPRECATED
}

// Re-do the announcements shown in the announcements box
function checkAnnouncements() {
    var prev = [];
    var prevStatus = [];
    // Add applicable announcements

    Announcements({type: 'djcontrols'}).each(datum => {
        try {
            // Check to make sure the announcement is valid / not expired
            if (moment(datum.starts).isBefore(moment(Meta.time)) && moment(datum.expires).isAfter(moment(Meta.time)))
            {
                prev.push(`attn-${datum.ID}`);
                if (datum.title === "Reported Problem")
                {
                    prevStatus.push(`attn-status-report-${datum.ID}`);
                    if (document.querySelector(`#attn-status-report-${datum.ID}`) === null)
                    {
                        var temp = document.querySelector(`#attn-status`);
                        if (!temp)
                        {
                            var attn = document.querySelector("#announcements-body");

                            attn.innerHTML += `<div class="bg-dark-2 border-left border-danger shadow-2 p-1" style="border-left-width: 5px !important;" id="attn-status">
                            <h4 id="attn-title-status" class="text-white p-1 m-1">System Problems Detected</h4>
                                <div id="attn-body-status" style="display: none;">
                                    <p class="attn-status shadow-2 bg-secondary" id="attn-status-report-${datum.ID}"><span class="badge badge-purple m-1">Reported by DJ</span> ${datum.announcement}</p>
                                    <small class="p-1">Major and critical issues could affect your ability to run a show.</small>
                                </div>
                            </div>`;

                        } else {
                            var temp = document.querySelector(`#attn-status`);
                            temp.className = `bg-dark-2 border-left border-danger shadow-2 p-1`;
                            var temp = document.querySelector(`#attn-body-status`);
                            temp.innerHTML += `<p class="attn-status shadow-2 bg-secondary" id="attn-status-report-${datum.ID}"><span class="badge badge-purple m-1">Reported by DJ</span> ${datum.announcement}</p>`;
                        }
                        // If this DJ Controls is configured by WWSU to notify on technical problems, notify so.
                        if (client.emergencies)
                        {
                            addNotification(`reported-problem`, `danger`, datum.createdAt, datum.announcement);
                        }
                    } else {
                        var temp = document.querySelector(`#attn-status-report-${datum.ID}`);
                        temp.innerHTML = `<span class="badge badge-purple m-1">Reported by DJ</span>${datum.announcement}`;
                    }
                } else {
                    if (document.querySelector(`#attn-${datum.ID}`) === null)
                    {
                        var attn = document.querySelector("#announcements-body");
                        attn.innerHTML += `<div class="attn bg-dark-2 border-left border-${datum.level} shadow-2 p-1" style="border-left-width: 5px !important;" id="attn-${datum.ID}">
                            <h4 id="attn-title-${datum.ID}" class="text-white p-1 m-1">${datum.title}</h4>
                                <div id="attn-body-${datum.ID}" style="display: none;">
                                    ${datum.announcement}
                                </div>
                            </div>`;

                    } else {
                        var temp = document.querySelector(`#attn-${datum.ID}`);
                        temp.className = `attn bg-dark-2 border-left border-${datum.level} shadow-2 p-1`;
                        var temp = document.querySelector(`#attn-title-${datum.ID}`);
                        temp.innerHTML = datum.title;
                        var temp = document.querySelector(`#attn-body-${datum.ID}`);
                        temp.innerHTML = datum.announcement;
                    }
                }
            }
        } catch (e) {
            iziToast.show({
                title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                message: 'Error occurred in the checkAnnouncements each djcontrols. ' + e.message
            });
            console.error(e);
        }
    });

    var highestLevel = (prevStatus.length > 0) ? 1 : 5;
    Status().each(datum => {
        if (datum.status <= 3)
        {
            var badge = `<span class="badge badge-dark">Unknown</span>`;
            switch (datum.status)
            {
                case 1:
                    badge = `<span class="badge badge-danger m-1">CRITICAL</span>`;
                    break;
                case 2:
                    badge = `<span class="badge badge-urgent m-1">Major</span>`;
                    break;
                case 3:
                    badge = `<span class="badge badge-warning m-1">Minor</span>`;
                    break;
            }
            if (highestLevel > datum.status)
                highestLevel = datum.status;
            if (document.querySelector(`#attn-status-${datum.name}`) === null && prevStatus.indexOf(`attn-status-${datum.name}`) === -1)
            {
                var temp = document.querySelector(`#attn-status`);
                if (!temp)
                {
                    var attn = document.querySelector("#announcements-body");
                    attn.innerHTML += `<div class="bg-dark-2 border-left border-danger shadow-2 p-1" style="border-left-width: 5px !important;" id="attn-status">
                            <h4 id="attn-title-status" class="text-white p-1 m-1">System Problems Detected</h4>
                                <div id="attn-body-status" style="display: none;">
                                    <p class="attn-status shadow-2 bg-secondary" id="attn-status-${datum.name}">${badge}<strong>${datum.label}</strong>: ${datum.data}</p>
                                    <small class="p-1">Major and critical issues could affect your ability to run a show.</small>
                                </div>
                            </div>`;

                } else {
                    var temp = document.querySelector(`#attn-body-status`);
                    temp.innerHTML += `<p class="attn-status shadow-2 bg-secondary" id="attn-status-${datum.name}">${badge}<strong>${datum.label}</strong>: ${datum.data}</p>`;
                }
            } else {
                var temp = document.querySelector(`#attn-status-${datum.name}`);
                if (temp)
                    temp.innerHTML = `${badge}<strong>${datum.label}</strong>: ${datum.data}`;
            }
            prevStatus.push(`attn-status-${datum.name}`);
        }
    });

    var temp = document.querySelector(`#attn-status`);
    if (temp)
    {
        if (highestLevel === 1 || highestLevel === 2)
        {
            temp.className = `bg-dark-2 border-left border-danger shadow-2 p-1`;
        } else if (highestLevel <= 3)
        {
            temp.className = `bg-dark-2 border-left border-trivial shadow-2 p-1`;
        }
        if (prevStatus.length <= 0)
            temp.parentNode.removeChild(temp);
    }

    var prevEas = [];
    var highestEas = 5;
    Eas().each(datum => {
        var badge = `<span class="badge badge-dark">Unknown</span>`;
        switch (datum.severity)
        {
            case 'Extreme':
                badge = `<span class="badge badge-danger m-1">EXTREME</span>`;
                highestEas = 1;
                break;
            case 'Severe':
                badge = `<span class="badge badge-urgent m-1">Severe</span>`;
                if (highestEas > 2)
                    highestEas = 2;
                break;
            case 'Moderate':
                badge = `<span class="badge badge-warning m-1">Moderate</span>`;
                if (highestEas > 3)
                    highestEas = 3;
                break;
            case 'Minor':
                badge = `<span class="badge badge-trivial m-1">Minor</span>`;
                if (highestEas > 4)
                    highestEas = 4;
                break;
        }
        if (document.querySelector(`#attn-eas-${datum.ID}`) === null && prevEas.indexOf(`attn-eas-${datum.ID}`) === -1)
        {
            var temp = document.querySelector(`#attn-eas`);
            if (!temp)
            {
                var attn = document.querySelector("#announcements-body");

                attn.innerHTML += `<div class="bg-dark-2 border-left border-${highestEas <= 2 ? `danger` : `trivial`} shadow-2 p-1" style="border-left-width: 5px !important;" id="attn-eas">
                            <h4 id="attn-title-status" class="text-white p-1 m-1">Emergency / Weather Alerts</h4>
                                <div id="attn-body-eas" style="display: none;">
                                    <p class="attn-eas shadow-2 bg-secondary" id="attn-eas-${datum.ID}">${badge}<strong>${datum.alert}</strong> in effect for the counties ${datum.counties}</p>
                                    <small class="p-1">You may want to consider ending your show and seeking shelter if there is an extreme alert in effect.</small>
                                </div>
                            </div>`;
            } else {
                var temp = document.querySelector(`#attn-eas`);
                if (temp)
                    temp.className = `bg-dark-2 border-left border-${highestEas <= 2 ? `danger` : `trivial`} shadow-2 p-1`;
                var temp = document.querySelector(`#attn-body-eas`);
                if (temp)
                    temp.innerHTML += `<p class="attn-eas shadow-2 bg-secondary" id="attn-eas-${datum.ID}">${badge}<strong>${datum.alert}</strong> in effect for the counties ${datum.counties}</p>`;
            }
        } else {
            var temp = document.querySelector(`#attn-eas`);
            if (temp)
                temp.className = `bg-dark-2 border-left border-${highestEas <= 2 ? `danger` : `trivial`} shadow-2 p-1`;
            var temp = document.querySelector(`#attn-eas-${datum.ID}`);
            if (temp)
                temp.innerHTML = `${badge}<strong>${datum.alert}</strong> in effect for the counties ${datum.counties}`;
        }
        prevEas.push(`attn-eas-${datum.ID}`);
    });

    // Remove announcements no longer valid from the announcements box
    var attn = document.querySelectorAll(".attn");
    for (var i = 0; i < attn.length; i++) {
        if (prev.indexOf(attn[i].id) === -1)
            attn[i].parentNode.removeChild(attn[i]);
    }

    // Remove statuses no longer valid from the announcements box
    var attn = document.querySelectorAll(".attn-status");
    for (var i = 0; i < attn.length; i++) {
        if (prevStatus.indexOf(attn[i].id) === -1)
            attn[i].parentNode.removeChild(attn[i]);
    }

    if (prevStatus.length <= 0)
    {
        var temp = document.querySelector(`#attn-status`);
        if (temp)
            temp.parentNode.removeChild(temp);
    }

    // Remove eas alerts no longer valid from the announcements box
    var attn = document.querySelectorAll(".attn-eas");
    for (var i = 0; i < attn.length; i++) {
        if (prevEas.indexOf(attn[i].id) === -1)
            attn[i].parentNode.removeChild(attn[i]);
    }

    if (prevEas.length <= 0)
    {
        var temp = document.querySelector(`#attn-eas`);
        if (temp)
            temp.parentNode.removeChild(temp);
    }

    // Process all announcements for the announcements menu, if applicable
    if (client.admin)
    {
        var announcements = document.querySelector('#options-announcements');
        announcements.innerHTML = ``;

        var compare = function (a, b) {
            try {
                if (moment(a.starts).valueOf() < moment(b.starts).valueOf())
                    return -1;
                if (moment(a.starts).valueOf() > moment(b.starts).valueOf())
                    return 1;
                return 0;
            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please check the logs',
                    message: `Error occurred in the compare function of loadAnnouncements.`
                });
            }
        };
        Announcements().get().sort(compare).map(announcement => {
            announcements.innerHTML += `<div class="row m-1 bg-light-1 border-left border-${announcement.level} shadow-2" style="border-left-width: 5px !important;">
                    <div class="col-4 text-primary">
                        ${moment(announcement.starts).format("MM/DD/YYYY h:mm A")}<br />
                        - ${moment(announcement.expires).format("MM/DD/YYYY h:mm A")}
                    </div>
                    <div class="col-2 text-secondary">
                        ${announcement.type}
                    </div>
                    <div class="col-4 text-dark">
                        ${announcement.title}
                    </div>
                    <div class="col-2 text-dark">
                <button type="button" id="options-announcements-edit-${announcement.ID}" class="close" aria-label="Edit Announcement" title="Edit this announcement">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                <button type="button" id="options-announcements-remove-${announcement.ID}" class="close" aria-label="Remove Announcement" title="Remove this announcement">
                <span aria-hidden="true"><i class="fas fa-trash text-dark"></i></span>
                </button>
                    </div>
                </div>
                `;
        });
    }
}

function checkCalendar() {
    try {
        // Prepare the calendar variable
        calendar = [];

        // Erase the clockwheel
        $(".chart").empty();
        data.sectors = [];
        data.smallSectors = [];

        // Define a comparison function that will order calendar events by start time when we run the iteration
        var compare = function (a, b) {
            try {
                if (moment(a.start).valueOf() < moment(b.start).valueOf())
                    return -1;
                if (moment(a.start).valueOf() > moment(b.start).valueOf())
                    return 1;
                if (a.ID > b.ID)
                    return -1;
                if (b.ID > a.ID)
                    return 1;
                return 0;
            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please check the logs',
                    message: `Error occurred in the compare function of Calendar.sort in the checkCalendar call.`
                });
            }
        };

        // Declare empty temp variables for cal
        var calPriorityN = 0;
        var calTypeN = '';
        var calHostN = '';
        var calShowN = '';
        var calTopicN = ``;
        var calStartsN = null;
        // TODO: Make this more efficient; filter takes quite a bit of CPU.
        var records = Calendar().get();
        if (records.length > 0)
            records = records.filter(event => !event.title.startsWith("Genre:") && !event.title.startsWith("Playlist:") && moment(event.start).isBefore(moment(Meta.time).add(1, 'days')));

        // Run through every event in memory, sorted by the comparison function, and add appropriate ones into our formatted calendar variable.
        if (records.length > 0)
        {

            var nowEvent = null;
            records.sort(compare);
            records
                    .map(event =>
                    {
                        try {
                            var stripped = event.title.replace("Show: ", "");
                            stripped = stripped.replace("Remote: ", "");
                            stripped = stripped.replace("Sports: ", "");

                            if (Meta.show === stripped && moment(event.end).isAfter(moment(Meta.time)))
                                nowEvent = event;

                            // null start or end? Use a default to prevent errors.
                            if (!moment(event.start).isValid())
                                event.start = moment(Meta.time).startOf('day');
                            if (!moment(event.end).isValid())
                                event.end = moment(Meta.time).add(1, 'days').startOf('day');

                            // Does this event start within the next 12 hours, and has not yet ended? Add it to our formatted array.
                            if (moment(Meta.time).add(12, 'hours').isAfter(moment(event.start)) && moment(Meta.time).isBefore(moment(event.end)))
                            {
                                calendar.push(event);
                            }

                            // Sports broadcasts. Check for broadcasts scheduled to start within the next 15 minutes. Skip any scheduled to end in 15 minutes.
                            if (event.active === 1 && event.title.startsWith("Sports: ") && moment(Meta.time).add(15, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(15, 'minutes').isAfter(moment(Meta.time)) && calPriorityN < 10)
                            {
                                calPriorityN = 10;
                                calTypeN = 'Sports';
                                calHostN = '';
                                calShowN = event.title.replace('Sports: ', '');
                                calTopicN = truncateText(event.description, 256, `...`);
                                calStartsN = event.start;
                            }

                            // Remote broadcasts. Check for broadcasts scheduled to start within the next 15 minutes. Skip any scheduled to end in 15 minutes.
                            if (event.active === 1 && event.title.startsWith("Remote: ") && moment(Meta.time).add(15, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(15, 'minutes').isAfter(moment(Meta.time)) && calPriorityN < 7)
                            {
                                var summary = event.title.replace('Remote: ', '');
                                var temp = summary.split(" - ");

                                calPriorityN = 7;
                                calTypeN = 'Remote';
                                calHostN = temp[0];
                                calShowN = temp[1];
                                calTopicN = truncateText(event.description, 256, `...`);
                                calStartsN = event.start;
                            }

                            // Radio shows. Check for broadcasts scheduled to start within the next 10 minutes. Skip any scheduled to end in 15 minutes.
                            if (event.active === 1 && event.title.startsWith("Show: ") && moment(Meta.time).add(10, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(15, 'minutes').isAfter(moment(Meta.time)) && calPriorityN < 5)
                            {
                                var summary = event.title.replace('Show: ', '');
                                var temp = summary.split(" - ");

                                calPriorityN = 5;
                                calTypeN = 'Show';
                                calHostN = temp[0];
                                calShowN = temp[1];
                                calTopicN = truncateText(event.description, 256, `...`);
                                calStartsN = event.start;
                            }

                            // Prerecords. Check for broadcasts scheduled to start within the next 10 minutes. Skip any scheduled to end in 15 minutes.
                            if (event.active === 1 && event.title.startsWith("Prerecord: ") && moment(Meta.time).add(10, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(15, 'minutes').isAfter(moment(Meta.time)) && calPriorityN < 3)
                            {
                                calPriorityN = 3;
                                calTypeN = 'Prerecord';
                                calHostN = '';
                                calShowN = event.title.replace('Prerecord: ', '');
                                calTopicN = truncateText(event.description, 256, `...`);
                                calStartsN = event.start;
                            }

                            // OnAir Studio Prerecord Bookings.
                            if (event.active === 1 && event.title.startsWith("OnAir Studio Prerecord Bookings ") && moment(Meta.time).add(10, 'minutes').isAfter(moment(event.start)) && moment(event.end).isAfter(moment(Meta.time)) && calPriorityN < 1)
                            {
                                calPriorityN = 1;
                                calTypeN = 'Booking';
                                calHostN = '';
                                calShowN = event.title.replace('OnAir Studio Prerecord Bookings ', '');
                                calStartsN = event.start;
                            }

                        } catch (e) {
                            console.error(e);
                            iziToast.show({
                                title: 'An error occurred - Please check the logs',
                                message: `Error occurred during calendar iteration in processCalendar.`
                            });
                        }
                    });
        }

        // Check for changes in determined upcoming scheduled event compared to what is stored in memory
        if (calTypeN !== calType || calHostN !== calHost || calShowN !== calShow || calStartsN !== calStarts || calPriorityN !== calPriority)
        {
            calNotified = false;
            calType = calTypeN;
            calHost = calHostN;
            calShow = calShowN;
            calTopic = calTopicN;
            calStarts = calStartsN;
            calPriority = calPriorityN;
            calHint = false;
            // Cancel any active tutorials
            if (trip)
            {
                trip.stop();
                trip = null;
            }
        }

        // Display tutorials when shows are upcoming
        if ((Meta.state.startsWith("automation_") || Meta.state === 'live_prerecord') && !calHint)
        {
            calHint = true;
            /*
             if (calType === "Show")
             {
             setTimeout(function () {
             trip = new Trip([
             {
             sel: $("#btn-golive"),
             content: `Welcome, ${calHost}! To begin your show, click "Live". To skip the tutorial, click the x on this window.`,
             expose: true,
             position: "e",
             nextClickSelector: $("#btn-golive")
             },
             {
             sel: $("#go-live-modal"),
             content: `I filled in your DJ and show names automatically.<br />
             Write a show topic if you like, which will display on the website and display signs. <br />
             If desired, uncheck "enable website chat" to prevent others from messaging you.<br />
             <strong>Click "Go Live" when ready.</strong> This will start a countdown until you're live.`,
             expose: true,
             position: "n",
             nextClickSelector: $("#live-go")
             },
             {
             sel: $("#operations"),
             content: `This box will now show how much time until you are live (click anywhere inside to continue the tutorial, or x to stop the tutorial).<br />
             If you need more time, click +15-second PSA or +30-second PSA.<br />
             <strong>Show intros and other music queued after the IDs do not count in the queue countdown.</strong>`,
             expose: true,
             position: "s",
             nextClickSelector: $("#operations")
             }
             ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
             trip = null;
             console.log("trip closed");
             }});
             trip.start();
             }, 5000);
             }
             
             // Remote broadcasts
             if (calType === "Remote")
             {
             setTimeout(function () {
             trip = new Trip([
             {
             sel: $("#btn-goremote"),
             content: `Hello! To begin the scheduled remote broadcast ${calHost} - ${calShow}, click "Remote". To skip the tutorial, click the x on this window.`,
             expose: true,
             position: "e",
             nextClickSelector: $("#btn-goremote")
             },
             {
             sel: $("#go-remote-modal"),
             content: `I filled in your host and show names automatically.<br />
             Write a topic if you like, which will display on the website and display signs.<br />
             If desired, uncheck "enable website chat" to prevent others from messaging you.<br />
             Ensure your remote encoder is connected and streaming audio to the remote server, and then <strong>Click "Go Remote" when ready.</strong> This will start a countdown until you're live.`,
             expose: true,
             position: "n",
             nextClickSelector: $("#remote-go")
             },
             {
             sel: $("#operations"),
             content: `This box will now show how much time until your remote broadcast starts (click anywhere inside to continue the tutorial, or x to stop the tutorial).<br />
             If you need more time, click +15-second PSA or +30-second PSA.<br />
             <strong>Intros and other music queued after the IDs do not count in the queue countdown.</strong> A separate countdown will start after this one finishes so you know how much time is left in the intros / music.`,
             expose: true,
             position: "s",
             nextClickSelector: $("#operations")
             }
             ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
             trip = null;
             console.log("trip closed");
             }});
             trip.start();
             }, 5000);
             }
             
             // Sports broadcasts
             if (calType === "Sports")
             {
             setTimeout(function () {
             trip = new Trip([
             {
             sel: $("#btn-gosports"),
             content: `Hello! To begin the scheduled sports broadcast ${calShow}, click "Sports". To skip the tutorial, click the x on this window.`,
             expose: true,
             position: "e",
             nextClickSelector: $("#btn-gosports")
             },
             {
             sel: $("#go-sports-modal"),
             content: `I selected the scheduled sport automatically.<br />
             If desired, uncheck "enable website chat" to prevent others from messaging you.<br />
             If this broadcast is being done remotely (no OnAir Studio producer), check "Remote Sports Broadcast" and ensure you are streaming audio to the remote stream on the encoder before clicking Go Sports.<br />
             <strong>Click "Go Sports" when ready.</strong> This will start a countdown until you're live.`,
             expose: true,
             position: "n",
             nextClickSelector: $("#sports-go")
             },
             {
             sel: $("#operations"),
             content: `This box will now show how much time until your sports broadcast starts (click anywhere inside to continue the tutorial, or x to stop the tutorial).<br />
             If you need more time, click +15-second PSA or +30-second PSA.<br />
             <strong>Intros and other music queued after the IDs do not count in the queue countdown.</strong> A separate countdown will start after this one finishes so you know how much time is left in the intros / music.`,
             expose: true,
             position: "s",
             nextClickSelector: $("#operations")
             }
             ], {delay: -1, showCloseBox: true, onTripClose: (tripIndex, tripObject) => {
             trip = null;
             console.log("trip closed");
             }});
             trip.start();
             }, 5000);
             }
             */
        }

        // Determine priority of what is currently on the air
        var curPriority = 0;
        if (Meta.state.startsWith("sports_"))
            curPriority = 10;
        if (Meta.state.startsWith("remote_"))
            curPriority = 7;
        if (Meta.state.startsWith("live_") && Meta.state !== 'live_prerecord')
            curPriority = 5;
        if (Meta.state === 'live_prerecord')
            curPriority = 3;
        if (Meta.state.startsWith("automation_"))
            curPriority = 2;

        // Determine if the DJ should be notified of the upcoming program
        if ((curPriority <= calPriority || nowEvent === null) && !calNotified && isHost && Meta.show !== `${calHost} - ${calShow}` && Meta.changingState === null)
        {
            // Sports events should notify right away; allows for 15 minutes to transition
            if (calType === 'Sports')
            {
                calNotified = true;
                var notification = notifier.notify('Upcoming Sports Broadcast', {
                    message: 'Please wrap-up / end your show in the next few minutes.',
                    icon: 'https://icon2.kisspng.com/20171221/lje/gold-cup-trophy-png-clip-art-image-5a3c1fa99cbcb0.608850721513889705642.jpg',
                    duration: 900000,
                });
                main.flashTaskbar();
                iziToast.show({
                    class: 'flash-bg',
                    title: 'Sports broadcast in less than 15 minutes.',
                    message: `If the sports broadcast is still planned, please wrap up your show now and click "End Show". That way, the sports team has time to set up.`,
                    timeout: 900000,
                    close: true,
                    color: 'yellow',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
                    layout: 2,
                    image: `assets/images/sportsOff.png`,
                    maxWidth: 480,
                    buttons: [
                        ['<button>End Show</button>', function (instance, toast, button, e, inputs) {
                                endShow();
                                instance.hide({}, toast, 'button');
                            }]
                    ]
                });
            }

            // Remote events should also notify right away; allows for 15 minutes to transition
            if (calType === 'Remote')
            {
                calNotified = true;
                var notification = notifier.notify('Upcoming Remote Broadcast', {
                    message: 'Please wrap-up / end your show in the next few minutes.',
                    icon: 'http://cdn.onlinewebfonts.com/svg/img_550701.png',
                    duration: 900000,
                });
                main.flashTaskbar();
                iziToast.show({
                    class: 'flash-bg',
                    title: 'Remote broadcast in less than 15 minutes.',
                    message: `If the remote broadcast is still planned, please wrap up your show now and click "End Show". That way, the producers have time to set up for the broadcast.`,
                    timeout: 900000,
                    close: true,
                    color: 'yellow',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
                    layout: 2,
                    image: `assets/images/remoteOff.png`,
                    maxWidth: 480,
                    buttons: [
                        ['<button>End Show</button>', function (instance, toast, button, e, inputs) {
                                endShow();
                                instance.hide({}, toast, 'button');
                            }]
                    ]
                });
            }

            // Live shows should not notify until the scheduled start time is past the current time.
            if (calType === 'Show' && moment(Meta.time).isAfter(moment(calStarts)))
            {
                calNotified = true;
                var notification = notifier.notify('Interfering with Another Show', {
                    message: 'Please wrap-up / end your show as soon as possible.',
                    icon: 'http://pluspng.com/img-png/stop-png-hd-stop-sign-clipart-png-clipart-2400.png',
                    duration: 900000,
                });
                main.flashTaskbar();
                iziToast.show({
                    class: 'flash-bg',
                    title: 'You are interfering with a scheduled show!',
                    message: `Please wrap up your show now. Then, if the next producer will be ready within 5 minutes, click "Switch Show"; otherwise, click "End Show".`,
                    timeout: 900000,
                    close: true,
                    color: 'red',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
                    layout: 2,
                    image: `assets/images/showOff.png`,
                    maxWidth: 480,
                    buttons: [
                        ['<button>Switch Show</button>', function (instance, toast, button, e, inputs) {
                                switchShow();
                                instance.hide({}, toast, 'button');
                            }],
                        ['<button>End Show</button>', function (instance, toast, button, e, inputs) {
                                endShow();
                                instance.hide({}, toast, 'button');
                            }]
                    ]
                });
            }

            // Prerecords also should not notify until the scheduled start time is past the current time.
            if (calType === 'Prerecord' && moment(Meta.time).isAfter(moment(calStarts)))
            {
                calNotified = true;
                var notification = notifier.notify('Interfering with a Prerecord', {
                    message: 'Please wrap-up / end your show as soon as possible.',
                    icon: 'http://pluspng.com/img-png/stop-png-hd-stop-sign-clipart-png-clipart-2400.png',
                    duration: 900000,
                });
                main.flashTaskbar();
                iziToast.show({
                    class: 'flash-bg',
                    title: 'You are interfering with a scheduled prerecord!',
                    message: `Please wrap up your show and then click "End Show".`,
                    timeout: 900000,
                    close: true,
                    color: 'red',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
                    layout: 2,
                    image: `assets/images/prerecordOff.png`,
                    maxWidth: 480,
                    buttons: [
                        ['<button>End Show</button>', function (instance, toast, button, e, inputs) {
                                endShow();
                                instance.hide({}, toast, 'button');
                            }]
                    ]
                });
            }

            // OnAir Studio Reserve
            if (calType === 'Booking' && calPriority < 7 && moment(Meta.time).isAfter(moment(calStarts)))
            {
                calNotified = true;
                var notification = notifier.notify('OnAir Studio is Reserved', {
                    message: 'Please wrap-up / end your show as soon as possible.',
                    icon: 'http://pluspng.com/img-png/stop-png-hd-stop-sign-clipart-png-clipart-2400.png',
                    duration: 900000,
                });
                main.flashTaskbar();
                iziToast.show({
                    class: 'flash-bg',
                    title: 'Someone has reserved the OnAir Studio for prerecording!',
                    message: `If you are doing your show in the OnAir Studio, please wrap up your show now and click "End Show".`,
                    timeout: 900000,
                    close: true,
                    color: 'red',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
                    layout: 2,
                    image: `assets/images/prerecordOff.png`,
                    maxWidth: 480,
                    buttons: [
                        ['<button>End Show</button>', function (instance, toast, button, e, inputs) {
                                endShow();
                                instance.hide({}, toast, 'button');
                            }]
                    ]
                });
            }
        }

        // Clear current list of events
        document.querySelector('#calendar-events').innerHTML = '';

        // Prepare some variables
        var timeLeft = 1000000;
        var timeLeft2 = 1000000;
        var doLabel = null;
        var doStart = 0;
        var doSize = 0;
        var doColor = 0;
        var currentStart = moment();
        var currentEnd = moment();
        var firstEvent = '';

        // Add in our new list, and include in clockwheel
        if (calendar.length > 0)
        {
            calendar.map(event => {
                // If we are not doing a show, proceed with a 12-hour clockwheel and events list
                if (Meta.state.startsWith("automation_") || Meta.state === "live_prerecord")
                {
                    var finalColor = (typeof event.color !== 'undefined' && /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(event.color)) ? hexRgb(event.color) : hexRgb('#787878');
                    if (event.active < 1)
                        finalColor = hexRgb('#161616');
                    finalColor.red = Math.round(finalColor.red);
                    finalColor.green = Math.round(finalColor.green);
                    finalColor.blue = Math.round(finalColor.blue);
                    document.querySelector('#calendar-events').innerHTML += ` <div class="m-1 bs-callout bs-callout-default shadow-2" style="border-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue}); background: rgb(${parseInt(finalColor.red / 2)}, ${parseInt(finalColor.green / 2)}, ${parseInt(finalColor.blue / 2)});">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(event.start).format("hh:mm A")} - ${moment(event.end).format("hh:mm A")}
                                            </div>
                                            <div class="col-8">
                                                ${event.title}
                                                ${event.active < 1 ? `<br /><strong>CANCELED</strong>` : ``}
                                            </div>
                                        </div>
                                    </div></div>`;
                    // Add upcoming shows to the clockwheel shading
                    if (event.active === 1)
                    {
                        if (event.title.startsWith("Show: ") || event.title.startsWith("Remote: ") || event.title.startsWith("Sports: ") || event.title.startsWith("Prerecord: "))
                        {
                            if (moment(event.end).diff(moment(Meta.time), 'seconds') < (12 * 60 * 60))
                            {
                                if (moment(event.start).isAfter(moment(Meta.time)))
                                {
                                    data.sectors.push({
                                        label: event.title,
                                        start: ((moment(event.start).diff(moment(Meta.time), 'seconds') / (12 * 60 * 60)) * 360) + 0.5,
                                        size: ((moment(event.end).diff(moment(event.start), 'seconds') / (12 * 60 * 60)) * 360) - 0.5,
                                        color: event.color || '#787878'
                                    });
                                } else {
                                    data.sectors.push({
                                        label: event.title,
                                        start: 0.5,
                                        size: ((moment(event.end).diff(moment(Meta.time), 'seconds') / (12 * 60 * 60)) * 360) - 0.5,
                                        color: event.color || '#787878'
                                    });
                                }
                            } else if (moment(event.start).diff(moment(Meta.time), 'seconds') < (12 * 60 * 60))
                            {
                                if (moment(event.start).isAfter(moment(Meta.time)))
                                {
                                    var start = ((moment(event.start).diff(moment(Meta.time), 'seconds') / (12 * 60 * 60)) * 360);
                                    data.sectors.push({
                                        label: event.title,
                                        start: start + 0.5,
                                        size: 360 - start,
                                        color: event.color || '#787878'
                                    });
                                } else {
                                    data.sectors.push({
                                        label: event.title,
                                        start: 0,
                                        size: 360,
                                        color: event.color || '#787878'
                                    });
                                }
                            }
                        } else {
                            if (moment(event.end).diff(moment(Meta.time), 'seconds') < (12 * 60 * 60))
                            {
                                if (moment(event.start).isAfter(moment(Meta.time)))
                                {
                                    data.smallSectors.push({
                                        label: event.title,
                                        start: ((moment(event.start).diff(moment(Meta.time), 'seconds') / (12 * 60 * 60)) * 360) + 0.5,
                                        size: ((moment(event.end).diff(moment(event.start), 'seconds') / (12 * 60 * 60)) * 360) - 0.5,
                                        color: event.color || '#787878'
                                    });
                                } else {
                                    data.smallSectors.push({
                                        label: event.title,
                                        start: 0.5,
                                        size: ((moment(event.end).diff(moment(Meta.time), 'seconds') / (12 * 60 * 60)) * 360) - 0.5,
                                        color: event.color || '#787878'
                                    });
                                }
                            } else if (moment(event.start).diff(moment(Meta.time), 'seconds') < (12 * 60 * 60))
                            {
                                if (moment(event.start).isAfter(moment(Meta.time)))
                                {
                                    var start = ((moment(event.start).diff(moment(Meta.time), 'seconds') / (12 * 60 * 60)) * 360);
                                    data.smallSectors.push({
                                        label: event.title,
                                        start: start + 0.5,
                                        size: 360 - start,
                                        color: event.color || '#787878'
                                    });
                                } else {
                                    data.smallSectors.push({
                                        label: event.title,
                                        start: 0,
                                        size: 360,
                                        color: event.color || '#787878'
                                    });
                                }
                            }
                        }
                    }
                    // If we are doing a show, do a 1-hour clockwheel
                } else {
                    if (event.title.startsWith("Show: ") || event.title.startsWith("Remote: ") || event.title.startsWith("Sports: "))
                    {
                        var stripped = event.title.replace("Show: ", "");
                        stripped = stripped.replace("Remote: ", "");
                        stripped = stripped.replace("Sports: ", "");
                        // If the event we are processing is what is on the air right now, and the event has not yet ended...
                        if (Meta.show === stripped && moment(event.end).isAfter(moment(Meta.time)))
                        {
                            // Calculate base remaining time
                            timeLeft = moment(event.end).diff(moment(Meta.time), 'minutes');
                            // If there is less than 1 hour remaining in the show, only shade the clock for the portion of the hour remaining in the show
                            if (moment(event.end).diff(moment(Meta.time), 'minutes') < 60)
                            {
                                if (moment(event.start).isAfter(moment(Meta.time)))
                                {
                                    doLabel = event.title;
                                    doStart = ((moment(event.start).diff(moment(Meta.time), 'seconds') / (60 * 60)) * 360);
                                    doSize = ((moment(event.end).diff(moment(event.start), 'seconds') / (60 * 60)) * 360);
                                    doColor = event.color || '#787878';
                                    currentStart = moment(event.start);
                                    currentEnd = moment(event.end);
                                } else {
                                    var theSize = ((moment(event.end).diff(moment(Meta.time), 'seconds') / (60 * 60)) * 360);
                                    doLabel = event.title;
                                    doStart = 0;
                                    doSize = theSize;
                                    doColor = event.color || '#787878';
                                    currentStart = moment(event.start);
                                    currentEnd = moment(event.end);
                                }
                                // Otherwise, shade the entire hour, if the event has already started via the scheduled start time
                            } else if (moment(event.start).isBefore(moment(Meta.time)))
                            {
                                doLabel = event.title;
                                doStart = 0;
                                doSize = 360;
                                doColor = event.color || '#787878';
                                currentStart = moment(event.start);
                                currentEnd = moment(event.end);
                            }
                            // If the event being process is not what is live, but the end time is after the current time...
                        } else if (moment(event.end).isAfter(moment(Meta.time)))
                        {
                            // Do a check to see if this event will intercept the currently live event
                            timeLeft2 = moment(event.start).diff(moment(Meta.time), 'minutes');
                            // Sports and remote broadcasts should be given an extra 15 minutes for preparation
                            if (event.title.startsWith("Sports: ") || event.title.startsWith("Remote: "))
                                timeLeft2 -= 15;
                            if (timeLeft2 < 0)
                                timeLeft2 = 0;
                            // If timeLeft2 is less than timeleft, that means the currently live show needs to end earlier than the scheduled time.
                            if (timeLeft2 < timeLeft)
                            {
                                timeLeft = timeLeft2;
                                currentEnd = moment(event.start);
                                if (event.title.startsWith("Sports: ") || event.title.startsWith("Remote: "))
                                {
                                    currentEnd = moment(currentEnd).subtract(15, 'minutes');
                                }
                                if (moment(currentEnd).isBefore(moment(Meta.time)))
                                {
                                    currentEnd = moment(Meta.time);
                                    timeLeft = 0;
                                }
                            }
                            if (timeLeft < 0)
                                timeLeft = 0;
                            // If the event being processed starts in less than 1 hour, add it to the hour clockwheel as a black shaded event
                            if (event.active === 1)
                            {
                                if (moment(event.start).diff(moment(Meta.time), 'minutes') < 60)
                                {
                                    if (moment(event.start).isAfter(moment(Meta.time)))
                                    {
                                        var theStart = ((moment(event.start).diff(moment(Meta.time), 'seconds') / (60 * 60)) * 360);
                                        var theSize = ((moment(event.end).diff(moment(event.start), 'seconds') / (60 * 60)) * 360);
                                        if ((theSize + theStart) > 360)
                                            theSize = 360 - theStart;
                                        data.sectors.push({
                                            label: event.title,
                                            start: theStart,
                                            size: theSize,
                                            color: "#000000"
                                        });
                                    } else {
                                        data.sectors.push({
                                            label: event.title,
                                            start: 0,
                                            size: ((moment(event.end).diff(moment(Meta.time), 'seconds') / (60 * 60)) * 360),
                                            color: "#000000"
                                        });
                                    }
                                }
                            }
                        }
                    }
                    // Add the event to the list on the right of the clock
                    if (moment(Meta.time).add(1, 'hours').isAfter(moment(event.start)) && moment(Meta.time).isBefore(moment(event.end)))
                    {
                        var finalColor = (typeof event.color !== 'undefined' && /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(event.color)) ? hexRgb(event.color) : hexRgb('#787878');
                        if (event.active < 1)
                            finalColor = hexRgb('#161616');
                        finalColor.red = Math.round(finalColor.red);
                        finalColor.green = Math.round(finalColor.green);
                        finalColor.blue = Math.round(finalColor.blue);
                        var stripped = event.title.replace("Show: ", "");
                        stripped = stripped.replace("Remote: ", "");
                        stripped = stripped.replace("Sports: ", "");
                        if (Meta.show !== stripped)
                        {
                            document.querySelector('#calendar-events').innerHTML += `  <div class="m-1 bs-callout bs-callout-default shadow-2" style="border-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue}); background: rgb(${parseInt(finalColor.red / 2)}, ${parseInt(finalColor.green / 2)}, ${parseInt(finalColor.blue / 2)});">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(event.start).format("hh:mm A")} - ${moment(event.end).format("hh:mm A")}
                                            </div>
                                            <div class="col-8">
                                                ${event.title}
                                                ${event.active < 1 ? `<strong>CANCELED</strong>` : ``}
                                            </div>
                                        </div>
                                    </div></div>`;
                        }
                    }
                }
            });
        }

        // In automation, shade the clock in 12-hour format for upcoming shows
        if (Meta.state.startsWith("automation_") || Meta.state === "live_prerecord")
        {
            var temp = document.getElementById("calendar-title");
            temp.innerHTML = 'Clockwheel (next 12 hours)';
            var start = moment(Meta.time).startOf('day');
            if (moment(Meta.time).hour() >= 12)
                start.add(12, 'hours');
            var diff = moment(Meta.time).diff(moment(start), 'seconds');
            data.start = (360 / 12 / 60 / 60) * diff;

// Show an indicator on the clock for the current hour (extra visual to show 12-hour clock mode)
            data.sectors.push({
                label: 'current hour',
                start: -1,
                size: 2,
                color: "#000000"
            });


            var sectors = calculateSectors(data);
            var newSVG = document.getElementById("clock-program");
            newSVG.setAttribute("transform", `rotate(${data.start})`);
            sectors.normal.map(function (sector) {

                var newSector = document.createElementNS("http://www.w3.org/2000/svg", "path");
                newSector.setAttributeNS(null, 'fill', sector.color);
                newSector.setAttributeNS(null, 'd', 'M' + sector.L + ',' + sector.L + ' L' + sector.L + ',0 A' + sector.L + ',' + sector.L + ' 1 0,1 ' + sector.X + ', ' + sector.Y + ' z');
                newSector.setAttributeNS(null, 'transform', 'rotate(' + sector.R + ', ' + sector.L + ', ' + sector.L + ')');

                newSVG.appendChild(newSector);
            });
            var newSVG = document.getElementById("clock-program-2");
            newSVG.setAttribute("transform", `rotate(${data.start})`);
            sectors.small.map(function (sector) {

                var newSector = document.createElementNS("http://www.w3.org/2000/svg", "path");
                newSector.setAttributeNS(null, 'fill', sector.color);
                newSector.setAttributeNS(null, 'd', 'M' + sector.L + ',' + sector.L + ' L' + sector.L + ',0 A' + sector.L + ',' + sector.L + ' 1 0,1 ' + sector.X + ', ' + sector.Y + ' z');
                newSector.setAttributeNS(null, 'transform', 'rotate(' + sector.R + ', ' + sector.L + ', ' + sector.L + ')');

                newSVG.appendChild(newSector);
            });
            // During shows, use a 1-hour clockwheel
        } else {
            var temp = document.getElementById("calendar-title");
            temp.innerHTML = 'Clockwheel (next hour)';
            var start = moment(Meta.time).startOf('hour');
            var diff = moment(Meta.time).diff(moment(start), 'seconds');
            data.start = (360 / 60 / 60) * diff;

            if (Meta.queueFinish !== null)
            {
                document.querySelector('#calendar-events').innerHTML = `  <div class="m-1 bs-callout bs-callout-default shadow-2">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(Meta.queueFinish).format("hh:mm:ss A")}
                                            </div>
                                            <div class="col-8">
                                                RadioDJ Queue
                                            </div>
                                        </div>
                                    </div></div>` + document.querySelector('#calendar-events').innerHTML;
            }


            if (doLabel !== null)
            {
                var doTopOfHour = false;
                if (!moment(Meta.lastID).add(10, 'minutes').startOf('hour').isSame(moment(Meta.time).startOf('hour')) && moment(Meta.time).diff(moment(Meta.time).startOf('hour'), 'minutes') < 10)
                {
                    var topOfHour = moment(Meta.time).startOf('hour');
                    // This happens when the DJ has not yet taken their top of the hour break; keep the time in the events list the same until they take the break.
                    if (moment(currentEnd).subtract(10, 'minutes').isAfter(moment(topOfHour)))
                    {
                        doTopOfHour = true;
                        document.querySelector('#calendar-events').innerHTML = `  <div class="m-1 bs-callout bs-callout-warning shadow-2">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(topOfHour).format("hh:mm A")}
                                            </div>
                                            <div class="col-8">
                                                Mandatory Top-of-Hour Break
                                            </div>
                                        </div>
                                    </div></div>` + document.querySelector('#calendar-events').innerHTML;

                    }
                } else {
                    var topOfHour = moment(Meta.time).add(1, 'hours').startOf('hour');
                    // If the DJ is expected to do a top of the hour break at the next top of hour, show so on the clock and in the events list
                    if (moment(currentEnd).subtract(10, 'minutes').isAfter(moment(topOfHour)))
                    {
                        doTopOfHour = true;
                        document.querySelector('#calendar-events').innerHTML = `  <div class="m-1 bs-callout bs-callout-warning shadow-2">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(topOfHour).format("hh:mm A")}
                                            </div>
                                            <div class="col-8">
                                                Mandatory Top-of-Hour Break
                                            </div>
                                        </div>
                                    </div></div>` + document.querySelector('#calendar-events').innerHTML;
                    }
                }

                // First in the list of events, show the current show and how much time remains based on the schedule and whether or not something else will mandate this show
                // ends early.
                var finalColor = (typeof doColor !== 'undefined' && /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(doColor)) ? hexRgb(doColor) : hexRgb('#787878');
                finalColor.red = Math.round(finalColor.red);
                finalColor.green = Math.round(finalColor.green);
                finalColor.blue = Math.round(finalColor.blue);
                document.querySelector('#calendar-events').innerHTML = `  <div class="m-1 bs-callout bs-callout-default shadow-2" style="border-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue}); background: rgb(${parseInt(finalColor.red / 2)}, ${parseInt(finalColor.green / 2)}, ${parseInt(finalColor.blue / 2)});">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment.duration(moment(currentEnd).diff(moment(Meta.time), 'minutes'), 'minutes').format("h [hrs], m [mins]")} Left
                                            </div>
                                            <div class="col-8">
                                                ${doLabel}
                                            </div>
                                        </div>
                                    </div></div>` + document.querySelector('#calendar-events').innerHTML;
                if (moment(currentEnd).diff(moment(Meta.time), 'minutes') < 60)
                {
                    if (moment(currentStart).isAfter(moment(Meta.time)))
                    {
                        var theStart = ((moment(currentStart).diff(moment(Meta.time), 'seconds') / (60 * 60)) * 360);
                        var theSize = ((moment(currentEnd).diff(moment(currentStart), 'seconds') / (60 * 60)) * 360);
                        data.sectors.push({
                            label: doLabel,
                            start: theStart,
                            size: theSize,
                            color: doColor
                        });
                    } else {
                        var theSize = ((moment(currentEnd).diff(moment(Meta.time), 'seconds') / (60 * 60)) * 360);
                        data.sectors.push({
                            label: doLabel,
                            start: 0,
                            size: theSize,
                            color: doColor
                        });
                    }
                } else if (moment(currentStart).isBefore(moment(Meta.time)))
                {
                    data.sectors.push({
                        label: doLabel,
                        start: 0,
                        size: 360,
                        color: doColor
                    });
                } else {
                    var theStart = ((moment(currentStart).diff(moment(Meta.time), 'seconds') / (60 * 60)) * 360);
                    if (theStart < 360)
                    {
                        data.sectors.push({
                            label: doLabel,
                            start: theStart,
                            size: 360 - theStart,
                            color: doColor
                        });
                    }
                }

                // Then, shade the top of hour ID break on the clock if required
                if (doTopOfHour)
                {
                    if (moment(Meta.lastID).add(10, 'minutes').startOf('hour') !== moment(Meta.time).startOf('hour') && moment(Meta.time).diff(moment(Meta.time).startOf('hour'), 'minutes') < 5)
                    {
                        var start = moment(Meta.time).startOf('hour').subtract(5, 'minutes');
                        var diff = moment(Meta.time).diff(moment(start), 'seconds');
                        data.sectors.push({
                            label: 'current minute',
                            start: 360 - (diff * (360 / 60 / 60)),
                            size: 60,
                            color: "#FFEB3B"
                        });
                    } else {
                        var start = moment(Meta.time).add(1, 'hours').startOf('hour').subtract(5, 'minutes');
                        var diff = moment(start).diff(moment(Meta.time), 'seconds');
                        data.sectors.push({
                            label: 'current minute',
                            start: ((360 / 60 / 60) * diff),
                            size: 60,
                            color: "#FFEB3B"
                        });
                    }
                }
            }

            // Finally, show an indicator on the clock for the current minute (extra visual to show 1-hour clock mode)
            data.sectors.push({
                label: 'current minute',
                start: 0,
                size: 2,
                color: "#000000"
            });


            var sectors = calculateSectors(data);
            var newSVG = document.getElementById("clock-program");
            newSVG.setAttribute("transform", `rotate(${data.start})`);
            sectors.normal.map(function (sector) {

                var newSector = document.createElementNS("http://www.w3.org/2000/svg", "path");
                newSector.setAttributeNS(null, 'fill', sector.color);
                newSector.setAttributeNS(null, 'd', 'M' + sector.L + ',' + sector.L + ' L' + sector.L + ',0 A' + sector.L + ',' + sector.L + ' 1 0,1 ' + sector.X + ', ' + sector.Y + ' z');
                newSector.setAttributeNS(null, 'transform', 'rotate(' + sector.R + ', ' + sector.L + ', ' + sector.L + ')');

                newSVG.appendChild(newSector);
            });
            var newSVG = document.getElementById("clock-program-2");
            newSVG.setAttribute("transform", `rotate(${data.start})`);
            sectors.small.map(function (sector) {

                var newSector = document.createElementNS("http://www.w3.org/2000/svg", "path");
                newSector.setAttributeNS(null, 'fill', sector.color);
                newSector.setAttributeNS(null, 'd', 'M' + sector.L + ',' + sector.L + ' L' + sector.L + ',0 A' + sector.L + ',' + sector.L + ' 1 0,1 ' + sector.X + ', ' + sector.Y + ' z');
                newSector.setAttributeNS(null, 'transform', 'rotate(' + sector.R + ', ' + sector.L + ', ' + sector.L + ')');

                newSVG.appendChild(newSector);
            });

            // Shade in queue time on the clockwheel
            if (Meta.queueFinish !== null)
            {
                data.sectors = [];
                var diff = moment(Meta.queueFinish).diff(moment(Meta.time), 'seconds');

                if (diff < (60 * 60))
                {
                    data.sectors.push({
                        label: 'queue time',
                        start: 0,
                        size: diff * 0.1,
                        color: "#0000ff"
                    });
                } else {
                    data.sectors.push({
                        label: 'queue time',
                        start: 0,
                        size: 360,
                        color: "#0000ff"
                    });
                }

                var sectors = calculateSectors(data);
                var newSVG = document.getElementById("clock-program");
                newSVG.setAttribute("transform", `rotate(${data.start})`);
                sectors.normal.map(function (sector) {

                    var newSector = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    newSector.setAttributeNS(null, 'fill', sector.color);
                    newSector.setAttributeNS(null, 'd', 'M' + sector.L + ',' + sector.L + ' L' + sector.L + ',0 A' + sector.L + ',' + sector.L + ' 1 0,1 ' + sector.X + ', ' + sector.Y + ' z');
                    newSector.setAttributeNS(null, 'transform', 'rotate(' + sector.R + ', ' + sector.L + ', ' + sector.L + ')');

                    newSVG.appendChild(newSector);
                });
                var newSVG = document.getElementById("clock-program-2");
                newSVG.setAttribute("transform", `rotate(${data.start})`);
                sectors.small.map(function (sector) {

                    var newSector = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    newSector.setAttributeNS(null, 'fill', sector.color);
                    newSector.setAttributeNS(null, 'd', 'M' + sector.L + ',' + sector.L + ' L' + sector.L + ',0 A' + sector.L + ',' + sector.L + ' 1 0,1 ' + sector.X + ', ' + sector.Y + ' z');
                    newSector.setAttributeNS(null, 'transform', 'rotate(' + sector.R + ', ' + sector.L + ', ' + sector.L + ')');

                    newSVG.appendChild(newSector);
                });
            }
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during checkCalendar.`
        });
    }
}

// Called when the recipients available to send/receive messages needs recalculating
function checkRecipients() {
    try {

        var recipients = {};
        var groupIDs = [];
        var recipientIDs = [];

        Recipients().each(function (recipient) {

            // Skip system and display recipients; we do not want to use those in the messages system.
            if (recipient.group === 'system' || recipient.group === 'display')
                return null;

            if (typeof recipients[recipient.group] === 'undefined')
            {
                recipients[recipient.group] = [];
                groupIDs.push(`users-g-${recipient.group}`);
            }
            recipientIDs.push(`users-u-${recipient.ID}`);
            recipients[recipient.group].push(recipient);
        });

        for (var key in recipients)
        {
            if (recipients.hasOwnProperty(key))
            {
                var temp = document.querySelector(`#users-g-${key}`);
                if (temp === null)
                {
                    temp = document.querySelector(`#users`);
                    temp.innerHTML += `<p class="navdrawer-subheader">${key}</p>
                    <ul class="navdrawer-nav" id="users-g-${key}">
                    </ul>
                    <div class="navdrawer-divider"></div>`;
                }
                if (recipients[key].length > 0)
                {
                    recipients[key].map(recipient => {
                        var temp = document.querySelector(`#users-u-${recipient.ID}`);
                        var theClass = '<i class="chip-icon bg-dark">OFF</i>';
                        // Online recipients in wwsu-red color, offline in dark color.
                        switch (recipient.status)
                        {
                            case 1:
                                theClass = '<i class="chip-icon bg-primary">ON</i>';
                                break;
                            case 2:
                                theClass = '<i class="chip-icon bg-primary">ON</i>';
                                break;
                            case 3:
                                theClass = '<i class="chip-icon bg-primary">ON</i>';
                                break;
                            case 4:
                                theClass = '<i class="chip-icon bg-primary">ON</i>';
                                break;
                            case 5:
                                theClass = '<i class="chip-icon bg-primary">ON</i>';
                                break;
                            default:
                                theClass = '<i class="chip-icon bg-dark">OFF</i>';
                                break;
                        }
                        // Make "Web Public" red if the webchat is enabled.
                        if (recipient.host === 'website' && Meta.webchat)
                            theClass = '<i class="chip-icon bg-primary">ON</i>';
                        if (temp !== null)
                        {
                            temp.remove();
                        }
                        temp = document.querySelector(`#users-g-${key}`);
                        temp.innerHTML += `
<div id="users-u-${recipient.ID}" class="recipient nav-item nav-link${activeRecipient === recipient.ID ? ` active` : ``} d-flex justify-content-between align-items-center">
<span id="users-l-${recipient.ID}">${theClass}${recipient.label}</span>
<div>
<span class="badge badge-${recipient.unread > 0 ? 'primary' : 'secondary'} badge-pill" id="users-n-${recipient.host}">${recipient.unread}</span>
</div>
`;
                    });
                }

                // Remove recipients no longer valid
                var attn = document.querySelectorAll(".recipient");
                for (var i = 0; i < attn.length; i++) {
                    if (recipientIDs.indexOf(attn[i].id) === -1)
                        attn[i].parentNode.removeChild(attn[i]);
                }
            }
        }


    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during checkRecipients.`
        });
    }
}

// Called when the user clicks on a recipient to view the messages from that recipient
function selectRecipient(recipient = null)
{
    try {
        activeRecipient = recipient;

        var messages = document.querySelector("#messages-info");
        var messageIDs = [];
        messages.innerHTML = ``;

        Recipients().each(function (recipientb) {
            // Update all the recipients, ensuring only the selected one is active
            var temp = document.querySelector(`#users-u-${recipientb.ID}`);
            if (temp !== null)
            {
                temp.classList.remove('active');
            }
        });

        var host = Recipients({ID: recipient}).first().host;
        var ID = Recipients({ID: recipient}).first().ID;
        var status = Recipients({ID: recipient}).first().status;
        var label = Recipients({ID: recipient}).first().label;
        var theTime = Recipients({ID: recipient}).first().time;

        var temp = document.querySelector(`#users-u-${ID}`);
        if (temp !== null)
        {
            temp.classList.add('active');
        }

        var temp = document.querySelector(`#messenger-buttons`);
        if (ID && host && host.startsWith('website-'))
        {
            if (temp)
                temp.innerHTML = `<button type="button" class="btn btn-urgent btn-lg" id="users-o-mute-${ID}" title="Mute this user for 24 hours">Mute</button><button type="button" class="btn btn-danger btn-lg" id="users-o-ban-${ID}" title="Ban this user indefinitely">Ban</button>`;
        } else {
            if (temp)
                temp.innerHTML = ``;
        }

        // Add labels at the top of the messages box to explain stuff
        if (recipient === null || typeof host === 'undefined')
        {
            messages.innerHTML = `<div class="bs-callout bs-callout-info shadow-4">
                            <div>To begin, click recipients in the bottom right corner and select a recipient.</div>
                    </div>`;
        } else if (host === 'website' && Meta.webchat)
        {
            messages.innerHTML = `<div class="bs-callout bs-callout-info shadow-4">
                            <div>You are viewing public web messages. Messages sent will be visible by all web recipients.</div>
                    </div>`;
        } else if (host.startsWith("website-") && Meta.webchat) {
            messages.innerHTML = `<div class="bs-callout bs-callout-info shadow-4">
                            <div class="container">
                            <div class="row">
                            <div class="col-3">
                            ${jdenticon.toSvg(host, 96)}
                            </div>
                            <div class="col-9">
                            <div class="text-white">
                                <h4>${label}</h4>
                                <p>Messages sent will only be visible to this visitor.</p>
                                ${status === 0 ? `<p>Last Seen: ${moment(theTime).format("LLL")}</p>` : ``}
                            </div>
                            </div>
                            </div>
                            </div>
                    </div>`;
        } else if (host === 'website' && !Meta.webchat)
        {
            messages.innerHTML = `<div class="bs-callout bs-callout-info shadow-4">
                            <div>You are viewing public web messages. The chat is currently disabled, therefore recipients cannot send you messages.</div>
                    </div>`;
        } else if (host.startsWith("website-") && !Meta.webchat) {
            messages.innerHTML = `<div class="bs-callout bs-callout-info shadow-4">
                            <div class="container">
                            <div class="row">
                            <div class="col-3">
                            ${jdenticon.toSvg(host, 96)}
                            </div>
                            <div class="col-9">
                            <div class="text-white">
                                <h4>${label}</h4>
                                <p>The web chat is currently disabled; this visitor cannot send you messages</p>
                                ${status === 0 ? `<p>Last Seen: ${moment(theTime).format("LLL")}</p>` : ``}
                            </div>
                            </div>
                            </div>
                            </div>
                    </div>`;
        } else {
            messages.innerHTML = `<div class="bs-callout bs-callout-info shadow-4">
                            <div class="container">
                            <div class="row">
                            <div class="col-3">
                            ${jdenticon.toSvg(host, 96)}
                            </div>
                            <div class="col-9">
                            <div class="text-white">
                                <h4>${label}</h4>
                                ${status === 0 ? `<p>Last Seen: ${moment(theTime).format("LLL")}</p>` : `Note: Just because a computer is online does not necessarily mean someone is there to read your message.`}
                            </div>
                            </div>
                            </div>
                            </div>
                    </div>`;
        }

        // Define a comparison function that will order messages by createdAt when we run the iteration
        var compare = function (a, b) {
            try {
                if (moment(a.createdAt).valueOf() < moment(b.createdAt).valueOf())
                    return -1;
                if (moment(a.createdAt).valueOf() > moment(b.createdAt).valueOf())
                    return 1;
                if (a.ID > b.ID)
                    return -1;
                if (b.ID > a.ID)
                    return 1;
                return 0;
            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please check the logs',
                    message: `Error occurred in the compare function of selectRecipient.`
                });
            }
        };

        // Get only the relevant messages to show in the "new messages" box
        var query = [{from: host, to: [client.host, 'DJ', 'DJ-private']}, {to: host}];
        if (host === 'website')
        {
            query = [{to: ['DJ', 'website']}];
        }

        totalUnread = 0;
        var recipientUnread = {};
        var records = Recipients().get();

        if (records.length > 0)
            records.map(recipient2 => recipientUnread[recipient2.host] = 0);

        records = Messages().get().sort(compare);
        var unreadIDs = [];

        if (records.length > 0)
        {
            records.map(message => {
                // Delete messages older than 1 hour
                if (moment().subtract(1, 'hours').isAfter(moment(message.createdAt)))
                {
                    var temp3 = document.querySelector(`#message-n-m-${message.ID}`);
                    if (temp3)
                    {
                        temp3.parentNode.removeChild(temp3);
                    }
                    Messages({ID: message.ID}).remove();
                    // Do not continue; no need if the message is being deleted
                    return null;
                }
                // Do not continue if this message is not new
                if (!message.needsread)
                    return null;
                totalUnread++;
                if (typeof recipientUnread[message.from_real] === 'undefined')
                    recipientUnread[message.from_real] = 0;
                recipientUnread[message.from_real]++;
                unreadIDs.push(`message-n-m-${message.ID}`);

                var temp = document.querySelector(`#message-n-m-${message.ID}`);
                if (temp === null)
                {
                    var temp2 = document.querySelector(`#messages-unread`);
                    temp2.innerHTML += `<div class="m-1 bs-callout bs-callout-primary shadow-4 message-n animated bounceIn slow" style="cursor: pointer;" id="message-n-m-${message.ID}">
                                        <span class="close text-white" id="message-n-x-${message.ID}" style="pointer-events: auto;">X</span>
                                        <div id="message-n-a-${message.ID}" style="pointer-events: auto;">
                                            <div id="message-n-t-${message.ID}">${message.message}</div>
                                            <div id="message-n-b-${message.ID}" style="font-size: 0.66em;">${moment(message.createdAt).format("hh:mm A")} by ${message.from_friendly} ${(message.to === 'DJ-private') ? ' (Private)' : ``}</span>
                                        </div>
                                    </div>`;
                } else {
                    document.querySelector(`#message-n-t-${message.ID}`).innerHTML = message.message;
                    document.querySelector(`#message-n-b-${message.ID}`).innerHTML = `${moment(message.createdAt).format("hh:mm A")} by ${message.from_friendly} ${(message.to === 'DJ-private') ? ' (Private)' : ``}`;
                }
            });
        }

        // Remove new messages no longer valid
        var attn = document.querySelectorAll(".message-n");
        for (var i = 0; i < attn.length; i++) {
            if (unreadIDs.indexOf(attn[i].id) === -1)
                attn[i].parentNode.removeChild(attn[i]);
        }

        for (var key in recipientUnread)
        {
            if (recipientUnread.hasOwnProperty(key))
            {
                Recipients({host: key}).update({unread: recipientUnread[key]});
            }
        }

        checkRecipients();

        // Now, get other messages according to selected recipient
        var messages = document.querySelector("#messages");
        var temp = document.querySelector(`#btn-messenger-unread`);
        temp.className = `notification badge badge-${totalUnread > 0 ? 'primary' : 'secondary'} shadow-4`;
        temp.innerHTML = totalUnread;
        var records = Messages(query).get().sort(compare);

        if (records.length > 0)
        {
            records.map(message => {

                messageIDs.push(`message-m-${message.ID}`);
                var temp2 = document.querySelector(`#message-m-${message.ID}`);
                if (temp2 === null)
                {
                    messages.innerHTML += `
<div class="row text-dark message m-1 shadow-1 border-left ${message.needsread ? `border-primary` : `border-light`} bg-light-1" style="width: 96%; border-left-width: 5px !important;" id="message-m-${message.ID}">
    <div class="col-2">
      ${jdenticon.toSvg(message.from, 64)}<br />
    </div>
    <div class="col-8">
      <small>${message.from_friendly} -> ${(message.to === 'DJ-private') ? 'DJ (Private)' : `${message.to_friendly}`}</small>
      <div id="message-t-${message.ID}">${message.message}</div>
    </div>
    <div class="col-2">
      <small>${moment(message.createdAt).format("hh:mm A")}</small>
    </div>
</div>`;
                } else {
                    temp2.className = `row text-dark message m-1 shadow-1 border-left ${message.needsread ? `border-primary` : `border-light`} bg-light-1`;
                    var temp3 = document.querySelector(`#message-t-${message.ID}`);
                    temp3.innerHTML = message.message;
                }
            });
        }

        // Remove recipients no longer valid
        var attn = document.querySelectorAll(".message");
        for (var i = 0; i < attn.length; i++) {
            if (messageIDs.indexOf(attn[i].id) === -1)
                attn[i].parentNode.removeChild(attn[i]);
        }

    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during selectRecipient.`
        });
}
}

// Called when a message needs to be marked as read. A null message means mark all messages by the currently selected recipient as read.
function markRead(message = null)
{
    try {
        var query = {ID: message};
        if (message === null)
        {
            if (activeRecipient === null)
                return null;

            var host = Recipients({ID: activeRecipient}).first().host;
            if (host === 'website')
            {
                query = {from: {left: 'website'}};
            } else {
                query = {from: host};
            }
        }
        Messages(query).update({needsread: false});
        selectRecipient(activeRecipient);
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during markRead.`
        });
}
}

// Called when the user requests to have a message deleted
function deleteMessage(message) {
    hostReq.request({method: 'POST', url: nodeURL + '/messages/remove', data: {ID: message}}, function (response) {
        if (response === 'OK')
        {
            iziToast.show({
                title: `Message deleted!`,
                message: `The message was deleted successfully.`,
                timeout: 5000,
                close: true,
                color: 'green',
                drag: false,
                position: 'center',
                closeOnClick: true,
                overlay: false,
                zindex: 1000
            });
        } else {
            iziToast.show({
                title: `Message failed to delete!`,
                message: `There was an error trying to delete that message.`,
                timeout: 10000,
                close: true,
                color: 'red',
                drag: false,
                position: 'center',
                closeOnClick: true,
                overlay: false,
                zindex: 1000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to delete message ${message} but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        console.log(JSON.stringify(response));
    });
}

// Prompt the user to confirm a mute when they ask to mute someone
function prepareMute(recipient) {
    try {
        var label = Recipients({ID: recipient}).first().label;
        var inputData = "";
        iziToast.show({
            title: `Confirm mute of ${label}`,
            message: `A mute causes this person to lose access to the chat for 24 hours and deletes all messages they sent. Only mute someone who is causing a legitimate disruption or threat of safety / integrity. <strong>To proceed, specify a brief reason why you are muting this user and then click "mute".</strong>`,
            timeout: 60000,
            close: true,
            color: 'yellow',
            drag: false,
            position: 'center',
            closeOnClick: false,
            overlay: true,
            zindex: 1000,
            layout: 2,
            image: `assets/images/mute.png`,
            maxWidth: 480,
            inputs: [
                ['<input type="text">', 'keyup', function (instance, toast, input, e) {
                        inputData = input.value;
                    }, true],
            ],
            buttons: [
                ['<button>Mute</button>', function (instance, toast, button, e, inputs) {
                        finishMute(recipient, inputData);
                        instance.hide({}, toast, 'button');
                    }],
                ['<button>Cancel</button>', function (instance, toast, button, e, inputs) {
                        instance.hide({}, toast, 'button');
                    }]
            ]
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during prepareMute.`
        });
    }
}

// Prompt the user when they ask to ban someone
function prepareBan(recipient) {
    try {
        var label = Recipients({ID: recipient}).first().label;
        var inputData = "";
        iziToast.show({
            title: `Confirm ban of ${label}`,
            message: `Banning this person will cause them to lose access to WWSU indefinitely and will delete all their messages. Only ban people who are seriously threatening your or WWSU's safety or integrity. <strong>To proceed, specify a brief reason why you are banning this user and then click "ban".</strong>`,
            timeout: 60000,
            close: true,
            color: 'yellow',
            drag: false,
            position: 'center',
            closeOnClick: false,
            overlay: true,
            zindex: 1000,
            layout: 2,
            image: `assets/images/ban.png`,
            maxWidth: 480,
            inputs: [
                ['<input type="text">', 'keyup', function (instance, toast, input, e) {
                        inputData = input.value;
                    }, true],
            ],
            buttons: [
                ['<button>Ban</button>', function (instance, toast, button, e, inputs) {
                        finishBan(recipient, inputData);
                        instance.hide({}, toast, 'button');
                    }],
                ['<button>Cancel</button>', function (instance, toast, button, e, inputs) {
                        instance.hide({}, toast, 'button');
                    }]
            ]
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during prepareMute.`
        });
    }
}

// Finalizes and issues a mute
function finishMute(recipient, reason) {
    try {
        var host = Recipients({ID: recipient}).first().host;
        hostReq.request({method: 'POST', url: nodeURL + '/discipline/add', data: {active: true, IP: host, action: 'dayban', message: reason}}, function (response) {
            if (response === 'OK')
            {
                iziToast.show({
                    title: `User muted!`,
                    message: `The user was muted successfully.`,
                    timeout: 5000,
                    close: true,
                    color: 'green',
                    drag: false,
                    position: 'center',
                    closeOnClick: true,
                    overlay: false,
                    zindex: 1000
                });
            } else {
                iziToast.show({
                    title: `Failed to mute!`,
                    message: `There was an error trying to mute this user.`,
                    timeout: 10000,
                    close: true,
                    color: 'red',
                    drag: false,
                    position: 'center',
                    closeOnClick: true,
                    overlay: false,
                    zindex: 1000
                });
                hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to mute ${host} but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
            }
            console.log(JSON.stringify(response));
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during finishMute.`
        });
    }
}

// Finalizes and issues a ban
function finishBan(recipient, reason) {
    try {
        var host = Recipients({ID: recipient}).first().host;
        hostReq.request({method: 'POST', url: nodeURL + '/discipline/add', data: {active: true, IP: host, action: 'permaban', message: reason}}, function (response) {
            if (response === 'OK')
            {
                iziToast.show({
                    title: `User banned!`,
                    message: `The user was banned successfully.`,
                    timeout: 5000,
                    close: true,
                    color: 'green',
                    drag: false,
                    position: 'center',
                    closeOnClick: true,
                    overlay: false,
                    zindex: 1000
                });
            } else {
                iziToast.show({
                    title: `Failed to ban!`,
                    message: `There was an error trying to ban this user.`,
                    timeout: 10000,
                    close: true,
                    color: 'red',
                    drag: false,
                    position: 'center',
                    closeOnClick: true,
                    overlay: false,
                    zindex: 1000
                });
                hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to ban ${host} but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
            }
            console.log(JSON.stringify(response));
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during finishBan.`
        });
    }
}

// Prompt the user to confirm if they want to remove an announcement
function prepareAttnRemove(ID) {
    try {
        iziToast.show({
            title: `Confirm removal of announcement ${ID}`,
            message: `Are you sure you want to remove this announcement?`,
            timeout: 60000,
            close: true,
            color: 'yellow',
            drag: false,
            position: 'center',
            closeOnClick: false,
            overlay: true,
            zindex: 1000,
            buttons: [
                ['<button>Yes</button>', function (instance, toast, button, e, inputs) {
                        finishAttnRemove(ID);
                        instance.hide({}, toast, 'button');
                    }],
                ['<button>No</button>', function (instance, toast, button, e, inputs) {
                        instance.hide({}, toast, 'button');
                    }]
            ]
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during prepareAttnRemove.`
        });
    }
}

// Finalizes and removes an announcement
function finishAttnRemove(ID) {
    try {
        directorReq.request({db: Directors(), method: 'POST', url: nodeURL + '/announcements/remove', data: {ID: ID}}, function (response) {
            if (response === 'OK')
            {
                iziToast.show({
                    title: `Announcement removed!`,
                    message: `The announcement was removed successfully.`,
                    timeout: 5000,
                    close: true,
                    color: 'green',
                    drag: false,
                    position: 'center',
                    closeOnClick: true,
                    overlay: false,
                    zindex: 1000
                });
            } else {
                iziToast.show({
                    title: `Failed to remove!`,
                    message: `There was an error trying to remove that announcement.`,
                    timeout: 10000,
                    close: true,
                    color: 'red',
                    drag: false,
                    position: 'center',
                    closeOnClick: true,
                    overlay: false,
                    zindex: 1000
                });
                hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `Someone on ${client.host} DJ Controls attempted to delete announcement ${ID} but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
            }
            console.log(JSON.stringify(response));
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during finishAttnRemove.`
        });
    }
}

// THE FUNCTIONS BELOW DEAL WITH THE BUTTONS CLICKED IN WWSU OPERATIONS


function returnBreak() {
    var afterFunction = () => {
        hostReq.request({method: 'POST', url: nodeURL + '/state/return'}, function (response) {
            console.log(JSON.stringify(response));
            if (response !== 'OK')
            {
                iziToast.show({
                    title: 'An error occurred',
                    message: 'Cannot return from break. Please try again in 15-30 seconds.',
                    timeout: 10000
                });
                hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'urgent', event: `DJ attempted to return from break, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
            }
        });
    }

    if (typeof window.peerHost !== `undefined`)
    {
        startCall(window.peerHost, (success) => {
            if (success)
            {
                afterFunction();
            }
        });
    } else {
        afterFunction();
    }
}

function queuePSA(duration) {
    hostReq.request({method: 'POST', url: nodeURL + '/songs/queue-psa', data: {duration: duration}}, function (response) {
        console.log(JSON.stringify(response));
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Could not queue a PSA. Please try again in 15-30 seconds.',
                timeout: 10000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to queue a PSA, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
    });
}

function prepareLive() {
    document.querySelector("#live-handle").value = '';
    document.querySelector("#live-show").value = '';
    document.querySelector("#live-topic").value = '';
    document.querySelector("#live-topic").placeholder = ``;
    document.querySelector("#live-webchat").checked = true;
    document.querySelector("#live-handle").className = "form-control m-1 is-invalid";
    document.querySelector("#live-show").className = "form-control m-1 is-invalid";
    // Auto-fill show host and name if one is scheduled to go on
    if (calType === 'Show')
    {
        document.querySelector("#live-handle").value = calHost;
        document.querySelector("#live-show").value = calShow;
        document.querySelector("#live-topic").placeholder = calTopic;
        document.querySelector("#live-handle").className = "form-control m-1";
        document.querySelector("#live-show").className = "form-control m-1";
    }
    $("#go-live-modal").iziModal('open');
}

function goLive() {
    if (calType === 'Show' && document.querySelector("#live-handle").value === calHost && document.querySelector("#live-show").value === calShow)
    {
        _goLive();
    } else {
        iziToast.show({
            timeout: 60000,
            overlay: true,
            displayMode: 'once',
            color: 'yellow',
            id: 'inputs',
            zindex: 999,
            layout: 2,
            image: `assets/images/goLive.png`,
            maxWidth: 480,
            title: 'You are about to begin an un-scheduled show',
            message: 'Directors will be notified if you go live! The clockwheel on DJ Controls may be wrong. And programmed show openers/returns/closers might not queue. Continue?',
            position: 'center',
            drag: false,
            closeOnClick: false,
            buttons: [
                ['<button><b>Continue</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                        _goLive();
                    }],
                ['<button><b>Cancel</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                    }],
            ]
        });
    }
}

function _goLive() {
    hostReq.request({method: 'post', url: nodeURL + '/state/live', data: {showname: document.querySelector('#live-handle').value + ' - ' + document.querySelector('#live-show').value, topic: (document.querySelector('#live-topic').value !== `` || calType !== `Show`) ? document.querySelector('#live-topic').value : calTopic, djcontrols: client.host, webchat: document.querySelector('#live-webchat').checked}}, function (response) {
        if (response === 'OK')
        {
            isHost = true;
            selectRecipient(null);
            $("#go-live-modal").iziModal('close');
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Cannot go live at this time. Please try again in 15-30 seconds.',
                timeout: 10000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'urgent', event: `DJ attempted to go live, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        console.log(JSON.stringify(response));
    });
}

function prepareRemote() {
    if (!client.makeCalls)
    {
        iziToast.show({
            title: 'Cannot do remote broadcast',
            message: `This DJ Controls is not allowed to make audio calls. Therefore, a remote broadcast cannot be started on this DJ Controls. If this is an error, on an administrator DJ Controls, go to manage hosts, and assign the make calls permission to ${client.friendlyname}.`,
            timeout: 60000,
            maxWidth: 480,
        });
        return null;
    }
    document.querySelector("#remote-handle").value = '';
    document.querySelector("#remote-show").value = '';
    document.querySelector("#remote-topic").value = '';
    document.querySelector("#remote-topic").placeholder = '';
    document.querySelector("#remote-handle").className = "form-control m-1 is-invalid";
    document.querySelector("#remote-show").className = "form-control m-1 is-invalid";
    document.querySelector("#remote-webchat").checked = true;
    // Auto fill remote host and show if one is scheduled to go on
    if (calType === 'Remote')
    {
        document.querySelector("#remote-handle").value = calHost;
        document.querySelector("#remote-show").value = calShow;
        document.querySelector("#remote-topic").placeholder = calTopic;
        document.querySelector("#remote-handle").className = "form-control m-1";
        document.querySelector("#remote-show").className = "form-control m-1";
    }

    // Populate input devices
    navigator.mediaDevices.enumerateDevices()
            .then((devices) => {
                var temp = document.querySelector("#remote-input");
                if (temp !== null)
                {
                    temp.innerHTML = ``;

                    devices.map((device, index) => {
                        if (device.kind === 'audioinput') {
                            temp.innerHTML += `<option value="${device.deviceId}">${device.label || 'Microphone ' + (index + 1)}</option>`;
                        }
                    });

                    temp.onchange = () => {
                        getAudio(temp.value);
                    };
                }
            });

    // Populate hosts that can be audio-called
    var temp2 = document.querySelector("#remote-host");
    if (temp2 !== null)
    {
        temp2.innerHTML = ``;
        Hosts({authorized: true, answerCalls: true}).each((host) => {
            console.dir(host);
            Recipients({host: host.host}).each((recipient) => {
                console.dir(recipient);
                if (host.host !== client.host && recipient.peer !== null)
                {
                    temp2.innerHTML += `<option value="${host.host}">${host.friendlyname}</option>`;
                }
            });
        });
    }

    $("#go-remote-modal").iziModal('open');
}

function goRemote() {
    if (calType === 'Remote' && document.querySelector("#remote-handle").value === calHost && document.querySelector("#remote-show").value === calShow)
    {
        _goRemote();
    } else {
        iziToast.show({
            timeout: 60000,
            overlay: true,
            displayMode: 'once',
            color: 'yellow',
            id: 'inputs',
            zindex: 999,
            layout: 2,
            image: `assets/images/goRemote.png`,
            maxWidth: 480,
            title: 'You are about to begin an un-scheduled remote broadcast',
            message: 'Directors will be notified if you begin the broadcast! The clockwheel on DJ Controls may be wrong. And programmed openers/returns/closers might not queue. Continue?',
            position: 'center',
            drag: false,
            closeOnClick: false,
            buttons: [
                ['<button><b>Continue</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                        _goRemote();
                    }],
                ['<button><b>Cancel</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                    }],
            ]
        });
    }
}

function _goRemote() {
    var remoteOptions = document.getElementById('remote-host');
    var selectedOption = remoteOptions.options[remoteOptions.selectedIndex].value;
    startCall(selectedOption, (success) => {
        if (success)
        {
            hostReq.request({method: 'POST', url: nodeURL + '/state/remote', data: {showname: document.querySelector('#remote-handle').value + ' - ' + document.querySelector('#remote-show').value, topic: (document.querySelector('#remote-topic').value !== `` || calType !== `Remote`) ? document.querySelector('#remote-topic').value : calTopic, djcontrols: client.host, webchat: document.querySelector('#remote-webchat').checked}}, function (response) {
                if (response === 'OK')
                {
                    isHost = true;
                    selectRecipient(null);
                    $("#go-remote-modal").iziModal('close');
                } else {
                    iziToast.show({
                        title: 'An error occurred',
                        message: 'Cannot go remote at this time. Please try again in 15-30 seconds.',
                        timeout: 10000
                    });
                    hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'urgent', event: `DJ attempted to go remote, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
                }
                console.log(JSON.stringify(response));
            });
        }
    });
}

function prepareSports() {
    document.querySelector('#sports-sport').value = "";
    document.querySelector("#sports-sport").className = "form-control m-1 is-invalid";
    document.querySelector('#sports-topic').value = "";
    document.querySelector('#sports-topic').placeholder = "";
    document.querySelector("#sports-webchat").checked = true;
    // Auto fill the sport dropdown if a sport is scheduled
    if (calType === 'Sports')
    {
        document.querySelector("#sports-sport").value = calShow;
        document.querySelector('#sports-topic').value = "";
        document.querySelector('#sports-topic').placeholder = calTopic;
        document.querySelector("#sports-sport").className = "form-control m-1";
        document.querySelector("#sports-webchat").checked = true;
    }
    $("#go-sports-modal").iziModal('open');
}

function goSports() {
    if (calType === 'Sports' && document.querySelector("#sports-sport").value === calShow)
    {
        _goSports();
    } else {
        iziToast.show({
            timeout: 60000,
            overlay: true,
            displayMode: 'once',
            color: 'yellow',
            id: 'inputs',
            zindex: 999,
            layout: 2,
            image: `assets/images/goSports.png`,
            maxWidth: 480,
            title: 'You are about to begin an un-scheduled sports broadcast',
            message: 'Directors will be notified if you begin the broadcast! The clockwheel on DJ Controls may be wrong. And programmed openers/returns/liners/closers might not queue. Continue?',
            position: 'center',
            drag: false,
            closeOnClick: false,
            buttons: [
                ['<button><b>Continue</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                        _goSports();
                    }],
                ['<button><b>Cancel</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                    }],
            ]
        });
    }
}

function _goSports() {
    var sportsOptions = document.getElementById('sports-sport');
    var selectedOption = sportsOptions.options[sportsOptions.selectedIndex].value;
    hostReq.request({method: 'POST', url: nodeURL + '/state/sports', data: {sport: selectedOption, topic: (document.querySelector('#sports-topic').value !== `` || calType !== `Sports`) ? document.querySelector('#sports-topic').value : calTopic, webchat: document.querySelector('#sports-webchat').checked}}, function (response) {
        if (response === 'OK')
        {
            isHost = true;
            selectRecipient(null);
            $("#go-sports-modal").iziModal('close');
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Cannot go to sports broadcast at this time. Please try again in 15-30 seconds.',
                timeout: 10000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'urgent', event: `DJ attempted to go sports, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        console.log(JSON.stringify(response));
    });
}

function prepareSportsRemote() {
    if (!client.makeCalls)
    {
        iziToast.show({
            title: 'Cannot do remote sports broadcast',
            message: `This DJ Controls is not allowed to make audio calls. Therefore, a remote sports broadcast cannot be started on this DJ Controls. If this is an error, on an administrator DJ Controls, go to manage hosts, and assign the make calls permission to ${client.friendlyname}.`,
            timeout: 60000,
            maxWidth: 480,
        });
        return null;
    }
    document.querySelector('#sportsremote-sport').value = "";
    document.querySelector("#sportsremote-sport").className = "form-control m-1 is-invalid";
    document.querySelector('#sportsremote-topic').value = "";
    document.querySelector('#sportsremote-topic').placeholder = "";
    document.querySelector("#sportsremote-webchat").checked = true;
    // Auto fill the sport dropdown if a sport is scheduled
    if (calType === 'Sports')
    {
        document.querySelector("#sportsremote-sport").value = calShow;
        document.querySelector('#sportsremote-topic').value = "";
        document.querySelector('#sportsremote-topic').placeholder = calTopic;
        document.querySelector("#sportsremote-sport").className = "form-control m-1";
        document.querySelector("#sportsremote-webchat").checked = true;
    }

    // Populate input devices
    navigator.mediaDevices.enumerateDevices()
            .then((devices) => {
                var temp = document.querySelector("#sportsremote-input");
                if (temp !== null)
                {
                    temp.innerHTML = ``;

                    devices.map((device, index) => {
                        if (device.kind === 'audioinput') {
                            temp.innerHTML += `<option value="${device.deviceId}">${device.label || 'Microphone ' + (index + 1)}</option>`;
                        }
                    });

                    temp.onchange = () => {
                        getAudio(temp.value);
                    };
                }
            });

    // Populate hosts that can be audio-called
    var temp2 = document.querySelector("#sportsremote-host");
    if (temp2 !== null)
    {
        temp2.innerHTML = ``;
        Hosts({authorized: true, answerCalls: true}).each((host) => {
            console.dir(host);
            Recipients({host: host.host}).each((recipient) => {
                console.dir(recipient);
                if (host.host !== client.host && recipient.peer !== null)
                {
                    temp2.innerHTML += `<option value="${host.host}">${host.friendlyname}</option>`;
                }
            });
        });
    }

    $("#go-sportsremote-modal").iziModal('open');
}

function goSportsRemote() {
    if (calType === 'Sports' && document.querySelector("#sportsremote-sport").value === calShow)
    {
        _goSportsRemote();
    } else {
        iziToast.show({
            timeout: 60000,
            overlay: true,
            displayMode: 'once',
            color: 'yellow',
            id: 'inputs',
            zindex: 999,
            layout: 2,
            image: `assets/images/goSports.png`,
            maxWidth: 480,
            title: 'You are about to begin an un-scheduled sports broadcast',
            message: 'Directors will be notified if you begin the broadcast! The clockwheel on DJ Controls may be wrong. And programmed openers/returns/liners/closers might not queue. Continue?',
            position: 'center',
            drag: false,
            closeOnClick: false,
            buttons: [
                ['<button><b>Continue</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                        _goSportsRemote();
                    }],
                ['<button><b>Cancel</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                    }],
            ]
        });
    }
}

function _goSportsRemote() {
    var remoteOptions = document.getElementById('sportsremote-host');
    var selectedOption = remoteOptions.options[remoteOptions.selectedIndex].value;
    startCall(selectedOption, (success) => {
        if (success)
        {
            var sportsOptions = document.getElementById('sportsremote-sport');
            var selectedOption = sportsOptions.options[sportsOptions.selectedIndex].value;
            hostReq.request({method: 'POST', url: nodeURL + '/state/sports-remote', data: {sport: selectedOption, topic: (document.querySelector('#sportsremote-topic').value !== `` || calType !== `Sports`) ? document.querySelector('#sportsremote-topic').value : calTopic, webchat: document.querySelector('#sportsremote-webchat').checked}}, function (response) {
                if (response === 'OK')
                {
                    isHost = true;
                    selectRecipient(null);
                    $("#go-sportsremote-modal").iziModal('close');
                } else {
                    iziToast.show({
                        title: 'An error occurred',
                        message: 'Cannot go to sports broadcast at this time. Please try again in 15-30 seconds.',
                        timeout: 10000
                    });
                    hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'urgent', event: `DJ attempted to go sports remote, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
                }
                console.log(JSON.stringify(response));
            });
        }
    });
}

function promptIfNotHost(action, fn)
{
    if (isHost)
    {
        fn();
    } else {
        iziToast.show({
            timeout: 60000,
            overlay: true,
            displayMode: 'once',
            color: 'yellow',
            id: 'inputs',
            zindex: 999,
            layout: 2,
            image: ``,
            maxWidth: 480,
            title: 'Confirm action',
            message: `Are you sure you want to ${action}? You might interfere with the current broadcast.`,
            position: 'center',
            drag: false,
            closeOnClick: false,
            buttons: [
                ['<button><b>Yes</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                        isHost = true;
                        fn();
                    }],
                ['<button><b>No</b></button>', function (instance, toast) {
                        instance.hide({transitionOut: 'fadeOut'}, toast, 'button');
                    }],
            ]
        });
    }
}

function prepareLog() {
    document.querySelector("#log-datetime").value = moment(Meta.time).format("YYYY-MM-DD\THH:mm");
    document.querySelector("#log-artist").value = '';
    document.querySelector("#log-title").value = '';
    document.querySelector("#log-album").value = '';
    document.querySelector("#log-label").value = '';
    $("#log-modal").iziModal('open');
}

function saveLog() {
    var thelog = 'DJ/Producer played a track.';
    var dateObject = moment(document.querySelector("#log-datetime").value);
    hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'manual', logsubtype: Meta.show, loglevel: 'secondary', event: thelog, trackArtist: document.querySelector("#log-artist").value, trackTitle: document.querySelector("#log-title").value, trackAlbum: document.querySelector("#log-album").value, trackLabel: document.querySelector("#log-label").value, date: dateObject.toISOString()}}, function (response) {
        if (response === 'OK')
        {
            $("#log-modal").iziModal('close');
            iziToast.show({
                title: `Saved`,
                message: `Your log entry was saved successfully.`,
                timeout: 5000,
                close: true,
                color: 'green',
                drag: false,
                position: 'center',
                closeOnClick: true,
                overlay: false,
                zindex: 1000
            });
            if (document.querySelector("#log-artist").value.length > 0 && document.querySelector("#log-title").value.length > 0)
            {
                iziToast.show({
                    title: `Please indicate when you finished playing:`,
                    message: `${document.querySelector("#log-artist").value} - ${document.querySelector("#log-title").value}`,
                    timeout: 600000,
                    close: true,
                    color: 'blue',
                    drag: false,
                    position: 'bottomCenter',
                    closeOnClick: false,
                    overlay: false,
                    buttons: [
                        ['<button>Playing Another Track</button>', function (instance, toast, button, e, inputs) {
                                prepareLog();
                                instance.hide({}, toast, 'button');
                            }],
                        ['<button>Playing No Tracks</button>', function (instance, toast, button, e, inputs) {
                                hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'manual', logsubtype: Meta.show, loglevel: 'secondary', event: 'DJ/Producer finished playing music.', trackArtist: '', trackTitle: '', trackAlbum: '', trackLabel: '', date: moment().toISOString(true)}}, function (response) {});
                                instance.hide({}, toast, 'button');
                            }]
                    ]
                });
            }
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to submit a log entry. Please email engineer@wwsu1069.org.'
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to add a log, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        console.log(JSON.stringify(response));
    });
}

// for when a DJ reports a problem
function prepareEmergency() {
    document.querySelector("#emergency-issue").value = ``;
    $("#emergency-modal").iziModal('open');
}

function sendEmergency() {
    hostReq.request({method: 'POST', url: nodeURL + '/announcements/add-problem', data: {information: `<strong>${moment().format("MM/DD/YYYY hh:mm A")}</strong>: ${document.querySelector("#emergency-issue").value}`}}, function (response) {
        if (response === 'OK')
        {
            $("#emergency-modal").iziModal('close');
            iziToast.show({
                title: `Reported`,
                message: `The problem has been reported, and the engineer will be notified.`,
                timeout: 5000,
                close: true,
                color: 'green',
                drag: false,
                position: 'center',
                closeOnClick: true,
                overlay: false,
                zindex: 1000
            });
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to submit a problem. Please email your issue to engineer@wwsu1069.org instead.'
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to report a problem, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        console.log(JSON.stringify(response));
    });
}

// For when a DJ requests to have a message display on the display signs
function prepareDisplay() {
    document.querySelector("#display-message").value = ``;
    $("#display-modal").iziModal('open');
}

function sendDisplay() {
    hostReq.request({method: 'POST', url: nodeURL + '/messages/send', data: {from: client.host, to: `display-public`, to_friendly: `Display (Public)`, message: document.querySelector("#display-message").value}}, function (response) {
        if (response === 'OK')
        {
            $("#display-modal").iziModal('close');
            iziToast.show({
                title: `Sent`,
                message: `Your message was sent to the display signs.`,
                timeout: 5000,
                close: true,
                color: 'green',
                drag: false,
                position: 'center',
                closeOnClick: true,
                overlay: false,
                zindex: 1000
            });
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to submit a message to the display signs. Please email engineer@wwsu1069.org'
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to send a message to display signs, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        console.log(JSON.stringify(response));
    });
}

function endShow() {
    hostReq.request({method: 'POST', url: nodeURL + '/state/automation'}, function (response) {
        if (typeof response.showTime === 'undefined')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to end your broadcast. Please try again in 15-30 seconds.',
                timeout: 10000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'urgent', event: `DJ attempted to end their show, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        } else {
            $("#xp-modal").iziModal('open');
            document.querySelector(`#stat-showTime`).innerHTML = `${parseInt((response.showTime || 0) / 6) / 10} this show`;
            document.querySelector(`#stat-listenerMinutes`).innerHTML = `${parseInt((response.listenerMinutes || 0) / 6) / 10} this show`;
            document.querySelector(`#stat-subtotalXP`).innerHTML = typeof response.subtotalXP !== 'undefined' ? `${formatInt(response.subtotalXP)} this show` : ``;
            document.querySelector(`#stat-totalXP`).innerHTML = typeof response.totalXP !== 'undefined' ? formatInt(response.totalXP) : `-`;
            document.querySelector(`#stat-remoteCredits`).innerHTML = typeof response.remoteCredits !== 'undefined' ? formatInt(response.remoteCredits) : `-`;
            document.querySelector(`#stat-totalShowTime`).innerHTML = typeof response.totalShowTime !== 'undefined' ? formatInt(parseInt(response.totalShowTime / 60)) : `-`;
            document.querySelector(`#stat-totalListeners`).innerHTML = typeof response.totalListenerMinutes !== 'undefined' ? formatInt(parseInt(response.totalListenerMinutes / 60)) : `-`;

            try {
                window.peerDevice = undefined;
                window.peerHost = undefined;
                outgoingCloseIgnore = true;
                console.log(`Closing call via endShow`);
                outgoingCall.close();
                outgoingCall = undefined;
                outgoingCloseIgnore = false;
            } catch (eee) {
                outgoingCloseIgnore = false;
                // ignore errors
            }
        }
        console.log(JSON.stringify(response));
    });
}

function switchShow() {
    hostReq.request({method: 'POST', url: nodeURL + '/state/automation', data: {transition: true}}, function (response) {
        if (typeof response.showTime === 'undefined')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to end your broadcast. Please try again in 15-30 seconds.',
                timeout: 10000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'urgent', event: `DJ attempted to switch show, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        } else {
            $("#xp-modal").iziModal('open');
            document.querySelector(`#stat-showTime`).innerHTML = `${parseInt((response.showTime || 0) / 6) / 10} this show`;
            document.querySelector(`#stat-listenerMinutes`).innerHTML = `${parseInt((response.listenerMinutes || 0) / 6) / 10} this show`;
            document.querySelector(`#stat-subtotalXP`).innerHTML = typeof response.subtotalXP !== 'undefined' ? `${formatInt(response.subtotalXP)} this show` : ``;
            document.querySelector(`#stat-totalXP`).innerHTML = typeof response.totalXP !== 'undefined' ? formatInt(response.totalXP) : `-`;
            document.querySelector(`#stat-remoteCredits`).innerHTML = typeof response.remoteCredits !== 'undefined' ? formatInt(response.remoteCredits) : `-`;
            document.querySelector(`#stat-totalShowTime`).innerHTML = typeof response.totalShowTime !== 'undefined' ? formatInt(parseInt(response.totalShowTime / 60)) : `-`;
            document.querySelector(`#stat-totalListeners`).innerHTML = typeof response.totalListenerMinutes !== 'undefined' ? formatInt(parseInt(response.totalListenerMinutes / 60)) : `-`;

            try {
                window.peerDevice = undefined;
                window.peerHost = undefined;
                outgoingCloseIgnore = true;
                console.log(`Closing call via switchShow`);
                outgoingCall.close();
                outgoingCall = undefined;
                outgoingCloseIgnore = false;
            } catch (eee) {
                outgoingCloseIgnore = false;
                // ignore errors
            }
        }
        console.log(JSON.stringify(response));
    });
}

function goBreak(halftime) {
    hostReq.request({method: 'POST', url: nodeURL + '/state/break', data: {halftime: halftime}}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to go into break. Please try again in 15-30 seconds.',
                timeout: 10000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'urgent', event: `DJ attempted to go to break, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        console.log(JSON.stringify(response));
    });
}

function playTopAdd() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Queuing/playing Top Add';
    hostReq.request({method: 'POST', url: nodeURL + '/songs/queue-add'}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to play a Top Add. Please try again in 15-30 seconds.',
                timeout: 10000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to play a Top Add, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

function playLiner() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Queuing/playing Liner';
    hostReq.request({method: 'POST', url: nodeURL + '/songs/queue-liner'}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to play a liner. Please try again in 15-30 seconds.',
                timeout: 10000
            });
            hostReq.request({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'djcontrols', logsubtype: Meta.show, loglevel: 'warning', event: `DJ attempted to play a Liner, but an error was returned: ${JSON.stringify(response) || response}`}}, function (response) {});
        }
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

// Finalizes and issues a mute
function queueRequest(requestID) {
    try {
        hostReq.request({method: 'POST', url: nodeURL + '/requests/queue', data: {ID: requestID}}, function (response) {
            if (response === 'OK')
            {
                iziToast.show({
                    title: `Request queued!`,
                    message: `The request was queued successfully. The request entry will not disappear until the request is played.`,
                    timeout: 10000,
                    close: true,
                    color: 'green',
                    drag: false,
                    position: 'center',
                    closeOnClick: true,
                    overlay: false,
                    zindex: 1000
                });
            } else {
                iziToast.show({
                    title: `Failed to queue request!`,
                    message: `There was an error trying to queue that request. Either the request was already queued, cannot be queued because of rotation rules, or some other error happened.`,
                    timeout: 10000,
                    close: true,
                    color: 'red',
                    drag: false,
                    position: 'center',
                    closeOnClick: true,
                    overlay: false,
                    zindex: 1000
                });
            }
            console.log(JSON.stringify(response));
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during queueRequest.`
        });
    }
}

// Check for new Eas alerts and push them out when necessary.
function processEas(data, replace = false)
{
    // Data processing
    try {
        var prev = [];
        if (replace)
        {
            // Get all the EAS IDs currently in memory before replacing the data
            prev = Eas().select("ID");

            // Replace with the new data
            Eas = TAFFY();
            Eas.insert(data);

            // Go through the new data. If any IDs exists that did not exist before, consider it a new alert and make a notification.
            Eas().each(function (record)
            {
                if (prev.indexOf(record.ID) === -1)
                {
                    if (record.severity === 'Extreme')
                    {
                        if (!Meta.state.startsWith("automation_"))
                        {
                            var notification = notifier.notify('Extreme Weather Alert in effect', {
                                message: `Please consider ending your show and taking shelter. See DJ Controls.`,
                                icon: 'https://png2.kisspng.com/20180419/rue/kisspng-weather-forecasting-storm-computer-icons-clip-art-severe-5ad93bcb9e9da1.5355263615241860596497.png',
                                duration: 900000,
                            });
                            main.flashTaskbar();
                            iziToast.show({
                                class: 'flash-bg',
                                class: 'iziToast-eas-extreme-end',
                                title: 'Extreme Weather Alert in Effect',
                                message: `A ${record.alert} is in effect for the counties of ${record.counties}. You may wish to consider ending your show early and taking shelter. If so, click "End Show" when ready to end. Otherwise, close this notification.`,
                                timeout: 900000,
                                close: true,
                                color: 'red',
                                drag: false,
                                position: 'center',
                                closeOnClick: false,
                                overlay: true,
                                zindex: 500,
                                layout: 2,
                                image: `assets/images/extremeWeather.png`,
                                maxWidth: 640,
                                buttons: [
                                    ['<button>End Show</button>', function (instance, toast, button, e, inputs) {
                                            endShow();
                                            instance.hide({}, toast, 'button');
                                        }]
                                ]
                            });
                        } else {
                            iziToast.show({
                                class: 'iziToast-eas-extreme',
                                title: 'Extreme Weather Alert in Effect',
                                message: `A ${record.alert} is in effect for the counties of ${record.counties}. You may wish to decide against hosting any shows at this time and instead seeking shelter.`,
                                timeout: 900000,
                                close: true,
                                color: 'red',
                                drag: false,
                                position: 'center',
                                closeOnClick: true,
                                overlay: true,
                                zindex: 500,
                                layout: 2,
                                image: `assets/images/extremeWeather.png`,
                                maxWidth: 640
                            });
                        }
                    } else if (record.severity === 'Severe')
                    {
                        var notification = notifier.notify('Severe Weather Alert in effect', {
                            message: `Please keep an eye on the weather. See DJ Controls for more info.`,
                            icon: 'https://static1.squarespace.com/static/59a614fef7e0ab8b4a7b489a/5aa95c6a652dea6215e225f9/5aa95d258165f5044f919008/1521460510101/feature+icon+-+severe+weather.png?format=300w',
                            duration: 900000,
                        });
                        main.flashTaskbar();
                        iziToast.show({
                            class: 'iziToast-eas-severe',
                            title: 'Severe Weather Alert in Effect',
                            message: `A ${record.alert} is in effect for the counties of ${record.counties}. Please keep an eye on the weather.`,
                            timeout: 900000,
                            close: true,
                            color: 'yellow',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: true,
                            zindex: 250,
                            layout: 2,
                            image: `assets/images/severeWeather.png`,
                            maxWidth: 640
                        });
                    }
                }
            });

        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Eas.insert(data[key]);
                            var className = 'secondary';
                            if (data[key].severity === 'Extreme')
                            {
                                className = 'danger';
                            } else if (data[key].severity === 'Severe')
                            {
                                className = 'urgent';
                            } else if (data[key].severity === 'Moderate')
                            {
                                className = 'warning';
                            } else {
                                className = 'info';
                            }
                            if (document.querySelector(`#attn-eas-${data[key].ID}`) === null)
                            {
                                // TODO EAS
                            } else {
                            }
                            if (data[key].severity === 'Extreme')
                            {
                                if (!Meta.state.startsWith("automation_"))
                                {
                                    var notification = notifier.notify('Extreme Weather Alert in effect', {
                                        message: `Please consider ending your show and taking shelter. See DJ Controls.`,
                                        icon: 'https://png2.kisspng.com/20180419/rue/kisspng-weather-forecasting-storm-computer-icons-clip-art-severe-5ad93bcb9e9da1.5355263615241860596497.png',
                                        duration: 900000,
                                    });
                                    main.flashTaskbar();
                                    iziToast.show({
                                        class: 'flash-bg',
                                        class: 'iziToast-eas-extreme-end',
                                        title: 'Extreme Weather Alert in Effect!',
                                        message: `A ${data[key].alert} is in effect for the counties of ${data[key].counties}. You may wish to consider ending the show early and taking shelter. If so, click "End Show" when ready to end. Otherwise, close this notification.`,
                                        timeout: 900000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: false,
                                        overlay: true,
                                        zindex: 500,
                                        layout: 2,
                                        image: `assets/images/extremeWeather.png`,
                                        maxWidth: 640,
                                        buttons: [
                                            ['<button>End Show</button>', function (instance, toast, button, e, inputs) {
                                                    endShow();
                                                    instance.hide({}, toast, 'button');
                                                }]
                                        ]
                                    });
                                } else {
                                    iziToast.show({
                                        class: 'flash-bg',
                                        class: 'iziToast-eas-extreme',
                                        title: 'Extreme weather alert in effect',
                                        message: `A ${data[key].alert} is in effect for the counties of ${data[key].counties}. You may wish to decide against hosting any shows at this time and instead seeking shelter.`,
                                        timeout: 900000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: true,
                                        zindex: 500,
                                        layout: 2,
                                        image: `assets/images/extremeWeather.png`,
                                        maxWidth: 640
                                    });
                                }
                            } else if (data[key].severity === 'Severe')
                            {
                                var notification = notifier.notify('Severe Weather Alert in effect', {
                                    message: `Please keep an eye on the weather. See DJ Controls for more info.`,
                                    icon: 'https://static1.squarespace.com/static/59a614fef7e0ab8b4a7b489a/5aa95c6a652dea6215e225f9/5aa95d258165f5044f919008/1521460510101/feature+icon+-+severe+weather.png?format=300w',
                                    duration: 900000,
                                });
                                main.flashTaskbar();
                                iziToast.show({
                                    class: 'iziToast-eas-severe',
                                    title: 'Severe weather alert in effect',
                                    message: `A ${data[key].alert} is in effect for the counties of ${data[key].counties}. Please keep an eye on the weather.`,
                                    timeout: 900000,
                                    close: true,
                                    color: 'yellow',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: true,
                                    zindex: 250,
                                    layout: 2,
                                    image: `assets/images/severeWeather.png`,
                                    maxWidth: 640
                                });
                            }
                            break;
                        case 'update':
                            Eas({ID: data[key].ID}).update(data[key]);
                            var className = 'secondary';
                            if (data[key].severity === 'Extreme')
                            {
                                className = 'danger';
                            } else if (data[key].severity === 'Severe')
                            {
                                className = 'urgent';
                            } else if (data[key].severity === 'Moderate')
                            {
                                className = 'warning';
                            } else {
                                className = 'info';
                            }
                            if (document.querySelector(`#attn-eas-${data[key].ID}`) === null)
                            {
                                // TODO EAS
                            } else {
                            }
                            break;
                        case 'remove':
                            Eas({ID: data[key]}).remove();
                            var easAttn = document.querySelector(`#attn-eas-${data[key]}`);
                            if (easAttn !== null)
                                easAttn.parentNode.removeChild(easAttn);
                            break;
                    }
                }
            }
        }

        checkAnnouncements();
        checkAnnouncementColor();

    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: 'Error occurred during the processEas function.'
        });
}
}

// Update recipients as changes happen
function processStatus(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {
            Status = TAFFY();
            Status.insert(data);

            // Add Status-based announcements
            var prev = [];
            if (data.length > 0)
            {
                data.map(datum => {
                    if (document.querySelector(`#attn-status-${datum.name}`) === null)
                    {
                        if (client.emergencies && datum.status < 3)
                        {
                            var notification = notifier.notify('System Problem', {
                                message: `${datum.label} reports a significant issue. Please see DJ Controls announcements.`,
                                icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                                duration: (1000 * 60 * 15),
                            });
                            main.flashTaskbar();
                        }
                    }
                    if (datum.name === 'silence' && (client.emergencies || isHost) && datum.status <= 3)
                    {
                        iziToast.show({
                            title: 'Silence / Low Audio detected!',
                            message: `Please check your audio levels and ensure they are good. Be aware silence detection may be delayed due to the delay system.`,
                            timeout: 60000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: true,
                            zindex: 500,
                            layout: 2,
                            image: `assets/images/silence.png`,
                            maxWidth: 480
                        });
                        var notification = notifier.notify('Low / No Audio Detected', {
                            message: `Please check your audio levels to see if they are okay.`,
                            icon: 'http://pluspng.com/img-png/mute-png-noun-project-200.png',
                            duration: 60000,
                        });
                        main.flashTaskbar();
                        if (Meta.state.startsWith("sports_") || Meta.state.startsWith("sportsremote_") || Meta.state.startsWith("remote_"))
                            responsiveVoice.speak(`Silence detected. Please check your audio connection.`);
                    }
                });
            }
            checkAnnouncements();
        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Status.insert(data[key]);
                            if (document.querySelector(`#attn-status-${data[key].name}`) === null)
                            {
                                if (client.emergencies && data[key].status < 3)
                                {
                                    var notification = notifier.notify('System Problem', {
                                        message: `${data[key].label} reports a significant issue. Please see DJ Controls announcements.`,
                                        icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                                        duration: (1000 * 60 * 15),
                                    });
                                    main.flashTaskbar();
                                }
                            }
                            if (data[key].name === 'silence' && data[key].status <= 3 && (client.emergencies || isHost))
                            {
                                iziToast.show({
                                    title: 'Silence / Low Audio detected!',
                                    message: `Please check your audio levels and ensure they are good. Be aware silence detection may be delayed due to the delay system.`,
                                    timeout: 60000,
                                    close: true,
                                    color: 'red',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: true,
                                    zindex: 500,
                                    layout: 2,
                                    image: `assets/images/silence.png`,
                                    maxWidth: 480
                                });
                                var notification = notifier.notify('Low / No Audio Detected', {
                                    message: `Please check your audio levels to see if they are okay.`,
                                    icon: 'http://pluspng.com/img-png/mute-png-noun-project-200.png',
                                    duration: 60000,
                                });
                                main.flashTaskbar();
                                if (Meta.state.startsWith("sports_") || Meta.state.startsWith("sportsremote_") || Meta.state.startsWith("remote_"))
                                    responsiveVoice.speak(`Silence detected. Please check your audio connection.`);
                            }
                            break;
                        case 'update':
                            Status({ID: data[key].ID}).update(data[key]);
                            var className = 'secondary';
                            if (data[key].status === 1)
                            {
                                className = 'danger';
                            } else if (data[key].status === 2)
                            {
                                className = 'urgent';
                            } else if (data[key].status === 3)
                            {
                                className = 'warning';
                            }
                            if (document.querySelector(`#attn-status-${data[key].name}`) === null)
                            {
                                if (client.emergencies && data[key].status < 3)
                                {
                                    var notification = notifier.notify('System Problem', {
                                        message: `${data[key].label} reports a significant issue. Please see DJ Controls announcements.`,
                                        icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                                        duration: (1000 * 60 * 15),
                                    });
                                    main.flashTaskbar();
                                }
                            }
                            if (data[key].name === 'silence' && data[key].status <= 3 && (client.emergencies || isHost))
                            {
                                iziToast.show({
                                    title: 'Silence / Low Audio detected!',
                                    message: `Please check your audio levels and ensure they are good. Be aware silence detection may be delayed due to the delay system.`,
                                    timeout: 60000,
                                    close: true,
                                    color: 'red',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: true,
                                    zindex: 500,
                                    layout: 2,
                                    image: `assets/images/silence.png`,
                                    maxWidth: 480
                                });
                                var notification = notifier.notify('Low / No Audio Detected', {
                                    message: `Please check your audio levels to see if they are okay.`,
                                    icon: 'http://pluspng.com/img-png/mute-png-noun-project-200.png',
                                    duration: 60000,
                                });
                                main.flashTaskbar();
                                if (Meta.state.startsWith("sports_") || Meta.state.startsWith("sportsremote_") || Meta.state.startsWith("remote_"))
                                    responsiveVoice.speak(`Silence detected. Please check your audio connection.`);
                            }
                            break;
                        case 'remove':
                            Status({ID: data[key]}).remove();
                            break;
                    }
                }
            }
            checkAnnouncements();
        }

        checkAnnouncementColor();

    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the processStatus function.'
        });
}
}

// Update announcements as they come in
function processAnnouncements(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {
            // Replace with the new data
            Announcements = TAFFY();
            Announcements.insert(data);
        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Announcements.insert(data[key]);
                            break;
                        case 'update':
                            Announcements({ID: data[key].ID}).update(data[key]);
                            break;
                        case 'remove':
                            Announcements({ID: data[key]}).remove();
                            break;
                    }
                }
            }
        }

        checkAnnouncements();

    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: 'Error occurred during the processAnnouncements function.'
        });
}
}

// Update announcements as they come in
function processCalendar(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {
            // Replace with the new data
            Calendar = TAFFY();
            Calendar.insert(data);
        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Calendar.insert(data[key]);
                            break;
                        case 'update':
                            Calendar({ID: data[key].ID}).update(data[key]);
                            break;
                        case 'remove':
                            Calendar({ID: data[key]}).remove();
                            break;
                    }
                }
            }
        }

    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: 'Error occurred during the processCalendar function.'
        });
}
}

// Update recipients as changes happen
function processRecipients(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {
            if (data.length > 0)
            {
                data.map((datum, index) => {
                    data[index].unread = 0;

                    var temp = Recipients({ID: datum.ID}).first();
                    if (waitingFor && waitingFor.host === datum.host && datum.peer !== null && (!temp || temp === null || typeof temp.host === `undefined` || temp.peer !== datum.peer))
                        startCall(waitingFor.host, waitingFor.cb, true);
                });
            }

            Recipients = TAFFY();
            Recipients.insert(data);
        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            data[key].unread = 0;
                            Recipients.insert(data[key]);
                            if (waitingFor && waitingFor.host === data[key].host && data[key].peer !== null)
                                startCall(waitingFor.host, waitingFor.cb, true);
                            break;
                        case 'update':
                            data[key].unread = 0;
                            var temp = Recipients({ID: data[key].ID}).first();
                            if (temp && waitingFor && waitingFor.host === data[key].host && data[key].peer !== null && temp.peer !== data[key].peer)
                                startCall(waitingFor.host, waitingFor.cb, true);
                            Recipients({ID: data[key].ID}).update(data[key]);
                            break;
                        case 'remove':
                            Recipients({ID: data[key]}).remove();
                            break;
                    }
                }
            }
        }
        selectRecipient(activeRecipient);
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: 'Error occurred during the processRecipients function.'
        });
}
}

// Update messages as changes happen
function processMessages(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {
            var prev = [];

            prev = Messages().select("ID");

            // Display notifications for new messages
            if (data.length > 0)
            {
                // Replace old data with new data
                Messages = TAFFY();
                Messages.insert(data);

                data.map((datum, index) => {
                    data[index].needsread = false;
                    data[index].from_real = datum.from;
                    if (datum.to === `DJ`)
                        data[index].from_real = `website`;
                    if (prev.indexOf(datum.ID) === -1)
                    {
                        switch (data[index].to)
                        {
                            case 'emergency':
                                if (client.emergencies)
                                {
                                    data[index].needsread = true;
                                    addNotification(`reported-problem`, `danger`, datum.createdAt, datum.message);
                                }
                                break;
                            case client.host:
                            case 'all':
                                var notification = notifier.notify('New Message', {
                                    message: `You have a new message from ${datum.from_friendly} (see DJ Controls).`,
                                    icon: 'https://images.vexels.com/media/users/3/136398/isolated/preview/b682d2f42a8d5d26e484abff38f92e78-flat-message-icon-by-vexels.png',
                                    duration: 30000,
                                });
                                main.flashTaskbar();
                                iziToast.show({
                                    title: `Message from ${datum.from_friendly}`,
                                    message: `${datum.message}`,
                                    timeout: 30000,
                                    close: true,
                                    color: 'blue',
                                    drag: false,
                                    position: 'bottomCenter',
                                    closeOnClick: false,
                                    overlay: false,
                                    layout: 2,
                                    image: `assets/images/messageAll.png`,
                                    maxWidth: 480,
                                    buttons: [
                                        ['<button>View / Reply</button>', function (instance, toast, button, e, inputs) {
                                                $("#messages-modal").iziModal('open');
                                                selectRecipient(Recipients({host: datum.from}).first().ID || null);
                                                instance.hide({}, toast, 'button');
                                            }]
                                    ]
                                });
                                data[index].needsread = true;
                                break;
                            case 'DJ':
                            case 'DJ-private':
                                if (typeof Meta.state !== 'undefined' && ((Meta.state.includes("automation_") && client.webmessages) || (!Meta.state.includes("automation_") && isHost)))
                                {
                                    var notification = notifier.notify('New Web Message', {
                                        message: `You have a new web message from ${datum.from_friendly} (see DJ Controls).`,
                                        icon: 'https://images.vexels.com/media/users/3/136398/isolated/preview/b682d2f42a8d5d26e484abff38f92e78-flat-message-icon-by-vexels.png',
                                        duration: 30000,
                                    });
                                    main.flashTaskbar();
                                    iziToast.show({
                                        title: `Web message from ${datum.from_friendly}`,
                                        message: `${datum.message}`,
                                        timeout: 30000,
                                        close: true,
                                        color: 'blue',
                                        drag: false,
                                        position: 'bottomCenter',
                                        closeOnClick: false,
                                        overlay: false,
                                        layout: 2,
                                        image: `assets/images/messageWeb.png`,
                                        maxWidth: 480,
                                        buttons: [
                                            ['<button>View / Reply</button>', function (instance, toast, button, e, inputs) {
                                                    $("#messages-modal").iziModal('open');
                                                    var host = (datum.to === 'DJ' ? 'website' : datum.from);
                                                    selectRecipient(Recipients({host: host}).first().ID || null);
                                                    instance.hide({}, toast, 'button');
                                                }]
                                        ]
                                    });
                                    data[index].needsread = true;
                                }
                                break;
                            default:
                                break;
                        }
                    }
                });
            }

            selectRecipient(activeRecipient);
        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            data[key].needsread = false;
                            data[key].from_real = data[key].from;
                            if (data[key].to === `DJ`)
                                data[key].from_real = `website`;
                            switch (data[key].to)
                            {
                                case 'emergency':
                                    if (client.emergencies)
                                    {
                                        data[key].needsread = true;
                                        addNotification(`reported-problem`, `danger`, datum.createdAt, datum.announcement);
                                    }
                                    break;
                                case client.host:
                                case 'all':
                                    var notification = notifier.notify('New Message', {
                                        message: `You have a new message from ${data[key].from_friendly} (see DJ Controls).`,
                                        icon: 'https://images.vexels.com/media/users/3/136398/isolated/preview/b682d2f42a8d5d26e484abff38f92e78-flat-message-icon-by-vexels.png',
                                        duration: 30000,
                                    });
                                    main.flashTaskbar();
                                    iziToast.show({
                                        title: `Message from ${data[key].from_friendly}`,
                                        message: `${data[key].message}`,
                                        timeout: 30000,
                                        close: true,
                                        color: 'blue',
                                        drag: false,
                                        position: 'bottomCenter',
                                        closeOnClick: false,
                                        overlay: false,
                                        layout: 2,
                                        image: `assets/images/messageAll.png`,
                                        maxWidth: 480,
                                        buttons: [
                                            ['<button>View / Reply</button>', function (instance, toast, button, e, inputs) {
                                                    $("#messages-modal").iziModal('open');
                                                    selectRecipient(Recipients({host: data[key].from}).first().ID || null);
                                                    instance.hide({}, toast, 'button');
                                                }]
                                        ]
                                    });
                                    data[key].needsread = true;
                                    break;
                                case 'DJ':
                                case 'DJ-private':
                                    if (typeof Meta.state !== 'undefined' && ((Meta.state.includes("automation_") && client.webmessages) || (!Meta.state.includes("automation_") && isHost)))
                                    {
                                        var notification = notifier.notify('New Web Message', {
                                            message: `You have a new web message from ${data[key].from_friendly} (see DJ Controls).`,
                                            icon: 'https://images.vexels.com/media/users/3/136398/isolated/preview/b682d2f42a8d5d26e484abff38f92e78-flat-message-icon-by-vexels.png',
                                            duration: 30000,
                                        });
                                        main.flashTaskbar();
                                        iziToast.show({
                                            title: `Web message from ${data[key].from_friendly}`,
                                            message: `${data[key].message}`,
                                            timeout: 30000,
                                            close: true,
                                            color: 'blue',
                                            drag: false,
                                            position: 'bottomCenter',
                                            closeOnClick: false,
                                            overlay: false,
                                            layout: 2,
                                            image: `assets/images/messageWeb.png`,
                                            maxWidth: 480,
                                            buttons: [
                                                ['<button>View / Reply</button>', function (instance, toast, button, e, inputs) {
                                                        $("#messages-modal").iziModal('open');
                                                        var host = (data[key].to === 'DJ' ? 'website' : data[key].from);
                                                        selectRecipient(Recipients({host: host}).first().ID || null);
                                                        instance.hide({}, toast, 'button');
                                                    }]
                                            ]
                                        });
                                        data[key].needsread = true;
                                    }
                                    break;
                                default:
                                    break;
                            }
                            Messages.insert(data[key]);
                            selectRecipient(activeRecipient);
                            break;
                        case 'update':
                            data[key].from_real = data[key].from;
                            if (data[key].to === `DJ`)
                                data[key].from_real = `website`;
                            Messages({ID: data[key].ID}).update(data[key]);
                            selectRecipient(activeRecipient);
                            break;
                        case 'remove':
                            Messages({ID: data[key]}).remove();
                            selectRecipient(activeRecipient);
                            break;
                    }
                }
            }
        }
        //sendToRenderer();
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: 'Error occurred during the processMessages function.'
        });
}
}

// WORK ON THIS
// Update messages as changes happen
function processRequests(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {

            var prev = [];

            prev = Requests().select("ID");

            // Notify on new requests
            data.map((datum, index) => {
                data[index].needsread = false;
                if (prev.indexOf(datum.ID === -1))
                {
                    if (typeof Meta.state !== 'undefined' && ((Meta.state.includes("automation_") && client.requests) || (!Meta.state.includes("automation_") && isHost)))
                    {
                        data[index].needsread = true;
                        var notification = notifier.notify('Track Requested', {
                            message: `A track was requested (see DJ Controls). Playing requests are optional.`,
                            icon: 'https://static.thenounproject.com/png/7236-200.png',
                            duration: 30000,
                        });
                        main.flashTaskbar();
                        iziToast.show({
                            title: `Track Requested`,
                            message: `${data[key].trackname}`,
                            timeout: 30000,
                            close: true,
                            color: 'blue',
                            drag: false,
                            position: 'bottomCenter',
                            closeOnClick: false,
                            overlay: false,
                            layout: 2,
                            image: `assets/images/trackRequest.png`,
                            maxWidth: 480,
                            buttons: [
                                ['<button>View Requests</button>', function (instance, toast, button, e, inputs) {
                                        $("#requests-modal").iziModal('open');
                                        instance.hide({}, toast, 'button');
                                    }]
                            ]
                        });
                    }
                }
            });

            // Replace the data
            Requests = new TAFFY();
            Requests.insert(data);

        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            data[key].needsread = false;
                            if (typeof Meta.state !== 'undefined' && ((Meta.state.includes("automation_") && client.requests) || (!Meta.state.includes("automation_") && isHost)))
                            {
                                data[key].needsread = true;
                                var notification = notifier.notify('Track Requested', {
                                    message: `A track was requested (see DJ Controls). Playing requests are optional.`,
                                    icon: 'https://static.thenounproject.com/png/7236-200.png',
                                    duration: 30000,
                                });
                                main.flashTaskbar();
                                iziToast.show({
                                    title: `Track Requested`,
                                    message: `${data[key].trackname}`,
                                    timeout: 30000,
                                    close: true,
                                    color: 'blue',
                                    drag: false,
                                    position: 'bottomCenter',
                                    closeOnClick: false,
                                    overlay: false,
                                    layout: 2,
                                    image: `assets/images/trackRequest.png`,
                                    maxWidth: 480,
                                    buttons: [
                                        ['<button>View Requests</button>', function (instance, toast, button, e, inputs) {
                                                $("#requests-modal").iziModal('open');
                                                instance.hide({}, toast, 'button');
                                            }]
                                    ]
                                });
                            }
                            Requests.insert(data[key]);
                            break;
                        case 'update':
                            Requests({ID: data[key].ID}).update(data[key]);
                            break;
                        case 'remove':
                            Requests({ID: data[key]}).remove();
                            break;
                    }
                }
            }
        }

        var prev = [];

        // Update track requests
        Requests({played: 0}).each(function (datum) {
            try {
                prev.push(`request-${datum.ID}`);
                if (document.querySelector(`#request-${datum.ID}`) === null)
                {
                    var request = document.querySelector("#track-requests");
                    request.innerHTML += `<div class="row request m-2 bg-light-1 border-left border-info shadow-4" id="request-${datum.ID}" style="border-left-width: 5px !important;">
    <div class="col-8" id="request-i-${datum.ID}">
      <h6 id="request-t-${datum.ID}">${datum.trackname}</h6>
      <span id="request-u-${datum.ID}">Requested By: ${datum.username !== null && datum.username !== '' ? datum.username : `Anonymous`}</span><br />
      <small id="request-m-${datum.ID}">${datum.message}</small>
    </div>
    <div class="col-4" style="text-align: center;">
    <button type="button" class="btn btn-primary" id="request-b-${datum.ID}">Play Now</button>
    </div>
  </div>`;
                } else {
                    var temp = document.querySelector(`#request-t-${datum.ID}`);
                    temp.innerHTML = `${datum.trackname}`;
                    var temp = document.querySelector(`#request-u-${datum.ID}`);
                    temp.innerHTML = `Requested By: ${datum.username !== null && datum.username !== '' ? datum.username : `Anonymous`}`;
                    var temp = document.querySelector(`#request-m-${datum.ID}`);
                    temp.innerHTML = `${datum.message}`;
                }
            } catch (e) {
                iziToast.show({
                    title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                    message: 'Error occurred in the processRequests each. ' + e.message
                });
                console.error(e);
            }
        });

        // Remove requests no longer valid
        var attn = document.querySelectorAll(".request");
        for (var i = 0; i < attn.length; i++) {
            if (prev.indexOf(attn[i].id) === -1)
                attn[i].parentNode.removeChild(attn[i]);
        }

        var temp = document.querySelector(`#badge-track-requests`);
        temp.className = `notification badge badge-${prev.length > 0 ? 'primary' : 'secondary'} shadow-4`;
        temp.innerHTML = prev.length;


    } catch (e) {
        console.error(e);
}
}

function loadDJ(dj = null, reset = true) {
    try {
        var afterFunction = function () {
            var DJName = Djs({ID: parseInt(DJData.DJ)}).first().name;
            document.querySelector('#options-dj-name').innerHTML = `${jdenticon.toSvg(`DJ ${DJName}`, 48)}   ${DJName}`;
            document.querySelector('#options-dj-buttons').innerHTML = `
            <button type="button" class="btn btn-urgent btn-lg" id="btn-options-dj-edit" data-dj="${DJData.DJ}" title="Edit this DJ">Edit</button>
            <button type="button" class="btn btn-danger btn-lg" id="btn-options-dj-remove" data-dj="${DJData.DJ}" title="Remove this DJ">Remove</button>
            <button type="button" class="btn btn-purple btn-lg" id="btn-options-dj-xp" data-dj="${DJData.DJ}" title="View/Edit/Add/Remove the notes / remote credits / XP of this DJ">Notes/Remotes/XP</button>`;
            var remote = 0;
            var totalXP = 0;
            if (DJData.XP.length > 0)
            {
                document.querySelector(`#dj-xp-add-div`).innerHTML = `<button type="button" class="btn btn-success btn-lg" id="dj-xp-add" data-dj="${dj}" title="Add a Note / Remote Credit / XP">Add</button>`;
                var xpLogs = document.querySelector(`#dj-xp-logs`);
                xpLogs.scrollTop = 0;

                var compare = function (a, b) {
                    try {
                        if (a.type === "note" && b.type !== "note")
                            return -1;
                        if (b.type === "note" && a.type !== "note")
                            return 1;
                        if (a.type === "remote" && b.type !== "remote")
                            return -1;
                        if (b.type === "remote" && a.type !== "remote")
                            return 1;
                        if (moment(a.createdAt).valueOf() < moment(b.createdAt).valueOf())
                            return 1;
                        if (moment(a.createdAt).valueOf() > moment(b.createdAt).valueOf())
                            return -1;
                        if (a.ID > b.ID)
                            return -1;
                        if (b.ID > a.ID)
                            return 1;
                        return 0;
                    } catch (e) {
                        console.error(e);
                        iziToast.show({
                            title: 'An error occurred - Please check the logs',
                            message: `Error occurred in the compare function of loadDJ.`
                        });
                    }
                };

                var newXPLogs = ``;
                DJData.XP.sort(compare);
                DJData.XP.map(record => {
                    var theClass = `secondary`;
                    var theTitle = `This is a note.`;

                    if (record.type === "xp")
                    {
                        totalXP += record.amount;
                        theClass = `info`;
                        theTitle = `This is an XP entry.`;
                    }

                    if (record.type === "remote")
                    {
                        theClass = `warning`;
                        theTitle = `This is a remote credit entry.`;
                        if (moment(record.createdAt).isSameOrAfter(moment(DJData.startOfSemester)))
                            remote += record.amount;
                    }

                    newXPLogs += `<div class="row m-1 bg-light-1 border-left border-${theClass} shadow-2" style="border-left-width: 5px !important;" title="${theTitle}">
                    <div class="col-3 text-primary">
                        ${moment(record.createdAt).format("YYYY-MM-DD h:mm A")}
                    </div>
                    <div class="col-2 text-success">
                        ${record.amount}
                    </div>
                    <div class="col-5 text-secondary">
                        ${record.type}-${record.subtype}${record.description !== null && record.description !== '' ? `: ${record.description}` : ``}
                    </div>
                    <div class="col-2 text-dark">
                        <button type="button" id="dj-xp-edit-${record.ID}" class="close dj-xp-edit" aria-label="Edit XP/Remote" title="Edit this record">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                        <button type="button" id="dj-xp-remove-${record.ID}" class="close dj-xp-remove" aria-label="Remove XP/Remote" title="Remove this record">
                <span aria-hidden="true"><i class="fas fa-trash text-dark"></i></span>
                </button>
                    </div>
                </div>
`;
                });

                xpLogs.innerHTML = newXPLogs;
            }
            document.querySelector('#dj-remotes').innerHTML = formatInt(remote || 0);
            document.querySelector('#dj-xp').innerHTML = formatInt(totalXP || 0);

            var att = document.querySelector('#dj-attendance');
            att.scrollTop = 0;
            var showTime = 0;
            var listenerMinutes = 0;

            var newAtt = ``;
            if (DJData.attendance.length > 0)
            {
                var compare = function (a, b) {
                    try {
                        var theDateA = a.actualStart !== null ? a.actualStart : a.scheduledStart;
                        var theDateB = b.actualStart !== null ? b.actualStart : b.scheduledStart;
                        if (moment(theDateA).valueOf() < moment(theDateB).valueOf())
                            return 1;
                        if (moment(theDateA).valueOf() > moment(theDateB).valueOf())
                            return -1;
                        if (a.ID > b.ID)
                            return -1;
                        if (b.ID > a.ID)
                            return 1;
                        return 0;
                    } catch (e) {
                        console.error(e);
                        iziToast.show({
                            title: 'An error occurred - Please check the logs',
                            message: `Error occurred in the compare function of loadDJ.`
                        });
                    }
                };
                DJData.attendance.sort(compare);
                DJData.attendance.map(record => {

                    if (record.showTime !== null)
                        showTime += record.showTime;
                    if (record.listenerMinutes !== null)
                        listenerMinutes += record.listenerMinutes;

                    var theDate = record.actualStart !== null ? record.actualStart : record.scheduledStart;
                    if (record.scheduledStart === null)
                    {
                        newAtt += `<div class="row m-1 bg-light-1 border-left border-urgent shadow-2" style="border-left-width: 5px !important;" title="The DJ went on the air when they were not scheduled to be on.">
                            <div class="col-2 text-danger">
                                ${moment(theDate).format("MM/DD/YYYY")}
                            </div>
                            <div class="col-5 text-info">
                                ${record.event}
                            </div>
                            <div class="col-4">
                                <span class="text-secondary">UN-SCHEDULED</span><br />
                                <span class="text-primary">${moment(record.actualStart).format("h:mm A")} - ${record.actualEnd !== null ? moment(record.actualEnd).format("h:mm A") : `ONGOING`}</span>
                            </div>
                            <div class="col-1">
                                <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the logs for this show">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                            </div>
                        </div>`;
                    } else if (moment(record.scheduledStart).isAfter(moment(Meta.time)))
                    {
                        newAtt += `<div class="row m-1 bg-light-1 border-left border-secondary shadow-2" style="border-left-width: 5px !important;" title="This scheduled show has not aired yet.">
                            <div class="col-2 text-danger">
                                ${moment(theDate).format("MM/DD/YYYY")}
                            </div>
                            <div class="col-5 text-info">
                                ${record.event}
                            </div>
                            <div class="col-4">
                                <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                                <span class="text-primary">FUTURE EVENT</span>
                            </div>
                            <div class="col-1">
                                <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the logs for this show">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                            </div>
                        </div>`;
                    } else if (record.actualStart !== null && record.actualEnd !== null)
                    {
                        if (Math.abs(moment(record.scheduledStart).diff(moment(record.actualStart), 'minutes')) >= 10 || Math.abs(moment(record.scheduledEnd).diff(moment(record.actualEnd), 'minutes')) >= 10)
                        {
                            newAtt += `<div class="row m-1 bg-light-1 border-left border-warning shadow-2" style="border-left-width: 5px !important;" title="The DJ signed on or off 10 or more minutes before or after scheduled time.">
                            <div class="col-2 text-danger">
                                ${moment(theDate).format("MM/DD/YYYY")}
                            </div>
                            <div class="col-5 text-info">
                                ${record.event}
                            </div>
                            <div class="col-4">
                                <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                                <span class="text-primary">${moment(record.actualStart).format("h:mm A")} - ${record.actualEnd !== null ? moment(record.actualEnd).format("h:mm A") : `ONGOING`}</span>
                            </div>
                            <div class="col-1">
                                <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the logs for this show">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                            </div>
                        </div>`;
                        } else {
                            newAtt += `<div class="row m-1 bg-light-1 border-left border-success shadow-2" style="border-left-width: 5px !important;" title="This show was scheduled and on time.">
                            <div class="col-2 text-danger">
                                ${moment(theDate).format("MM/DD/YYYY")}
                            </div>
                            <div class="col-5 text-info">
                                ${record.event}
                            </div>
                            <div class="col-4">
                                <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                                <span class="text-primary">${moment(record.actualStart).format("h:mm A")} - ${record.actualEnd !== null ? moment(record.actualEnd).format("h:mm A") : `ONGOING`}</span>
                            </div>
                            <div class="col-1">
                                <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the logs for this show">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                            </div>
                        </div>`;
                        }
                    } else if (record.actualStart !== null && record.actualEnd === null)
                    {
                        newAtt += `<div class="row m-1 bg-light-1 border-left border-info shadow-2" style="border-left-width: 5px !important;" title="This show is still ongoing.">
                            <div class="col-2 text-danger">
                                ${moment(theDate).format("MM/DD/YYYY")}
                            </div>
                            <div class="col-5 text-info">
                                ${record.event}
                            </div>
                            <div class="col-4">
                                <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                                <span class="text-primary">${moment(record.actualStart).format("h:mm A")} - ${record.actualEnd !== null ? moment(record.actualEnd).format("h:mm A") : `ONGOING`}</span>
                            </div>
                            <div class="col-1">
                                <button type="button" id="dj-show-logs-${record.ID}" class="close dj-show-logs" aria-label="Show Log" title="View the logs for this show">
                <span aria-hidden="true"><i class="fas fa-file text-dark"></i></span>
                </button>
                            </div>
                        </div>`;
                    } else if (record.actualStart === null && record.actualEnd === null) {
                        newAtt += `<div class="row m-1 bg-light-1 border-left border-danger shadow-2" style="border-left-width: 5px !important;" title="This show was scheduled, but the DJ did not go on the air.">
                            <div class="col-2 text-danger">
                                ${moment(theDate).format("MM/DD/YYYY")}
                            </div>
                            <div class="col-5 text-info">
                                ${record.event}
                            </div>
                            <div class="col-4">
                                <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                                <span class="text-primary">ABSENT / DID NOT AIR</span>
                            </div>
                            <div class="col-1">
                            </div>
                        </div>`;
                    } else {
                        newAtt += `<div class="row m-1 bg-light-1 border-left border-info shadow-2" style="border-left-width: 5px !important;" title="This show is scheduled, but has not begun yet.">
                            <div class="col-2 text-danger">
                                ${moment(theDate).format("MM/DD/YYYY")}
                            </div>
                            <div class="col-5 text-info">
                                ${record.event}
                            </div>
                            <div class="col-4">
                                <span class="text-secondary">${moment(record.scheduledStart).format("h:mm A")} - ${moment(record.scheduledEnd).format("h:mm A")}</span><br />
                                <span class="text-primary">NOT YET STARTED</span>
                            </div>
                            <div class="col-1">
                            </div>
                        </div>`;
                    }
                });

                att.innerHTML = newAtt;

                document.querySelector('#dj-showtime').innerHTML = formatInt(Math.floor(showTime / 60));
                document.querySelector('#dj-listenertime').innerHTML = formatInt(Math.floor(listenerMinutes / 60));
            }
        };

        if (reset)
        {
            DJData.XP = [];
            DJData.attendance = [];
            DJData.DJ = dj === null ? DJData.DJ || '' : dj;
            hostReq.request({method: 'POST', url: nodeURL + '/xp/get', data: {dj: DJData.DJ}}, function (response) {
                DJData.XP = response.data;
                DJData.startOfSemester = response.startOfSemester;
                // Populate attendance records
                hostReq.request({method: 'POST', url: nodeURL + '/attendance/get', data: {dj: DJData.DJ}}, function (response2) {
                    DJData.attendance = response2;
                    afterFunction();
                });
            });
        } else {
            afterFunction();
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred in loadDJ.`
        });
}
}
;

// Update recipients as changes happen
function processDjs(data = {}, replace = false)
        {
            // Data processing
            try {
                if (replace)
                {
                    Djs = TAFFY();
                    Djs.insert(data);
                } else {
                    for (var key in data)
                    {
                        if (data.hasOwnProperty(key))
                        {
                            switch (key)
                            {
                                case 'insert':
                                    Djs.insert(data[key]);
                                    break;
                                case 'update':
                                    Djs({ID: data[key].ID}).update(data[key]);
                                    break;
                                case 'remove':
                                    Djs({ID: data[key]}).remove();
                                    break;
                            }
                        }
                    }
                }

                document.querySelector("#options-xp-djs").innerHTML = ``;
                document.querySelector('#options-djs').innerHTML = ``;

                Djs().each(function (dj, index) {
                    var djClass = `danger`;
                    var djTitle = `${dj.name} has not done a show in over 30 days (${moment(dj.lastSeen).format("LL")}).`;
                    if (moment(Meta.time).diff(moment(dj.lastSeen), 'hours') <= (24 * 30))
                    {
                        djClass = `warning`;
                        djTitle = `${dj.name} has not done a show for between 7 and 30 days (${moment(dj.lastSeen).format("LL")}).`;
                    }
                    if (moment(Meta.time).diff(moment(dj.lastSeen), 'hours') <= (24 * 7))
                    {
                        djClass = `success`;
                        djTitle = `${dj.name} did a show in the last 7 days (${moment(dj.lastSeen).format("LL")}).`;
                    }

                    document.querySelector('#options-djs').innerHTML += `<div class="p-1 m-1" style="width: 96px; text-align: center; position: relative;" title="${djTitle}">
                        <button type="button" id="options-dj-${dj.ID}" class="btn btn-${djClass} btn-float" style="position: relative;" data-dj="${dj.ID}"><div style="position: absolute; top: 4px; left: 4px;">${jdenticon.toSvg(`DJ ${dj.name}`, 48)}</div></button>
                        <div style="text-align: center; font-size: 1em;">${dj.name}</div>
                    </div>`;
                    document.querySelector("#options-xp-djs").innerHTML += `<div class="custom-control custom-switch">
  <input class="custom-control-input" id="options-xp-djs-i-${dj.ID}" type="checkbox">
  <span class="custom-control-track"></span>
  <label class="custom-control-label" for="options-xp-djs-i-${dj.ID}">${dj.name}</label>
</div>`;
                });

            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                    message: 'Error occurred in the processDjs function.'
                });
        }
        }

// Update recipients as changes happen
function processDirectors(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {
            Directors = TAFFY();
            Directors.insert(data);

        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Directors.insert(data[key]);
                            break;
                        case 'update':
                            Directors({ID: data[key].ID}).update(data[key]);
                            break;
                        case 'remove':
                            Directors({ID: data[key]}).remove();
                            break;
                    }
                }
            }
        }

        document.querySelector('#options-directors').innerHTML = ``;

        Directors().each(function (director, index) {
            document.querySelector('#options-directors').innerHTML += `<div class="p-1 m-1" style="width: 96px; text-align: center; position: relative;" title="${director.name} is currently ${director.present ? "clocked IN" : "clocked OUT"} as of ${moment(director.since).format("LLL")}">
                        <button type="button" id="options-director-${director.ID}" class="btn ${director.present ? "btn-success" : "btn-danger"} btn-float" style="position: relative;" data-director="${director.ID}"><div style="position: absolute; top: 4px; left: 4px;">${jdenticon.toSvg(`Director ${director.name}`, 48)}</div></button>
                        <div style="text-align: center; font-size: 1em;">${director.name}</div>
                    </div>`;
        });

    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the processDirectors function.'
        });
}
}

// Update recipients as changes happen
function processHosts(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {
            Hosts = TAFFY();
            Hosts.insert(data);
        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Hosts.insert(data[key]);
                            if (data[key].host === main.getMachineID())
                            {
                                socket.disconnect();
                                socket.reconnect();
                            }
                            break;
                        case 'update':
                            Hosts({ID: data[key].ID}).update(data[key]);
                            // Changes to this host should cause a refresh of the socket
                            if (data[key].host === main.getMachineID())
                            {
                                socket.disconnect();
                                socket.reconnect();
                            }
                            break;
                        case 'remove':
                            Hosts({ID: data[key]}).remove();
                            // If this host no longer exists, disconnect the socket
                            if (!Hosts({host: main.getMachineID()}).first())
                                socket.disconnect();
                            break;
                    }
                }
            }
        }

        document.querySelector('#options-djcontrols').innerHTML = ``;

        Hosts().each(function (host, index) {
            document.querySelector('#options-djcontrols').innerHTML += `<div class="row m-1">
                    <div class="col-6">
                        ${host.friendlyname} <span class="m-2">${host.silenceDetection ? `<i class="fas fa-microphone-slash text-dark" title="${host.friendlyname} is responsible for reporting silence to WWSU."></i>` : ''}${host.recordAudio ? `<i class="fas fa-circle text-dark" title="${host.friendlyname} is responsible for recording and saving radio programming."></i>` : ''}</span>
                    </div>
                    <div class="col-1" title="${host.authorized ? `${host.friendlyname} is authorized to connect to WWSU.` : `${host.friendlyname} is NOT authorized to connect to WWSU.`}">
                        ${host.authorized ? '<i class="fas fa-check-circle text-dark"></i>' : ''}
                    </div>
                    <div class="col-1" title="${host.admin ? `${host.friendlyname} will display and allow access to the administration menu.` : `${host.friendlyname} will NOT display and allow access to the administration menu.`}">
                        ${host.admin ? '<i class="fas fa-cog text-dark"></i>' : ''}
                    </div>
                    <div class="col-1" title="${host.makeCalls ? `${host.friendlyname} can make audio calls / start remote broadcasts.` : `${host.friendlyname} can NOT make audio calls / start remote broadcasts.`}">
                        ${host.makeCalls ? '<i class="fas fa-phone-volume text-dark"></i>' : ''}
                    </div>
                    <div class="col-1" title="${host.answerCalls ? `${host.friendlyname} can answer / play incoming audio calls.` : `${host.friendlyname} can NOT answer / play incoming audio calls.`}">
                        ${host.answerCalls ? '<i class="fas fa-headphones text-dark"></i>' : ''}
                    </div>
                                <div class="col-2">
            ${client.host !== host.host ? `<button type="button" id="options-djcontrols-edit-${host.ID}" class="close" aria-label="Edit Host" title="Edit ${host.friendlyname} / settings">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                <button type="button" id="options-djcontrols-remove-${host.ID}" class="close" aria-label="Remove Host" title="Remove ${host.friendlyname}">
                <span aria-hidden="true"><i class="fas fa-trash text-dark"></i></span>
                </button>` : `<span title="To prevent accidental lock-out, you cannot edit / remove your own host. Please use another DJ Controls to edit your host.">(YOU)</span>`}
            </div>
                </div>`;
        });

    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the processDirectors function.'
        });
}
}


function processXp(data)
{
    for (var key in data)
    {
        if (data.hasOwnProperty(key))
        {
            switch (key)
            {
                case 'insert':
                    if (data[key].dj === parseInt(DJData.DJ))
                    {
                        DJData.XP.push(data[key]);
                        loadDJ(DJData.DJ, false);
                    }
                    break;
                case 'update':
                    if (data[key].dj === parseInt(DJData.DJ))
                    {
                        DJData.XP
                                .filter(record => record.ID === data[key].ID)
                                .map((record, index) => DJData.XP[index] = data[key]);
                        loadDJ(DJData.DJ, false);
                    }
                    break;
                case 'remove':
                    DJData.XP
                            .filter(record => record.ID === data[key])
                            .map((record, index) => {
                                delete DJData.XP[index];
                                loadDJ(DJData.DJ, false);
                            });
                    break;
            }
        }
    }
}

function processDiscipline(data, replace = false)
{
    // Data processing
    try {
        if (replace)
        {
            Discipline = TAFFY();
            Discipline.insert(data);
        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Discipline.insert(data[key]);
                            break;
                        case 'update':
                            Discipline({ID: data[key].ID}).update(data[key]);
                            break;
                        case 'remove':
                            Discipline({ID: data[key]}).remove();
                            break;
                    }
                }
            }
        }

        var temp = document.querySelector('#options-discipline');
        var temp2 = ``;

        if (temp !== null)
        {
            temp.innerHTML = ``;
            Discipline().each((discipline, index) => {
                temp2 += `<div class="row m-1 bg-light-1 border-left border-${discipline.active ? `success` : `secondary`} shadow-2" style="border-left-width: 5px !important;" title="This discipline is ${discipline.active ? `` : `NOT `}active.">
                <div class="container m-1">
                        <div class="row bg-light-1">
                            <div class="col-1 text-danger">
                                ${discipline.ID}
                            </div>
                            <div class="col-3 text-primary">
                                ${moment(discipline.createdAt).format("LLL")}
                            </div>
                            <div class="col-4">
                                ${discipline.IP}
                            </div>
                            <div class="col-2 text-info">
                                ${discipline.action}
                            </div>
                            <div class="col-2">
                                <button type="button" id="options-discipline-edit-${discipline.ID}" class="close" aria-label="Edit Discipline" title="Edit discipline ${discipline.ID}">
                <span aria-hidden="true"><i class="fas fa-edit text-dark"></i></span>
                </button>
                <button type="button" id="options-discipline-remove-${discipline.ID}" class="close" aria-label="Remove Discipline" title="Remove discipline ${discipline.ID}">
                <span aria-hidden="true"><i class="fas fa-trash text-dark"></i></span>
                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
            });

            temp.innerHTML = temp2;
        }


    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the processDiscipline function.'
        });
}
}

function processLogs(data, replace = false)
{
    // Data processing
    try {
        var prev = [];
        if (replace)
        {
            // Get all the EAS IDs currently in memory before replacing the data
            prev = Logs().select("ID");

            // Replace with the new data
            Logs = TAFFY();
            Logs.insert(data);

            // Go through the new data. If any IDs exists that did not exist before, consider it a new alert and make a notification.
            Logs().each(function (record)
            {
                if (prev.indexOf(record.ID) === -1 && client.emergencies)
                {
                    if (record.logtype === "absent")
                    {
                        addNotification(`absent-broadcast`, `warning`, record.createdAt, record.event);
                    }
                    if (record.logtype === "unauthorized")
                    {
                        addNotification(`unauthorized-broadcast`, `urgent`, record.createdAt, record.event);
                    }
                    if (record.logtype === "cancellation")
                    {
                        addNotification(`canceled-broadcast`, `info`, record.createdAt, record.event);
                    }
                    if (record.logtype === "id")
                    {
                        addNotification(`failed-legal-id`, `urgent`, record.createdAt, record.event);
                    }
                    if (record.logtype === "director-absent")
                    {
                        addNotification(`absent-director`, `urgent`, record.createdAt, record.event);
                    }
                    if (record.logtype === "director-cancellation")
                    {
                        addNotification(`director-canceled-hours`, `info`, record.createdAt, record.event);
                    }
                }
            });

        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Logs.insert(data[key]);
                            if (data[key].logtype === "absent")
                            {
                                addNotification(`absent-broadcast`, `warning`, data[key].createdAt, data[key].event);
                            }
                            if (data[key].logtype === "cancellation")
                            {
                                addNotification(`canceled-broadcast`, `info`, data[key].createdAt, data[key].event);
                            }
                            if (data[key].logtype === "unauthorized")
                            {
                                addNotification(`unauthorized-broadcast`, `urgent`, data[key].createdAt, data[key].event);
                            }
                            if (data[key].logtype === "id")
                            {
                                addNotification(`failed-legal-id`, `urgent`, data[key].createdAt, data[key].event);
                            }
                            if (data[key].logtype === "director-absent")
                            {
                                addNotification(`absent-director`, `urgent`, data[key].createdAt, data[key].event);
                            }
                            if (data[key].logtype === "director-cancellation")
                            {
                                addNotification(`director-canceled-hours`, `info`, data[key].createdAt, data[key].event);
                            }
                            break;
                        case 'update':
                            Logs({ID: data[key].ID}).update(data[key]);
                            break;
                        case 'remove':
                            Logs({ID: data[key]}).remove();
                            break;
                    }
                }
            }
        }

    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: 'Error occurred during the processLogs function.'
        });
}
}

function loadTimesheets(date)
{
    try {
        if (!moment(date).isValid())
            date = moment(Meta.time);
        var records = document.querySelector('#options-timesheets-records');
        records.innerHTML = `<h2 class="text-warning" style="text-align: center;">PLEASE WAIT...</h4>`;
        noReq.request({method: 'POST', url: nodeURL + '/timesheet/get', data: {date: date.toISOString(true)}}, function (response) {
            records.innerHTML = ``;
            Timesheets = response;
            var hours = {};
            var lighterRow = false;
            Timesheets.map((record, index) => {
                var newRow = document.getElementById(`options-timesheets-director-${record.name.replace(/\W/g, '')}`);

                // If there is not a row for this director yet, create one
                if (!newRow || newRow === null)
                {
                    records.innerHTML += `<div id="options-timesheets-director-${record.name.replace(/\W/g, '')}" class="card p-1 m-1 bg-light-1" style="width: 98%; position: relative;">
                    <div class="card-body">
                    <h5 class="card-title">${record.name}</h5>
                    <p class="card-text">
                    <div class="container">    
                        <div class="row shadow-2">
                            <div class="col text-dark">
                                > Day <br>
                                v Time
                            </div>
                            <div class="col text-dark border-left">
                                Sun
                            </div>
                            <div class="col text-dark border-left">
                                Mon
                            </div>
                            <div class="col text-dark border-left">
                                Tue
                            </div>
                            <div class="col text-dark border-left">
                                Wed
                            </div>
                            <div class="col text-dark border-left">
                                Thu
                            </div>
                            <div class="col text-dark border-left">
                                Fri
                            </div>
                            <div class="col text-dark border-left">
                                Sat
                            </div>
                        </div>
                        <div class="row border border-dark" style="height: 240px;">
                            <div class="col text-dark" style="position: relative;">
                                <div style="position: absolute; top: 8.5%;">3a</div>
                                <div style="position: absolute; top: 21%;">6a</div>
                                <div style="position: absolute; top: 33.5%;">9a</div>
                                <div style="position: absolute; top: 46%;">12p</div>
                                <div style="position: absolute; top: 58.5%;">3p</div>
                                <div style="position: absolute; top: 71%;">6p</div>
                                <div style="position: absolute; top: 83.5%;">9p</div>
                                <div class="border-top" style="position: absolute; top: 4.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 8.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 12.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 16.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 20.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 25%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 29.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 33.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 37.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 41.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 45.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 50%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 54.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 58.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 62.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 66.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 70.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 75%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 79.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 83.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 87.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 91.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 95.83%; width: 100%;"></div>
                            </div>
                            <div class="col text-dark border-left" id="options-timesheets-director-cell-0-${record.name.replace(/\W/g, '')}" style="position: relative;">
                                <div class="border-top" style="position: absolute; top: 4.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 8.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 12.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 16.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 20.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 25%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 29.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 33.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 37.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 41.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 45.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 50%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 54.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 58.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 62.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 66.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 70.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 75%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 79.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 83.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 87.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 91.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 95.83%; width: 100%;"></div>
                            </div>
                            <div class="col text-dark border-left" id="options-timesheets-director-cell-1-${record.name.replace(/\W/g, '')}" style="position: relative;">
                                <div class="border-top" style="position: absolute; top: 4.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 8.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 12.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 16.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 20.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 25%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 29.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 33.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 37.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 41.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 45.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 50%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 54.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 58.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 62.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 66.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 70.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 75%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 79.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 83.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 87.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 91.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 95.83%; width: 100%;"></div>
                            </div>
                            <div class="col text-dark border-left" id="options-timesheets-director-cell-2-${record.name.replace(/\W/g, '')}" style="position: relative;">
                                <div class="border-top" style="position: absolute; top: 4.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 8.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 12.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 16.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 20.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 25%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 29.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 33.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 37.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 41.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 45.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 50%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 54.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 58.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 62.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 66.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 70.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 75%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 79.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 83.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 87.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 91.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 95.83%; width: 100%;"></div>
                            </div>
                            <div class="col text-dark border-left" id="options-timesheets-director-cell-3-${record.name.replace(/\W/g, '')}" style="position: relative;">
                                <div class="border-top" style="position: absolute; top: 4.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 8.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 12.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 16.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 20.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 25%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 29.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 33.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 37.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 41.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 45.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 50%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 54.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 58.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 62.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 66.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 70.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 75%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 79.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 83.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 87.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 91.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 95.83%; width: 100%;"></div>
                            </div>
                            <div class="col text-dark border-left" id="options-timesheets-director-cell-4-${record.name.replace(/\W/g, '')}" style="position: relative;">
                                <div class="border-top" style="position: absolute; top: 4.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 8.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 12.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 16.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 20.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 25%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 29.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 33.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 37.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 41.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 45.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 50%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 54.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 58.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 62.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 66.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 70.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 75%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 79.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 83.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 87.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 91.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 95.83%; width: 100%;"></div>
                            </div>
                            <div class="col text-dark border-left" id="options-timesheets-director-cell-5-${record.name.replace(/\W/g, '')}" style="position: relative;">
                                <div class="border-top" style="position: absolute; top: 4.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 8.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 12.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 16.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 20.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 25%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 29.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 33.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 37.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 41.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 45.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 50%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 54.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 58.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 62.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 66.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 70.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 75%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 79.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 83.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 87.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 91.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 95.83%; width: 100%;"></div>
                            </div>
                            <div class="col text-dark border-left" id="options-timesheets-director-cell-6-${record.name.replace(/\W/g, '')}" style="position: relative;">
                                <div class="border-top" style="position: absolute; top: 4.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 8.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 12.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 16.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 20.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 25%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 29.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 33.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 37.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 41.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 45.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 50%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 54.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 58.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 62.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 66.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 70.83%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 75%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 79.16%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 83.33%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 87.5%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 91.66%; width: 100%;"></div>
                                <div class="border-top" style="position: absolute; top: 95.83%; width: 100%;"></div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-4 text-primary">
                            Weekly Hours
                            </div>
                            <div class="col-6 text-primary" id="options-timesheets-director-cell-h-${record.name.replace(/\W/g, '')}">
                            </div>
                        </div>
                    </div>
                    </p>
                    </div>
                    </div>
                    `;
                    hours[record.name] = moment.duration();
                }

                // Prepare clock moments
                var clockin = record.time_in !== null ? moment(record.time_in) : null;
                var clockout = record.time_out !== null ? moment(record.time_out) : null;
                var scheduledin = record.scheduled_in !== null ? moment(record.scheduled_in) : null;
                var scheduledout = record.scheduled_out !== null ? moment(record.scheduled_out) : null;
                var clocknow = moment(Meta.time);
                var clocknext = moment(date).add(1, 'weeks');
                var clockday = moment(clockin !== null ? clockin : scheduledin).format('e');

                /* Determine status.
                 * success = Approved and scheduled.
                 * purple = Approved, but not scheduled
                 * warning = Scheduled, but not approved
                 * urgent = Not scheduled and not approved
                 * info = Clocked in, but not clocked out
                 * danger = Absent / did not clock in for scheduled hours
                 * secondary = Canceled scheduled hours
                 */
                var status = `urgent`;
                var status2 = `This record is NOT approved, and did not fall within a scheduled office hours time block.`;
                var inT = ``;
                var outT = ``;
                var sInT = ``;
                var sOutT = ``;
                var timeline = ``;
                var divWidth = $(`#options-timesheets-director-${record.name.replace(/\W/g, '')}`).height();
                var dayValue = (1000 * 60 * 60 * 24);
                var width = 0;
                var left = 0;
                var sWidth = 0;
                var sLeft = 0;

                if (clockin !== null && clockout === null)
                {
                    status = `purple`;
                    status2 = `This record / director is still clocked in.`;
                    hours[record.name].add(clocknow.diff(clockin));
                    if (scheduledin !== null && scheduledout !== null)
                    {
                        if (moment(scheduledin).isBefore(moment(scheduledout).startOf('week')))
                        {
                            sInT = moment(scheduledin).format(`YYYY-MM-DD h:mm A`);
                            sLeft = 0;
                        } else {
                            sInT = moment(scheduledin).format(`h:mm A`);
                            sLeft = ((moment(scheduledin).valueOf() - moment(scheduledin).startOf('day').valueOf()) / dayValue) * 100;
                        }
                        if (moment(scheduledout).isAfter(moment(scheduledin).startOf('week').add(1, 'weeks')) || !moment(scheduledout).isSame(moment(scheduledin), 'day'))
                        {
                            sOutT = moment(scheduledout).format(`YYYY-MM-DD h:mm A`);
                            sWidth = 100 - sLeft;
                        } else {
                            sOutT = moment(scheduledout).format(`h:mm A`);
                            sWidth = (((moment(scheduledout).valueOf() - moment(scheduledin).valueOf()) / dayValue) * 100);
                        }
                        timeline += `<div title="Scheduled Hours: ${sInT} - ${sOutT}" class="bg-secondary" style="position: absolute; left: 5%; width: 15%; top: ${sLeft}%; height: ${sWidth}%;"></div>`;
                    }
                    if (moment(clockin).isBefore(moment().startOf('week')))
                    {
                        inT = moment(clockin).format(`YYYY-MM-DD h:mm A`);
                        left = 0;
                        width = (((moment(Meta.time).valueOf() - moment(clockin).valueOf()) / dayValue) * 100);
                        timeline += `<div title="Director still clocked in since ${inT}" id="timesheet-t-${record.ID}" class="bg-${status}" style="position: absolute; left: 20%; width: 75%; top: 0%; height: ${width}%;"></div>`;
                    } else {
                        inT = moment(clockin).format(`h:mm A`);
                        width = (((moment(Meta.time).valueOf() - moment(clockin).valueOf()) / dayValue) * 100);
                        left = ((moment(clockin).valueOf() - moment(clockin).startOf('day').valueOf()) / dayValue) * 100;
                        timeline += `<div title="Director still clocked in since ${inT}" id="timesheet-t-${record.ID}" class="bg-${status}" style="position: absolute; left: 20%; width: 75%; top: ${left}%; height: ${width}%;"></div>`;
                    }
                    outT = 'IN NOW';
                } else {
                    if (record.approved)
                    {
                        if (clockin !== null && clockout !== null && scheduledin !== null && scheduledout !== null)
                        {
                            status = `success`;
                            status2 = `This record is approved and fell within a scheduled office hours block.`;
                            hours[record.name].add(clockout.diff(clockin));
                            if (moment(clockin).isBefore(moment(clockout).startOf('week')))
                            {
                                inT = moment(clockin).format(`YYYY-MM-DD h:mm A`);
                                left = 0;
                            } else {
                                inT = moment(clockin).format(`h:mm A`);
                                left = ((moment(clockin).valueOf() - moment(clockin).startOf('day').valueOf()) / dayValue) * 100;
                            }
                            if (moment(clockout).isAfter(moment(clockin).startOf('week').add(1, 'weeks')) || !moment(clockout).isSame(moment(clockin), 'day'))
                            {
                                outT = moment(clockout).format(`YYYY-MM-DD h:mm A`);
                                width = 100 - left;
                            } else {
                                outT = moment(clockout).format(`h:mm A`);
                                width = (((moment(clockout).valueOf() - moment(clockin).valueOf()) / dayValue) * 100);
                            }
                            if (moment(scheduledin).isBefore(moment(scheduledout).startOf('week')))
                            {
                                sInT = moment(scheduledin).format(`YYYY-MM-DD h:mm A`);
                                sLeft = 0;
                            } else {
                                sInT = moment(scheduledin).format(`h:mm A`);
                                sLeft = ((moment(scheduledin).valueOf() - moment(scheduledin).startOf('day').valueOf()) / dayValue) * 100;
                            }
                            if (moment(scheduledout).isAfter(moment(scheduledin).startOf('week').add(1, 'weeks')) || !moment(scheduledout).isSame(moment(scheduledin), 'day'))
                            {
                                sOutT = moment(scheduledout).format(`YYYY-MM-DD h:mm A`);
                                sWidth = 100 - sLeft;
                            } else {
                                sOutT = moment(scheduledout).format(`h:mm A`);
                                sWidth = (((moment(scheduledout).valueOf() - moment(scheduledin).valueOf()) / dayValue) * 100);
                            }
                            timeline += `<div title="Scheduled Hours: ${sInT} - ${sOutT}" class="bg-secondary" style="position: absolute; left: 5%; width: 15%; top: ${sLeft}%; height: ${sWidth}%;"></div>`;
                            timeline += `<div id="timesheet-t-${record.ID}" title="Actual Hours (approved): ${inT} - ${outT}" class="bg-${status}" style="position: absolute; left: 20%; width: 75%; top: ${left}%; height: ${width}%;"></div>`;
                        } else if (clockin !== null && clockout !== null && (scheduledin === null || scheduledout === null)) {
                            status = `success`;
                            status2 = `This record is approved, but did not fall within a scheduled office hours block.`;
                            hours[record.name].add(clockout.diff(clockin));
                            if (moment(clockin).isBefore(moment(clockout).startOf('week')))
                            {
                                inT = moment(clockin).format(`YYYY-MM-DD h:mm A`);
                                left = 0;
                            } else {
                                inT = moment(clockin).format(`h:mm A`);
                                left = ((moment(clockin).valueOf() - moment(clockin).startOf('day').valueOf()) / dayValue) * 100;
                            }
                            if (moment(clockout).isAfter(moment(clockin).startOf('week').add(1, 'weeks')) || !moment(clockout).isSame(moment(clockin), 'day'))
                            {
                                outT = moment(clockout).format(`YYYY-MM-DD h:mm A`);
                                width = 100 - left;
                            } else {
                                outT = moment(clockout).format(`h:mm A`);
                                width = (((moment(clockout).valueOf() - moment(clockin).valueOf()) / dayValue) * 100);
                            }
                            timeline += `<div id="timesheet-t-${record.ID}" title="Actual Unscheduled Hours (approved): ${inT} - ${outT}" class="bg-${status}" style="position: absolute; left: 20%; width: 75%; top: ${left}%; height: ${width}%;"></div>`;
                        } else if (scheduledin !== null && scheduledout !== null && clockin === null && clockout === null) {
                            status = `secondary`;
                            status2 = `This is NOT an actual timesheet; the director canceled scheduled office hours.`;
                            if (moment(scheduledin).isBefore(moment(scheduledout).startOf('week')))
                            {
                                sInT = moment(scheduledin).format(`YYYY-MM-DD h:mm A`);
                                sLeft = 0;
                            } else {
                                sInT = moment(scheduledin).format(`h:mm A`);
                                sLeft = ((moment(scheduledin).valueOf() - moment(scheduledin).startOf('day').valueOf()) / dayValue) * 100;
                            }
                            if (moment(scheduledout).isAfter(moment(scheduledin).startOf('week').add(1, 'weeks')) || !moment(scheduledout).isSame(moment(scheduledin), 'day'))
                            {
                                sOutT = moment(scheduledout).format(`YYYY-MM-DD h:mm A`);
                                sWidth = 100 - sLeft;
                            } else {
                                sOutT = moment(scheduledout).format(`h:mm A`);
                                sWidth = (((moment(scheduledout).valueOf() - moment(scheduledin).valueOf()) / dayValue) * 100);
                            }
                            timeline += `<div title="Scheduled Hours (CANCELED): ${sInT} - ${sOutT}" class="" style="background-color: #787878; position: absolute; left: 5%; width: 15%; top: ${sLeft}%; height: ${sWidth}%;"></div>`;
                        }
                    } else {
                        if (clockin !== null && clockout !== null && scheduledin !== null && scheduledout !== null)
                        {
                            status = `warning`;
                            status2 = `This record is NOT approved, but fell within a scheduled office hours block.`;
                            if (moment(clockin).isBefore(moment(clockout).startOf('week')))
                            {
                                inT = moment(clockin).format(`YYYY-MM-DD h:mm A`);
                                left = 0;
                            } else {
                                inT = moment(clockin).format(`h:mm A`);
                                left = ((moment(clockin).valueOf() - moment(clockin).startOf('day').valueOf()) / dayValue) * 100;
                            }
                            if (moment(clockout).isAfter(moment(clockin).startOf('week').add(1, 'weeks')) || !moment(clockout).isSame(moment(clockin), 'day'))
                            {
                                outT = moment(clockout).format(`YYYY-MM-DD h:mm A`);
                                width = 100 - left;
                            } else {
                                outT = moment(clockout).format(`h:mm A`);
                                width = (((moment(clockout).valueOf() - moment(clockin).valueOf()) / dayValue) * 100);
                            }
                            if (moment(scheduledin).isBefore(moment(scheduledout).startOf('week')))
                            {
                                sInT = moment(scheduledin).format(`YYYY-MM-DD h:mm A`);
                                sLeft = 0;
                            } else {
                                sInT = moment(scheduledin).format(`h:mm A`);
                                sLeft = ((moment(scheduledin).valueOf() - moment(scheduledin).startOf('day').valueOf()) / dayValue) * 100;
                            }
                            if (moment(scheduledout).isAfter(moment(scheduledin).startOf('week').add(1, 'weeks')) || !moment(scheduledout).isSame(moment(scheduledin), 'day'))
                            {
                                sOutT = moment(scheduledout).format(`YYYY-MM-DD h:mm A`);
                                sWidth = 100 - sLeft;
                            } else {
                                sOutT = moment(scheduledout).format(`h:mm A`);
                                sWidth = (((moment(scheduledout).valueOf() - moment(scheduledin).valueOf()) / dayValue) * 100);
                            }
                            timeline += `<div title="Scheduled Hours: ${sInT} - ${sOutT}" class="bg-secondary" style="position: absolute; left: 5%; width: 15%; top: ${sLeft}%; height: ${sWidth}%;"></div>`;
                            timeline += `<div id="timesheet-t-${record.ID}" title="Actual Hours (NEEDS REVIEW): ${inT} - ${outT}" class="bg-${status}" style="position: absolute; left: 20%; width: 75%; top: ${left}%; height: ${width}%;"></div>`;
                        } else if (clockin !== null && clockout !== null && (scheduledin === null || scheduledout === null)) {
                            status = `warning`;
                            status2 = `This record is NOT approved and did not fall within a scheduled office hours block.`;
                            if (moment(clockin).isBefore(moment(clockout).startOf('week')))
                            {
                                inT = moment(clockin).format(`YYYY-MM-DD h:mm A`);
                                left = 0;
                            } else {
                                inT = moment(clockin).format(`h:mm A`);
                                left = ((moment(clockin).valueOf() - moment(clockin).startOf('day').valueOf()) / dayValue) * 100;
                            }
                            if (moment(clockout).isAfter(moment(clockin).startOf('week').add(1, 'weeks')) || !moment(clockout).isSame(moment(clockin), 'day'))
                            {
                                outT = moment(clockout).format(`YYYY-MM-DD h:mm A`);
                                width = 100 - left;
                            } else {
                                outT = moment(clockout).format(`h:mm A`);
                                width = (((moment(clockout).valueOf() - moment(clockin).valueOf()) / dayValue) * 100);
                            }
                            timeline += `<div id="timesheet-t-${record.ID}" title="Actual Unscheduled Hours (NEEDS REVIEW): ${inT} - ${outT}" class="bg-${status}" style="position: absolute; left: 20%; width: 75%; top: ${left}%; height: ${width}%;"></div>`;
                        } else if (scheduledin !== null && scheduledout !== null && clockin === null && clockout === null) {
                            status = `danger`;
                            status2 = `This is NOT an actual timesheet; the director failed to clock in during scheduled office hours.`;
                            if (moment(scheduledin).isBefore(moment(scheduledout).startOf('week')))
                            {
                                sInT = moment(scheduledin).format(`YYYY-MM-DD h:mm A`);
                                sLeft = 0;
                            } else {
                                sInT = moment(scheduledin).format(`h:mm A`);
                                sLeft = ((moment(scheduledin).valueOf() - moment(scheduledin).startOf('day').valueOf()) / dayValue) * 100;
                            }
                            if (moment(scheduledout).isAfter(moment(scheduledin).startOf('week').add(1, 'weeks')) || !moment(scheduledout).isSame(moment(scheduledin), 'day'))
                            {
                                sOutT = moment(scheduledout).format(`YYYY-MM-DD h:mm A`);
                                sWidth = 100 - sLeft;
                            } else {
                                sOutT = moment(scheduledout).format(`h:mm A`);
                                sWidth = (((moment(scheduledout).valueOf() - moment(scheduledin).valueOf()) / dayValue) * 100);
                            }
                            timeline += `<div title="Scheduled Hours (NO SHOW): ${sInT} - ${sOutT}" class="bg-danger" style="position: absolute; left: 5%; width: 15%; top: ${sLeft}%; height: ${sWidth}%;"></div>`;
                        }
                    }
                }

                // Fill in the timesheet record
                var cell = document.getElementById(`options-timesheets-director-cell-${clockday}-${record.name.replace(/\W/g, '')}`);
                if (cell !== null)
                    cell.innerHTML += timeline;

                // Iterate through each director and list their hours worked.
                for (var key in hours)
                {
                    if (hours.hasOwnProperty(key))
                    {
                        var cell = document.getElementById(`options-timesheets-director-cell-h-${key.replace(/\W/g, '')}`);
                        if (cell)
                        {
                            cell.innerHTML = `${hours[key].format('h', 1)}`;
                        }
                    }
                }

            });
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: 'Error occurred during loadTimesheets.'
        });
    }
}

function hexRgb(hex, options = {}) {
    try {
        if (typeof hex !== 'string' || nonHexChars.test(hex) || !validHexSize.test(hex)) {
            throw new TypeError('Expected a valid hex string');
        }

        hex = hex.replace(/^#/, '');
        let alpha = 255;

        if (hex.length === 8) {
            alpha = parseInt(hex.slice(6, 8), 16) / 255;
            hex = hex.substring(0, 6);
        }

        if (hex.length === 4) {
            alpha = parseInt(hex.slice(3, 4).repeat(2), 16) / 255;
            hex = hex.substring(0, 3);
        }

        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }

        const num = parseInt(hex, 16);
        const red = num >> 16;
        const green = (num >> 8) & 255;
        const blue = num & 255;

        return options.format === 'array' ?
                [red, green, blue, alpha] :
                {red, green, blue, alpha};
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: 'Error occurred during hexRgb.'
        });
}
}

function calculateSectors(data) {
    var sectors = [];
    var smallSectors = [];

    var l = data.size / 2
    var l2 = data.smallSize / 2
    var a = 0 // Angle
    var aRad = 0 // Angle in Rad
    var z = 0 // Size z
    var x = 0 // Side x
    var y = 0 // Side y
    var X = 0 // SVG X coordinate
    var Y = 0 // SVG Y coordinate
    var R = 0 // Rotation

    data.sectors.map(function (item2) {
        var doIt = function (item) {
            a = item.size;
            if ((item.start + item.size) > 360)
                a = 360 - item.start;
            aCalc = (a > 180) ? 180 : a;
            aRad = aCalc * Math.PI / 180;
            z = Math.sqrt(2 * l * l - (2 * l * l * Math.cos(aRad)));
            if (aCalc <= 90) {
                x = l * Math.sin(aRad);
            } else {
                x = l * Math.sin((180 - aCalc) * Math.PI / 180);
            }

            y = Math.sqrt(z * z - x * x);
            Y = y;

            if (a <= 180) {
                X = l + x;
                arcSweep = 0;
            } else {
                X = l - x;
                arcSweep = 1;
            }

            sectors.push({
                label: item.label,
                color: item.color,
                arcSweep: arcSweep,
                L: l,
                X: X,
                Y: Y,
                R: item.start
            });

            if (a > 180)
            {
                var temp = {
                    label: item.label,
                    size: 180 - (360 - a),
                    start: 180 + item.start,
                    color: item.color
                };
                doIt(temp);
            }
        };

        doIt(item2);


    })

    data.smallSectors.map(function (item2) {
        var doIt2 = function (item) {
            a = item.size;
            if ((item.start + item.size) > 360)
                a = 360 - item.start;
            aCalc = (a > 180) ? 180 : a;
            aRad = aCalc * Math.PI / 180;
            z = Math.sqrt(2 * l2 * l2 - (2 * l2 * l2 * Math.cos(aRad)));
            if (aCalc <= 90) {
                x = l2 * Math.sin(aRad);
            } else {
                x = l2 * Math.sin((180 - aCalc) * Math.PI / 180);
            }

            y = Math.sqrt(z * z - x * x);
            Y = y;

            if (a <= 180) {
                X = l2 + x;
                arcSweep = 0;
            } else {
                X = l2 - x;
                arcSweep = 1;
            }

            smallSectors.push({
                label: item.label,
                color: item.color,
                arcSweep: arcSweep,
                L: l2,
                X: X,
                Y: Y,
                R: item.start
            });

            if (a > 180)
            {
                var temp = {
                    label: item.label,
                    size: 180 - (360 - a),
                    start: 180 + item.start,
                    color: item.color
                };
                doIt2(temp);
            }
        };

        doIt2(item2);


    })


    return {normal: sectors, small: smallSectors};
}

function formatInt(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getInitials(name) {
    var _nameSplit = name.split(' ');
    var _initials;

    //Get initials from name
    if (_nameSplit.length > 1) {
        _initials = _nameSplit[0].charAt(0).toUpperCase() + _nameSplit[1].charAt(0).toUpperCase();
    } else {
        _initials = _nameSplit[0].charAt(0).toUpperCase();
    }

    return _initials;
}

function truncateText(str, strLength = 256, ending = `...`) {
    if (str.length > strLength) {
        return str.substring(0, strLength - ending.length) + ending;
    } else {
        return str;
}
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
    if (!client.recordAudio)
        return undefined;
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

function newRecording(filename, forced = false)
{
    var _newRecording = () => {
        try {
            if (recorder.isRecording())
            {
                recorder.finishRecording();
                console.log(`Finished recording`);
            }
            recorderTitle = filename;
            if (recorderTitle)
            {
                recorder.startRecording();
                console.log(`Started recording`);
            }
        } catch (eee) {
            // ignore errors
        }
    };

    recorderTitle2 = recorderTitle;
    if (forced)
    {
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

function stopRecording(forced = false)
{
    var _stopRecording = () => {
        try {
            if (recorder.isRecording())
            {
                recorder.finishRecording();
                console.log(`Finished recording`);
            }
        } catch (eee) {
            // ignore errors
        }
    };
    if (forced)
    {
        _stopRecording();
    } else {
        console.log(`Finishing recording after delay`);
        recorderTitle2 = recorderTitle;
        setTimeout(function () {
            _stopRecording();
        }, settings.get(`recorder.delay`) || 1);
}
}

function startRecording(filename)
{
    console.log(`Starting recording after delay`);
    setTimeout(function () {
        try {
            recorderTitle = filename;
            if (recorderTitle)
            {
                recorder.startRecording();
                console.log(`Started recording`);
            }
        } catch (eee) {
            // ignore errors
        }
    }, settings.get(`recorder.delay`) || 1);
}

function processConfig(data) {
    for (var key in data)
    {
        if (data.hasOwnProperty(key))
        {
            Config[key] = data[key];
        }
    }
}

function addNotification(group, level, time, notification)
{
    Notifications.push({group: group, level: level, time: time, notification: notification});
    var temp = document.querySelector(`#notification-group-${group}`);
    if (temp === null)
    {
        var tempi2 = document.querySelector(`#notification-groups`);
        if (tempi2 !== null)
        {
            tempi2.innerHTML += `<div class="row text-dark m-1 shadow-1 border-left border-primary bg-light-1" style="width: 96%; border-left-width: 5px !important;" id="notification-group-${group}">
    <div class="col-9 text-primary" style="font-size: 2em;">
      ${group}
    </div>
    <div class="col-3 text-secondary" style="font-size: 2em;" id="notification-group-n-${group}">
      1
    </div>
</div>`;
            var notification = notifier.notify(`New ${group} notifications`, {
                message: `There are new ${group} notifications in DJ Controls`,
                icon: '',
                duration: 900000,
            });
        }
    } else {
        var tempi2 = document.querySelector(`#notification-group-n-${group}`);
        if (tempi2 !== null)
        {
            tempi2.innerHTML = Notifications.filter((note) => note.group === group).length;
        }
    }
    main.flashTaskbar();
    $('#modal-notifications').iziModal('open');
}