/* global iziToast, io, moment, Infinity */

try {
// Define hexrgb constants
    var hexChars = 'a-f\\d';
    var match3or4Hex = `#?[${hexChars}]{3}[${hexChars}]?`;
    var match6or8Hex = `#?[${hexChars}]{6}([${hexChars}]{2})?`;

    var nonHexChars = new RegExp(`[^#${hexChars}]`, 'gi');
    var validHexSize = new RegExp(`^${match3or4Hex}$|^${match6or8Hex}$`, 'i');

    // Define constants
    var fs = require("fs"); // file system
    var os = require('os'); // OS
    var main = require('electron').remote.require('./main');
    const {remote} = window.require('electron');
    var notifier = require('./electron-notifications/index.js');
    var nrc = require("node-run-cmd");
    var sanitize = require("sanitize-filename");

    // Define data variables
    var Meta = {time: moment().toISOString(), state: 'unknown'};
    var Calendar = TAFFY();
    var Status = TAFFY();
    var Messages = TAFFY();
    var Announcements = TAFFY();
    var Eas = TAFFY();
    var Recipients = TAFFY();
    var Requests = TAFFY();
    var Logs = TAFFY();

    // Define HTML elements

    // Define other variables
    var nodeURL = 'https://server.wwsu1069.org';
    //var nodeURL = 'http://localhost:1337';
    var recordPadPath = "C:\\Program Files (x86)\\NCH Software\\Recordpad\\recordpad.exe";
    var recordPath = "S:\\OnAir recordings";
    var delay = 9000; // Subtract 1 second from the amount of on-air delay, as it takes about a second to process the recorder.

    io.sails.url = nodeURL;
    var disconnected = true;
    var theStatus = 4;
    var calendar = []; // Contains calendar events for the next 24 hours
    var activeRecipient = 0;
    var client = {};
    var totalUnread = 0;
    var totalRequests = 0;
    var breakNotified = false;
    var data = {
        size: 160,
        start: 0, // angle to rotate pie chart by
        sectors: [] // start (angle from start), size (amount of angle to cover), label, color
    }
    var prevQueueLength = 0;
    var queueLength = 0;

    // These are used for keeping track of upcoming shows and notifying DJs to prevent people cutting into each other's shows.
    var calPriority = 0;
    var calType = '';
    var calHost = '';
    var calShow = '';
    var calNotified = false;
    var calStarts = null;

    // Clock stuff
    var date = moment(Meta.time);
    var seconds = date.seconds();
    var secondsC = 0;
    var minutes = date.minutes();
    var minutesC = 0;
    var hours = date.hours();
    var hoursC = 0;
    var clockInterval = setInterval(function () {
        date = moment(Meta.time);
        seconds = date.seconds();
        minutes = date.minutes();
        hours = date.hours();
        var dateStamp = document.getElementById("datestamp");
        dateStamp.innerHTML = date.format('LLLL');
        if (hoursC !== (hours + (Math.floor(minutes / 3) / 20)))
        {
            var containers = document.querySelectorAll('.hours-container');
            if (containers)
            {
                for (var i = 0; i < containers.length; i++) {
                    if (containers[i].angle === undefined) {
                        containers[i].angle = 1.5;
                    } else {
                        containers[i].angle += 1.5;
                    }
                    containers[i].style.webkitTransform = 'rotateZ(' + containers[i].angle + 'deg)';
                    containers[i].style.transform = 'rotateZ(' + containers[i].angle + 'deg)';
                }
                hoursC = Math.floor((hoursC * 20) + 1) / 20;
                if (hoursC >= 24)
                    hoursC = 0;
            }
        }
        if (minutesC !== minutes)
        {
            var containers = document.querySelectorAll('.minutes-container');
            if (containers)
            {
                for (var i = 0; i < containers.length; i++) {
                    if (containers[i].angle === undefined) {
                        containers[i].angle = 6;
                    } else {
                        containers[i].angle += 6;
                    }
                    containers[i].style.webkitTransform = 'rotateZ(' + containers[i].angle + 'deg)';
                    containers[i].style.transform = 'rotateZ(' + containers[i].angle + 'deg)';
                }
                minutesC++;
                if (minutesC >= 60)
                {
                    minutesC = 0;
                    // Start a new recording if we are in automation
                    if (Meta.state.startsWith("automation_"))
                    {
                        nrc.run(`"${recordPadPath}" -done`)
                                .then(function (response) {
                                    console.log(`DONE: ${response}`);
                                    nrc.run(`"${recordPadPath}" -recordfile "${recordPath}\\automation\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3"`)
                                            .then(function (response2) {
                                                if (response2 == 0)
                                                {
                                                    nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'recorder', logsubtype: 'automation', loglevel: 'info', event: `A recording was started in ${recordPath}\\automation\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
                                                    });
                                                }
                                                console.log(`RECORDFILE: ${response2}`)
                                            })
                                            .catch(err => {
                                                console.error(err);
                                            });
                                })
                                .catch(err => {
                                    console.error(err);
                                });
                    }
                }
            }
        }
        if (secondsC !== seconds)
        {
            var containers = document.querySelectorAll('.seconds-container');
            if (containers)
            {
                for (var i = 0; i < containers.length; i++) {
                    if (containers[i].angle === undefined) {
                        containers[i].angle = 6;
                    } else {
                        containers[i].angle += 6;
                    }
                    containers[i].style.webkitTransform = 'rotateZ(' + containers[i].angle + 'deg)';
                    containers[i].style.transform = 'rotateZ(' + containers[i].angle + 'deg)';
                }
                secondsC++;
                if (secondsC >= 60)
                {
                    secondsC = 0;

                    // We want to refresh announcements and the calendar every minute.
                    checkAnnouncements();
                    checkCalendar();
                }
            }
        }
    }, 100);

    // Read in WWSU Node username and password from uncommitted tokens file
    var tokens = JSON.parse(fs.readFileSync(`${remote.app.getAppPath()}/tokens.json`));

    var messageFlash = setInterval(function () {
        if (totalUnread > 0 || totalRequests > 0)
        {
            var messaging = document.querySelector("#messaging");
            messaging.className = "card p-1 m-3 text-white bg-info-dark";
            setTimeout(function () {
                messaging.className = "card p-1 m-3 text-white bg-dark";
            }, 250);
        }

        var flasher = document.querySelectorAll(".flash-bg");
        if (flasher !== null && flasher.length > 0)
        {
            console.log(`FOUND IT`);
            document.querySelector("body").style.backgroundColor = '#ffffff';
            setTimeout(function () {
                document.querySelector("body").style.backgroundColor = '#000000';
            }, 250);
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
        closeOnClick: true,
        position: 'center',
        timeout: 30000
    });

    // Pre-load all the modal windows
    $("#go-live-modal").iziModal({
        title: `<h5 class="mt-0" style="text-align: center; font-size: 2em; color: #FFFFFF">Mics, Recorder, Action!</h5>`,
        headerColor: '#363636',
        width: 640,
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

    $("#go-remote-modal").iziModal({
        title: `<h5 class="mt-0" style="text-align: center; font-size: 2em; color: #FFFFFF">Remote Broadcast</h5>`,
        headerColor: '#363636',
        width: 640,
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

    $("#go-sports-modal").iziModal({
        title: `<h5 class="mt-0" style="text-align: center; font-size: 2em; color: #FFFFFF">Raider Sports</h5>`,
        headerColor: '#363636',
        width: 640,
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

    $("#log-modal").iziModal({
        title: `<h5 class="mt-0" style="text-align: center; font-size: 2em; color: #FFFFFF">Logs, Logs, and More Logs</h5>`,
        headerColor: '#363636',
        width: 640,
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

    $("#messages-modal").iziModal({
        title: `<h5 class="mt-0" style="text-align: center; font-size: 2em; color: #FFFFFF">Messages</h5>`,
        headerColor: '#363636',
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
                                nodeRequest({method: 'POST', url: nodeURL + '/messages/send', data: {from: os.hostname(), to: host, to_friendly: label, message: message}}, (response) => {
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

    function quillGetHTML(inputDelta) {
        var tempCont = document.createElement("div");
        (new Quill(tempCont)).setContents(inputDelta);
        return tempCont.getElementsByClassName("ql-editor")[0].innerHTML;
    }

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
        title: `<h5 class="mt-0" style="text-align: center; font-size: 2em; color: #FFFFFF">Report an Issue</h5>`,
        headerColor: '#363636',
        width: 640,
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

    $("#display-modal").iziModal({
        title: `<h5 class="mt-0" style="text-align: center; font-size: 2em; color: #FFFFFF">Display a Message on Display Signs</h5>`,
        headerColor: '#363636',
        width: 640,
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

    $("#xp-modal").iziModal({
        title: `<h5 class="mt-0" style="text-align: center; font-size: 2em; color: #FFFFFF">Your Show is Complete</h5>`,
        headerColor: '#363636',
        width: 640,
        focusInput: true,
        arrowKeys: false,
        navigateCaption: false,
        navigateArrows: false, // Boolean, 'closeToModal', 'closeScreenEdge'
        overlayClose: false,
        overlayColor: 'rgba(0, 0, 0, 0.75)',
        timeout: 60000,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)',
        zindex: 60
    });
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

// EVENT HANDLERS

io.socket.on('disconnect', function () {
    try {
        io.socket._raw.io._reconnection = true;
        io.socket._raw.io._reconnectionAttempts = Infinity;
        if (!disconnected)
        {
            var noConnection = document.getElementById('no-connection');
            noConnection.style.display = "inline";
            disconnected = true;
            var notification = notifier.notify('DJ Controls Lost Connection', {
                message: `DJ Controls lost connection to WWSU.`,
                icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                duration: 60000
            });
        }
    } catch (e) {
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the disconnect event.'
        });
        console.error(e);
    }
});

io.socket.on('connect', function () {
    try {
        if (disconnected)
        {
            var noConnection = document.getElementById('no-connection');
            noConnection.style.display = "none";
            disconnected = false;
        }
        doSockets();
    } catch (e) {
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the connect event.' + e.message
        });
        console.error(e);
    }
});

io.socket.on('meta', function (data) {
    var startRecording = null;
    for (var key in data)
    {
        if (data.hasOwnProperty(key))
        {
            if (key === 'state')
            {
                if (((Meta[key].startsWith("automation_") || Meta[key] === 'unknown') && Meta[key] !== 'automation_break') || (Meta[key].includes("_returning") && !data[key].includes("_returning")))
                {
                    if (data[key] === 'live_on')
                    {
                        startRecording = 'live';
                    } else if (data[key] === 'remote_on')
                    {
                        startRecording = 'remote';
                    } else if (data[key] === 'sports_on' || data[key] === 'sportsremote_on')
                    {
                        startRecording = 'sports';
                    }
                } else if (!Meta[key].startsWith("automation_") && data[key].startsWith("automation_"))
                {
                    startRecording = 'automation';
                } else if (data[key].includes("_break") || data[key].includes("_returning") || data[key].includes("_halftime"))
                {
                    setTimeout(function () {
                        nrc.run(`"${recordPadPath}" -done`)
                                .then(function (response) {
                                    console.log(response);
                                })
                                .catch(err => {
                                    console.error(err);
                                });
                    }, delay);
                }
            }
            Meta[key] = data[key];
        }
    }
    doMeta(data);
    if (startRecording !== null) {
        setTimeout(function () {
            nrc.run(`"${recordPadPath}" -done`)
                    .then(function (response) {
                        console.log(response);
                        nrc.run(`"${recordPadPath}" -recordfile "${recordPath}\\${startRecording}\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3"`)
                                .then(function (response2) {
                                    if (response2 == 0)
                                    {
                                        nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'recorder', logsubtype: (startRecording === 'automation' ? 'automation' : Meta.dj), loglevel: 'info', event: `A recording was started in ${recordPath}\\${startRecording}\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
                                        });
                                    }
                                    console.log(response2);
                                })
                                .catch(err => {
                                    console.error(err);
                                });
                    })
                    .catch(err => {
                        console.error(err);
                    });
        }, delay);
    }
});

// On new eas data, update our eas memory and run the process function.
io.socket.on('eas', function (data) {
    processEas(data);
});

io.socket.on('status', function (data) {
    processStatus(data);
});

io.socket.on('announcements', function (data) {
    processAnnouncements(data);
});

io.socket.on('calendar', function (data) {
    processCalendar(data);
});

io.socket.on('messages', function (data) {
    processMessages(data);
});

