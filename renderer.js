/* global iziToast, io, moment, Infinity */

try {

    // Define constants
    var fs = require("fs"); // file system
    var os = require('os'); // OS

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
    var nodeURL = 'http://localhost:1337';

    io.sails.url = nodeURL;
    var disconnected = true;
    var theStatus = 4;
    var calendar = []; // Contains calendar events for the next 24 hours

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
                    minutesC = 0;
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

    // Define default settings for iziToast (overlaying messages)
    iziToast.settings({
        titleColor: '#000000',
        messageColor: '#000000',
        color: 'red',
        close: true,
        overlay: true,
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
        overlayColor: 'rgba(0, 0, 0, 0.4)',
        timeout: 180000,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)'
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
        overlayColor: 'rgba(0, 0, 0, 0.4)',
        timeout: 180000,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)'
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
        overlayColor: 'rgba(0, 0, 0, 0.4)',
        timeout: 180000,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)'
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
        overlayColor: 'rgba(0, 0, 0, 0.4)',
        timeout: 180000,
        timeoutProgressbar: true,
        pauseOnHover: true,
        timeoutProgressbarColor: 'rgba(255,255,255,0.5)'
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
    for (var key in data)
    {
        if (data.hasOwnProperty(key))
        {
            Meta[key] = data[key];
        }
    }
    doMeta(data);
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

document.querySelector("#live-handle").addEventListener("change", function () {
    if (calType === 'Show' && document.querySelector("#live-handle").value === calHost && document.querySelector("#live-show").value === calShow)
    {
        document.querySelector("#live-noschedule").style.display = "none";
    } else {
        document.querySelector("#live-noschedule").style.display = "inline";
    }
});

document.querySelector("#live-show").addEventListener("change", function () {
    if (calType === 'Show' && document.querySelector("#live-handle").value === calHost && document.querySelector("#live-show").value === calShow)
    {
        document.querySelector("#live-noschedule").style.display = "none";
    } else {
        document.querySelector("#live-noschedule").style.display = "inline";
    }
});

document.querySelector("#remote-handle").addEventListener("change", function () {
    if (calType === 'Remote' && document.querySelector("#remote-handle").value === calHost && document.querySelector("#remote-show").value === calShow)
    {
        document.querySelector("#remote-noschedule").style.display = "none";
    } else {
        document.querySelector("#remote-noschedule").style.display = "inline";
    }
});

document.querySelector("#remote-show").addEventListener("change", function () {
    if (calType === 'Remote' && document.querySelector("#remote-handle").value === calHost && document.querySelector("#remote-show").value === calShow)
    {
        document.querySelector("#remote-noschedule").style.display = "none";
    } else {
        document.querySelector("#remote-noschedule").style.display = "inline";
    }
});

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

