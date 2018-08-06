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
        if (hoursC !== (hours + (Math.floor(minutes / 15) / 4)))
        {
            var containers = document.querySelectorAll('.hours-container');
            if (containers)
            {
                for (var i = 0; i < containers.length; i++) {
                    if (containers[i].angle === undefined) {
                        containers[i].angle = 7.5;
                    } else {
                        containers[i].angle += 7.5;
                    }
                    containers[i].style.webkitTransform = 'rotateZ(' + containers[i].angle + 'deg)';
                    containers[i].style.transform = 'rotateZ(' + containers[i].angle + 'deg)';
                }
                hoursC = hoursC + 0.25;
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
                                                    nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'operation', logsubtype: 'automation', loglevel: 'info', event: `A recording was started in ${recordPath}\\automation\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
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
    var tokens = JSON.parse(fs.readFileSync("tokens.json"));

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
        message: 'Error occurred when trying to load initial variables.'
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
                duration: 60000,
                buttons: ["Close"]
            });
            notification.on('buttonClicked', (text, buttonIndex, options) => {
                notification.close();
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
            message: 'Error occurred in the connect event.'
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
                } else if (data[key].includes("_break") || data[key].includes("_returning"))
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
                                        nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'operation', logsubtype: (startRecording === 'automation' ? 'automation' : Meta.dj), loglevel: 'info', event: `A recording was started in ${recordPath}\\${startRecording}\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
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

document.querySelector("#btn-return").onclick = function () {
    returnBreak();
};

document.querySelector("#btn-psa15").onclick = function () {
    queuePSA(15);
};

document.querySelector("#btn-psa30").onclick = function () {
    queuePSA(30);
};

document.querySelector("#btn-golive").onclick = function () {
    prepareLive();
};

document.querySelector("#btn-goremote").onclick = function () {
    prepareRemote();
};

document.querySelector("#btn-gosports").onclick = function () {
    prepareSports();
};

document.querySelector("#btn-endshow").onclick = function () {
    endShow();
};

document.querySelector("#btn-switchshow").onclick = function () {
    switchShow();
};

document.querySelector("#btn-resume").onclick = function () {
    returnBreak();
};

document.querySelector("#btn-break").onclick = function () {
    goBreak(false);
};

document.querySelector("#btn-halftime").onclick = function () {
    goBreak(true);
};

document.querySelector("#btn-topadd").onclick = function () {
    playTopAdd();
};

document.querySelector("#btn-liner").onclick = function () {
    playLiner();
};

document.querySelector("#btn-log").onclick = function () {
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

$('#themessage').keydown(function (e) {
    if (e.which === 13) {
        try {
            var host = Recipients({ID: activeRecipient}).first().host;
            var label = Recipients({ID: activeRecipient}).first().label;
            nodeRequest({method: 'POST', url: nodeURL + '/messages/send', data: {from: os.hostname(), to: host, to_friendly: label, message: document.querySelector(`#themessage`).value}}, function (response) {
                if (response === 'OK')
                {
                    document.querySelector(`#themessage`).value = ``;
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

function doSockets() {
    onlineSocket();
    metaSocket();
    easSocket();
    statusSocket();
    calendarSocket();
    messagesSocket();
    recipientsSocket();
}

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

function metaSocket() {
    console.log('attempting meta socket');
    io.socket.post('/meta/get', {}, function serverResponded(body, JWR) {
        try {
            var startRecording = null;
            for (var key in body)
            {
                if (body.hasOwnProperty(key))
                {
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
                                            nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'operation', logsubtype: (startRecording === 'automation' ? 'automation' : Meta.dj), loglevel: 'info', event: `A recording was started in ${recordPath}\\${startRecording}\\${sanitize(Meta.dj)} (${moment().format("YYYY_MM_DD HH_mm_ss")}).mp3`}}, function (response3) {
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
        } catch (e) {
            console.log(`FAILED messages CONNECTION`);
            console.error(e);
            setTimeout(messagesSocket, 10000);
        }
    });
}

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

function doMeta(metan) {
    try {
        if (Meta.breakneeded && Meta.djcontrols === os.hostname())
        {
            if (document.querySelector("#iziToast-breakneeded") === null && !breakNotified)
            {
                breakNotified = true;
                var notification = notifier.notify('Top of Hour Break Required', {
                    message: 'Please take a break within the next 5 minutes.',
                    icon: 'http://cdn.onlinewebfonts.com/svg/img_205852.png',
                    duration: 300000,
                    buttons: ["Close"]
                });
                notification.on('buttonClicked', (text, buttonIndex, options) => {
                    notification.close();
                });
                main.flashTaskbar();
                iziToast.show({
                    id: 'iziToast-breakneeded',
                    class: 'flash-bg',
                    title: '<i class="fas fa-clock"></i> Top of hour break required',
                    message: `Please find a graceful stopping point and then click "take a break" within the next 5 minutes.`,
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
        queueLength = Math.round(Meta.queueLength);
        if (queueLength < 0)
            queueLength = 0;
        var queueTime = document.querySelector("#queue-seconds");
        queueTime.innerHTML = moment.duration(queueLength, "seconds").format();
        if (queueLength < 15 && (Meta.state.includes("_returning") || (Meta.state.startsWith("automation_") && Meta.state !== 'automation_on' && Meta.state !== 'automation_genre') && Meta.state !== 'automation_playlist'))
        {
            var operations = document.querySelector("#operations");
            operations.className = "card p-1 m-3 text-white bg-warning-dark";
            setTimeout(function () {
                operations.className = "card p-1 m-3 text-white bg-dark";
            }, 250);
        }
        if (typeof metan.state !== 'undefined')
        {
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
                        buttons: ["Close"]
                    });
                    notification.on('buttonClicked', (text, buttonIndex, options) => {
                        notification.close();
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

function checkAnnouncements() {
    var prev = [];
    // Add applicable announcements
    Announcements().each(function (datum) {
        if (moment(datum.starts).isBefore(moment(Meta.time)) && moment(datum.expires).isAfter(moment(Meta.time)))
        {
            prev.push(`attn-${datum.ID}`);
            if (document.querySelector(`#attn-${datum.ID}`) === null)
            {
                var attn = document.querySelector("#announcements-body");
                attn.innerHTML += `<div class="attn attn-${datum.level} alert alert-${datum.level}" id="attn-${datum.ID}" role="alert">
                        <i class="fas fa-bullhorn"></i> ${datum.announcement}
                    </div>`;
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
                        buttons: ["Close"]
                    });
                    notification.on('buttonClicked', (text, buttonIndex, options) => {
                        notification.close();
                    });
                    main.flashTaskbar();
                }
            } else {
                var temp = document.querySelector(`#attn-${datum.ID}`);
                temp.className = `attn attn-${datum.level} alert alert-${datum.level}`;
                temp.innerHTML = `<i class="fas fa-bullhorn"></i> ${datum.announcement}`;
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

                    // Does this event start within the next 24 hours, and has not yet ended? Add it to our formatted array.
                    if (moment(Meta.time).add(1, 'days').isAfter(moment(event.start)) && moment(Meta.time).isBefore(moment(event.end)))
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
        if (curPriority <= calPriority && !calNotified && Meta.djcontrols === os.hostname() && Meta.dj !== `${calHost} - ${calShow}`)
        {
            // Sports events should notify right away; allows for 15 minutes to transition
            if (calType === 'Sports')
            {
                calNotified = true;
                var notification = notifier.notify('Upcoming Sports Broadcast', {
                    message: 'Please wrap-up / end your show in the next few minutes.',
                    icon: 'https://icon2.kisspng.com/20171221/lje/gold-cup-trophy-png-clip-art-image-5a3c1fa99cbcb0.608850721513889705642.jpg',
                    duration: 900000,
                    buttons: ["Close"]
                });
                notification.on('buttonClicked', (text, buttonIndex, options) => {
                    notification.close();
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
                    buttons: ["Close"]
                });
                notification.on('buttonClicked', (text, buttonIndex, options) => {
                    notification.close();
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
                    duration: 600000,
                    buttons: ["Close"]
                });
                notification.on('buttonClicked', (text, buttonIndex, options) => {
                    notification.close();
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
                    duration: 600000,
                    buttons: ["Close"]
                });
                notification.on('buttonClicked', (text, buttonIndex, options) => {
                    notification.close();
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

        // Add in our new list
        if (calendar.length > 0)
        {

            calendar.forEach(function (event) {
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
            });
        }
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during checkCalendar.`
        });
    }
}

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
                        if (recipient.host === 'website' && Meta.webchat)
                            theClass = 'wwsu-red';
                        if (temp !== null)
                        {
                            temp.remove();
                        }
                        temp = document.querySelector(`#users-g-${key}`);
                        if (recipient.group === 'website' && recipient.host !== 'website')
                        {
                            temp.innerHTML += `<div id="users-u-${recipient.host}" class="recipient">
                                <div id="users-b-${recipient.host}" class="p-1 m-1 bg-${theClass} ${activeRecipient === recipient.ID ? 'border border-warning' : ''}" style="cursor: pointer;">
                                                    <div class="container">
  <div class="row">
    <div class="col-8" id="users-c1-${recipient.host}">
      <span id="users-l-${recipient.host}">${recipient.label}</span>
    </div>
    <div class="col-4" id="users-c2-${recipient.host}" style="text-align: center;">
                                                                                <div class="dropdown">
      <span class='message-options' id="users-o-${recipient.host}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><i class="fas fa-ellipsis-v"></i></span><span class="badge badge-${recipient.unread > 0 ? 'danger' : 'secondary'}" id="users-n-${recipient.host}">${recipient.unread}</span>
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
    <div class="col-8" id="users-c1-${recipient.host}">
      <span id="users-l-${recipient.host}">${recipient.label}</span>
    </div>
    <div class="col-4" id="users-c2-${recipient.host}" style="text-align: center;">
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

function selectRecipient(recipient = null)
{
    try {
        activeRecipient = recipient;

        var messages = document.querySelector("#messages");
        var messageIDs = [];
        messages.innerHTML = ``;

        Recipients().each(function (recipientb) {
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

        // Define a comparison function that will order calendar events by start time when we run the iteration
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

        var temp = document.querySelector(`#btn-messenger-unread`);
        temp.className = `notification badge badge-${totalUnread > 0 ? 'danger' : 'secondary'}`;
        temp.innerHTML = totalUnread;
        var records = Messages(query).get().sort(compare);

        if (records.length > 0)
        {
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
                                <span class='message-options' id="message-o-${message.ID}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><i class="fas fa-ellipsis-v"></i></span>
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
                                <span class='message-options' id="message-o-${message.ID}" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false"><i class="fas fa-ellipsis-v"></i></span>
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

function returnBreak() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Queuing Sweeper/ID';
    nodeRequest({method: 'POST', url: nodeURL + '/state/return'}, function (response) {
        $("#wait-modal").iziModal('close');
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
    if (calType === 'Show')
    {
        document.querySelector("#live-handle").value = calHost;
        document.querySelector("#live-show").value = calShow;
        document.querySelector("#live-noschedule").style.display = "none";
    }
    $("#go-live-modal").iziModal('open');
}

function goLive() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Clearing RadioDJ queue and preparing for live show';
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
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

function prepareRemote() {
    document.querySelector("#remote-handle").value = '';
    document.querySelector("#remote-show").value = '';
    document.querySelector("#remote-topic").value = '';
    document.querySelector("#remote-noschedule").style.display = "inline";
    document.querySelector("#remote-webchat").checked = true;
    if (calType === 'Remote')
    {
        document.querySelector("#remote-handle").value = calHost;
        document.querySelector("#remote-show").value = calShow;
        document.querySelector("#remote-noschedule").style.display = "none";
    }
    $("#go-remote-modal").iziModal('open');
}

function goRemote() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Clearing RadioDJ queue and preparing for remote broadcast';
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
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

function prepareSports() {
    document.querySelector('#sports-sport').value = "";
    document.querySelector("#sports-noschedule").style.display = "inline";
    document.querySelector("#sports-remote").checked = false;
    document.querySelector("#sports-webchat").checked = true;
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
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Clearing RadioDJ queue and preparing for sports broadcast';
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
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

function prepareLog() {
    document.querySelector("#log-datetime").value = moment(Meta.time).format("MM/DD/YYYY HH:mm:ss");
    document.querySelector("#log-type").value = 'Did an unknown action';
    document.querySelector("#log-artist").value = '';
    document.querySelector("#log-title").value = '';
    document.querySelector("#log-album").value = '';
    document.querySelector("#log-label").value = '';
    $("#log-modal").iziModal('open');
}

function saveLog() {
    var thelog = 'DJ/Producer ' + document.querySelector("#log-type").value;
    var dateObject = moment(document.querySelector("#log-datetime").value);
    nodeRequest({method: 'POST', url: nodeURL + '/logs/add', data: {logtype: 'operation', logsubtype: Meta.dj, loglevel: 'info', event: thelog, trackArtist: document.querySelector("#log-artist").value, trackTitle: document.querySelector("#log-title").value, trackAlbum: document.querySelector("#log-album").value, trackLabel: document.querySelector("#log-label").value, date: dateObject.toISOString()}}, function (response) {
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
        } else {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to submit a log entry. Please email engineer@wwsu1069.org.'
            });
        }
        console.log(JSON.stringify(response));
    });
}

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
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Queuing automation music in RadioDJ';
    nodeRequest({method: 'POST', url: nodeURL + '/state/automation'}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to end your broadcast. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        }
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

function switchShow() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Queuing PSAs / ID';
    nodeRequest({method: 'POST', url: nodeURL + '/state/automation', data: {transition: true}}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to end your broadcast. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        } else {
            prepareLive();
        }
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

function goBreak(halftime) {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = (halftime ? 'Queuing Halftime music' : 'Queuing PSAs');
    nodeRequest({method: 'POST', url: nodeURL + '/state/break', data: {halftime: halftime}}, function (response) {
        if (response !== 'OK')
        {
            iziToast.show({
                title: 'An error occurred',
                message: 'Error occurred trying to go into break. Please try again in 15-30 seconds.',
                timeout: 10000
            });
        }
        $("#wait-modal").iziModal('close');
        console.log(JSON.stringify(response));
    });
}

function playTopAdd() {
    $("#wait-modal").iziModal('open');
    document.querySelector("#wait-text").innerHTML = 'Queuing/playing Top Add song';
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
                                buttons: ["Close"]
                            });
                            notification.on('buttonClicked', (text, buttonIndex, options) => {
                                notification.close();
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
                            buttons: ["Close"]
                        });
                        notification.on('buttonClicked', (text, buttonIndex, options) => {
                            notification.close();
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
                                        buttons: ["Close"]
                                    });
                                    notification.on('buttonClicked', (text, buttonIndex, options) => {
                                        notification.close();
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
                                    buttons: ["Close"]
                                });
                                notification.on('buttonClicked', (text, buttonIndex, options) => {
                                    notification.close();
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
                                buttons: ["Close"]
                            });
                            notification.on('buttonClicked', (text, buttonIndex, options) => {
                                notification.close();
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
                            buttons: ["Close"]
                        });
                        notification.on('buttonClicked', (text, buttonIndex, options) => {
                            notification.close();
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
                                        buttons: ["Close"]
                                    });
                                    notification.on('buttonClicked', (text, buttonIndex, options) => {
                                        notification.close();
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
                                    buttons: ["Close"]
                                });
                                notification.on('buttonClicked', (text, buttonIndex, options) => {
                                    notification.close();
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
                                        buttons: ["Close"]
                                    });
                                    notification.on('buttonClicked', (text, buttonIndex, options) => {
                                        notification.close();
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
                                    buttons: ["Close"]
                                });
                                notification.on('buttonClicked', (text, buttonIndex, options) => {
                                    notification.close();
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
                                        buttons: ["Close"]
                                    });
                                    notification.on('buttonClicked', (text, buttonIndex, options) => {
                                        notification.close();
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
                                    buttons: ["Close"],
                                });
                                notification.on('buttonClicked', (text, buttonIndex, options) => {
                                    notification.close();
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
                                        buttons: ["Close"]
                                    });
                                    notification.on('buttonClicked', (text, buttonIndex, options) => {
                                        notification.close();
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
                                            buttons: ["Close"]
                                        });
                                        notification.on('buttonClicked', (text, buttonIndex, options) => {
                                            notification.close();
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
                                        buttons: ["Close"],
                                    });
                                    notification.on('buttonClicked', (text, buttonIndex, options) => {
                                        notification.close();
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
                                            buttons: ["Close"]
                                        });
                                        notification.on('buttonClicked', (text, buttonIndex, options) => {
                                            notification.close();
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