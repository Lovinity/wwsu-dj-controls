/* global iziToast, io, moment, Infinity */

try {

    // Define constants
    var fs = require("fs"); // file system
    var os = require('os'); // OS

    // Define data variables
    var Meta = {time: moment().toISOString()};
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
                    secondsC = 0;
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
    console.dir(data);
    for (var key in data)
    {
        if (data.hasOwnProperty(key))
        {
            Meta[key] = data[key];
        }
    }
    doMeta(data);
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
                            cb(JSON.parse(JWR.body));
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
    metaSocket();
}

function metaSocket() {
    io.socket.post('/meta/get', {}, function serverResponded(body, JWR) {
        try {
            console.dir(body);
            for (var key in body)
            {
                if (body.hasOwnProperty(key))
                {
                    Meta[key] = body[key];
                }
            }
            doMeta(body);
        } catch (e) {
            console.error(e);
            setTimeout(metaSocket, 10000);
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
                    timeout: false,
                    close: false,
                    color: 'yellow',
                    drag: false,
                    position: 'bottomCenter',
                    closeOnClick: false,
                    overlay: false,
                    buttons: [
                        ['<button>Take a Break</button>', function (instance, toast, button, e, inputs) {
                                goBreak(false);
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
        if (queueLength < 15)
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
                for (i = 0; i < actionButtons.length; i++) {
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
                            close: false,
                            color: 'red',
                            drag: false,
                            position: 'bottomCenter',
                            closeOnClick: false,
                            overlay: false,
                            buttons: [
                                ['<button>Resume Show</button>', function (instance, toast, button, e, inputs) {
                                        returnBreak();
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
        for (i = 0; i < actionButtons.length; i++) {
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

// WORK ON THIS: onclick HTML cannot call these functions; use onclick event handlers within this javascript instead

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
    // WORK ON THIS
    $("#go-live-modal").iziModal('open');
}

function goLive() {
    $("#go-live-modal").iziModal('close');
    nodeRequest({method: 'post', url: nodeURL + '/state/live', data: {showname: document.querySelector('#live-handle').value + ' - ' + document.querySelector('#live-show').value, topic: document.querySelector('#live-topic').value, djcontrols: os.computerName(), webchat: document.querySelector('#live-webchat').checked}}, function (response) {
        doMeta(Meta);
    });
}

function prepareRemote() {
    // WORK ON THIS
    $("#go-remote-modal").iziModal('open');
}

function goRemote() {
    $("#go-remote-modal").iziModal('close');
    nodeRequest({method: 'POST', url: nodeURL + '/state/remote', data: {showname: document.querySelector('#remote-handle').value + ' - ' + document.querySelector('#remote-show').value, topic: document.querySelector('#remote-topic').value, djcontrols: os.computerName(), webchat: document.querySelector('#remote-webchat').checked}}, function (response) {
        doMeta(Meta);
    });
}

function prepareSports() {
    // WORK ON THIS
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