function authorise(cb)
{
    // REMOVE FOR PRODUCTION
    cb('BLAH');
    return null;

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

function doSockets() {
    onlineSocket();
    metaSocket();
    easSocket();
    statusSocket();
    announcementsSocket();
    calendarSocket();
}

function onlineSocket()
{
    console.log('attempting online socket');
    nodeRequest({method: 'post', url: nodeURL + '/recipients/add-computers', data: {host: os.hostname()}}, function (response) {
        try {
        } catch (e) {
            console.log('FAILED ONLINE CONNECTION');
            setTimeout(onlineSocket, 10000);
        }
    });
}

function metaSocket() {
    io.socket.post('/meta/get', {}, function serverResponded(body, JWR) {
        try {
            for (var key in body)
            {
                if (body.hasOwnProperty(key))
                {
                    Meta[key] = body[key];
                }
            }
            doMeta(body);
        } catch (e) {
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
            console.log('FAILED EAS CONNECTION');
            setTimeout(easSocket, 10000);
        }
    });
}

function statusSocket() {
    io.socket.post('/status/get', {}, function serverResponded(body, JWR) {
        //console.log(body);
        try {
            processStatus(body, true);
        } catch (e) {
            console.log('FAILED Status CONNECTION');
            setTimeout(statusSocket, 10000);
        }
    });
}

function announcementsSocket() {
    io.socket.post('/announcements/get', {type: 'djcontrols'}, function serverResponded(body, JWR) {
        //console.log(body);
        try {
            processAnnouncements(body, true);
        } catch (e) {
            console.log('FAILED Announcements CONNECTION');
            setTimeout(announcementsSocket, 10000);
        }
    });
}

function calendarSocket() {
    io.socket.post('/calendar/get', {}, function serverResponded(body, JWR) {
        //console.log(body);
        try {
            processCalendar(body, true);
        } catch (e) {
            console.log('FAILED Calendar CONNECTION');
            setTimeout(calendarSocket, 10000);
        }
    });
}

function doMeta(metan) {
    try {
        if (Meta.breakneeded && Meta.djcontrols === os.hostname())
        {
            if (document.querySelector("#iziToast-breakneeded") === null)
                iziToast.show({
                    id: 'iziToast-breakneeded',
                    title: 'Top of hour break required',
                    message: `Please find a graceful stopping point and then click "take a break" within the next 5 minutes.`,
                    timeout: 600000,
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
                            }, true]
                    ]
                });
        } else {
            var temp = document.querySelector("#iziToast-breakneeded");
            if (temp !== null)
                iziToast.hide({}, temp);
        }
        queueLength = Math.round(Meta.queueLength);
        if (queueLength < 0)
            queueLength = 0;
        var queueTime = document.querySelector("#queue-seconds");
        queueTime.innerHTML = queueLength;
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
                var temp = document.querySelector('#operations');
                var badge = document.querySelector('#operations-state');
                badge.innerHTML = Meta.state;
                var actionButtons = temp.querySelectorAll("#btn-circle");
                for (var i = 0; i < actionButtons.length; i++) {
                    actionButtons[i].style.display = "none";
                }
                document.querySelector('#queue').style.display = "none";
                document.querySelector('#no-remote').style.display = "none";
                document.querySelector('#please-wait').style.display = "none";
                if (Meta.state === 'automation_on')
                {
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
                } else if (Meta.state.startsWith('automation_') || (Meta.state.includes('_returning') && !Meta.state.startsWith('sports')))
                {
                    document.querySelector('#queue').style.display = "inline";
                } else if (Meta.state.startsWith('sports') && Meta.state.includes('_returning'))
                {
                    document.querySelector('#queue').style.display = "inline";
                    document.querySelector('#btn-psa15').style.display = "inline";
                    document.querySelector('#btn-psa30').style.display = "inline";
                } else if (Meta.state.includes('_break_disconnected') || Meta.state.includes('_halftime_disconnected'))
                {
                    if (document.querySelector("#iziToast-noremote") === null)
                        iziToast.show({
                            id: 'iziToast-noremote',
                            title: 'Lost Remote Connection',
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
                                    }, true]
                            ]
                        });
                    document.querySelector('#no-remote').style.display = "inline";
                    document.querySelector('#btn-resume').style.display = "inline";
                } else if (Meta.state.includes('_break') || Meta.state.includes('_halftime'))
                {
                    document.querySelector('#btn-return').style.display = "inline";
                } else if (Meta.state.includes('live_'))
                {
                    badge.className = 'badge badge-danger';
                    document.querySelector('#btn-endshow').style.display = "inline";
                    document.querySelector('#btn-break').style.display = "inline";
                    document.querySelector('#btn-topadd').style.display = "inline";
                    document.querySelector('#btn-log').style.display = "inline";
                } else if (Meta.state.includes('sports_') || Meta.state.includes('sportsremote_'))
                {
                    badge.className = 'badge badge-success';
                    document.querySelector('#btn-endshow').style.display = "inline";
                    document.querySelector('#btn-break').style.display = "inline";
                    document.querySelector('#btn-halftime').style.display = "inline";
                    document.querySelector('#btn-liner').style.display = "inline";
                } else if (Meta.state.includes('remote_'))
                {
                    badge.className = 'badge badge-purple';
                    document.querySelector('#btn-endshow').style.display = "inline";
                    document.querySelector('#btn-break').style.display = "inline";
                    document.querySelector('#btn-topadd').style.display = "inline";
                    document.querySelector('#btn-log').style.display = "inline";
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
    // Remove all regular announcements
    var attn = document.querySelectorAll(".attn");
    for (var i = 0; i < attn.length; i++) {
        attn[i].parentNode.removeChild(attn[i]);
    }

    // Add applicableannouncements
    var attn = document.querySelector("#announcements-body");
    Announcements().each(function (datum) {
        if (moment(datum.starts).isBefore(moment(Meta.time)) && moment(datum.expires).isAfter(moment(Meta.time)))
        {
            attn.innerHTML += `<div class="attn attn-${datum.level} alert alert-${datum.level}" id="attn-${datum.ID}" role="alert">
                        ${datum.announcement}
                    </div>`;
        }
    });
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

        // Run through every event in memory, sorted by the comparison function, and add appropriate ones into our formatted calendar variable.
        Calendar().get().sort(compare).forEach(function (event)
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
        if (curPriority <= calPriority && !calNotified && Meta.djcontrols === os.hostname())
        {
            // Sports events should notify right away; allows for 15 minutes to transition
            if (calType === 'Sports')
            {
                calNotified = true;
                iziToast.show({
                    title: 'Sports broadcast in less than 15 minutes.',
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
                            }, true]
                    ]
                });
            }

            // Remote events should also notify right away; allows for 15 minutes to transition
            if (calType === 'Remote')
            {
                calNotified = true;
                iziToast.show({
                    title: 'Remote broadcast in less than 15 minutes.',
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
                            }, true]
                    ]
                });
            }

            // Live shows should not notify until the scheduled start time is past the current time.
            if (calType === 'Show' && moment(Meta.time).isAfter(moment(calStarts)))
            {
                calNotified = true;
                iziToast.show({
                    title: 'You are interrupting another show!',
                    message: `You are running into another person's show time. Please wrap up your show now and then click "End Show".`,
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
                            }, true]
                    ]
                });
            }

            // Prerecords also should not notify until the scheduled start time is past the current time.
            if (calType === 'Prerecord' && moment(Meta.time).isAfter(moment(calStarts)))
            {
                calNotified = true;
                iziToast.show({
                    title: 'You are running into a scheduled prerecord.',
                    message: `You are running into a scheduled prerecorded show. Unless WWSU has given you`,
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
                            }, true]
                    ]
                });
            }

        }

        // Clear current list of events
        document.querySelector('#calendar-events').innerHTML = '';

        // Add in our new list
        calendar.forEach(function (event) {
            document.querySelector('#calendar-events').innerHTML += ` <div class="p-1 m-1" style="background-color: ${event.color}">
                                    <div class="container">
                                        <div class="row">
                                            <div class="col-4">
                                                ${moment(event.start).format("hh:mm A")}
                                            </div>
                                            <div class="col-8">
                                                ${event.title}
                                            </div>
                                        </div>
                                    </div></div>`;
        });
    } catch (e) {
        console.error(e);
        iziToast.show({
            title: 'An error occurred - Please check the logs',
            message: `Error occurred during checkCalendar.`
        });
    }
}