io.socket.on('requests', function (data) {
    processRequests(data);
});

io.socket.on('recipients', function (data) {
    processRecipients(data);
});

// OnClick handlers

document.querySelector("#btn-return-b").onclick = function () {
    returnBreak();
};

document.querySelector("#btn-psa15-b").onclick = function () {
    queuePSA(15);
};

document.querySelector("#btn-psa30-b").onclick = function () {
    queuePSA(30);
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

document.querySelector("#btn-endshow-b").onclick = function () {
    endShow();
};

document.querySelector("#btn-switchshow-b").onclick = function () {
    switchShow();
};

document.querySelector("#btn-resume-b").onclick = function () {
    returnBreak();
};

document.querySelector("#btn-break-b").onclick = function () {
    goBreak(false);
};

document.querySelector("#btn-halftime-b").onclick = function () {
    goBreak(true);
};

document.querySelector("#btn-topadd-b").onclick = function () {
    playTopAdd();
};

document.querySelector("#btn-liner-b").onclick = function () {
    playLiner();
};

document.querySelector("#btn-log-b").onclick = function () {
    prepareLog();
};

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

document.querySelector("#log-add").onclick = function () {
    saveLog();
};

document.querySelector(`#users`).addEventListener("click", function (e) {
    try {
        console.log(e.target.id);
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`users-o-mute`))
            {
                var recipient = Recipients({host: e.target.id.replace(`users-o-mute-`, ``)}).first().ID;
                prepareMute(recipient);
            }
            if (e.target.id.startsWith(`users-o-ban`))
            {
                var recipient = Recipients({host: e.target.id.replace(`users-o-ban-`, ``)}).first().ID;
                prepareBan(recipient);
            }
            if (e.target.id.startsWith(`users-b`))
            {
                var recipient = Recipients({host: e.target.id.replace(`users-b-`, ``)}).first().ID;
                selectRecipient(recipient);
            }
            if (e.target.id.startsWith(`users-l`))
            {
                var recipient = Recipients({host: e.target.id.replace(`users-l-`, ``)}).first().ID;
                selectRecipient(recipient);
            }
            if (e.target.id.startsWith(`users-n`))
            {
                var recipient = Recipients({host: e.target.id.replace(`users-n-`, ``)}).first().ID;
                selectRecipient(recipient);
            }
            if (e.target.id.startsWith(`users-c1`))
            {
                var recipient = Recipients({host: e.target.id.replace(`users-c1-`, ``)}).first().ID;
                selectRecipient(recipient);
            }
            if (e.target.id.startsWith(`users-c2`))
            {
                var recipient = Recipients({host: e.target.id.replace(`users-c2-`, ``)}).first().ID;
                selectRecipient(recipient);
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

document.querySelector(`#messages`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`message-o-mute`))
            {
                var recipient = Messages({ID: parseInt(e.target.id.replace(`message-o-mute-`, ``))}).first().from;
                prepareMute(recipient);
            }
            if (e.target.id.startsWith(`message-o-ban`))
            {
                var recipient = Messages({ID: parseInt(e.target.id.replace(`message-o-ban-`, ``))}).first().from;
                prepareBan(recipient);
            }
            if (e.target.id.startsWith(`message-o-delete`))
            {
                deleteMessage(e.target.id.replace(`message-o-delete-`, ``));
            }
            if (e.target.id.startsWith(`message-m`))
            {
                markRead(parseInt(e.target.id.replace(`message-m-`, ``)));
            }
            if (e.target.id.startsWith(`message-b`))
            {
                markRead(parseInt(e.target.id.replace(`message-b-`, ``)));
            }
            if (e.target.id.startsWith(`message-t`))
            {
                markRead(parseInt(e.target.id.replace(`message-t-`, ``)));
            }
            if (e.target.id.startsWith(`message-c1`))
            {
                markRead(parseInt(e.target.id.replace(`message-c1-`, ``)));
            }
            if (e.target.id.startsWith(`message-c2`))
            {
                markRead(parseInt(e.target.id.replace(`message-c2-`, ``)));
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

document.querySelector(`#messages-unread`).addEventListener("click", function (e) {
    try {
        if (e.target) {
            console.log(e.target.id);
            if (e.target.id.startsWith(`message-n-m`))
            {
                var message = Messages({ID: parseInt(e.target.id.replace(`message-n-m-`, ``))}).first();
                var host = (message.to === 'DJ' ? 'website' : message.from);
                selectRecipient(Recipients({host: host}).first().ID || null);
                $("#messages-modal").iziModal('open');
            }
            if (e.target.id.startsWith(`message-n-t`))
            {
                var message = Messages({ID: parseInt(e.target.id.replace(`message-n-t-`, ``))}).first();
                var host = (message.to === 'DJ' ? 'website' : message.from);
                selectRecipient(Recipients({host: host}).first().ID || null);
                $("#messages-modal").iziModal('open');
            }
            if (e.target.id.startsWith(`message-n-b`))
            {
                var message = Messages({ID: parseInt(e.target.id.replace(`message-n-b-`, ``))}).first();
                var host = (message.to === 'DJ' ? 'website' : message.from);
                selectRecipient(Recipients({host: host}).first().ID || null);
                $("#messages-modal").iziModal('open');
            }
            if (e.target.id.startsWith(`message-n-x`))
            {
                markRead(parseInt(e.target.id.replace(`message-n-x-`, ``)));
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
            if (e.target.id.startsWith(`attn-r`))
            {
                var ID = parseInt(e.target.id.replace(`attn-r-`, ``));
                prepareAttnRemove(ID);
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
    if (calType === 'Show' && document.querySelector("#live-handle").value === calHost && document.querySelector("#live-show").value === calShow)
    {
        document.querySelector("#live-noschedule").style.display = "none";
    } else {
        document.querySelector("#live-noschedule").style.display = "inline";
    }
};

document.querySelector("#live-show").onkeyup = function () {
    if (calType === 'Show' && document.querySelector("#live-handle").value === calHost && document.querySelector("#live-show").value === calShow)
    {
        document.querySelector("#live-noschedule").style.display = "none";
    } else {
        document.querySelector("#live-noschedule").style.display = "inline";
    }
};

document.querySelector("#remote-handle").onkeyup = function () {
    if (calType === 'Remote' && document.querySelector("#remote-handle").value === calHost && document.querySelector("#remote-show").value === calShow)
    {
        document.querySelector("#remote-noschedule").style.display = "none";
    } else {
        document.querySelector("#remote-noschedule").style.display = "inline";
    }
};

document.querySelector("#remote-show").onkeyup = function () {
    if (calType === 'Remote' && document.querySelector("#remote-handle").value === calHost && document.querySelector("#remote-show").value === calShow)
    {
        document.querySelector("#remote-noschedule").style.display = "none";
    } else {
        document.querySelector("#remote-noschedule").style.display = "inline";
    }
};

document.querySelector("#sports-sport").addEventListener("change", function () {
    if (calType === 'Sports' && document.querySelector("#sports-sport").value === calShow)
    {
        document.querySelector("#sports-noschedule").style.display = "none";
    } else {
        document.querySelector("#sports-noschedule").style.display = "inline";
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

// Get a token for API endpoints requiring authorization
function authorise(cb)
{
    io.socket.request({method: 'POST', url: nodeURL + '/user/auth', timeout: 3000, data: {email: tokens.email, password: tokens.password}}, function (body, JWR) {
        if (!body)
        {
            authtoken = null;
            cb(false);
        } else {
            try {
                authtoken = body.token;
                cb(authtoken);
            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                    message: 'Error occurred authorizing a Node request and passing it to callback.'
                });
            }
        }
    });
}

// This function calls authorise to get a token, and then proceeds with the requested API call
function nodeRequest(opts, cb) {
    authorise(function (token) {
        if (token)
        {
            opts.headers = {
                'Authorization': 'Bearer ' + token
            };
            try {
                io.socket.request(opts, function serverResponded(body, JWR) {
                    if (!body)
                    {
                        cb(false);
                    } else {
                        try {
                            cb(body);
                        } catch (e) {
                            console.error(e);
                            iziToast.show({
                                title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                                message: 'Error occurred in nodeRequest callback.'
                            });
                        }
                    }
                });
            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                    message: 'Error occurred making a Node request.'
                });
            }
        } else {
            try {
                cb(false);
            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please inform engineer@wwsu1069.org.',
                    message: 'Error occurred in nodeRequest callback.'
                });
            }
        }
    });
}

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
    onlineSocket();
    metaSocket();
    easSocket();
    statusSocket();
    calendarSocket();
    messagesSocket();
    recipientsSocket();
}

// Registers this DJ Controls as a recipient
function onlineSocket()
{
    console.log('attempting online socket');
    nodeRequest({method: 'post', url: nodeURL + '/recipients/add-computers', data: {host: os.hostname()}}, function (response) {
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
    io.socket.post('/meta/get', {}, function serverResponded(body, JWR) {
        try {
            var startRecording = null;
            for (var key in body)
            {
                if (body.hasOwnProperty(key))
                {
                    // Manage NCH Software RecordPad recordings
                    if (key === 'state')
                    {
                        if (((Meta[key].startsWith("automation_") || Meta[key] === 'unknown') && Meta[key] !== 'automation_break') || (Meta[key].includes("_returning") && !body[key].includes("_returning")))
                        {
                            if (body[key] === 'live_on')
                            {
                                startRecording = 'live';
                            } else if (body[key] === 'remote_on')
                            {
                                startRecording = 'remote';
                            } else if (body[key] === 'sports_on' || body[key] === 'sportsremote_on')
                            {
                                startRecording = 'sports';
                            } else if (body[key].startsWith("automation_"))
                            {
                                startRecording = 'automation';
                            }
                        } else if (!Meta[key].startsWith("automation_") && body[key].startsWith("automation_"))
                        {
                            startRecording = 'automation';
                        } else if (body[key].includes("_break") || body[key].includes("_returning"))
                        {
                            nrc.run(`"${recordPadPath}" -done`)
                                    .then(function (response) {
                                        console.log(response);
                                    })
                                    .catch(err => {
                                        console.error(err);
                                    });
                        }
                    }
                    Meta[key] = body[key];
                }
            }
            doMeta(body);
            if (startRecording !== null) {
                nrc.run(`"${recordPadPath}" -done`)
                        .then(function (response) {
                            console.log(`DONE: ${response}`);
                            nrc.run(`"${recordPadPath}" -recordfile "${recordPath}\\${startRecording}\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3"`)
                                    .then(function (response2) {
                                        if (response2 == 0)
                                        {
                                            nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'recorder', logsubtype: (startRecording === 'automation' ? 'automation' : Meta.dj), loglevel: 'info', event: `A recording was started in ${recordPath}\\${startRecording}\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
                                            });
                                        }
                                        console.log(`RECORDFILE: ${response2}`);
                                    })
                                    .catch(err => {
                                        console.error(err);
                                    });
                        })
                        .catch(err => {
                            console.error(err);
                        });
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
    io.socket.post('/eas/get', {}, function serverResponded(body, JWR) {
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
    io.socket.post('/status/get', {}, function serverResponded(body, JWR) {
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
    io.socket.post('/calendar/get', {}, function serverResponded(body, JWR) {
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
    nodeRequest({method: 'post', url: nodeURL + '/hosts/get', data: {host: os.hostname()}}, function (body) {
        //console.log(body);
        try {
            client = body;
            nodeRequest({method: 'post', url: nodeURL + '/messages/get', data: {host: os.hostname()}}, function (body2) {
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

            nodeRequest({method: 'post', url: nodeURL + '/requests/get', data: {}}, function (body3) {
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

            io.socket.post('/announcements/get', {type: 'djcontrols'}, function serverResponded(body, JWR) {
                //console.log(body);
                try {
                    processAnnouncements(body, true);
                } catch (e) {
                    console.error(e);
                    console.log('FAILED Announcements CONNECTION');
                    setTimeout(messagesSocket, 10000);
                }
            });

            if (client.emergencies)
            {
                io.socket.post('/logs/get', {}, function serverResponded(body, JWR) {
                    //console.log(body);
                    try {
                        // TODO
                        //processLogs(body, true);
                    } catch (e) {
                        console.error(e);
                        console.log('FAILED logs CONNECTION');
                        setTimeout(messagesSocket, 10000);
                    }
                });
            }
        } catch (e) {
            console.log(`FAILED messages CONNECTION`);
            console.error(e);
            setTimeout(messagesSocket, 10000);
        }
    });
}

// Retrieving a list of clients we can send/receive messages to/from
function recipientsSocket() {
    console.log('attempting recipients socket');
    io.socket.post('/recipients/get', {}, function serverResponded(body, JWR) {
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

// Called on change to any metadata info
function doMeta(metan) {
    try {
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
        // Notify the DJ of a mandatory top of the hour break if they need to take one
        if (Meta.breakneeded && Meta.djcontrols === os.hostname())
        {
            if (document.querySelector("#iziToast-breakneeded") === null && !breakNotified)
            {
                breakNotified = true;
                var notification = notifier.notify(`Don't forget Top of Hour break!`, {
                    message: 'Please take a break in the next 3 minutes.',
                    icon: 'http://cdn.onlinewebfonts.com/svg/img_205852.png',
                    duration: 300000,
                });
                main.flashTaskbar();
                iziToast.show({
                    id: 'iziToast-breakneeded',
                    class: 'flash-bg',
                    title: `<i class="fas fa-clock"></i> Don't forget the required Top of Hour break!`,
                    message: `Please find a graceful stopping point and then click "take a break" within the next 3 minutes. If you're about to end your show, you do not need to take a break.`,
                    timeout: false,
                    close: true,
                    color: 'yellow',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 250,
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

        // Manage queueLength
        prevQueueLength = queueLength;
        queueLength = Math.round(Meta.queueLength);
        if (queueLength < 0)
            queueLength = 0;

        // Detect if the DJ adds stuff to the queue before the system has entered show mode or exited break mode. Notify the DJ if such happened.
        if ((prevQueueLength + 10) < queueLength && Meta.djcontrols === os.hostname() && typeof metan.state === 'undefined')
        {
            if (Meta.state.includes("_returning") && queueLength > (60 * 2))
            {
                var notification = notifier.notify(`Problem with RadioDJ queue`, {
                    message: `Please wait for the queue to empty / finish before adding tracks.`,
                    icon: '',
                    duration: 120000,
                });
                main.flashTaskbar();
                iziToast.show({
                    class: 'flash-bg',
                    title: '<i class="fas fa-clock"></i> Tracks were added to the RadioDJ queue too soon',
                    message: `You need to wait until the queue empties / finishes before adding tracks. Otherwise, the system will think you are still coming out of a break.`,
                    timeout: 120000,
                    close: true,
                    color: 'yellow',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 250
                });
            } else if (Meta.state === 'automation_live' && queueLength >= (60 * 5))
            {
                var notification = notifier.notify(`Problem with RadioDJ queue`, {
                    message: `Please wait for the queue to empty / finish before adding tracks.`,
                    icon: '',
                    duration: 120000,
                });
                main.flashTaskbar();
                iziToast.show({
                    class: 'flash-bg',
                    title: '<i class="fas fa-clock"></i> Tracks were added to the RadioDJ queue too soon',
                    message: `You need to wait until the queue empties / finishes before adding tracks. The system does not enter live show mode until the queue finishes playing.`,
                    timeout: 120000,
                    close: true,
                    color: 'yellow',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 250
                });
            } else if ((Meta.state === 'automation_sports' || Meta.state === 'automation_sportsremote' || Meta.state === 'automation_remote') && queueLength >= 60)
            {
                var notification = notifier.notify(`Problem with RadioDJ queue`, {
                    message: `Please wait for the queue to empty / finish before adding tracks.`,
                    icon: '',
                    duration: 120000,
                });
                main.flashTaskbar();
                iziToast.show({
                    class: 'flash-bg',
                    title: '<i class="fas fa-clock"></i> Tracks were added to the RadioDJ queue too soon',
                    message: `You need to wait until the queue empties / finishes before adding tracks. The system does not enter broadcast mode until the queue finishes playing.`,
                    timeout: 120000,
                    close: true,
                    color: 'yellow',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 250
                });
            }
        }
        // Make queue timer show current queue length (when visible)
        var queueTime = document.querySelector("#queue-seconds");
        queueTime.innerHTML = moment.duration(queueLength, "seconds").format();

        // Flash the WWSU Operations box when queue time goes below 15 seconds.
        if (queueLength < 15 && (Meta.state.includes("_returning") || (Meta.state.startsWith("automation_") && Meta.state !== 'automation_on' && Meta.state !== 'automation_genre') && Meta.state !== 'automation_playlist'))
        {
            var operations = document.querySelector("#operations");
            operations.className = "card p-1 m-3 text-white bg-warning-dark";
            setTimeout(function () {
                operations.className = "card p-1 m-3 text-white bg-dark";
            }, 250);
        }

        // Do stuff if the state changed
        if (typeof metan.state !== 'undefined')
        {
            // Always re-do the calendar / clockwheel when states change.
            checkCalendar();

            // Have the WWSU Operations box display buttons and operations depending on which state we are in
            $('#operations-body').animateCss('bounceOut', function () {
                var badge = document.querySelector('#operations-state');
                badge.innerHTML = Meta.state;
                var actionButtons = document.querySelectorAll(".btn-operation");
                for (var i = 0; i < actionButtons.length; i++) {
                    actionButtons[i].style.display = "none";
                }
                document.querySelector('#queue').style.display = "none";
                document.querySelector('#no-remote').style.display = "none";
                document.querySelector('#please-wait').style.display = "none";
                if (Meta.state === 'automation_on' || Meta.state === 'automation_break')
                {
                    badge.className = 'badge badge-primary';
                    document.querySelector('#btn-golive').style.display = "inline";
                    document.querySelector('#btn-goremote').style.display = "inline";
                    document.querySelector('#btn-gosports').style.display = "inline";
                } else if (Meta.state === 'automation_playlist')
                {
                    badge.className = 'badge badge-primary';
                    document.querySelector('#btn-golive').style.display = "inline";
                    document.querySelector('#btn-goremote').style.display = "inline";
                    document.querySelector('#btn-gosports').style.display = "inline";
                } else if (Meta.state === 'automation_genre')
                {
                    badge.className = 'badge badge-primary';
                    document.querySelector('#btn-golive').style.display = "inline";
                    document.querySelector('#btn-goremote').style.display = "inline";
                    document.querySelector('#btn-gosports').style.display = "inline";
                } else if (Meta.state === 'live_prerecord' || Meta.state === 'automation_prerecord')
                {
                    badge.className = 'badge badge-danger';
                    document.querySelector('#btn-golive').style.display = "inline";
                    document.querySelector('#btn-goremote').style.display = "inline";
                    document.querySelector('#btn-gosports').style.display = "inline";
                } else if (Meta.state.startsWith('automation_') || (Meta.state.includes('_returning') && !Meta.state.startsWith('sports')))
                {
                    document.querySelector('#queue').style.display = "inline";
                    document.querySelector('#btn-psa15').style.display = "inline";
                    document.querySelector('#btn-psa30').style.display = "inline";
                } else if (Meta.state.startsWith('sports') && Meta.state.includes('_returning'))
                {
                    document.querySelector('#queue').style.display = "inline";
                    document.querySelector('#btn-psa15').style.display = "inline";
                    document.querySelector('#btn-psa30').style.display = "inline";
                    // If the system goes into disconnected mode, the host client should be notified of that!
                } else if (Meta.state.includes('_break_disconnected') || Meta.state.includes('_halftime_disconnected') && Meta.djcontrols === os.hostname())
                {
                    if (document.querySelector("#iziToast-noremote") === null)
                        iziToast.show({
                            id: 'iziToast-noremote',
                            class: 'flash-bg',
                            title: '<i class="fas fa-exclamation-triangle"></i> Lost Remote Connection',
                            message: `Please ensure you are streaming to the remote stream and that your internet connection is stable. Then, click "Resume Show".`,
                            timeout: false,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'Center',
                            closeOnClick: false,
                            overlay: true,
                            zindex: 250,
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
                    document.querySelector('#no-remote').style.display = "inline";
                    document.querySelector('#btn-resume').style.display = "inline";
                } else if (Meta.state.includes('_break') || Meta.state.includes('_halftime'))
                {
                    document.querySelector('#btn-return').style.display = "inline";
                } else if (Meta.state.includes('live_'))
                {
                    badge.className = 'badge badge-danger';
                    if (Meta.playing)
                    {
                        document.querySelector('#queue').style.display = "inline";
                    } else {
                        document.querySelector('#btn-topadd').style.display = "inline";
                        document.querySelector('#btn-log').style.display = "inline";
                    }
                    document.querySelector('#btn-endshow').style.display = "inline";
                    document.querySelector('#btn-switchshow').style.display = "inline";
                    document.querySelector('#btn-break').style.display = "inline";
                } else if (Meta.state.includes('sports_') || Meta.state.includes('sportsremote_'))
                {
                    badge.className = 'badge badge-success';
                    if (Meta.playing)
                    {
                        document.querySelector('#queue').style.display = "inline";
                    } else {
                        document.querySelector('#btn-liner').style.display = "inline";
                    }
                    document.querySelector('#btn-endshow').style.display = "inline";
                    document.querySelector('#btn-break').style.display = "inline";
                    document.querySelector('#btn-halftime').style.display = "inline";
                } else if (Meta.state.includes('remote_'))
                {
                    badge.className = 'badge badge-purple';
                    if (Meta.playing)
                    {
                        document.querySelector('#queue').style.display = "inline";
                    } else {
                        document.querySelector('#btn-topadd').style.display = "inline";
                        document.querySelector('#btn-log').style.display = "inline";
                    }
                    document.querySelector('#btn-endshow').style.display = "inline";
                    document.querySelector('#btn-break').style.display = "inline";
                } else {
                }
                $('#operations-body').animateCss('bounceIn', function () {});
            });
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please inform engineer@wwsu1069.org.',
            message: 'Error occurred in the doMeta function.'
        });
    }
}

// Shows a please wait box.
function pleaseWait() {
    try {
        var temp = document.querySelector('#operations');
        var actionButtons = temp.querySelectorAll("#btn-circle");
        for (var i = 0; i < actionButtons.length; i++) {
            actionButtons[i].style.display = "none";
        }
        document.querySelector('#please-wait').style.display = "inline";
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
    var temp = document.querySelectorAll(".attn-status-1");
    var temp2 = document.querySelectorAll(".attn-status-2");
    var temp3 = document.querySelectorAll(".attn-eas-Extreme");
    var temp4 = document.querySelectorAll(".attn-eas-Severe");
    var attn = document.querySelector("#announcements");

    if (temp.length > 0 || temp3.length > 0)
    {
        attn.className = "card p-1 m-3 text-white bg-danger-dark";
    } else if (temp2.length > 0 || temp4.length > 0)
    {
        attn.className = "card p-1 m-3 text-white bg-warning-dark";
    } else {
        attn.className = "card p-1 m-3 text-white bg-dark";
    }
}

// Re-do the announcements shown in the announcements box
function checkAnnouncements() {
    var prev = [];
    // Add applicable announcements
    Announcements().each(function (datum) {
        // Check to make sure the announcement is valid / not expired
        if (moment(datum.starts).isBefore(moment(Meta.time)) && moment(datum.expires).isAfter(moment(Meta.time)))
        {
            prev.push(`attn-${datum.ID}`);
            if (document.querySelector(`#attn-${datum.ID}`) === null)
            {
                var attn = document.querySelector("#announcements-body");
                attn.innerHTML += `<div class="attn attn-${datum.level} alert alert-${datum.level}" id="attn-${datum.ID}" role="alert">
                                ${client.emergencies ? `<button type="button" class="close" aria-label="Remove">
                <span aria-hidden="true" id="attn-r-${datum.ID}">&times;</span>
                </button>` : ``}
                        <i class="fas fa-bullhorn"></i> ${datum.announcement}
                    </div>`;
                // If this DJ Controls is configured by WWSU to notify on technical problems, notify so.
                if (client.emergencies && datum.announcement.startsWith("<strong>Problem reported by"))
                {
                    iziToast.show({
                        title: '<i class="fas fa-exclamation-triangle"></i> Technical issue reported!',
                        message: `${datum.announcement}`,
                        timeout: false,
                        close: true,
                        color: 'red',
                        drag: false,
                        position: 'center',
                        closeOnClick: false,
                        overlay: true,
                        zindex: 250
                    });
                    var notification = notifier.notify('Problem Reported', {
                        message: `A problem was reported. Please see DJ Controls.`,
                        icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                        duration: (1000 * 60 * 60 * 24),
                    });
                    main.flashTaskbar();
                }
            } else {
                var temp = document.querySelector(`#attn-${datum.ID}`);
                temp.className = `attn attn-${datum.level} alert alert-${datum.level}`;
                temp.innerHTML = `${client.emergencies ? `<button type="button" class="close" aria-label="Remove">
                <span aria-hidden="true" id="attn-r-${datum.ID}">&times;</span>
                </button>` : ``}<i class="fas fa-bullhorn"></i> ${datum.announcement}`;
            }
        }
    });

    // Remove announcements no longer valid
    var attn = document.querySelectorAll(".attn");
    for (var i = 0; i < attn.length; i++) {
        if (prev.indexOf(attn[i].id) === -1)
            attn[i].parentNode.removeChild(attn[i]);
    }
}

function checkCalendar() {
    try {
        // Prepare the calendar variable
        calendar = [];

        // Erase the clockwheel
        $(".chart").empty();
        data.sectors = [];

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
                    message: `Error occurred in the compare function of Calendar.sort in the checkCalendar call.`
                });
            }
        };

        // Declare empty temp variables for cal
        var calPriorityN = 0;
        var calTypeN = '';
        var calHostN = '';
        var calShowN = '';
        var calStartsN = null;
        var records = Calendar().get().sort(compare);

        // Run through every event in memory, sorted by the comparison function, and add appropriate ones into our formatted calendar variable.
        if (records.length > 0)
        {
            records.forEach(function (event)
            {
                try {
                    // Do not show genre nor playlist events
                    if (event.title.startsWith("Genre:") || event.title.startsWith("Playlist:"))
                        return null;

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

                    // First priority: Sports broadcasts. Check for broadcasts scheduled to start within the next 15 minutes. Skip any scheduled to end in 15 minutes.
                    if (event.title.startsWith("Sports: ") && moment(Meta.time).add(15, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(15, 'minutes').isAfter(moment(Meta.time)) && calPriorityN < 10)
                    {
                        calPriorityN = 10;
                        calTypeN = 'Sports';
                        calHostN = '';
                        calShowN = event.title.replace('Sports: ', '');
                        calStartsN = event.start;
                    }

                    // Second priority: Remote broadcasts. Check for broadcasts scheduled to start within the next 15 minutes. Skip any scheduled to end in 15 minutes.
                    if (event.title.startsWith("Remote: ") && moment(Meta.time).add(15, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(15, 'minutes').isAfter(moment(Meta.time)) && calPriorityN < 7)
                    {
                        var summary = event.title.replace('Remote: ', '');
                        var temp = summary.split(" - ");

                        calPriorityN = 7;
                        calTypeN = 'Remote';
                        calHostN = temp[0];
                        calShowN = temp[1];
                        calStartsN = event.start;
                    }

                    // Third priority: Radio shows. Check for broadcasts scheduled to start within the next 10 minutes. Skip any scheduled to end in 15 minutes.
                    if (event.title.startsWith("Show: ") && moment(Meta.time).add(10, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(15, 'minutes').isAfter(moment(Meta.time)) && calPriorityN < 5)
                    {
                        var summary = event.title.replace('Show: ', '');
                        var temp = summary.split(" - ");

                        calPriorityN = 5;
                        calTypeN = 'Show';
                        calHostN = temp[0];
                        calShowN = temp[1];
                        calStartsN = event.start;
                    }

                    // Fourth priority: Prerecords. Check for broadcasts scheduled to start within the next 10 minutes. Skip any scheduled to end in 15 minutes.
                    if (event.title.startsWith("Prerecord: ") && moment(Meta.time).add(10, 'minutes').isAfter(moment(event.start)) && moment(event.end).subtract(15, 'minutes').isAfter(moment(Meta.time)) && calPriorityN < 2)
                    {
                        calPriorityN = 2;
                        calTypeN = 'Prerecord';
                        calHostN = '';
                        calShowN = event.title.replace('Prerecord: ', '');
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
            calStarts = calStartsN;
            calPriority = calPriorityN;
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
            curPriority = 2;
        if (Meta.state.startsWith("automation_"))
            curPriority = 1;

        // Determine if the DJ should be notified of the upcoming program
        if (curPriority <= calPriority && !calNotified && Meta.djcontrols === os.hostname() && Meta.dj !== `${calHost} - ${calShow}` && Meta.changingState === null)
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
                    title: '<i class="fas fa-trophy"></i> Sports broadcast in less than 15 minutes.',
                    message: `A sports broadcast is scheduled to begin in less than 15 minutes. If this broadcast is still scheduled to air, please wrap up your show now and then click "End Show". That way, WWSU has 15 minutes to prepare for the broadcast.`,
                    timeout: 900000,
                    close: true,
                    color: 'blue',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
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
                    title: '<i class="fas fa-broadcast-tower"></i> Remote broadcast in less than 15 minutes.',
                    message: `A remote broadcast is scheduled to begin in less than 15 minutes. If this broadcast is still scheduled to air, please wrap up your show now and then click "End Show". That way, WWSU has 15 minutes to prepare for the broadcast.`,
                    timeout: 900000,
                    close: true,
                    color: 'blue',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
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
                    title: '<i class="fas fa-microphone-alt"></i> You are interrupting another show!',
                    message: `You are running into another person's show time. Please wrap up your show now and then click "End Show" (or click "Switch Show" if the other person is ready to go live in the next few minutes).`,
                    timeout: 900000,
                    close: true,
                    color: 'blue',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
                    buttons: [
                        ['<button>End Show</button>', function (instance, toast, button, e, inputs) {
                                endShow();
                                instance.hide({}, toast, 'button');
                            }],
                        ['<button>Switch Show</button>', function (instance, toast, button, e, inputs) {
                                switchShow();
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
                    title: '<i class="fas fa-circle"></i> You are running into a scheduled prerecord.',
                    message: `You are running into a scheduled prerecorded show. Unless WWSU has given you permission to continue, please consider wrapping up and ending your show by clicking "End Now".`,
                    timeout: 900000,
                    close: true,
                    color: 'blue',
                    drag: false,
                    position: 'center',
                    closeOnClick: false,
                    overlay: true,
                    zindex: 501,
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
            calendar.forEach(function (event) {
                // If we are not doing a show, proceed with a 12-hour clockwheel and events list
                if (Meta.state.startsWith("automation_") || Meta.state === "live_prerecord")
                {
                    var finalColor = (typeof event.color !== 'undefined' && /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(event.color)) ? hexRgb(event.color) : hexRgb('#787878');
                    finalColor.red = Math.round(finalColor.red / 2);
                    finalColor.green = Math.round(finalColor.green / 2);
                    finalColor.blue = Math.round(finalColor.blue / 2);
                    document.querySelector('#calendar-events').innerHTML += ` <div class="p-1 m-1" style="background-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue});">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(event.start).format("hh:mm A")} - ${moment(event.end).format("hh:mm A")}
                                            </div>
                                            <div class="col-8">
                                                ${event.title}
                                            </div>
                                        </div>
                                    </div></div>`;
                    // Add upcoming shows to the clockwheel shading
                    if (event.title.startsWith("Show: ") || event.title.startsWith("Remote: ") || event.title.startsWith("Sports: ") || event.title.startsWith("Prerecord: "))
                    {
                        if (moment(event.end).diff(moment(Meta.time), 'minutes') < (12 * 60))
                        {
                            if (moment(event.start).isAfter(moment(Meta.time)))
                            {
                                data.sectors.push({
                                    label: event.title,
                                    start: ((moment(event.start).diff(moment(Meta.time), 'minutes') / (12 * 60)) * 360),
                                    size: ((moment(event.end).diff(moment(event.start), 'minutes') / (12 * 60)) * 360) - 2,
                                    color: event.color || '#787878'
                                });
                            } else {
                                data.sectors.push({
                                    label: event.title,
                                    start: 0,
                                    size: ((moment(event.end).diff(moment(Meta.time), 'minutes') / (12 * 60)) * 360) - 2,
                                    color: event.color || '#787878'
                                });
                            }
                        } else if (moment(event.start).diff(moment(Meta.time), 'minutes') < (12 * 60))
                        {
                            if (moment(event.start).isAfter(moment(Meta.time)))
                            {
                                var start = ((moment(event.start).diff(moment(Meta.time), 'minutes') / (12 * 60)) * 360);
                                data.sectors.push({
                                    label: event.title,
                                    start: start,
                                    size: 358 - start,
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
                        console.dir(data.sectors);
                    }
                    // If we are doing a show, do a 1-hour clockwheel
                } else {
                    if (event.title.startsWith("Show: ") || event.title.startsWith("Remote: ") || event.title.startsWith("Sports: "))
                    {
                        var stripped = event.title.replace("Show: ", "");
                        stripped = stripped.replace("Remote: ", "");
                        stripped = stripped.replace("Sports: ", "");
                        // If the event we are processing is what is on the air right now, and the event has not yet ended...
                        if (Meta.dj === stripped && moment(event.end).isAfter(moment(Meta.time)))
                        {
                            // Calculate base remaining time
                            timeLeft = moment(event.end).diff(moment(Meta.time), 'minutes');
                            // If there is less than 1 hour remaining in the show, only shade the clock for the portion of the hour remaining in the show
                            if (moment(event.end).diff(moment(Meta.time), 'minutes') < 60)
                            {
                                if (moment(event.start).isAfter(moment(Meta.time)))
                                {
                                    doLabel = event.title;
                                    doStart = ((moment(event.start).diff(moment(Meta.time), 'minutes') / 60) * 360);
                                    doSize = ((moment(event.end).diff(moment(event.start), 'minutes') / 60) * 360) + 6;
                                    doColor = event.color || '#787878';
                                    currentStart = moment(event.start);
                                    currentEnd = moment(event.end);
                                } else {
                                    var theSize = ((moment(event.end).diff(moment(Meta.time), 'minutes') / 60) * 360) + 6;
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
                            console.log(`Timeleft: ${timeLeft}`);
                            console.log(`TimeLeft2: ${timeLeft2}`);
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
                            if (moment(event.start).diff(moment(Meta.time), 'minutes') < 60)
                            {
                                if (moment(event.start).isAfter(moment(Meta.time)))
                                {
                                    var theStart = ((moment(event.start).diff(moment(Meta.time), 'minutes') / 60) * 360) + 6;
                                    var theSize = ((moment(event.end).diff(moment(event.start), 'minutes') / 60) * 360);
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
                                        size: ((moment(event.end).diff(moment(Meta.time), 'minutes') / 60) * 360) + 6,
                                        color: "#000000"
                                    });
                                }
                            }
                        }
                    }
                    // Add the event to the list on the right of the clock
                    if (moment(Meta.time).add(1, 'hours').isAfter(moment(event.start)) && moment(Meta.time).isBefore(moment(event.end)))
                    {
                        var finalColor = (typeof event.color !== 'undefined' && /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(event.color)) ? hexRgb(event.color) : hexRgb('#787878');
                        finalColor.red = Math.round(finalColor.red / 2);
                        finalColor.green = Math.round(finalColor.green / 2);
                        finalColor.blue = Math.round(finalColor.blue / 2);
                        var stripped = event.title.replace("Show: ", "");
                        stripped = stripped.replace("Remote: ", "");
                        stripped = stripped.replace("Sports: ", "");
                        if (Meta.dj !== stripped)
                        {
                            document.querySelector('#calendar-events').innerHTML += ` <div class="p-1 m-1" style="background-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue});">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(event.start).format("hh:mm A")} - ${moment(event.end).format("hh:mm A")}
                                            </div>
                                            <div class="col-8">
                                                ${event.title}
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
            var diff = moment(Meta.time).diff(moment(start), 'minutes');
            data.start = 0.5 * diff;

// Show an indicator on the clock for the current hour (extra visual to show 12-hour clock mode)
            data.sectors.push({
                label: 'current hour',
                start: 0,
                size: 2,
                color: "#000000"
            });

            console.dir(data);

            var sectors = calculateSectors(data);
            var newSVG = document.getElementById("clock-program");
            newSVG.setAttribute("transform", `rotate(${data.start})`);
            console.dir(sectors);
            sectors.map(function (sector) {

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
            var diff = moment(Meta.time).diff(moment(start), 'minutes');
            data.start = 6 * diff;


            if (doLabel !== null)
            {
                var doTopOfHour = false;
                if (!Meta.breakneeded)
                {
                    var topOfHour = moment(Meta.time).add(1, 'hours').startOf('hour');
                    // If the DJ is expected to do a top of the hour break at the next top of hour, show so on the clock and in the events list
                    if (moment(currentEnd).subtract(10, 'minutes').isAfter(moment(topOfHour)))
                    {
                        doTopOfHour = true;
                        document.querySelector('#calendar-events').innerHTML = ` <div class="p-1 m-1" style="background-color: #7f751d;">
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
                    topOfHour = moment(Meta.time).startOf('hour');
                    // This happens when the DJ has not yet taken their top of the hour break; keep the time in the events list the same until they take the break.
                    if (moment(currentEnd).subtract(10, 'minutes').isAfter(moment(topOfHour)))
                    {
                        doTopOfHour = true;
                        document.querySelector('#calendar-events').innerHTML += ` <div class="p-1 m-1" style="background-color: #7f751d;">
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
                finalColor.red = Math.round(finalColor.red / 2);
                finalColor.green = Math.round(finalColor.green / 2);
                finalColor.blue = Math.round(finalColor.blue / 2);
                document.querySelector('#calendar-events').innerHTML = ` <div class="p-1 m-1" style="background-color: rgb(${finalColor.red}, ${finalColor.green}, ${finalColor.blue});">
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
                        var theStart = ((moment(currentStart).diff(moment(Meta.time), 'minutes') / 60) * 360);
                        var theSize = ((moment(currentEnd).diff(moment(currentStart), 'minutes') / 60) * 360) + 6;
                        data.sectors.push({
                            label: doLabel,
                            start: theStart,
                            size: theSize,
                            color: doColor
                        });
                    } else {
                        var theSize = ((moment(currentEnd).diff(moment(Meta.time), 'minutes') / 60) * 360) + 6;
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
                    var theStart = ((moment(currentStart).diff(moment(Meta.time), 'minutes') / 60) * 360);
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
                    if (!Meta.breakneeded)
                    {
                        var start = moment(Meta.time).add(1, 'hours').startOf('hour');
                        var diff = moment(start).diff(moment(Meta.time), 'minutes');
                        data.sectors.push({
                            label: 'current minute',
                            start: (6 * diff) + 6,
                            size: 15,
                            color: "#FFEB3B"
                        });
                    } else {
                        var start = moment(Meta.time).startOf('hour');
                        var diff = moment(Meta.time).diff(moment(start), 'minutes');
                        data.sectors.push({
                            label: 'current minute',
                            start: 360 - (diff * 6),
                            size: 15,
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

            console.dir(data);

            var sectors = calculateSectors(data);
            var newSVG = document.getElementById("clock-program");
            newSVG.setAttribute("transform", `rotate(${data.start})`);
            console.dir(sectors);
            sectors.map(function (sector) {

                var newSector = document.createElementNS("http://www.w3.org/2000/svg", "path");
                newSector.setAttributeNS(null, 'fill', sector.color);
                newSector.setAttributeNS(null, 'd', 'M' + sector.L + ',' + sector.L + ' L' + sector.L + ',0 A' + sector.L + ',' + sector.L + ' 1 0,1 ' + sector.X + ', ' + sector.Y + ' z');
                newSector.setAttributeNS(null, 'transform', 'rotate(' + sector.R + ', ' + sector.L + ', ' + sector.L + ')');

                newSVG.appendChild(newSector);
            })
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
            recipientIDs.push(`users-u-${recipient.host}`);
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
                    temp.innerHTML += `<div class="p-1 bg-secondary" id="users-g-${key}">
                        <h3 style="text-align: center; font-size: 1em; color: #ECEFF1">${key}</h3>
                    </div>`;
                }
                if (recipients[key].length > 0)
                {
                    recipients[key].forEach(function (recipient) {
                        var temp = document.querySelector(`#users-u-${recipient.host}`);
                        var theClass = 'dark';
                        // Online recipients in wwsu-red color, offline in dark color.
                        switch (recipient.status)
                        {
                            case 1:
                                theClass = 'wwsu-red';
                                break;
                            case 2:
                                theClass = 'wwsu-red';
                                break;
                            case 3:
                                theClass = 'wwsu-red';
                                break;
                            case 4:
                                theClass = 'wwsu-red';
                                break;
                            case 5:
                                theClass = 'wwsu-red';
                                break;
                            default:
                                theClass = 'dark';
                                break;
                        }
                        // Make "Web Public" red if the webchat is enabled.
                        if (recipient.host === 'website' && Meta.webchat)
                            theClass = 'wwsu-red';
                        if (temp !== null)
                        {
                            temp.remove();
                        }
                        temp = document.querySelector(`#users-g-${key}`);
                        // For web visitor recipients, add options for muting or banning
                        if (recipient.group === 'website' && recipient.host !== 'website')
                        {
                            temp.innerHTML += `<div id="users-u-${recipient.host}" class="recipient">
                                <div id="users-b-${recipient.host}" class="p-1 m-1 bg-${theClass} ${activeRecipient === recipient.ID ? 'border border-warning' : ''}" style="cursor: pointer;">
                                                    <div class="container">
  <div class="row">
    <div class="col-9" id="users-c1-${recipient.host}">
      <span id="users-l-${recipient.host}">${recipient.label}</span>
    </div>
    <div class="col-3" id="users-c2-${recipient.host}" style="text-align: center;">
                                                                                <div class="dropdown">
      <span class='close' id="users-o-${recipient.host}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><i class="fas fa-ellipsis-v"></i></span><span class="badge badge-${recipient.unread > 0 ? 'danger' : 'secondary'}" id="users-n-${recipient.host}">${recipient.unread}</span>
                                                                                        <div class="dropdown-menu" aria-labelledby="users-o-${recipient.host}">
                                        <a class="dropdown-item text-warning-dark" data-toggle="dropdown" id="users-o-mute-${recipient.host}">Mute for 24 hours</a>
                                        <a class="dropdown-item text-danger-dark" data-toggle="dropdown" id="users-o-ban-${recipient.host}">Ban indefinitely</a>
                                    </div>
    </div>
  </div>
</div> 
                                </div>
                            </div>
                        </div>`;
                        } else {
                            temp.innerHTML += `<div id="users-u-${recipient.host}" class="recipient">
                                <div id="users-b-${recipient.host}" class="p-1 m-1 bg-${theClass} ${activeRecipient === recipient.ID ? 'border border-warning' : ''}" style="cursor: pointer;">
                                                    <div class="container">
  <div class="row">
    <div class="col-9" id="users-c1-${recipient.host}">
      <span id="users-l-${recipient.host}">${recipient.label}</span>
    </div>
    <div class="col-3" id="users-c2-${recipient.host}" style="text-align: center;">
    <span class="badge badge-${recipient.unread > 0 ? 'danger' : 'secondary'}" id="users-n-${recipient.host}" style="float: right;">${recipient.unread}</span>
    </div>
  </div>
</div> 
                                </div>
                        </div>`;
                        }
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

        var messages = document.querySelector("#messages");
        var messageIDs = [];
        messages.innerHTML = ``;

        Recipients().each(function (recipientb) {
            // Update all the recipients, ensuring only the selected one has a yellow border
            var temp = document.querySelector(`#users-b-${recipientb.host}`);
            if (temp !== null)
            {
                var theClass = 'dark';
                switch (recipientb.status)
                {
                    case 1:
                        theClass = 'wwsu-red';
                        break;
                    case 2:
                        theClass = 'wwsu-red';
                        break;
                    case 3:
                        theClass = 'wwsu-red';
                        break;
                    case 4:
                        theClass = 'wwsu-red';
                        break;
                    case 5:
                        theClass = 'wwsu-red';
                        break;
                    default:
                        theClass = 'dark';
                        break;
                }
                if (recipientb.host === 'website' && Meta.webchat)
                    theClass = 'wwsu-red';
                temp.className = `p-1 m-1 bg-${theClass}`;
            }
        });

        if (recipient === null)
        {
            messages.innerHTML += `<div class="message m-2 bg-danger-dark" style="cursor: pointer;">
                        <div class="m-1">
                            <div>Please click a recipient on the left to view / send messages.</div>
                        </div>
                    </div>`;
            return null;
        }

        var host = Recipients({ID: recipient}).first().host;
        var status = Recipients({ID: recipient}).first().status;
        var label = Recipients({ID: recipient}).first().label;

        var temp = document.querySelector(`#users-b-${host}`);
        if (temp !== null)
        {
            var theClass = 'dark';
            switch (status)
            {
                case 1:
                    theClass = 'wwsu-red';
                    break;
                case 2:
                    theClass = 'wwsu-red';
                    break;
                case 3:
                    theClass = 'wwsu-red';
                    break;
                case 4:
                    theClass = 'wwsu-red';
                    break;
                case 5:
                    theClass = 'wwsu-red';
                    break;
                default:
                    theClass = 'dark';
                    break;
            }
            if (host === 'website' && Meta.webchat)
                theClass = 'wwsu-red';
            temp.className = `p-1 m-1 bg-${theClass} border border-warning`;
        }

        // Add labels at the top of the messages box to explain stuff
        if (recipient === null || typeof host === 'undefined')
        {
            messages.innerHTML += `<div class="m-2 bg-danger-dark" style="cursor: pointer;">
                        <div class="m-1">
                            <div>Please click a recipient on the left to view / send messages.</div>
                        </div>
                    </div>`;
        } else if (host === 'website' && Meta.webchat)
        {
            messages.innerHTML += `<div class="m-2 bg-danger-dark" style="cursor: pointer;">
                        <div class="m-1">
                            <div>You are viewing messages sent publicly from the web. Messages you send will be visible to all web visitors.</div>
                        </div>
                    </div>`;
        } else if (host.startsWith("website-") && Meta.webchat) {
            messages.innerHTML += `<div class="m-2 bg-danger-dark" style="cursor: pointer;">
                        <div class="m-1">
                            <div>You are viewing private messages from ${label}. Messages you send will ONLY be visible by ${label}. This visitor is currently ${status > 0 ? 'online' : 'offline'}.</div>
                        </div>
                    </div>`;
        } else if (host === 'website' && !Meta.webchat)
        {
            messages.innerHTML += `<div class="m-2 bg-dark" style="cursor: pointer;">
                        <div class="m-1">
                            <div>You are viewing messages sent publicly from the web. The web chat is currently disabled. Therefore, web visitors cannot send messages.</div>
                        </div>
                    </div>`;
        } else if (host.startsWith("website-") && !Meta.webchat) {
            messages.innerHTML += `<div class="m-2 bg-dark" style="cursor: pointer;">
                        <div class="m-1">
                            <div>You are viewing private messages from ${label}. The web chat is currently disabled. Therefore, web visitors cannot send messages.</div>
                        </div>
                    </div>`;
        } else {
            messages.innerHTML += `<div class="m-2 bg-danger-dark" style="cursor: pointer;">
                        <div class="m-1">
                            <div>You are viewing messages from the computer ${label}. Messages you send will be delivered to the DJ Controls running on that computer. The DJ controls on this computer is currently ${status > 0 ? 'online' : 'offline'}.</div>
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
        var query = [{from: host, to: os.hostname()}, {from: os.hostname(), to: host}, {from: host, to: 'DJ'}, {from: host, to: 'DJ-private'}];
        if (host === 'website')
        {
            query = [{to: 'DJ'}, {to: 'website'}];
        }

        totalUnread = 0;
        var recipientUnread = {};
        var records = Recipients().get();

        if (records.length > 0)
        {
            records.forEach(function (recipient2) {
                recipientUnread[recipient2.host] = 0;
            });
        }

        records = Messages({needsread: true}).get().sort(compare);
        var unreadIDs = [];

        if (records.length > 0)
        {
            records.forEach(function (message) {
                totalUnread++;
                if (typeof recipientUnread[message.from_real] === 'undefined')
                    recipientUnread[message.from_real] = 0;
                recipientUnread[message.from_real]++;
                unreadIDs.push(`message-n-m-${message.ID}`);

                var temp = document.querySelector(`#message-n-m-${message.ID}`);
                if (temp === null)
                {
                    var temp2 = document.querySelector(`#messages-unread`);
                    temp2.innerHTML += `<div class="m-1 bg-wwsu-red message-n" style="cursor: pointer;" id="message-n-m-${message.ID}">
                                        <span class="close" id="message-n-x-${message.ID}">X</span>
                                        <div class="m-1">
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
        var temp = document.querySelector(`#btn-messenger-unread`);
        temp.className = `notification badge badge-${totalUnread > 0 ? 'danger' : 'secondary'}`;
        temp.innerHTML = totalUnread;
        var records = Messages(query).get().sort(compare);

        if (records.length > 0)
        {
            // Remove messages older than 1 hour
            records.forEach(function (message) {
                if (moment().subtract(1, 'hours').isAfter(moment(message.createdAt)))
                {
                    Messages({ID: message.ID}).remove();
                    return null;
                }

                messageIDs.push(`message-m-${message.ID}`);

                var temp = document.querySelector(`#message-m-${message.ID}`);
                if (temp === null)
                {
                    // Messages from website visitors should offer the options delete message, mute user, or ban user.
                    if (message.from.startsWith("website-"))
                    {
                        var temp2 = document.querySelector(`#message-m-${message.ID}`);
                        if (temp2 === null)
                        {
                            messages.innerHTML += `<div class="message m-2 bg-${message.needsread ? 'wwsu-red' : 'dark'}" id="message-m-${message.ID}" style="cursor: pointer;">
                        <div class="m-1">
                              <div class="row">
    <div class="col-10" id="message-c1-${message.ID}">
                            <div id="message-t-${message.ID}">${message.message}</div>
                            <div style="font-size: 0.66em;" id="message-b-${message.ID}">${moment(message.createdAt).format("hh:mm A")} by ${message.from_friendly} ${(message.to === 'DJ-private') ? ' for DJ (Private)' : ` for ${message.to_friendly}`}</div>
    </div>
    <div class="col-2" id="message-c2-${message.ID}" style="text-align: center;">
<div class="dropdown">
                                <span class='close' id="message-o-${message.ID}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><i class="fas fa-ellipsis-v"></i></span>
                                <div class="dropdown-menu" aria-labelledby="message-o-${message.ID}">
                                    <a class="dropdown-item text-primary" data-toggle="dropdown" id="message-o-delete-${message.ID}">Delete Message</a>
                                    <a class="dropdown-item text-warning-dark" data-toggle="dropdown" id="message-o-mute-${message.ID}">Mute for 24 hours</a>
                                    <a class="dropdown-item text-danger-dark" data-toggle="dropdown" id="message-o-ban-${message.ID}">Ban indefinitely</a>
                                </div>
                            </div>
    </div>
  </div>
</div> 
                        </div>
                    </div>`;
                        } else {
                            temp2.className = `message m-2 bg-${message.needsread ? 'wwsu-red' : 'dark'}`;
                            var temp3 = document.querySelector(`#message-t-${message.ID}`);
                            temp3.innerHTML = message.message;
                            var temp3 = document.querySelector(`#message-b-${message.ID}`);
                            temp3.innerHTML = `${moment(message.createdAt).format("hh:mm A")} by ${message.from_friendly} ${(message.to === 'DJ-private') ? '(Private)' : ''}`;
                        }
                        // All other messages should just offer delete message as an option
                    } else {
                        var temp2 = document.querySelector(`#message-m-${message.ID}`);
                        if (temp2 === null)
                        {
                            messages.innerHTML += `<div class="message m-2 bg-${message.needsread ? 'wwsu-red' : 'dark'}" id="message-m-${message.ID}" style="cursor: pointer;">
                        <div class="m-1">
                              <div class="row">
    <div class="col-10" id="message-c1-${message.ID}">
                            <div id="message-t-${message.ID}">${message.message}</div>
                            <div style="font-size: 0.66em;" id="message-b-${message.ID}">${moment(message.createdAt).format("hh:mm A")} by ${message.from_friendly} ${(message.to === 'DJ-private') ? ' for DJ (Private)' : ` for ${message.to_friendly}`}</div>
    </div>
    <div class="col-2" id="message-c2-${message.ID}" style="text-align: center;">
<div class="dropdown">
                                <span class='close' id="message-o-${message.ID}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><i class="fas fa-ellipsis-v"></i></span>
                                <div class="dropdown-menu" aria-labelledby="message-o-${message.ID}">
                                    <a class="dropdown-item text-primary" data-toggle="dropdown" id="message-o-delete-${message.ID}">Delete Message</a>
                                </div>
                            </div>
    </div>
  </div>
</div> 
                        </div>
                    </div>`;
                        } else {
                            temp2.className = `message m-2 bg-${message.needsread ? 'wwsu-red' : 'dark'}`;
                            var temp3 = document.querySelector(`#message-t-${message.ID}`);
                            temp3.innerHTML = message.message;
                            var temp3 = document.querySelector(`#message-b-${message.ID}`);
                            temp3.innerHTML = `${moment(message.createdAt).format("hh:mm A")} by ${message.from_friendly} ${(message.to === 'DJ-private') ? ' for DJ (Private)' : ` for ${message.to_friendly}`}`;
                        }
                    }
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
    nodeRequest({method: 'POST', url: nodeURL + '/messages/remove', data: {ID: message}}, function (response) {
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
        }
        console.log(JSON.stringify(response));
    });
}

// Prompt the user to confirm a mute when they ask to mute someone
function prepareMute(recipient) {
    try {
        var label = Recipients({ID: recipient}).first().label;
        iziToast.show({
            title: `Confirm mute of ${label}`,
            message: `Muting this person will cause them to lose access to WWSU for 24 hours. Only mute people causing a legitimate annoyance.`,
            timeout: 60000,
            close: true,
            color: 'yellow',
            drag: false,
            position: 'center',
            closeOnClick: false,
            overlay: true,
            zindex: 1000,
            buttons: [
                ['<button>Mute</button>', function (instance, toast, button, e, inputs) {
                        finishMute(recipient);
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

        iziToast.show({
            title: `Confirm ban of ${label}`,
            message: `Muting this person will cause them to lose access to WWSU indefinitely. Only ban people who are seriously threatening your or WWSU's safety or integrity.`,
            timeout: 60000,
            close: true,
            color: 'yellow',
            drag: false,
            position: 'center',
            closeOnClick: false,
            overlay: true,
            zindex: 1000,
            buttons: [
                ['<button>Ban</button>', function (instance, toast, button, e, inputs) {
                        finishBan(recipient);
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
function finishMute(recipient) {
    try {
        var host = Recipients({ID: recipient}).first().host;
        nodeRequest({method: 'POST', url: nodeURL + '/discipline/ban-day', data: {host: host}}, function (response) {
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
function finishBan(recipient) {
    try {
        var host = Recipients({ID: recipient}).first().host;
        nodeRequest({method: 'POST', url: nodeURL + '/discipline/ban-indefinite', data: {host: host}}, function (response) {
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
        nodeRequest({method: 'POST', url: nodeURL + '/announcements/remove', data: {ID: ID}}, function (response) {
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
    nodeRequest({method: 'POST', url: nodeURL + '/state/return'}, function (response) {
        console.log(JSON.stringify(response));
    });
}

function queuePSA(duration) {
    nodeRequest({method: 'POST', url: nodeURL + '/songs/queue-psa', data: {duration: duration}}, function (response) {
        console.log(JSON.stringify(response));
    });
}

function prepareLive() {
    document.querySelector("#live-handle").value = '';
    document.querySelector("#live-show").value = '';
    document.querySelector("#live-topic").value = '';
    document.querySelector("#live-noschedule").style.display = "inline";
    document.querySelector("#live-webchat").checked = true;
    // Auto-fill show host and name if one is scheduled to go on
    if (calType === 'Show')
    {
        document.querySelector("#live-handle").value = calHost;
        document.querySelector("#live-show").value = calShow;
        document.querySelector("#live-noschedule").style.display = "none";
    }
    $("#go-live-modal").iziModal('open');
}

function goLive() {
    nodeRequest({method: 'post', url: nodeURL + '/state/live', data: {showname: document.querySelector('#live-handle').value + ' - ' + document.querySelector('#live-show').value, topic: document.querySelector('#live-topic').value, djcontrols: os.hostname(), webchat: document.querySelector('#live-webchat').checked}}, function (response) {
        if (response === 'OK')
        {
            $("#go-live-modal").iziModal('close');
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Cannot go live at this time. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        }
        console.log(JSON.stringify(response));
    });
}

function prepareRemote() {
    document.querySelector("#remote-handle").value = '';
    document.querySelector("#remote-show").value = '';
    document.querySelector("#remote-topic").value = '';
    document.querySelector("#remote-noschedule").style.display = "inline";
    document.querySelector("#remote-webchat").checked = true;
    // Auto fill remote host and show if one is scheduled to go on
    if (calType === 'Remote')
    {
        document.querySelector("#remote-handle").value = calHost;
        document.querySelector("#remote-show").value = calShow;
        document.querySelector("#remote-noschedule").style.display = "none";
    }
    $("#go-remote-modal").iziModal('open');
}

function goRemote() {
    nodeRequest({method: 'POST', url: nodeURL + '/state/remote', data: {showname: document.querySelector('#remote-handle').value + ' - ' + document.querySelector('#remote-show').value, topic: document.querySelector('#remote-topic').value, djcontrols: os.hostname(), webchat: document.querySelector('#remote-webchat').checked}}, function (response) {
        if (response === 'OK')
        {
            $("#go-remote-modal").iziModal('close');
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Cannot go remote at this time. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        }
        console.log(JSON.stringify(response));
    });
}

function prepareSports() {
    document.querySelector('#sports-sport').value = "";
    document.querySelector("#sports-noschedule").style.display = "inline";
    document.querySelector("#sports-remote").checked = false;
    document.querySelector("#sports-webchat").checked = true;
    // Auto fill the sport dropdown if a sport is scheduled
    if (calType === 'Sports')
    {
        document.querySelector("#sports-sport").value = calShow;
        document.querySelector("#sports-noschedule").style.display = "none";
    }
    $("#go-sports-modal").iziModal('open');
}

function goSports() {
    var sportsOptions = document.getElementById('sports-sport');
    var selectedOption = sportsOptions.options[sportsOptions.selectedIndex].value;
    nodeRequest({method: 'POST', url: nodeURL + '/state/sports', data: {sport: selectedOption, remote: document.querySelector('#sports-remote').checked, djcontrols: os.hostname(), webchat: document.querySelector('#sports-webchat').checked}}, function (response) {
        if (response === 'OK')
        {
            $("#go-sports-modal").iziModal('close');
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Cannot go to sports broadcast at this time. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        }
        console.log(JSON.stringify(response));
    });
}

function prepareLog() {
    document.querySelector("#log-datetime").value = moment(Meta.time).format("MM/DD/YYYY HH:mm:ss");
    document.querySelector("#log-artist").value = '';
    document.querySelector("#log-title").value = '';
    document.querySelector("#log-album").value = '';
    document.querySelector("#log-label").value = '';
    $("#log-modal").iziModal('open');
}

function saveLog() {
    var thelog = 'DJ/Producer played a track.';
    var dateObject = moment(document.querySelector("#log-datetime").value);
    nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'manual', logsubtype: Meta.dj, loglevel: 'info', event: thelog, trackArtist: document.querySelector("#log-artist").value, trackTitle: document.querySelector("#log-title").value, trackAlbum: document.querySelector("#log-album").value, trackLabel: document.querySelector("#log-label").value, date: dateObject.toISOString()}}, function (response) {
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
                    title: `Let me know when you finished playing this track:`,
                    message: `${document.querySelector("#log-artist").value} - ${document.querySelector("#log-title").value}`,
                    timeout: 600000,
                    close: false,
                    color: 'yellow',
                    drag: false,
                    position: 'bottomCenter',
                    closeOnClick: false,
                    overlay: false,
                    buttons: [
                        ['<button>Playing another track</button>', function (instance, toast, button, e, inputs) {
                                prepareLog();
                                instance.hide({}, toast, 'button');
                            }],
                        ['<button>Not playing any tracks</button>', function (instance, toast, button, e, inputs) {
                                nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'manual', logsubtype: Meta.dj, loglevel: 'info', event: 'DJ/Producer finished playing music.', trackArtist: '', trackTitle: '', trackAlbum: '', trackLabel: '', date: moment().toISOString(true)}}, function (response) {});
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
    nodeRequest({method: 'POST', url: nodeURL + '/announcements/add', data: {type: 'djcontrols', level: 'danger', announcement: `<strong>Problem reported by ${Meta.dj}</strong>: ${document.querySelector("#emergency-issue").value}`}}, function (response) {
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
    nodeRequest({method: 'POST', url: nodeURL + '/messages/send', data: {from: os.hostname(), to: `display-public`, to_friendly: `Display (Public)`, message: document.querySelector("#display-message").value}}, function (response) {
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
        }
        console.log(JSON.stringify(response));
    });
}

function endShow() {
    nodeRequest({method: 'POST', url: nodeURL + '/state/automation'}, function (response) {
        if (typeof response.showTime === 'undefined')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to end your broadcast. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        } else {
            $("#xp-modal").iziModal('open');
            document.querySelector(`#stat-showTime`).innerHTML = moment.duration(response.showTime || 0, "minutes").format();
            document.querySelector(`#stat-showXP`).innerHTML = response.showXP || 0;
            document.querySelector(`#stat-listenerMinutes`).innerHTML = moment.duration(response.listenerMinutes || 0, "minutes").format();
            document.querySelector(`#stat-listenerXP`).innerHTML = response.listenerXP || 0;
            document.querySelector(`#stat-messagesWeb`).innerHTML = response.messagesWeb || 0;
            document.querySelector(`#stat-messagesXP`).innerHTML = response.messagesXP || 0;
            document.querySelector(`#stat-topAdds`).innerHTML = response.topAdds || 0;
            document.querySelector(`#stat-topAddsXP`).innerHTML = response.topAddsXP || 0;
            document.querySelector(`#stat-IDsXP`).innerHTML = response.IDsXP || 0;
            document.querySelector(`#stat-subtotalXP`).innerHTML = response.subtotalXP || 0;
            document.querySelector(`#stat-totalXP`).innerHTML = response.totalXP || 0;
        }
        console.log(JSON.stringify(response));
    });
}

function switchShow() {
    nodeRequest({method: 'POST', url: nodeURL + '/state/automation', data: {transition: true}}, function (response) {
        if (typeof response.showTime === 'undefined')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to end your broadcast. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        } else {
            $("#xp-modal").iziModal('open');
            document.querySelector(`#stat-showTime`).innerHTML = moment.duration(response.showTime || 0, "minutes").format();
            document.querySelector(`#stat-showXP`).innerHTML = response.showXP || 0;
            document.querySelector(`#stat-listenerMinutes`).innerHTML = moment.duration(response.listenerMinutes || 0, "minutes").format();
            document.querySelector(`#stat-listenerXP`).innerHTML = response.listenerXP || 0;
            document.querySelector(`#stat-messagesWeb`).innerHTML = response.messagesWeb || 0;
            document.querySelector(`#stat-messagesXP`).innerHTML = response.messagesXP || 0;
            document.querySelector(`#stat-topAdds`).innerHTML = response.topAdds || 0;
            document.querySelector(`#stat-topAddsXP`).innerHTML = response.topAddsXP || 0;
            document.querySelector(`#stat-IDsXP`).innerHTML = response.IDsXP || 0;
            document.querySelector(`#stat-subtotalXP`).innerHTML = response.subtotalXP || 0;
            document.querySelector(`#stat-totalXP`).innerHTML = response.totalXP || 0;
        }
        console.log(JSON.stringify(response));
    });
}

function goBreak(halftime) {
    nodeRequest({method: 'POST', url: nodeURL + '/state/break', data: {halftime: halftime}}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to go into break. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        }
        console.log(JSON.stringify(response));
    });
}

function playTopAdd() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Queuing/playing Top Add';
    nodeRequest({method: 'POST', url: nodeURL + '/songs/queue-add'}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to play a Top Add. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        }
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

function playLiner() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Queuing/playing Liner';
    nodeRequest({method: 'POST', url: nodeURL + '/songs/queue-liner'}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to play a liner. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        }
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
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


            // Add Eas-based announcements
            if (data.length > 0)
            {
                data.forEach(function (datum) {
                    var className = 'secondary';
                    if (datum.severity === 'Extreme')
                    {
                        className = 'danger';
                    } else if (datum.severity === 'Severe')
                    {
                        className = 'urgent';
                    } else if (datum.severity === 'Moderate')
                    {
                        className = 'warning';
                    } else {
                        className = 'info';
                    }
                    if (document.querySelector(`#attn-eas-${datum.ID}`) === null)
                    {
                        var attn = document.querySelector("#announcements-body");
                        attn.innerHTML += `<div class="attn-eas attn-eas-${datum.severity} alert alert-${className}" id="attn-eas-${datum.ID}" role="alert">
                        <i class="fas fa-bolt"></i> <strong>${datum.alert}</strong> in effect for the counties ${datum.counties}.
                    </div>`;
                    } else {
                        var temp = document.querySelector(`#attn-eas-${datum.ID}`);
                        temp.className = `attn-eas attn-eas-${datum.severity} alert alert-${className}`;
                        temp.innerHTML = `<i class="fas fa-bolt"></i> <strong>${datum.alert}</strong> in effect for the counties ${datum.counties}.`;
                    }
                });
            }

            // Remove all Eas announcements no longer valid
            var prev2 = Eas().select("ID");
            var attn = document.querySelectorAll(".attn-eas");
            for (var i = 0; i < attn.length; i++) {
                if (prev2.indexOf(attn[i].id) === -1)
                    attn[i].parentNode.removeChild(attn[i]);
            }

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
                                title: '<i class="fas fa-bolt"></i> Extreme weather alert in effect',
                                message: `A ${record.alert} is in effect for the counties of ${record.counties}. You may wish to consider ending the show early and taking shelter. If so, click "End Show" when ready to end. Otherwise, close this notification.`,
                                timeout: 900000,
                                close: true,
                                color: 'red',
                                drag: false,
                                position: 'center',
                                closeOnClick: false,
                                overlay: true,
                                zindex: 500,
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
                                title: '<i class="fas fa-bolt"></i> Extreme weather alert in effect',
                                message: `A ${record.alert} is in effect for the counties of ${record.counties}. You may wish to decide against hosting any shows at this time and instead seeking shelter.`,
                                timeout: 900000,
                                close: true,
                                color: 'red',
                                drag: false,
                                position: 'center',
                                closeOnClick: true,
                                overlay: true,
                                zindex: 500
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
                            title: '<i class="fas fa-bolt"></i> Severe weather alert in effect',
                            message: `A ${record.alert} is in effect for the counties of ${record.counties}. Please keep an eye on the weather.`,
                            timeout: 900000,
                            close: true,
                            color: 'yellow',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: true,
                            zindex: 250
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
                                var attn = document.querySelector("#announcements-body");
                                attn.innerHTML += `<div class="attn-eas attn-eas-${data[key].severity} alert alert-${className}" id="attn-eas-${data[key].ID}" role="alert">
                        <i class="fas fa-bolt"></i> <strong>${data[key].alert}</strong> in effect for the counties ${data[key].counties}.
                    </div>`;
                            } else {
                                var temp = document.querySelector(`#attn-eas-${data[key].ID}`);
                                temp.className = `attn-eas attn-eas-${data[key].severity} alert alert-${className}`;
                                temp.innerHTML = `<i class="fas fa-bolt"></i> <strong>${data[key].alert}</strong> in effect for the counties ${data[key].counties}.`;
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
                                        title: '<i class="fas fa-bolt"></i> Extreme weather alert in effect',
                                        message: `A ${data[key].alert} is in effect for the counties of ${data[key].counties}. You may wish to consider ending the show early and taking shelter. If so, click "End Show" when ready to end. Otherwise, close this notification.`,
                                        timeout: 900000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: false,
                                        overlay: true,
                                        zindex: 500,
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
                                        title: '<i class="fas fa-bolt"></i> Extreme weather alert in effect',
                                        message: `A ${data[key].alert} is in effect for the counties of ${data[key].counties}. You may wish to decide against hosting any shows at this time and instead seeking shelter.`,
                                        timeout: 900000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: true,
                                        overlay: true,
                                        zindex: 500
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
                                    title: '<i class="fas fa-bolt"></i> Severe weather alert in effect',
                                    message: `A ${data[key].alert} is in effect for the counties of ${data[key].counties}. Please keep an eye on the weather.`,
                                    timeout: 900000,
                                    close: true,
                                    color: 'yellow',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: true,
                                    zindex: 250
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
                                var attn = document.querySelector("#announcements-body");
                                attn.innerHTML += `<div class="attn-eas attn-eas-${data[key].severity} alert alert-${className}" id="attn-eas-${data[key].ID}" role="alert">
                        <i class="fas fa-bolt"></i> <strong>${data[key].alert}</strong> in effect for the counties ${data[key].counties}.
                    </div>`;
                            } else {
                                var temp = document.querySelector(`#attn-eas-${data[key].ID}`);
                                temp.className = `attn-eas attn-eas-${data[key].severity} alert alert-${className}`;
                                temp.innerHTML = `<i class="fas fa-bolt"></i> <strong>${data[key].alert}</strong> in effect for the counties ${data[key].counties}.`;
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
    console.dir(data);
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
                data.forEach(function (datum) {
                    var className = 'secondary';
                    if (datum.status === 1)
                    {
                        className = 'danger';
                    } else if (datum.status === 2)
                    {
                        className = 'urgent';
                    } else if (datum.status === 3)
                    {
                        className = 'warning';
                    } else {
                        return null;
                    }
                    if (document.querySelector(`#attn-status-${datum.name}`) === null)
                    {
                        prev.push(`attn-status-${datum.name}`);
                        var attn = document.querySelector("#announcements-body");
                        attn.innerHTML += `<div class="attn-status attn-status-${datum.status} alert alert-${className}" id="attn-status-${datum.name}" role="alert">
                        <i class="fas fa-server"></i> <strong>${datum.label}</strong> is reporting a problem: ${datum.data}
                    </div>`;
                        if (client.emergencies && datum.status < 3)
                        {
                            var notification = notifier.notify('System Problem', {
                                message: `${datum.label} reports a significant issue. Please see DJ Controls.`,
                                icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                                duration: (1000 * 60 * 60 * 24),
                            });
                            main.flashTaskbar();
                        }
                    } else {
                        prev.push(`attn-status-${datum.name}`);
                        var temp = document.querySelector(`#attn-status-${datum.name}`);
                        temp.className = `attn-status attn-status-${datum.status} alert alert-${className}`;
                        temp.innerHTML = `<i class="fas fa-server"></i ><strong>${datum.label}</strong> is reporting a problem: ${datum.data}`;
                    }
                    if (datum.name === 'silence' && datum.status <= 3)
                    {
                        iziToast.show({
                            title: '<i class="fas fa-volume-off"></i> Silence / Low Audio detected!',
                            message: `Silence / low audio was detected. Please check your audio levels. The Silence entry in the Announcements box will disappear when audio levels are acceptable again. NOTE: Silence detection is delayed based off of the delay system.`,
                            timeout: 60000,
                            close: true,
                            color: 'red',
                            drag: false,
                            position: 'center',
                            closeOnClick: true,
                            overlay: true,
                            zindex: 500
                        });
                        var notification = notifier.notify('Low / No Audio Detected', {
                            message: `Please check your audio levels to see if they are okay.`,
                            icon: 'http://pluspng.com/img-png/mute-png-noun-project-200.png',
                            duration: 60000,
                        });
                        main.flashTaskbar();
                    }
                });
            }

            // Remove all Status announcements no longer valid

            // Remove announcements no longer valid
            var attn = document.querySelectorAll(".attn-status");
            for (var i = 0; i < attn.length; i++) {
                if (prev.indexOf(attn[i].id) === -1)
                    attn[i].parentNode.removeChild(attn[i]);
            }

        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Status.insert(data[key]);
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
                            } else {
                                continue;
                            }
                            if (document.querySelector(`#attn-status-${data[key].name}`) === null)
                            {
                                var attn = document.querySelector("#announcements-body");
                                attn.innerHTML += `<div class="attn-status attn-status-${data[key].status} alert alert-${className}" id="attn-status-${data[key].name}" role="alert">
                        <i class="fas fa-server"></i> <strong>${data[key].label}</strong> is reporting a problem: ${data[key].data}
                    </div>`;
                                if (client.emergencies && data[key].status < 3)
                                {
                                    var notification = notifier.notify('System Problem', {
                                        message: `${data[key].label} reports a significant issue. Please see DJ Controls.`,
                                        icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                                        duration: (1000 * 60 * 60 * 24),
                                    });
                                    main.flashTaskbar();
                                }
                            } else {
                                var temp = document.querySelector(`#attn-status-${data[key].name}`);
                                temp.className = `attn-status attn-status-${data[key].status} alert alert-${className}`;
                                temp.innerHTML = `<i class="fas fa-server"></i> <strong>${data[key].label}</strong> is reporting a problem: ${data[key].data}`;
                            }
                            if (data[key].name === 'silence' && data[key].status <= 3)
                            {
                                iziToast.show({
                                    title: '<i class="fas fa-volume-off"></i> Silence / Low Audio detected!',
                                    message: `Silence / low audio was detected. Please check your audio levels. The Silence entry in the Announcements box will disappear when audio levels are acceptable again. NOTE: Silence detection is on a delay according to the delay system.`,
                                    timeout: 60000,
                                    close: true,
                                    color: 'red',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: true,
                                    zindex: 500
                                });
                                var notification = notifier.notify('Low / No Audio Detected', {
                                    message: `Please check your audio levels to see if they are okay.`,
                                    icon: 'http://pluspng.com/img-png/mute-png-noun-project-200.png',
                                    duration: 60000,
                                });
                                main.flashTaskbar();
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
                            } else {
                                var attn = document.querySelector(`#attn-status-${data[key].name}`);
                                if (attn !== null)
                                    attn.parentNode.removeChild(attn);
                                continue;
                            }
                            if (document.querySelector(`#attn-status-${data[key].name}`) === null)
                            {
                                var attn = document.querySelector("#announcements-body");
                                attn.innerHTML += `<div class="attn-status attn-status-${data[key].status} alert alert-${className}" id="attn-status-${data[key].name}" role="alert">
                        <i class="fas fa-server"></i> <strong>${data[key].label}</strong> is reporting a problem: ${data[key].data}
                    </div>`;
                                if (client.emergencies && data[key].status < 3)
                                {
                                    var notification = notifier.notify('System Problem', {
                                        message: `${data[key].label} reports a significant issue. Please see DJ Controls.`,
                                        icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                                        duration: (1000 * 60 * 60 * 24),
                                    });
                                    main.flashTaskbar();
                                }
                            } else {
                                var temp = document.querySelector(`#attn-status-${data[key].name}`);
                                temp.className = `attn-status attn-status-${data[key].status} alert alert-${className}`;
                                temp.innerHTML = `<i class="fas fa-server"></i> <strong>${data[key].label}</strong> is reporting a problem: ${data[key].data}`;
                            }
                            if (data[key].name === 'silence' && data[key].status <= 3)
                            {
                                iziToast.show({
                                    title: '<i class="fas fa-volume-off"></i> Silence / Low Audio detected!',
                                    message: `Silence / low audio was detected. Please check your audio levels. The Silence entry in the Announcements box will disappear when audio levels are acceptable again. NOTE: Silence detection is on a delay according to the delay system.`,
                                    timeout: 60000,
                                    close: true,
                                    color: 'red',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: true,
                                    overlay: true,
                                    zindex: 500
                                });
                                var notification = notifier.notify('Low / No Audio Detected', {
                                    message: `Please check your audio levels to see if they are okay.`,
                                    icon: 'http://pluspng.com/img-png/mute-png-noun-project-200.png',
                                    duration: 60000,
                                });
                                main.flashTaskbar();
                            }
                            break;
                        case 'remove':
                            Status({ID: data[key]}).remove();
                            var attn = document.querySelector(`#attn-status-${data[key].name}`);
                            if (attn !== null)
                                attn.parentNode.removeChild(attn);
                            break;
                    }
                }
            }
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

        checkCalendar();

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
            Recipients = TAFFY();

            if (data.length > 0)
            {
                data.forEach(function (datum, index) {
                    data[index].unread = 0;
                });
            }

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
                            break;
                        case 'update':
                            data[key].unread = 0;
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

                data.forEach(function (datum, index) {
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
                                    iziToast.show({
                                        title: '<i class="fas fa-exclamation-triangle"></i> Technical issue reported!',
                                        message: `${datum.message}`,
                                        timeout: false,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: false,
                                        overlay: true,
                                        zindex: 250
                                    });
                                    var notification = notifier.notify('Problem Reported', {
                                        message: `A problem was reported. Please see DJ Controls.`,
                                        icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                                        duration: (1000 * 60 * 60 * 24),
                                    });
                                    main.flashTaskbar();
                                }
                                break;
                            case os.hostname():
                            case 'all':
                                var notification = notifier.notify('New Message', {
                                    message: `You have a new message from ${datum.from_friendly} (see DJ Controls).`,
                                    icon: 'https://images.vexels.com/media/users/3/136398/isolated/preview/b682d2f42a8d5d26e484abff38f92e78-flat-message-icon-by-vexels.png',
                                    duration: 30000,
                                });
                                main.flashTaskbar();
                                iziToast.show({
                                    title: `<i class="fas fa-comments"></i> Message from ${datum.from_friendly}`,
                                    message: `${datum.message}`,
                                    timeout: 30000,
                                    close: true,
                                    color: 'yellow',
                                    drag: false,
                                    position: 'bottomCenter',
                                    closeOnClick: false,
                                    overlay: false,
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
                                if (typeof Meta.state !== 'undefined' && ((Meta.state.includes("automation_") && client.webmessages) || (!Meta.state.includes("automation_") && typeof Meta.djcontrols !== 'undefined' && Meta.djcontrols === os.hostname())))
                                {
                                    var notification = notifier.notify('New Web Message', {
                                        message: `You have a new web message from ${datum.from_friendly} (see DJ Controls).`,
                                        icon: 'https://images.vexels.com/media/users/3/136398/isolated/preview/b682d2f42a8d5d26e484abff38f92e78-flat-message-icon-by-vexels.png',
                                        duration: 30000,
                                    });
                                    main.flashTaskbar();
                                    iziToast.show({
                                        title: `<i class="fas fa-comments"></i> Web message from ${datum.from_friendly}`,
                                        message: `${datum.message}`,
                                        timeout: 30000,
                                        close: true,
                                        color: 'green',
                                        drag: false,
                                        position: 'bottomCenter',
                                        closeOnClick: false,
                                        overlay: false,
                                        buttons: [
                                            ['<button>View / Reply</button>', function (instance, toast, button, e, inputs) {
                                                    $("#messages-modal").iziModal('open');
                                                    var host = (datum.to === 'DJ' ? 'website' : datum.from);
                                                    selectRecipient(Recipients({host: host}).first().ID || null);
                                                    instance.hide({}, toast, 'button');
                                                }]
                                        ]
                                    });
                                }
                                data[index].needsread = true;
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
                                        iziToast.show({
                                            title: '<i class="fas fa-exclamation-triangle"></i> Technical issue reported!',
                                            message: `${data[key].message}`,
                                            timeout: false,
                                            close: true,
                                            color: 'red',
                                            drag: false,
                                            position: 'center',
                                            closeOnClick: false,
                                            overlay: true,
                                            zindex: 250
                                        });
                                        var notification = notifier.notify('Problem Reported', {
                                            message: `A problem was reported. Please see DJ Controls.`,
                                            icon: 'https://freeiconshop.com/wp-content/uploads/edd/error-flat.png',
                                            duration: (1000 * 60 * 60 * 24),
                                        });
                                        main.flashTaskbar();
                                    }
                                    break;
                                case os.hostname():
                                case 'all':
                                    var notification = notifier.notify('New Message', {
                                        message: `You have a new message from ${data[key].from_friendly} (see DJ Controls).`,
                                        icon: 'https://images.vexels.com/media/users/3/136398/isolated/preview/b682d2f42a8d5d26e484abff38f92e78-flat-message-icon-by-vexels.png',
                                        duration: 30000,
                                    });
                                    main.flashTaskbar();
                                    iziToast.show({
                                        title: `<i class="fas fa-comments"></i> Message from ${data[key].from_friendly}`,
                                        message: `${data[key].message}`,
                                        timeout: 30000,
                                        close: true,
                                        color: 'yellow',
                                        drag: false,
                                        position: 'bottomCenter',
                                        closeOnClick: false,
                                        overlay: false,
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
                                    if (typeof Meta.state !== 'undefined' && ((Meta.state.includes("automation_") && client.webmessages) || (!Meta.state.includes("automation_") && typeof Meta.djcontrols !== 'undefined' && Meta.djcontrols === os.hostname())))
                                    {
                                        var notification = notifier.notify('New Web Message', {
                                            message: `You have a new web message from ${data[key].from_friendly} (see DJ Controls).`,
                                            icon: 'https://images.vexels.com/media/users/3/136398/isolated/preview/b682d2f42a8d5d26e484abff38f92e78-flat-message-icon-by-vexels.png',
                                            duration: 30000,
                                        });
                                        main.flashTaskbar();
                                        iziToast.show({
                                            title: `<i class="fas fa-comments"></i> Web message from ${data[key].from_friendly}`,
                                            message: `${data[key].message}`,
                                            timeout: 30000,
                                            close: true,
                                            color: 'green',
                                            drag: false,
                                            position: 'bottomCenter',
                                            closeOnClick: false,
                                            overlay: false,
                                            buttons: [
                                                ['<button>View / Reply</button>', function (instance, toast, button, e, inputs) {
                                                        $("#messages-modal").iziModal('open');
                                                        var host = (data[key].to === 'DJ' ? 'website' : data[key].from);
                                                        selectRecipient(Recipients({host: host}).first().ID || null);
                                                        instance.hide({}, toast, 'button');
                                                    }]
                                            ]
                                        });
                                    }
                                    data[key].needsread = true;
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
    /*
     // Data processing
     try {
     if (replace)
     {
     
     var prev = [];
     // Get all the requests currently in memory
     Requests.find({}, {ID: 1}, function (err, requestO) {
     
     requestO.forEach(function (record) {
     prev.push(record.ID);
     });
     
     // Notify on new requests
     data.forEach(function (datum, index) {
     data[index].needsread = false;
     if (prev.indexOf(datum.ID === -1))
     {
     if (typeof Meta.state !== 'undefined' && ((Meta.state.includes("automation_") && client.requests) || (!Meta.state.includes("automation_") && typeof Meta.djcontrols !== 'undefined' && Meta.djcontrols === thishost)))
     {
     data[index].needsread = true;
     exports.addNotification({
     title: 'Track Requested',
     message: `A track was requested: ${datum.trackname}. See DJ Controls messages for more info / to play the request.`,
     duration: 10000,
     priority: 3,
     icon: 'request.png',
     time: moment()
     });
     }
     }
     });
     
     // Replace the data
     Requests = new Datastore();
     Requests.insert(data);
     });
     
     } else {
     for (var key in data)
     {
     if (data.hasOwnProperty(key))
     {
     switch (key)
     {
     case 'insert':
     data[key].needsread = false;
     if (typeof Meta.state !== 'undefined' && ((Meta.state.includes("automation_") && client.requests) || (!Meta.state.includes("automation_") && typeof Meta.djcontrols !== 'undefined' && Meta.djcontrols === thishost)))
     {
     data[key].needsread = true;
     exports.addNotification({
     title: 'Track Requested',
     message: `A track was requested: ${data[key].trackname}. See DJ Controls messages for more info / to play the request.`,
     duration: 10000,
     priority: 3,
     icon: 'request.png',
     time: moment()
     });
     }
     Requests.insert(data[key]);
     break;
     case 'update':
     Requests.update({ID: data[key].ID}, data[key], {multi: true});
     break;
     case 'remove':
     Requests.remove({ID: data[key]}, {multi: true});
     break;
     }
     }
     }
     }
     sendToRenderer();
     } catch (e) {
     console.error(e);
     }
     */
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

    var l = data.size / 2
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
            console.log(`a: ${a}`);
            aCalc = (a > 180) ? 180 : a;
            console.log(`aCalc: ${aCalc}`);
            aRad = aCalc * Math.PI / 180;
            console.log(`aRad: ${aRad}`);
            console.log(`cos: ${Math.sqrt(2 * 80 * 80 - (2 * 80 * 80 * 0.5))}`);
            z = Math.sqrt(2 * l * l - (2 * l * l * Math.cos(aRad)));
            console.log(`z: ${z}`);
            if (aCalc <= 90) {
                x = l * Math.sin(aRad);
            } else {
                x = l * Math.sin((180 - aCalc) * Math.PI / 180);
            }
            console.log(`x: ${x}`);

            y = Math.sqrt(z * z - x * x);
            Y = y;
            console.log(`Y: ${Y}`);

            if (a <= 180) {
                X = l + x;
                arcSweep = 0;
            } else {
                X = l - x;
                arcSweep = 1;
            }
            console.log(`X: ${X}`);
            console.log(`arcSweep: ${arcSweep}`);

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


    return sectors
}