window.addEventListener('DOMContentLoaded', () => {

    try {
        // Machine ID
        var machineID = window.ipcRenderer.sendSync('get-machine-id');
        $('.connecting-id').html(machineID);

        // Animation queue
        var animations = new WWSUanimations();

        // Connection
        io.sails.url = "https://server.wwsu1069.org";
        io.sails.query = `host=${machineID}`;
        io.sails.reconnectionAttempts = 3;
        var socket = io.sails.connect();
        $('#connecting').removeClass('d-none');
        $('#loading').addClass('d-none');

        // WWSU Plugins
        var wwsuutil = new WWSUutil();
        var navigation = new WWSUNavigation();

        // WWSU Requests and Endpoint managers
        var noReq = new WWSUreq(socket, null);
        var hostReq = new WWSUreq(socket, machineID, null, null, 'host', '/auth/host', 'Host');
        var directors = new WWSUdirectors(socket, noReq);
        var directorReq = new WWSUreq(socket, machineID, directors, null, 'name', '/auth/director', 'Director');
        var logs = new WWSUlogs(socket, noReq, hostReq, directorReq);
        var djs = new WWSUdjs(socket, noReq, directorReq, hostReq, logs);
        var djReq = new WWSUreq(socket, machineID, djs, null, 'name', '/auth/dj', 'DJ');
        var adminDirectorReq = new WWSUreq(socket, machineID, directors, (record) => record.admin, 'name', '/auth/admin-director', 'Administrator Director');
        var status = new WWSUstatus(socket, noReq);
        var eas = new WWSUeas(socket, noReq, directorReq);
        var announcements = new WWSUannouncements(socket, noReq, [ 'all' ], directorReq);
        var timesheets = new WWSUtimesheet(socket, noReq);
        var calendar = new WWSUcalendar(socket, noReq, directorReq, djReq);
        var subscriptions = new WWSUsubscriptions(socket, noReq);
        var meta = new WWSUMeta(socket, noReq);
        var api = new WWSUapi(noReq, hostReq, djReq, directorReq, adminDirectorReq);
        var hosts = new WWSUhosts(socket, meta, machineID, window.ipcRenderer.sendSync('get-app-version'), hostReq, directorReq);
        var requests = new WWSUrequests(socket, hosts, hostReq);
        var state = new WWSUstate(socket, hosts, calendar, hostReq);
        var recipients = new WWSUrecipients(socket, meta, hostReq);
        var messages = new WWSUmessages(socket, recipients, meta, hosts, null, hostReq);

        var disciplineModal;

        // Sound alerts
        var sounds = {
            onBreak: new Howl({ src: [ 'assets/voice-queues/break.mp3' ] }),
            oneMinute: new Howl({ src: [ 'assets/voice-queues/oneMinute.mp3' ] }),
            thirtySeconds: new Howl({ src: [ 'assets/voice-queues/thirtySeconds.mp3' ] }),
            fifteenSeconds: new Howl({ src: [ 'assets/voice-queues/fifteenSeconds.mp3' ] }),
            tenSeconds: new Howl({ src: [ 'assets/voice-queues/tenSeconds.mp3' ] }),
            fiveSeconds: new Howl({ src: [ 'assets/voice-queues/fiveSeconds.mp3' ] }),
            oneSecond: new Howl({ src: [ 'assets/voice-queues/oneSecond.mp3' ] }),
        }

        // Variables
        var queueLength = 0;
        var countDown = 0;
        var todos = {
            status: {
                danger: 0,
                orange: 0,
                warning: 0,
                info: 0,
                primary: 0
            },
            accountability: {
                danger: 0,
                orange: 0,
                warning: 0,
                info: 0,
                primary: 0
            },
            timesheets: {
                danger: 0,
                orange: 0,
                warning: 0,
                info: 0,
                primary: 0
            },
            DJs: {
                danger: 0,
                orange: 0,
                warning: 0,
                info: 0,
                primary: 0
            }
        }

        // Navigation
        var navigation = new WWSUNavigation();
        navigation.addItem('#nav-dashboard', '#section-dashboard', 'Dashboard - WWSU DJ Controls', '/', true);
        navigation.addItem('#nav-announcements-view', '#section-announcements-view', 'View Announcements - WWSU DJ Controls', '/announcements-view', false);
        navigation.addItem('#nav-chat', '#section-chat', 'Messages / Chat - WWSU DJ Controls', '/chat', false);
        navigation.addItem('#nav-requests', '#section-requests', 'Track requests - WWSU DJ Controls', '/requests', false);
        navigation.addItem('#nav-report', '#section-report', 'Report a Problem - WWSU DJ Controls', '/report', false);

        navigation.addItem('#nav-notifications', '#section-notifications', 'Notifications / Todo - WWSU DJ Controls', '/notifications', false);
        navigation.addItem('#nav-announcements', '#section-announcements', 'Manage Announcements - WWSU DJ Controls', '/announcements', false);
        navigation.addItem('#nav-api', '#section-api', 'Make API Query - WWSU DJ Controls', '/api', false);
        navigation.addItem('#nav-calendar', '#section-calendar', 'Manage Calendar - WWSU DJ Controls', '/calendar', false, () => {
            fullCalendar.updateSize();
        });
        navigation.addItem('#nav-djs', '#section-djs', 'Manage DJs - WWSU DJ Controls', '/djs', false);
        navigation.addItem('#nav-logs', '#section-logs', 'Operation Logs - WWSU DJ Controls', '/logs', false);


        // Click events
        $('.status-more').click(() => {
            status.statusModal.iziModal('open');
        });
        $('.eas-more').click(() => {
            eas.easModal.iziModal('open');
        });
        $('.btn-calendar-definitions').click(() => {
            calendar.definitionsModal.iziModal('open');
        });
        $('.btn-calendar-prerequisites').click(() => {
            calendar.prerequisitesModal.iziModal('open');
        });
        $('.btn-manage-events').click(() => {
            calendar.showSimpleEvents();
        });
        $('#section-logs-date-browse').click(() => {
            logs.showAttendance($('#section-logs-date').val());
        });
        $('.chat-recipients').click(() => {
            recipients.openRecipients();
        });

        // Operation click events
        $('.btn-operation-resume').click(() => {
            state.return({});
        })
        $('.btn-operation-15-psa').click(() => {
            state.queuePSA({ duration: 15 });
        })
        $('.btn-operation-30-psa').click(() => {
            state.queuePSA({ duration: 30 });
        })
        $('.btn-operation-automation').click(() => {
            state.automation({ transition: false });
        })
        $('.btn-operation-switch').click(() => {
            state.automation({ transition: true });
        })
        $('.btn-operation-break').click(() => {
            state.break({ halftime: false, problem: false });
        })
        $('.btn-operation-extended-break').click(() => {
            state.break({ halftime: true, problem: false });
        })
        $('.btn-operation-top-add').click(() => {
            state.queueTopAdd({});
        })
        $('.btn-operation-liner').click(() => {
            state.queueLiner({});
        })
        $('.btn-operation-dump').click(() => {
            state.dump({});
        })
        $('.btn-operation-live').click(() => {
            state.showLiveForm();
        })

        // Initialize stuff
        status.initReportForm(`DJ Controls`, `#section-report-form`);
        logs.initAttendanceTable(`#section-logs-table-div`);
        logs.initDashboardLogs(`#section-dashboard-logs`);
        api.initApiForm('#section-api-form');
        requests.initTable('#section-requests-table-div', '.nav-icon-requests', '.track-requests');
        messages.initComponents('.chat-active-recipient', '.chat-status', '.chat-messages', '.chat-form', '.chat-mute', '.chat-ban', '.messages-new-all', '.nav-icon-messages');


        // CLOCKWHEEL

        // Initialize clockwheel
        var clockwheelDonutCanvas = $('#clockwheel-donut').get(0).getContext('2d');
        var clockwheelDonutData = {
            labels: [ 'Not Yet Loaded' ],
            datasets: [
                {
                    data: [ 60 ],
                    backgroundColor: [ '#000000' ]
                },
                {
                    data: [ 720 ],
                    backgroundColor: [ '#000000' ]
                }
            ]
        }
        var clockwheelDonutOptions = {
            maintainAspectRatio: false,
            responsive: true,
            cutoutPercentage: 66,
            legend: {
                display: false
            },
            animation: {
                animateRotate: false,
                animateScale: false
            }
        }
        var clockwheelDonut = new Chart(clockwheelDonutCanvas, {
            type: 'doughnut',
            data: clockwheelDonutData,
            options: clockwheelDonutOptions
        });

        // Clockwheel Clock and functions
        var $h = $("#hour"),
            $m = $("#minute"),
            $s = $("#second");

        function computeTimePositions ($h, $m, $s) {
            var now = moment(meta.meta.time),
                h = now.hours(),
                m = now.minutes(),
                s = now.seconds(),
                ms = 0,
                degS, degM, degH;

            degS = (s * 6) + (6 / 1000 * ms);
            degM = (m * 6) + (6 / 60 * s) + (6 / (60 * 1000) * ms);
            degH = (h * 30) + (30 / 60 * m);

            $s.css({ "transform": "rotate(" + degS + "deg)" });
            $m.css({ "transform": "rotate(" + degM + "deg)" });
            $h.css({ "transform": "rotate(" + degH + "deg)" });
        }

        function setUpFace () {
            for (var x = 1; x <= 60; x += 1) {
                addTick(x);
            }

            function addTick (n) {
                var tickClass = "smallTick",
                    tickBox = $("<div class=\"faceBox\"></div>"),
                    tick = $("<div></div>"),
                    tickNum = "";

                if (n % 5 === 0) {
                    tickClass = (n % 15 === 0) ? "largeTick" : "mediumTick";
                    tickNum = $("<div class=\"tickNum\"></div>").text(n / 5).css({ "transform": "rotate(-" + (n * 6) + "deg)" });
                    if (n >= 50) {
                        tickNum.css({ "left": "-0.5em" });
                    }
                }


                tickBox.append(tick.addClass(tickClass)).css({ "transform": "rotate(" + (n * 6) + "deg)" });
                tickBox.append(tickNum);

                $("#clock").append(tickBox);
            }
        }

        function setSize (width, height) {
            var size = Math.min(width, height);
            size = size * 0.63;
            $('.clock').css('width', `${size}px`);
            $('.clock').css('height', `${size}px`);
            $('.clock').css('margin-top', `-${size / 2}px`);
            $('.clock').css('margin-left', `-${size / 2}px`);
        }

        setUpFace();
        computeTimePositions($h, $m, $s);

        // CALENDAR

        // Initialize Calendar
        var calendarEl = document.getElementById('calendar');

        var fullCalendar = new FullCalendar.Calendar(calendarEl, {
            plugins: [ 'interaction', 'dayGrid', 'timeGrid', 'bootstrap' ],
            header: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            defaultView: 'timeGridWeek',
            navLinks: true, // can click day/week names to navigate views
            selectable: false,
            selectMirror: true,
            nowIndicator: true,
            editable: false,
            startEditable: false,
            durationEditable: false,
            resourceEditable: false,
            themeSystem: 'bootstrap',
            eventLimit: true, // allow "more" link when too many events
            events: function (info, successCallback, failureCallback) {
                $('#calendar').block({
                    message: '<h1>Loading...</h1>',
                    css: { border: '3px solid #a00' },
                    timeout: 30000,
                    onBlock: () => {
                        calendar.getEvents((events) => {
                            events = events.map((event) => {
                                var borderColor;
                                if (event.scheduleType === 'canceled-changed') return false;
                                if ([ 'canceled', 'canceled-system' ].indexOf(event.scheduleType) !== -1) {
                                    borderColor = "#ff0000"
                                } else if ([ 'updated', 'updated-system' ].indexOf(event.scheduleType) !== -1) {
                                    borderColor = "#ffff00"
                                } else if ([ 'unscheduled' ].indexOf(event.scheduleType) !== -1) {
                                    borderColor = "#00ff00"
                                } else {
                                    borderColor = "#0000ff"
                                }
                                return {
                                    id: event.unique,
                                    groupId: event.calendarID,
                                    start: moment(event.start).toDate(),
                                    end: moment(event.end).toDate(),
                                    title: `${event.type}: ${event.hosts} - ${event.name}`,
                                    backgroundColor: [ 'canceled', 'canceled-system' ].indexOf(event.scheduleType) === -1 ? event.color : "#161616",
                                    textColor: "#e6e6e6",
                                    borderColor: borderColor,
                                    extendedProps: {
                                        event: event
                                    }
                                }
                            });
                            successCallback(events);
                            fullCalendar.updateSize();
                            $('#calendar').unblock();
                        }, moment(info.start).subtract(1, 'days').toISOString(true), moment(info.end).toISOString(true));
                    }
                });
            },
            // When rendering events, filter by active filters.
            eventRender: function eventRender (info) {
                if (info.event.extendedProps.event.scheduleType === 'canceled-changed') return false;
                info.el.title = info.event.title;
                if ([ 'canceled', 'canceled-system' ].indexOf(info.event.extendedProps.event.scheduleType) !== -1) {
                    info.el.title += ` (CANCELED)`;
                }
                if ([ 'updated', 'updated-system' ].indexOf(info.event.extendedProps.event.scheduleType) !== -1) {
                    info.el.title += ` (edited on this occurrence)`;
                }
                var temp = document.getElementById(`filter-${info.event.extendedProps.event.type}`);
                if (temp !== null && temp.checked) {
                    return true;
                } else {
                    return false;
                }
            },

            eventClick: function (info) {
                calendar.showClickedEvent(info.event.extendedProps.event);
            }
        });
        fullCalendar.render();

        // Add click events to the filter by switches
        [ 'show', 'sports', 'remote', 'prerecord', 'genre', 'playlist', 'event', 'onair-booking', 'prod-booking', 'office-hours' ].map((type) => {
            var temp = document.getElementById(`filter-${type}`);
            if (temp !== null) {
                temp.addEventListener('click', (e) => {
                    fullCalendar.refetchEvents();
                })
            }
        })

    } catch (e) {
        console.error(e);
        $(document).Toasts('create', {
            class: 'bg-danger',
            title: 'Error initializing',
            body: 'There was an error initializing DJ Controls. Please report this to the engineer.',
            icon: 'fas fa-skull-crossbones fa-lg',
        });
    }





    /*
        SOCKET EVENTS AND FUNCTIONS
    */



    // Connected to WWSU
    socket.on('connect', () => {
        $('#reconnecting').addClass('d-none');
        $('#connecting').addClass('d-none');
        $('#unauthorized').addClass('d-none');
        $('#content').removeClass('d-none');
        socket._raw.io._reconnectionAttempts = Infinity;

        checkDiscipline(() => {
            hosts.get((success) => {
                if (success === 1) {
                    directors.init();
                    djs.init();
                    calendar.init();
                    meta.init();
                    status.init();
                    eas.init();
                    announcements.init();
                    requests.init();
                    recipients.init();
                    messages.init();
                    if (hosts.client.admin) {
                        $('.nav-admin').removeClass('d-none');
                        announcements.initTable('#section-announcements-content');
                        djs.initTable('#section-djs-content');
                        logs.initIssues();
                        logs.initIssuesTable('#section-notifications-issues');
                    }
                } else if (success === -1) {
                    $('#content').addClass('d-none');
                    $('#already-connected').removeClass('d-none');
                } else if (success === 0) {
                    $('#content').addClass('d-none');
                    $('#unauthorized').removeClass('d-none');
                }
            });
        })
    });

    // Disconnected from WWSU
    socket.on('disconnect', () => {
        $('#reconnecting').removeClass('d-none');
        $('#connecting').addClass('d-none');
        $('#unauthorized').addClass('d-none');
        $('#content').addClass('d-none');
    })

    // Connection error
    socket.on('reconnect_failed', (error) => {
        $('#unauthorized').removeClass('d-none');
        $('#connecting').addClass('d-none');
        $('#reconnecting').addClass('d-none');
        $('#content').addClass('d-none');
    });

    socket.on('error', () => {
        if (!hosts.connectedBefore) {
            $('#unauthorized').removeClass('d-none');
            $('#connecting').addClass('d-none');
            $('#reconnecting').addClass('d-none');
            $('#content').addClass('d-none');
        }
    })




    /*
        META EVENTS
    */




    // New meta information
    meta.on('newMeta', (updated, fullMeta) => {
        try {

            // handle changingState blocking operations buttons
            if (typeof updated.changingState !== 'undefined') {
                if (updated.changingState !== null) {
                    $('.operations').block({
                        message: `<h4>${updated.changingState}</h4>`,
                        css: { border: '3px solid #a00' },
                        timeout: 60000,
                    });
                } else {
                    $('.operations').unblock();
                }
            }

            if (typeof updated.attendanceID !== 'undefined') {
                logs.setAttendanceID(updated.attendanceID);
            }

            // Update dump button seconds
            if (typeof updated.delaySystem !== 'undefined') {
                $('.operation-dump-time').html(`${updated.delaySystem === null ? `Turn On` : `${updated.delaySystem} sec`}`);
            }

            // On break voice queue
            if (typeof updated.state !== 'undefined' && hosts.isHost && (fullMeta.state === 'sports_break' || fullMeta.state === 'sports_halftime' || fullMeta.state === 'remote_break' || fullMeta.state === 'sportsremote_break' || fullMeta.state === 'sportsremote_halftime')) {
                sounds.onBreak.play();
            }

            // Update now playing info
            if (typeof updated.line1 !== 'undefined') {
                animations.add('meta-line1', () => {
                    $('.meta-line1').html(updated.line1);
                })
            }
            if (typeof updated.line2 !== 'undefined') {
                animations.add('meta-line2', () => {
                    $('.meta-line2').html(updated.line2);
                })
            }

            // Update online listeners
            if (typeof updated.listeners !== 'undefined') {
                animations.add('meta-listeners', () => {
                    $('.meta-listeners').html(updated.listeners);
                })
            }

            // Determine which operation buttons should be visible depending on system state
            if (typeof updated.state !== 'undefined') {
                animations.add('meta-state', () => {
                    $('.operation-button').addClass('d-none');
                    switch (updated.state) {
                        case 'automation_on':
                        case 'automation_break':
                        case 'automation_playlist':
                        case 'automation_genre':
                        case 'automation_prerecord':
                        case 'prerecord_on':
                        case 'prerecord_break':
                            $('.operation-live').removeClass('d-none');
                            $('.operation-remote').removeClass('d-none');
                            $('.operation-sports').removeClass('d-none');
                            $('.operation-sportsremote').removeClass('d-none');
                            break;
                        case 'live_returning':
                        case 'remote_returning':
                        case 'sports_returning':
                        case 'sportsremote_returning':
                        case 'automation_live':
                        case 'automation_sports':
                        case 'automation_remote':
                        case 'automation_sportsremote':
                            $('.operation-15-psa').removeClass('d-none');
                            $('.operation-30-psa').removeClass('d-none');
                            break;
                        case 'live_break':
                        case 'remote_break':
                        case 'sports_break':
                        case 'sports_halftime':
                        case 'sportsremote_break':
                        case 'sportsremote_halftime':
                            $('.operation-resume').removeClass('d-none');
                            $('.operation-automation').removeClass('d-none');
                            $('.operation-switch').removeClass('d-none');
                            break;
                        case 'live_on':
                            $('.operation-automation').removeClass('d-none');
                            $('.operation-switch').removeClass('d-none');
                            $('.operation-break').removeClass('d-none');
                            $('.operation-top-add').removeClass('d-none');
                            $('.operation-log').removeClass('d-none');
                            break;
                        case 'sports_on':
                            $('.operation-automation').removeClass('d-none');
                            $('.operation-switch').removeClass('d-none');
                            $('.operation-break').removeClass('d-none');
                            $('.operation-extended-break').removeClass('d-none');
                            $('.operation-liner').removeClass('d-none');
                            break;
                        case 'remote_on':
                            $('.operation-automation').removeClass('d-none');
                            $('.operation-switch').removeClass('d-none');
                            $('.operation-break').removeClass('d-none');
                            $('.operation-top-add').removeClass('d-none');
                            $('.operation-log').removeClass('d-none');
                            $('.operation-dump').removeClass('d-none');
                            break;
                        case 'sportsremote_on':
                            $('.operation-automation').removeClass('d-none');
                            $('.operation-switch').removeClass('d-none');
                            $('.operation-break').removeClass('d-none');
                            $('.operation-extended-break').removeClass('d-none');
                            $('.operation-liner').removeClass('d-none');
                            $('.operation-dump').removeClass('d-none');
                            break;
                    }
                });
            }


        } catch (e) {
            console.error(e);
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error newMeta',
                body: 'There was an error in meta.newMeta. Please report this to the engineer.',
                autoHide: true,
                delay: 10000,
                icon: 'fas fa-skull-crossbones fa-lg',
            });
        }
    });

    // Meta ticker
    meta.on('metaTick', (fullMeta) => {
        try {
            // Calculate queue time and countdown time
            queueLength = fullMeta.queueFinish !== null ? Math.round(moment(fullMeta.queueFinish).diff(moment(fullMeta.time), 'seconds')) : 0
            countDown = fullMeta.countdown !== null ? Math.round(moment(fullMeta.countdown).diff(moment(fullMeta.time), 'seconds')) : 0
            if (queueLength < 0) { queueLength = 0 }
            if (countDown < 0) { countDown = 0 }

            if (queueLength > 0 && countDown > 0) {
                if (countDown > 100) {
                    window.ipcRenderer.send('progressMain', 1);
                } else {
                    window.ipcRenderer.send('progressMain', countDown / 100);
                }
            } else {
                window.ipcRenderer.send('progressMain', -1);
            }

            // Update station time
            animations.add('meta-time', () => {
                $('.meta-time').html(moment(fullMeta.time).format("llll"));
            })

            // Update trackFinish
            animations.add('meta-trackFinish', () => {
                $('.meta-trackFinish').html(fullMeta.trackFinish !== null ? moment.duration(moment(fullMeta.trackFinish).diff(moment(fullMeta.time), 'seconds'), 'seconds').format("HH:mm:ss") : '');
            })

            // Make queue timer show current queue length (when visible)
            // Also flash operations bar when about to go on the air
            animations.add('meta-queue', () => {
                // Queue length and first track
                $('.meta-queueLength').html(fullMeta.queueCalculating ? `<i class="fas fa-hourglass-half"></i>` : moment.duration(queueLength, 'seconds').format('HH:mm:ss'))
                $('.meta-firstTrack').html(fullMeta.queueCalculating || fullMeta.countdown === null ? `<i class="fas fa-hourglass-half"></i>` : moment.duration(countDown, 'seconds').format('HH:mm:ss'));
                if (fullMeta.queueMusic && (fullMeta.state.startsWith('_returning') || fullMeta.state.startsWith('automation_'))) {
                    $('.operation-firstTrack').removeClass('d-none');
                } else {
                    $('.operation-firstTrack').addClass('d-none');
                }

                // Flash the WWSU Operations box when queue time goes below 15 seconds.
                if (queueLength < 15 && queueLength > 0 && hosts.isHost && (fullMeta.state.endsWith('_returning') || fullMeta.state.startsWith('automation_'))) {
                    $('.operations-bar').removeClass('navbar-gray-dark');
                    $('.operations-bar').addClass('navbar-fuchsia');
                    setTimeout(function () {
                        $('.operations-bar').removeClass('navbar-fuchsia');
                        $('.operations-bar').addClass('navbar-gray-dark');
                    }, 500)
                }

                // Display queue time or "ON AIR" badge?
                if (!fullMeta.playing && (fullMeta.state === 'live_on' || fullMeta.state === 'remote_on' || fullMeta.state === 'sports_on' || fullMeta.state === 'sportsremote_on')) {
                    $('.meta-queueLength').addClass('d-none');
                    $('.meta-onAir').removeClass('d-none');
                } else {
                    $('.meta-onAir').addClass('d-none');
                    $('.meta-queueLength').removeClass('d-none');
                }
            });

            // Time remaining
            animations.add('meta-remaining', () => {
                if (fullMeta.scheduledEnd) {
                    $('.meta-remaining').html(moment.duration(moment(fullMeta.scheduledEnd).diff(moment(fullMeta.time), 'minutes'), 'minutes').format("H [hrs] m [mins]"))
                    if (fullMeta.scheduledStart && moment().isSameOrAfter(moment(fullMeta.scheduledStart))) {
                        var totalMinutes = moment(fullMeta.scheduledEnd).diff(moment(fullMeta.scheduledStart), 'minutes');
                        var minutesLeft = moment(fullMeta.scheduledEnd).diff(moment(fullMeta.time), 'minutes');
                        var progress = 100 * (totalMinutes > 0 ? (minutesLeft / totalMinutes) : 0);
                        if (progress >= 0) {
                            $('.meta-remaining-progress').css('width', `${progress}%`);
                        } else {
                            $('.meta-remaining').html('OVER-RUN');
                            $('.meta-remaining-progress').css('width', `0%`);
                            $('.meta-remaining-box').removeClass('bg-teal');
                            $('.meta-remaining-box').addClass('bg-warning');
                            setTimeout(() => {
                                $('.meta-remaining-box').removeClass('bg-warning');
                                $('.meta-remaining-box').addClass('bg-teal');
                            }, 250)
                        }
                    } else {
                        $('.meta-remaining-progress').css('width', '100%');
                    }
                } else {
                    $('.meta-remaining').html('N/A');
                    $('.meta-remaining-progress').css('width', '0%');
                }
            });

            // Tick clockwheel clock
            animations.add('clockwheel-clock', () => {
                computeTimePositions($h, $m, $s);
                setSize($('#clockwheel-donut').width(), $('#clockwheel-donut').height());
            });

            // Countdown voice queues
            if (hosts.isHost) {
                if (fullMeta.state === 'sports_returning' || fullMeta.state === 'sportsremote_returning' || fullMeta.state === 'remote_returning' || fullMeta.state === 'automation_sports' || fullMeta.state === 'automation_sportsremote' || fullMeta.state === 'automation_remote' || fullMeta.state === 'sports_on' || fullMeta.state === 'sportsremote_on') {
                    if (queueLength === 60) { sounds.oneMinute.play() }
                    if (queueLength === 30) { sounds.thirtySeconds.play() }
                    if (queueLength === 15) { sounds.fifteenSeconds.play() }
                    if (queueLength === 10) { sounds.tenSeconds.play() }
                    if (queueLength === 5) { sounds.fiveSeconds.play() }
                    if (queueLength === 1) { sounds.oneSecond.play() }
                }
            }

            // Every minute, update clockwheel
            if (moment(fullMeta.time).seconds() === 0) {
                updateClockwheel();
            }

            // Flash icons
            animations.add('nav-icons-flash', () => {
                $('.nav-icon-flash-danger').addClass('text-danger');
                $('.nav-icon-flash-warning').addClass('text-warning');
                $('.nav-icon-flash-primary').addClass('text-primary');
                $('.nav-icon-flash-info').addClass('text-info');
                $('.nav-icon-flash-success').addClass('text-success');
                setTimeout(() => {
                    $('.nav-icon-flash-danger').removeClass('text-danger');
                    $('.nav-icon-flash-warning').removeClass('text-warning');
                    $('.nav-icon-flash-primary').removeClass('text-primary');
                    $('.nav-icon-flash-info').removeClass('text-info');
                    $('.nav-icon-flash-success').removeClass('text-success');
                }, 500);
            });

        } catch (e) {
            console.error(e);
            $(document).Toasts('create', {
                class: 'bg-danger',
                title: 'Error metaTick',
                body: 'There was an error in meta.metaTick. Please report this to the engineer.',
                autoHide: true,
                delay: 10000,
                icon: 'fas fa-skull-crossbones fa-lg',
            });
        }
    });



    /*
        DISCIPLINE CHECK
    */




    /**
     * Check if this client has an active discipline on WWSU's API, and if so, display the #modal-discipline.
     * 
     * @param {function} cb Callback executed if user is not under a discipline
     */
    function checkDiscipline (cb) {
        socket.post('/discipline/get-web', {}, function serverResponded (body) {
            try {
                var docb = true
                if (body.length > 0) {
                    body.map((discipline) => {
                        var activeDiscipline = (discipline.active && (discipline.action !== 'dayban' || moment(discipline.createdAt).add(1, 'days').isAfter(moment())))
                        if (activeDiscipline) { docb = false }
                        if (activeDiscipline || !discipline.acknowledged) {
                            $('#modal-discipline-title').html(`Disciplinary action ${activeDiscipline ? `active against you` : `was issued in the past against you`}`);
                            $('#modal-discipline-body').html(`<p>On ${moment(discipline.createdAt).format('LLL')}, disciplinary action was issued against you for the following reason: ${discipline.message}.</p>
                <p>${activeDiscipline ? `A ${discipline.action} is currently active, and you are not allowed to use WWSU's services at this time.` : `The discipline has expired, but you must acknowledge this message before you may use WWSU's services. Further issues may warrant more severe disciplinary action.`}</p>
                <p>Please contact gm@wwsu1069.org if you have any questions or concerns.</p>`);
                            $('#modal-discipline').modal({ backdrop: 'static', keyboard: false });
                        }
                    })
                }
                if (docb) {
                    cb()
                }
            } catch (e) {
                console.error(e);
                $(document).Toasts('create', {
                    class: 'bg-danger',
                    title: 'Error checking discipline',
                    body: 'There was an error checking to see if you are allowed to access WWSU. Please try again later, or contact the engineer if this problem continues.',
                    autoHide: true,
                    delay: 10000,
                    icon: 'fas fa-skull-crossbones fa-lg',
                })
            }
        })
    }




    /*
        STATUS EVENTS
    */



    /**
     * Function called on every change in status
     * 
     * @param {array} db Array of status systems and their statuses from the WWSU model
     */
    function processStatus (db) {
        var globalStatus = 5;

        // Process each status and generate content
        var html = `<ul>`;
        todos.status = {
            danger: 0,
            orange: 0,
            warning: 0,
            info: 0,
            primary: 0
        };
        recountTodos();
        db
            .filter((record) => record.status <= 4)
            .sort((a, b) => a.status - b.status)
            .map((record) => {
                if (globalStatus > record.status) {
                    globalStatus = record.status;
                }
                switch (record.status) {
                    case 1:
                        html += `<li>
                        <span class="badge badge-danger">CRITICAL</span> <strong>${record.label}</strong>: ${record.data}
                        </li>`;
                        todos.status.danger++;
                        break;
                    case 2:
                        html += `<li>
                        <span class="badge bg-orange text-white">Major</span> <strong>${record.label}</strong>: ${record.data}
                        </li>`
                        todos.status.orange++;
                        break;
                    case 3:
                        html += `<li>
                        <span class="badge badge-warning">Minor</span> <strong>${record.label}</strong>: ${record.data}
                        </li>`
                        todos.status.warning++;
                        break;
                    case 4:
                        html += `<li>
                        <span class="badge badge-info">Info</span> <strong>${record.label}</strong>: ${record.data}
                        </li>`
                        todos.status.info++;
                        break;
                }
            });
        html += `</ul>`;
        recountTodos();

        animations.add('status-model', () => {
            status.statusModal.body = html;
            $('.system-status').html(html);
        });

        // Process global status indications
        animations.add('status-global', () => {
            $('.status-global-color').removeClass('bg-danger');
            $('.status-global-color').removeClass('bg-orange');
            $('.status-global-color').removeClass('bg-warning');
            $('.status-global-color').removeClass('bg-info');
            $('.status-global-color').removeClass('bg-success');
            $('.status-global-color').removeClass('bg-gray');
            switch (globalStatus) {
                case 1:
                    $('.status-global').html('CRITICAL');
                    $('.status-global-color').addClass('bg-danger');
                    break;
                case 2:
                    $('.status-global').html('Major');
                    $('.status-global-color').addClass('bg-orange');
                    break;
                case 3:
                    $('.status-global').html('Minor');
                    $('.status-global-color').addClass('bg-warning');
                    break;
                case 4:
                    $('.status-global').html('Info');
                    $('.status-global-color').addClass('bg-info');
                    break;
                case 5:
                    $('.status-global').html('Good');
                    $('.status-global-color').addClass('bg-success');
                    break;
            }
        });
    }

    status.on('replace', (db) => {
        processStatus(db.get());
    })
    status.on('insert', (query, db) => {
        processStatus(db.get());
    })
    status.on('update', (query, db) => {
        processStatus(db.get());
    })
    status.on('remove', (query, db) => {
        processStatus(db.get());
    })




    /*
        EAS EVENTS
    */




    /**
     * Function called on every change in EAS
     * 
     * @param {array} db Array of active EAS alerts
     */
    function processEas (db) {
        //if (hosts.isHost)
        eas.displayAlerts();

        var globalEas = 5;

        // Process each status and generate content
        var html = `<ul>`;
        db
            .map((record) => {
                switch (record.severity) {
                    case "Extreme":
                        html += `<li>
                        <span class="badge badge-danger">EXTREME</span> <strong>${record.alert}</strong>: in effect for ${record.counties} from ${moment(record.starts).format("llll")} until ${moment(record.expires).format("llll")}.
                        </li>`;
                        if (globalEas > 1)
                            globalEas = 1;
                        break;
                    case "Severe":
                        html += `<li>
                        <span class="badge bg-orange">Severe</span> <strong>${record.alert}</strong>: in effect for ${record.counties} from ${moment(record.starts).format("llll")} until ${moment(record.expires).format("llll")}.
                        </li>`;
                        if (globalEas > 2)
                            globalEas = 2;
                        break;
                    case "Moderate":
                        html += `<li>
                        <span class="badge badge-warning">Moderate</span> <strong>${record.alert}</strong>: in effect for ${record.counties} from ${moment(record.starts).format("llll")} until ${moment(record.expires).format("llll")}.
                        </li>`;
                        if (globalEas > 3)
                            globalEas = 3;
                        break;
                    case "Minor":
                        html += `<li>
                        <span class="badge badge-info">Minor</span> <strong>${record.alert}</strong>: in effect for ${record.counties} from ${moment(record.starts).format("llll")} until ${moment(record.expires).format("llll")}.
                        </li>`;
                        if (globalEas > 4)
                            globalEas = 4;
                        break;
                }
            });
        html += `</ul>`;

        animations.add('eas-model', () => {
            eas.easModal.body = html;
        });

        // Process global status indications
        animations.add('eas-global', () => {
            $('.eas-global-color').removeClass('bg-danger');
            $('.eas-global-color').removeClass('bg-orange');
            $('.eas-global-color').removeClass('bg-warning');
            $('.eas-global-color').removeClass('bg-info');
            $('.eas-global-color').removeClass('bg-success');
            $('.eas-global-color').removeClass('bg-gray');
            switch (globalEas) {
                case 1:
                    $('.eas-global').html('EXTREME');
                    $('.eas-global-color').addClass('bg-danger');
                    break;
                case 2:
                    $('.eas-global').html('Severe');
                    $('.eas-global-color').addClass('bg-orange');
                    break;
                case 3:
                    $('.eas-global').html('Moderate');
                    $('.eas-global-color').addClass('bg-warning');
                    break;
                case 4:
                    $('.eas-global').html('Minor');
                    $('.eas-global-color').addClass('bg-info');
                    break;
                case 5:
                    $('.eas-global').html('None');
                    $('.eas-global-color').addClass('bg-success');
                    break;
            }
        });
    }

    eas.on('replace', (db) => {
        processEas(db.get());
    })
    eas.on('insert', (query, db) => {
        processEas(db.get());
    })
    eas.on('update', (query, db) => {
        processEas(db.get());
    })
    eas.on('remove', (query, db) => {
        processEas(db.get());
    })




    /*
        ANNOUNCEMENTS EVENTS
    */




    /**
    * Function called on every change in announcements
    * 
    * @param {array} db Array of announcements
    */
    function processAnnouncements (db) {
        animations.add('announcements', () => {
            // First, process djcontrols announcements for the dashboard
            var html = ``;
            db
                .filter((record) => record.type === 'djcontrols' && moment(meta.meta.time).isSameOrAfter(record.starts) && moment(meta.meta.time).isBefore(record.expires))
                .map((record) => {
                    if (record.level === 'trivial')
                        record.level === 'secondary';
                    html += `<div class="alert alert-${record.level}">
                <h5>${record.title}</h5>
                ${record.announcement}
              </div>`;
                });
            $('.announcements').html(html);

            // Then, if admin, process announcements for the announcements options menu.
            if (hosts.client.admin) {
                announcements.updateTable();
                djs.updateTable();
            }
        });
    }

    announcements.on('replace', (db) => {
        processAnnouncements(db.get());
    })
    announcements.on('insert', (query, db) => {
        processAnnouncements(db.get());
    })
    announcements.on('update', (query, db) => {
        processAnnouncements(db.get());
    })
    announcements.on('remove', (query, db) => {
        processAnnouncements(db.get());
    })




    /*
        CALENDAR EVENTS AND FUNCTIONS
    */



    function updateCalendar () {
        updateClockwheel();
        fullCalendar.refetchEvents();
    }

    function updateClockwheel () {
        // Ask the calendar process to recalculate clockwheel segments
        calendar.getEvents((events) => window.ipcRenderer.send('calendar', [ 'update-clockwheel', [ events, meta.meta ] ]))
    }

    /**
     * When the calendar process returns new data for the clockwheel, update the clockwheel
     * 
     * @var {object} arg[0] New data object for the clockwheel Chart.js
     */
    window.ipcRenderer.on('update-clockwheel', (event, arg) => {
        animations.add('update-clockwheel', () => {
            var clockwheelDonutData = arg[ 0 ];
            clockwheelDonut.data = clockwheelDonutData;
            clockwheelDonut.update();
        });
    })

    // execute updateCalendar function each time calendar has been changed, but add a 1-second buffer so we don't update a million times at once.
    var calTimer;
    calendar.on('calendarUpdated', () => {
        clearTimeout(calTimer);
        calTimer = setTimeout(() => {
            updateCalendar();
        }, 1000);
    });




    /*
        LOGS FUNCTIONS
    */





    // Count event throws number of issues that need reviewed.
    logs.on('count', (danger, orange, warning, info) => {
        todos.accountability = {
            danger,
            orange,
            warning,
            info,
            primary: 0
        };
        recountTodos();
    })

    function recountTodos () {
        animations.add('recount-todos', () => {
            var danger = todos.status.danger + todos.accountability.danger + todos.timesheets.danger + todos.DJs.danger;
            var orange = todos.status.orange + todos.accountability.orange + todos.timesheets.orange + todos.DJs.orange;
            var warning = todos.status.warning + todos.accountability.warning + todos.timesheets.warning + todos.DJs.warning;
            var info = todos.status.info + todos.accountability.info + todos.timesheets.info + todos.DJs.info;
            var primary = todos.status.primary + todos.accountability.primary + todos.timesheets.primary + todos.DJs.primary;

            $('.notifications-danger').html(danger);
            $('.notifications-orange').html(orange);
            $('.notifications-warning').html(warning);
            $('.notifications-info').html(info);
            $('.notifications-primary').html(primary);

            $('.nav-icon-notifications').removeClass('nav-icon-flash-danger');
            $('.nav-icon-notifications').removeClass('text-danger');
            $('.nav-icon-notifications').removeClass('nav-icon-flash-warning');
            $('.nav-icon-notifications').removeClass('text-warning');
            $('.nav-icon-notifications').removeClass('nav-icon-flash-info');
            $('.nav-icon-notifications').removeClass('text-info');

            if (danger > 0) {
                $('.nav-icon-notifications').addClass('nav-icon-flash-danger');
            } else if (orange > 0) {
                $('.nav-icon-notifications').addClass('nav-icon-flash-warning');
            } else if (warning > 0) {
                $('.nav-icon-notifications').addClass('nav-icon-flash-warning');
            } else if (info > 0) {
                $('.nav-icon-notifications').addClass('nav-icon-flash-info');
            } else if (primary > 0) {
                $('.nav-icon-notifications').addClass('nav-icon-flash-primary');
            }
        });
    }




    /*
        TRACK REQUESTS FUNCTIONS
    */





    requests.on('replace', (db) => {
        requests.updateTable();
    })
    requests.on('insert', (query, db) => {
        requests.updateTable();
    })
    requests.on('update', (query, db) => {
        requests.updateTable();
    })
    requests.on('remove', (query, db) => {
        requests.updateTable();
    })




    /*
        DJ FUNCTIONS
    */




    djs.on('replace', (db) => {
        djs.updateTable();
    })
    djs.on('insert', (query, db) => {
        djs.updateTable();
    })
    djs.on('update', (query, db) => {
        djs.updateTable();
    })
    djs.on('remove', (query, db) => {
        djs.updateTable();
    })




    /*
        RECIPIENTS FUNCTIONS
    */




    recipients.on('replace', (db) => {
        messages.updateRecipientsTable();
    })
    recipients.on('insert', (query, db) => {
        messages.updateRecipientsTable();
    })
    recipients.on('update', (query, db) => {
        messages.updateRecipientsTable();
    })
    recipients.on('remove', (query, db) => {
        messages.updateRecipientsTable();
    })
    recipients.on('recipientChanged', (recipient) => {
        messages.changeRecipient(recipient);
    });




    /*
        MESSAGES FUNCTIONS
    */




    messages.on('replace', (db) => {
        messages.updateRecipient();
        messages.updateRecipientsTable();
    })
    messages.on('insert', (query, db) => {
        messages.updateRecipient();
        messages.updateRecipientsTable();
    })
    messages.on('update', (query, db) => {
        messages.updateRecipient();
        messages.updateRecipientsTable();
    })
    messages.on('remove', (query, db) => {
        messages.read = messages.read.filter((value) => value !== query);
        messages.notified = messages.notified.filter((value) => value !== query);
        messages.updateRecipient();
        messages.updateRecipientsTable();
    })

});