function returnBreak() {
    nodeRequest({method: 'POST', url: nodeURL + '/state/return'}, function (response) {
        doMeta(Meta);
    });
}

function queuePSA(duration) {
    nodeRequest({method: 'POST', url: nodeURL + '/songs/queue-psa', data: {duration: duration}}, function (response) {
        doMeta(Meta);
    });
}

function prepareLive() {
    document.querySelector("#live-handle").value = '';
    document.querySelector("#live-show").value = '';
    document.querySelector("#live-topic").value = '';
    document.querySelector("#live-noschedule").style.display = "inline";
    if (calType === 'Show')
    {
        document.querySelector("#live-handle").value = calHost;
        document.querySelector("#live-show").value = calShow;
        document.querySelector("#live-noschedule").style.display = "none";
    }
    $("#go-live-modal").iziModal('open');
}

function goLive() {
    $("#go-live-modal").iziModal('close');
    nodeRequest({method: 'post', url: nodeURL + '/state/live', data: {showname: document.querySelector('#live-handle').value + ' - ' + document.querySelector('#live-show').value, topic: document.querySelector('#live-topic').value, djcontrols: os.computerName(), webchat: document.querySelector('#live-webchat').checked}}, function (response) {
        doMeta(Meta);
    });
}

function prepareRemote() {
    document.querySelector("#remote-handle").value = '';
    document.querySelector("#remote-show").value = '';
    document.querySelector("#remote-topic").value = '';
    document.querySelector("#remote-noschedule").style.display = "inline";
    if (calType === 'Remote')
    {
        document.querySelector("#remote-handle").value = calHost;
        document.querySelector("#remote-show").value = calShow;
        document.querySelector("#remote-noschedule").style.display = "none";
    }
    $("#go-remote-modal").iziModal('open');
}

