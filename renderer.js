/* global iziToast, io */

try {

    // Define constants
    const fs = require("fs"); // file system

    // Define data variables
    var Meta = {time: '2018-07-03T03:14:50+00:00'};
    var Calendar = TAFFY();
    var Status = TAFFY();
    var Messages = TAFFY();
    var Announcements = TAFFY();
    var Eas = TAFFY();
    var Recipients = TAFFY();
    var Requests = TAFFY();

    // Define HTML elements

    // Define other variables
    var nodeURL = 'http://server.wwsu1069.org';

    var date = moment(Meta.time);
    var seconds = date.seconds();
    var secondsC = 0;
    var minutes = date.minutes();
    var minutesC = 0;
    var hours = date.hours();
    var hoursC = 0;
    var clockInterval = setInterval(function () {
        date = moment();
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
    var disconnected = true;

    // Define default settings for iziToast (overlaying messages)
    iziToast.settings({
        titleColor: '#000000',
        messageColor: '#000000',
        backgroundColor: 'rgba(244, 67, 54, 0.8);',
        color: 'rgba(244, 67, 54);',
        close: true,
        progressBarColor: 'rgba(244, 67, 54, 1);',
        overlay: true,
        overlayColor: 'rgba(244, 67, 54, 0.1);',
        zindex: 100,
        layout: 1,
        closeOnClick: false,
        position: 'center',
        timeout: 30000
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


} catch (e) {
    iziToast.show({
        title: 'An error occurred - Please inform engineer@wwsu1069.org.',
        message: 'Error occurred when trying to load initial variables.'
    });
    console.error(e);
}

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