function goRemote() {
    $("#go-remote-modal").iziModal('close');
    nodeRequest({method: 'POST', url: nodeURL + '/state/remote', data: {showname: document.querySelector('#remote-handle').value + ' - ' + document.querySelector('#remote-show').value, topic: document.querySelector('#remote-topic').value, djcontrols: os.computerName(), webchat: document.querySelector('#remote-webchat').checked}}, function (response) {
        doMeta(Meta);
    });
}

function prepareSports() {
    document.querySelector('#sports-sport').value = "";
    document.querySelector("#sports-noschedule").style.display = "inline";
    if (calType === 'Sports')
    {
        document.querySelector("#sports-sport").value = calShow;
        document.querySelector("#sports-noschedule").style.display = "none";
    }
    $("#go-sports-modal").iziModal('open');
}

function goSports() {
    $("#go-sports-modal").iziModal('close');
    var sportsOptions = document.getElementById('sports-sport');
    var selectedOption = sportsOptions.options[sportsOptions.selectedIndex].value;
    nodeRequest({method: 'POST', url: nodeURL + '/state/sports', data: {sport: selectedOption, remote: document.querySelector('#sports-remote').checked, djcontrols: os.computerName(), webchat: document.querySelector('#sports-webchat').checked}}, function (response) {
        doMeta(Meta);
    });
}

function endShow() {
    nodeRequest({method: 'POST', url: nodeURL + '/state/automation'}, function (response) {
        doMeta(Meta);
    });
}

function returnBreak() {
    nodeRequest({method: 'POST', url: nodeURL + '/state/return'}, function (response) {
        doMeta(Meta);
    });
}

function goBreak(halftime) {
    nodeRequest({method: 'POST', url: nodeURL + '/state/break', data: {halftime: halftime}}, function (response) {
        doMeta(Meta);
    });
}

function playTopAdd() {
    nodeRequest({method: 'POST', url: nodeURL + '/songs/queue-add'}, function (response) {
        doMeta(Meta);
    });
}

function playLiner() {
    nodeRequest({method: 'POST', url: nodeURL + '/songs/queue-liner'}, function (response) {
        doMeta(Meta);
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

            // Remove all Eas-based announcements
            var easAttn = document.querySelectorAll(".attn-eas");
            for (var i = 0; i < easAttn.length; i++) {
                easAttn[i].parentNode.removeChild(easAttn[i]);
            }

            // Replace with the new data
            Eas = TAFFY();
            Eas.insert(data);

            // Add Eas-based announcements
            var attn = document.querySelector("#announcements-body");
            data.forEach(function (datum) {
                // Skip alerts that are not severe nor extreme severity; we don't care about those for DJ Controls
                if (datum.severity !== 'Extreme' && datum.severity !== 'Severe')
                    return null;

                attn.innerHTML += `<div class="attn-eas attn-eas-${datum.severity} alert alert-${datum.severity === 'Extreme' ? 'danger' : 'warning'}" id="attn-eas-${datum.ID}" role="alert">
                        <strong>${datum.alert}</strong> in effect for the counties ${datum.counties}.
                    </div>`;
            });

            // Go through the new data. If any IDs exists that did not exist before, consider it a new alert and make a notification.
            Eas().each(function (record)
            {
                if (prev.indexOf(record.ID) === -1)
                {
                    if (record.severity === 'Extreme')
                    {
                        if (!Meta.state.startsWith("automation_"))
                        {
                            iziToast.show({
                                class: 'iziToast-eas-extreme-end',
                                title: 'Extreme weather alert in effect',
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
                                        }, true]
                                ]
                            });
                        } else {
                            iziToast.show({
                                class: 'iziToast-eas-extreme',
                                title: 'Extreme weather alert in effect',
                                message: `A ${record.alert} is in effect for the counties of ${record.counties}. You may wish to decide against hosting any shows at this time and instead seeking shelter.`,
                                timeout: 900000,
                                close: true,
                                color: 'red',
                                drag: false,
                                position: 'center',
                                closeOnClick: false,
                                overlay: true,
                                zindex: 500
                            });
                        }
                    } else if (record.severity === 'Severe')
                    {
                        iziToast.show({
                            class: 'iziToast-eas-severe',
                            title: 'Severe weather alert in effect',
                            message: `A ${record.alert} is in effect for the counties of ${record.counties}. Please keep an eye on the weather.`,
                            timeout: 900000,
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
                            var attn = document.querySelector("#announcements-body");
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
                            attn.innerHTML += `<div class="attn-eas attn-eas-${data[key].severity} alert alert-${className}" id="attn-eas-${data[key].ID}" role="alert">
                        <strong>${data[key].alert}</strong> in effect for the counties ${data[key].counties}.
                    </div>`;
                            if (data[key].severity === 'Extreme')
                            {
                                if (!Meta.state.startsWith("automation_"))
                                {
                                    iziToast.show({
                                        class: 'iziToast-eas-extreme-end',
                                        title: 'Extreme weather alert in effect',
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
                                                }, true]
                                        ]
                                    });
                                } else {
                                    iziToast.show({
                                        class: 'iziToast-eas-extreme',
                                        title: 'Extreme weather alert in effect',
                                        message: `A ${data[key].alert} is in effect for the counties of ${data[key].counties}. You may wish to decide against hosting any shows at this time and instead seeking shelter.`,
                                        timeout: 900000,
                                        close: true,
                                        color: 'red',
                                        drag: false,
                                        position: 'center',
                                        closeOnClick: false,
                                        overlay: true,
                                        zindex: 500
                                    });
                                }
                            } else if (data[key].severity === 'Severe')
                            {
                                iziToast.show({
                                    class: 'iziToast-eas-severe',
                                    title: 'Severe weather alert in effect',
                                    message: `A ${data[key].alert} is in effect for the counties of ${data[key].counties}. Please keep an eye on the weather.`,
                                    timeout: 900000,
                                    close: true,
                                    color: 'yellow',
                                    drag: false,
                                    position: 'center',
                                    closeOnClick: false,
                                    overlay: true,
                                    zindex: 250
                                });
                            }
                            break;
                        case 'update':
                            Eas({ID: data[key].ID}).update(data[key]);
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

        // Check to see if any alerts are extreme
        easExtreme = false;

        Eas().each(function (alert) {
            try {
                if (alert.severity === 'Extreme')
                    easExtreme = true;
            } catch (e) {
                console.error(e);
                iziToast.show({
                    title: 'An error occurred - Please check the logs',
                    message: `Error occurred during Eas iteration in processEas.`
                });
            }
        });

        checkAnnouncements();

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
        } else {
            for (var key in data)
            {
                if (data.hasOwnProperty(key))
                {
                    switch (key)
                    {
                        case 'insert':
                            Status.insert(data[key]);
                            break;
                        case 'update':
                            Status({ID: data[key].ID}).update(data[key]);
                            break;
                        case 'remove':
                            Status({ID: data[key]}).remove();
                            break;
                    }
                }
            }
        }

        // Check the worst status and update accordingly
        theStatus = 5;
        var attn = document.querySelector("#announcements-body");

        // Remove all Status-based announcements

        Status().each(function (status) {
            if (status.status < theStatus && status.status !== 4)
                theStatus = status.status;

            if (status.status < 3)
            {
                attn.innerHTML += `<div class="attn-status attn-status-${status.status} alert alert-${status.status < 2 ? 'danger' : 'warning'}" id="attn-status-${status.ID}" role="alert">
                        <strong>${status.label}</strong> is reporting a high-priority issue: ${status.data}
                    </div>`;
            }
        });

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