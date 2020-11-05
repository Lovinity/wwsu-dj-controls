"use strict";
window.addEventListener("DOMContentLoaded", () => {
	// Machine ID
	var machineID = window.ipc.getMachineId();
	$(".connecting-id").html(machineID);

	// Animation queue
	var animations = new WWSUanimations();

	// Connection
	io.sails.url = "https://server.wwsu1069.org";
	io.sails.query = `host=${machineID}`;
	io.sails.reconnectionAttempts = 3;
	var socket = io.sails.connect();
	$("#connecting").removeClass("d-none");
	$("#loading").addClass("d-none");

	// WWSU Plugins
	var wwsuutil = new WWSUutil();
	var navigation = new WWSUNavigation();

	// WWSU Requests and Endpoint managers
	var noReq = new WWSUreq(socket, null);
	var meta = new WWSUMeta(socket, noReq);
	var hostReq = new WWSUreq(
		socket,
		machineID,
		null,
		null,
		"host",
		"/auth/host",
		"Host"
	);
	var directors = new WWSUdirectors(socket, noReq, machineID);
	var directorReq = new WWSUreq(
		socket,
		machineID,
		directors,
		null,
		"name",
		"/auth/director",
		"Director"
	);
	var logs = new WWSUlogs(socket, noReq, hostReq, directorReq, meta);
	var djs = new WWSUdjs(socket, noReq, directorReq, hostReq, logs, meta);
	var djReq = new WWSUreq(
		socket,
		machineID,
		djs,
		null,
		"name",
		"/auth/dj",
		"DJ"
	);
	var adminDirectorReq = new WWSUreq(
		socket,
		machineID,
		directors,
		{ admin: true },
		"name",
		"/auth/admin-director",
		"Administrator Director"
	);
	var status = new WWSUstatus(socket, noReq);
	var eas = new WWSUeas(socket, noReq, directorReq, meta);
	var announcements = new WWSUannouncements(
		socket,
		noReq,
		["all"],
		meta,
		directorReq
	);
	var calendar = new WWSUcalendar(socket, meta, noReq, directorReq, djReq);
	var subscriptions = new WWSUsubscriptions(socket, noReq);
	var api = new WWSUapi(noReq, hostReq, djReq, directorReq, adminDirectorReq);
	var discipline = new WWSUdiscipline(socket, noReq, directorReq, meta);
	var requests = new WWSUrequests(socket, hosts, hostReq);
	var recipients = new WWSUrecipients(socket, meta, hostReq);
	var hosts = new WWSUhosts(
		socket,
		meta,
		recipients,
		machineID,
		window.ipc.getAppVersion(),
		hostReq,
		directorReq,
		djs
	);
	var timesheets = new WWSUtimesheet(
		socket,
		noReq,
		directors,
		adminDirectorReq,
		meta,
		hosts
	);
	var messages = new WWSUmessages(
		socket,
		recipients,
		meta,
		hosts,
		null,
		hostReq
	);
	var state = new WWSUstate(socket, hosts, calendar, hostReq);
	var climacell = new WWSUclimacell(socket, noReq, meta);
	var inventory = new WWSUinventory(socket, meta, hostReq, directorReq);
	var version = new WWSUversion(socket, `wwsu-dj-controls`, hostReq);
	var silence = new WWSUSilence(hostReq);
	var remote = new WWSUremote(socket, hostReq);

	// Sound alerts
	var sounds = {
		onBreak: new Howl({ src: ["assets/voice-queues/break.mp3"] }),
		oneMinute: new Howl({ src: ["assets/voice-queues/oneMinute.mp3"] }),
		thirtySeconds: new Howl({
			src: ["assets/voice-queues/thirtySeconds.mp3"],
		}),
		fifteenSeconds: new Howl({
			src: ["assets/voice-queues/fifteenSeconds.mp3"],
		}),
		tenSeconds: new Howl({ src: ["assets/voice-queues/tenSeconds.mp3"] }),
		fiveSeconds: new Howl({ src: ["assets/voice-queues/fiveSeconds.mp3"] }),
		oneSecond: new Howl({ src: ["assets/voice-queues/oneSecond.mp3"] }),
	};

	// Variables
	var breakNotified = false; // Did we notify the DJ they have to take a top of hour ID break?

	var queueLength = 0; // Current queue in seconds

	var countDown = 0; // Countdown to on air in seconds

	var audioDevices = [];

	var pendingHostCall;

	var todos = {
		status: {
			danger: 0,
			orange: 0,
			warning: 0,
			info: 0,
			primary: 0,
		},
		accountability: {
			danger: 0,
			orange: 0,
			warning: 0,
			info: 0,
			primary: 0,
		},
		timesheets: {
			danger: 0,
			orange: 0,
			warning: 0,
			info: 0,
			primary: 0,
		},
		DJs: {
			danger: 0,
			orange: 0,
			warning: 0,
			info: 0,
			primary: 0,
		},
	};

	// Navigation
	var navigation = new WWSUNavigation();
	navigation.addItem(
		"#nav-dashboard",
		"#section-dashboard",
		"Dashboard - WWSU DJ Controls",
		"/",
		true
	);
	navigation.addItem(
		"#nav-announcements-view",
		"#section-announcements-view",
		"View Announcements - WWSU DJ Controls",
		"/announcements-view",
		false
	);
	navigation.addItem(
		"#nav-chat",
		"#section-chat",
		"Messages / Chat - WWSU DJ Controls",
		"/chat",
		false
	);
	navigation.addItem(
		"#nav-requests",
		"#section-requests",
		"Track requests - WWSU DJ Controls",
		"/requests",
		false
	);
	navigation.addItem(
		"#nav-weather",
		"#section-weather",
		"Weather - WWSU DJ Controls",
		"/weather",
		false
	);
	// navigation.addItem('#nav-news', '#section-news', 'News - WWSU DJ Controls', '/news', false);
	navigation.addItem(
		"#nav-report",
		"#section-report",
		"Report a Problem - WWSU DJ Controls",
		"/report",
		false
	);

	navigation.addItem(
		"#nav-audio",
		"#section-audio",
		"Audio Settings - WWSU DJ Controls",
		"/audio",
		false
	);

	navigation.addItem(
		"#nav-serial",
		"#section-serial",
		"Serial Port Settings - WWSU DJ Controls",
		"/serial",
		false
	);


	navigation.addItem(
		"#nav-notifications",
		"#section-notifications",
		"Notifications / Todo - WWSU DJ Controls",
		"/notifications",
		false
	);
	navigation.addItem(
		"#nav-announcements",
		"#section-announcements",
		"Manage Announcements - WWSU DJ Controls",
		"/announcements",
		false
	);
	navigation.addItem(
		"#nav-api",
		"#section-api",
		"Make API Query - WWSU DJ Controls",
		"/api",
		false
	);
	navigation.addItem(
		"#nav-calendar",
		"#section-calendar",
		"Manage Calendar - WWSU DJ Controls",
		"/calendar",
		false,
		() => {
			fullCalendar.updateSize();
		}
	);
	navigation.addItem(
		"#nav-directors",
		"#section-directors",
		"Manage Directors - WWSU DJ Controls",
		"/directors",
		false
	);
	navigation.addItem(
		"#nav-djs",
		"#section-djs",
		"Manage DJs - WWSU DJ Controls",
		"/djs",
		false
	);
	navigation.addItem(
		"#nav-hosts",
		"#section-hosts",
		"Manage Hosts - WWSU DJ Controls",
		"/hosts",
		false
	);
	navigation.addItem(
		"#nav-inventory",
		"#section-inventory",
		"Manage Inventory - WWSU DJ Controls",
		"/inventory",
		false
	);
	navigation.addItem(
		"#nav-logs",
		"#section-logs",
		"Operation Logs - WWSU DJ Controls",
		"/logs",
		false
	);
	navigation.addItem(
		"#nav-timesheets",
		"#section-timesheets",
		"Director timesheets - WWSU DJ Controls",
		"/timesheets",
		false
	);

	// Click events
	$(".status-more").click(() => {
		status.statusModal.iziModal("open");
	});
	$(".eas-more").click(() => {
		eas.easModal.iziModal("open");
	});
	$(".btn-calendar-definitions").click(() => {
		calendar.definitionsModal.iziModal("open");
	});
	$(".btn-calendar-prerequisites").click(() => {
		calendar.prerequisitesModal.iziModal("open");
	});
	$(".btn-manage-events").click(() => {
		calendar.showSimpleEvents();
	});
	$("#section-logs-date-browse").click(() => {
		logs.showAttendance($("#section-logs-date").val());
	});
	$(".chat-recipients").click(() => {
		recipients.openRecipients();
	});
	$("#section-audio-devices-refresh").click(() => {
		$("#section-audio-devices").block({
			message: "<h1>Refreshing audio process...</h1>",
			css: { border: "3px solid #a00" },
			timeout: 30000,
			onBlock: () => {
				window.ipc.main.send("audioRefreshDevices", [true]);
			},
		});
	});

	// Operation click events
	$(".btn-operation-resume").click(() => {
		state.return({});
	});
	$(".btn-operation-15-psa").click(() => {
		state.queuePSA({ duration: 15 });
	});
	$(".btn-operation-30-psa").click(() => {
		state.queuePSA({ duration: 30 });
	});
	$(".btn-operation-automation").click(() => {
		state.automation({ transition: false });
	});
	$(".btn-operation-switch").click(() => {
		state.automation({ transition: true });
	});
	$(".btn-operation-break").click(() => {
		state.break({ halftime: false, problem: false });
	});
	$(".btn-operation-extended-break").click(() => {
		state.break({ halftime: true, problem: false });
	});
	$(".btn-operation-top-add").click(() => {
		state.queueTopAdd({});
	});
	$(".btn-operation-liner").click(() => {
		state.queueLiner({});
	});
	$(".btn-operation-dump").click(() => {
		state.dump({});
	});
	$(".btn-operation-live").click(() => {
		state.showLiveForm();
	});
	$(".btn-operation-remote").click(() => {
		state.showRemoteForm();
	});

	// Initialize stuff
	status.initReportForm(`DJ Controls`, `#section-report-form`);
	logs.initAttendanceTable(`#section-logs-table-div`);
	logs.initDashboardLogs(`#section-dashboard-logs`);
	api.initApiForm("#section-api-form");
	requests.initTable(
		"#section-requests-table-div",
		"#nav-requests",
		".track-requests"
	);
	timesheets.init(
		`#section-timesheets-hours`,
		`#section-timesheets-records`,
		`#section-timesheets-start`,
		`#section-timesheets-end`,
		`#section-timesheets-browse`
	);
	messages.initComponents(
		".chat-active-recipient",
		".chat-status",
		".chat-messages",
		".chat-form",
		".chat-mute",
		".chat-ban",
		".messages-new-all",
		"#nav-messages"
	);

	// CLOCKWHEEL

	// Initialize clockwheel
	var clockwheelDonutCanvas = $("#clockwheel-donut").get(0).getContext("2d");
	var clockwheelDonutData = {
		labels: ["Not Yet Loaded"],
		datasets: [
			{
				data: [60],
				backgroundColor: ["#000000"],
			},
			{
				data: [720],
				backgroundColor: ["#000000"],
			},
		],
	};
	var clockwheelDonutOptions = {
		maintainAspectRatio: false,
		responsive: true,
		cutoutPercentage: 66,
		legend: {
			display: false,
		},
		animation: {
			animateRotate: false,
			animateScale: false,
		},
	};
	var clockwheelDonut = new Chart(clockwheelDonutCanvas, {
		type: "doughnut",
		data: clockwheelDonutData,
		options: clockwheelDonutOptions,
	});

	// Clockwheel Clock and functions
	var $h = $("#hour"),
		$m = $("#minute"),
		$s = $("#second");

	function computeTimePositions($h, $m, $s) {
		var now = moment.parseZone(meta.meta.time),
			h = now.hours(),
			m = now.minutes(),
			s = now.seconds(),
			ms = 0,
			degS,
			degM,
			degH;

		degS = s * 6 + (6 / 1000) * ms;
		degM = m * 6 + (6 / 60) * s + (6 / (60 * 1000)) * ms;
		degH = h * 30 + (30 / 60) * m;

		$s.css({ transform: "rotate(" + degS + "deg)" });
		$m.css({ transform: "rotate(" + degM + "deg)" });
		$h.css({ transform: "rotate(" + degH + "deg)" });
	}

	function setUpFace() {
		for (let x = 1; x <= 60; x += 1) {
			addTick(x);
		}

		function addTick(n) {
			var tickClass = "smallTick",
				tickBox = $('<div class="faceBox"></div>'),
				tick = $("<div></div>"),
				tickNum = "";

			if (n % 5 === 0) {
				tickClass = n % 15 === 0 ? "largeTick" : "mediumTick";
				tickNum = $('<div class="tickNum"></div>')
					.text(n / 5)
					.css({ transform: "rotate(-" + n * 6 + "deg)" });
				if (n >= 50) {
					tickNum.css({ left: "-0.5em" });
				}
			}

			tickBox
				.append(tick.addClass(tickClass))
				.css({ transform: "rotate(" + n * 6 + "deg)" });
			tickBox.append(tickNum);

			$("#clock").append(tickBox);
		}
	}

	function setSize(width, height) {
		var size = Math.min(width, height);
		size = size * 0.63;
		$(".clock").css("width", `${size}px`);
		$(".clock").css("height", `${size}px`);
		$(".clock").css("margin-top", `-${size / 2}px`);
		$(".clock").css("margin-left", `-${size / 2}px`);
	}

	setUpFace();
	computeTimePositions($h, $m, $s);

	// Define recorder function
	function startRecording(delay) {
		let startRecording = null;
		let preText = ``;
		let preText2 = ``;
		let temp = ``;

		if (meta.meta.state === "live_on" || meta.meta.state === `prerecord_on`) {
			startRecording = "live";
			temp = meta.meta.show.split(" - ");
			preText = window.sanitize.string(temp[1]);
			preText2 = `${window.sanitize.string(meta.meta.show)}${
				meta.meta.state === `prerecord_on` ? ` PRERECORDED` : ``
			}`;
		} else if (meta.meta.state === "remote_on") {
			startRecording = "remote";
			temp = meta.meta.show.split(" - ");
			preText = window.sanitize.string(temp[1]);
			preText2 = `${window.sanitize.string(meta.meta.show)}${
				meta.meta.state === `prerecord_on` ? ` PRERECORDED` : ``
			}`;
		} else if (
			meta.meta.state === "sports_on" ||
			meta.meta.state === "sportsremote_on"
		) {
			startRecording = "sports";
			preText = window.sanitize.string(meta.meta.show);
			preText2 = window.sanitize.string(meta.meta.show);
		} else if (
			meta.meta.state === `automation_on` ||
			meta.meta.state === `automation_genre` ||
			meta.meta.state === `automation_playlist`
		) {
			startRecording = "automation";
			preText = window.sanitize.string(meta.meta.genre);
			preText2 = window.sanitize.string(meta.meta.genre);
		} else if (
			meta.meta.state.includes("_break") ||
			meta.meta.state.includes("_returning") ||
			meta.meta.state.includes("_halftime")
		) {
			window.ipc.recorder.send("recorderStop", [delay]);
		} else {
			startRecording = "automation";
			preText = window.sanitize.string(meta.meta.genre);
			preText2 = window.sanitize.string(meta.meta.genre);
		}
		if (startRecording !== null) {
			if (hosts.client.recordAudio) {
				window.ipc.recorder.send("recorderStart", [
					`${startRecording}/${preText}/${preText2} (${moment().format(
						"YYYY_MM_DD HH_mm_ss"
					)})`,
					delay,
				]);
			} else {
				window.ipc.recorder.send("recorderStop", [-1]);
			}
		}
	}

	// CALENDAR

	// Initialize Calendar
	var calendarEl = document.getElementById("calendar");

	var fullCalendar = new FullCalendar.Calendar(calendarEl, {
		headerToolbar: {
			start: "prev,next today",
			center: "title",
			end: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
		},
		initialView: "timeGridWeek",
		navLinks: true, // can click day/week names to navigate views
		selectable: false,
		selectMirror: true,
		nowIndicator: true,
		editable: false,
		eventStartEditable: false,
		eventDurationEditable: false,
		eventResourceEditable: false,
		themeSystem: "bootstrap",
		dayMaxEvents: 5,
		events: function (info, successCallback, failureCallback) {
			$("#calendar").block({
				message: "<h1>Loading...</h1>",
				css: { border: "3px solid #a00" },
				timeout: 30000,
				onBlock: () => {
					calendar.getEvents(
						(events) => {
							events = events
								.filter((event) => {
									// Filter out events by filters
									if (event.scheduleType === "canceled-changed") return false;
									var temp = document.getElementById(`filter-${event.type}`);
									if (temp !== null && temp.checked) {
										return true;
									} else {
										return false;
									}
								})
								.map((event) => {
									var borderColor;
									var title = `${event.type}: ${event.hosts} - ${event.name}`;
									if (
										["canceled", "canceled-system"].indexOf(
											event.scheduleType
										) !== -1
									) {
										borderColor = "#ff0000";
										title += ` (CANCELED)`;
									} else if (
										["updated", "updated-system"].indexOf(
											event.scheduleType
										) !== -1
									) {
										borderColor = "#ffff00";
										title += ` (changed this occurrence)`;
									} else if (
										["unscheduled"].indexOf(event.scheduleType) !== -1
									) {
										borderColor = "#00ff00";
										title += ` (unscheduled/unauthorized)`;
									} else {
										borderColor = "#0000ff";
									}
									return {
										id: event.unique,
										groupId: event.calendarID,
										start: moment.parseZone(event.start).toISOString(true),
										end: moment.parseZone(event.end).toISOString(true),
										title: title,
										backgroundColor:
											["canceled", "canceled-system"].indexOf(
												event.scheduleType
											) === -1
												? event.color
												: "#161616",
										textColor: wwsuutil.getContrastYIQ(event.color)
											? "#161616"
											: "#e6e6e6",
										borderColor: borderColor,
										extendedProps: {
											event: event,
										},
									};
								});
							successCallback(events);
							fullCalendar.updateSize();
							$("#calendar").unblock();
						},
						moment(info.start).subtract(1, "days").toISOString(true),
						moment(info.end).toISOString(true)
					);
				},
			});
		},

		eventClick: function (info) {
			calendar.showClickedEvent(info.event.extendedProps.event);
		},
	});
	fullCalendar.render();

	// Add click events to the filter by switches
	[
		"show",
		"sports",
		"remote",
		"prerecord",
		"genre",
		"playlist",
		"event",
		"onair-booking",
		"prod-booking",
		"office-hours",
	].map((type) => {
		var temp = document.getElementById(`filter-${type}`);
		if (temp !== null) {
			temp.addEventListener("click", (e) => {
				fullCalendar.refetchEvents();
			});
		}
	});

	window.ipc.on("console", (event, arg) => {
		switch (arg[0]) {
			case "log":
				console.log(arg[1]);
				break;
			case "dir":
				console.dir(arg[1]);
				break;
			case "error":
				console.error(arg[1]);
				break;
		}
	});

	// When the recorder is ready, determine if a recording should be started
	window.ipc.on("recorderReady", (event, arg) => {
		$(".notifications-recorder").removeClass("badge-secondary");
		$(".notifications-recorder").addClass("badge-warning");
		startRecording(-1);
	});

	// Update recorder process status indication
	window.ipc.on("recorderStarted", (event, arg) => {
		$(".notifications-recorder").removeClass("badge-warning");
		$(".notifications-recorder").addClass("badge-success");
	});
	window.ipc.on("recorderStopped", (event, arg) => {
		$(".notifications-recorder").removeClass("badge-success");
		$(".notifications-recorder").addClass("badge-warning");
	});

	window.ipc.on("silenceReady", (event, arg) => {
		$(".notifications-silence").removeClass("badge-secondary");
		$(".notifications-silence").removeClass("badge-warning");
		$(".notifications-silence").removeClass("badge-danger");
		$(".notifications-silence").addClass("badge-success");
	});

	// Do things depending on state of silence detected
	window.ipc.on("silenceState", (event, arg) => {
		let triggered = false;

		$(".notifications-silence").removeClass("badge-secondary");
		$(".notifications-silence").removeClass("badge-warning");
		$(".notifications-silence").removeClass("badge-danger");
		$(".notifications-silence").removeClass("badge-success");

		switch (arg[0]) {
			case 0:
				$(".notifications-silence").addClass("badge-success");

				// Deactivate silence if the alarm is active
				let silenceStatus = status.find({ name: "silence" }, true);
				if (!silenceStatus || silenceStatus.status < 4 || triggered) {
					silence.inactive();
					triggered = false;
				}
				break;
			case 1:
				$(".notifications-silence").addClass("badge-warning");
				break;
			case 2:
				$(".notifications-silence").addClass("badge-danger");
				silence.active();
				triggered = true;
				break;
		}
	});

	// Volume for audio
	window.ipc.on("audioVolume", (event, arg) => {
		animations.add("audio-volume", () => {
			let device = audioDevices.find((dev) => dev.device.deviceId === arg[0]);
			device = audioDevices.indexOf(device);
			if (device > -1) {
				$(`.vu-left-${device}`).width(`${arg[1][0] * 100}%`);
				$(`.vu-right-${device}`).width(
					`${
						typeof arg[1][1] !== "undefined" ? arg[1][1] * 100 : arg[0][1] * 100
					}%`
				);
			}
		});
	});

	// Add a log in WWSU when a recording was saved
	window.ipc.on("recorderSaved", (event, arg) => {
		logs.add(
			{
				logtype: "recorder",
				logsubtype: "automation",
				loglevel: "info",
				logIcon: `fas fa-file-audio`,
				title: `A recording was saved.`,
				event: `Path: ${arg}`,
			},
			true
		);
	});

	window.ipc.on("audioDevices", (event, arg) => {
		console.log(`Audio: Received audio devices`);
		console.dir(arg);

		$("#section-audio-devices").unblock();

		let htmlInputs = ``;
		let htmlOutputs = ``;

		audioDevices = arg[0];

		if (arg[0] && arg[0].length > 0) {
			arg[0].map((device, index) => {
				if (device.device.kind === "audioinput") {
					htmlInputs += `<div class="p-2">
					<h5>${device.device.label}</h5>
					<div class="progress progress-xs">
						<div class="progress-bar bg-primary vu-left-${index}" data-id="${
						device.device.deviceId
					}" role="progressbar" style="width: 0%; transition: none;"></div>
					</div>
					<div class="progress progress-xs">
						<div class="progress-bar bg-primary vu-right-${index}" data-id="${
						device.device.deviceId
					}" role="progressbar" style="width: 0%; transition: none;"></div>
					</div>
					<div class="slider-primary" style="width: 100%;">
                      <input type="text" style="width: 100%;" id="audio-volume-${index}" data-id="${
						device.device.deviceId
					}" value="" class="slider form-control" data-slider-min="0" data-slider-max="2"
                           data-slider-step="0.01" data-slider-value="${
															device.settings.volume
														}" data-slider-orientation="horizontal"
                           data-slider-selection="before" data-slider-tooltip="show">
					</div>
					<div class="form-check form-check-inline" title="If checked, device ${
						device.device.label
					} will be streamed to WWSU when broadcasting remotely from this DJ Controls.">
    					<input type="checkbox" class="form-check-input" id="audio-remote-${index}" data-id="${
						device.device.deviceId
					}" ${device.settings.remote ? `checked` : ``}>
    					<label class="form-check-label" for="audio-remote-${index}">Remote Broadcast (Input)</label>
					  </div>
					<div class="form-check form-check-inline" title="If checked, device ${
						device.device.label
					} will be recorded if this DJ Controls is responsible for recording on-air programming. ONLY CHECK for sources that get a direct feed from WWSU.">
    					<input type="checkbox" class="form-check-input" id="audio-recorder-${index}" data-id="${
						device.device.deviceId
					}" ${device.settings.recorder ? `checked` : ``}>
    					<label class="form-check-label" for="audio-recorder-${index}">Record</label>
					  </div>
					<div class="form-check form-check-inline" title="If checked, device ${
						device.device.label
					} will be monitored for silence if this DJ Controls is responsible for reporting silence. ONLY CHECK for sources that get a direct feed from WWSU.">
    					<input type="checkbox" class="form-check-input" id="audio-silence-${index}" data-id="${
						device.device.deviceId
					}" ${device.settings.silence ? `checked` : ``}>
    					<label class="form-check-label" for="audio-silence-${index}">Silence Detection</label>
  					</div>
					</div>`;

					window.requestAnimationFrame(() => {
						$(`#audio-volume-${index}`).bootstrapSlider({
							min: 0,
							max: 2,
							step: 0.01,
							ticks: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
							ticks_positions: [
								0,
								100 * (1 / 8),
								100 * (2 / 8),
								100 * (3 / 8),
								100 * (4 / 8),
								100 * (5 / 8),
								100 * (6 / 8),
								100 * (7 / 8),
								100,
							],
							ticks_labels: [
								"OFF",
								"25%",
								"50%",
								"75%",
								"100%",
								"125%",
								"150%",
								"175%",
								"200%",
							],
							ticks_snap_bounds: 0.025,
							value: device.settings.volume,
							orientation: "horizontal",
							selection: "before",
							tooltip: "show",
						});

						// Volume slider listener
						$(`#audio-volume-${index}`).off("change");
						$(`#audio-volume-${index}`).on("change", (obj) => {
							let deviceId = $(`#audio-volume-${index}`).data("id");
							window.ipc.main.send("audioChangeVolume", [
								deviceId,
								"audioinput",
								obj.value.newValue,
							]);
						});

						// Checkbox listeners
						$(`#audio-remote-${index}`).off("change");
						$(`#audio-remote-${index}`).on("change", (e) => {
							let deviceId = $(`#audio-remote-${index}`).data("id");
							console.log(`Clicked remote ${index}`);
							window.ipc.main.send("audioRemoteSettings", [
								deviceId,
								e.target.checked,
							]);
						});
						$(`#audio-recorder-${index}`).off("change");
						$(`#audio-recorder-${index}`).on("change", (e) => {
							let deviceId = $(`#audio-recorder-${index}`).data("id");
							console.log(`Clicked recorder ${index}`);
							window.ipc.main.send("audioRecorderSetting", [
								deviceId,
								"audioinput",
								e.target.checked,
							]);
						});
						$(`#audio-silence-${index}`).off("change");
						$(`#audio-silence-${index}`).on("change", (e) => {
							let deviceId = $(`#audio-silence-${index}`).data("id");
							console.log(`Clicked silence ${index}`);
							window.ipc.main.send("audioSilenceSetting", [
								deviceId,
								"audioinput",
								e.target.checked,
							]);
						});
					});
				} else if (device.device.kind === "audiooutput") {
					htmlOutputs += `<div class="p-2">
					<h5>${device.device.label}</h5>
					<div class="slider-primary" style="width: 100%;">
                      <input type="text" style="width: 100%;" id="audio-volume-${index}" data-id="${
						device.device.deviceId
					}" value="" class="slider form-control" data-slider-min="0" data-slider-max="2"
                           data-slider-step="0.01" data-slider-value="${
															device.settings.volume
														}" data-slider-orientation="horizontal"
                           data-slider-selection="before" data-slider-tooltip="show">
					</div>
					<div class="form-check form-check-inline" title="If checked and a remote broadcast is streaming to this host, the audio will be played through device ${
						device.device.label
					}. ONLY CHECK if this output device can be streamed over WWSU's airwaves.">
    					<input type="checkbox" class="form-check-input form-check-devices-output" id="audio-output-${index}" data-id="${
						device.device.deviceId
					}" ${device.settings.output ? `checked` : ``}>
    					<label class="form-check-label" for="audio-output-${index}">Remote Broadcast (Output)</label>
					  </div>
					<div class="form-check form-check-inline" title="If checked and doing a remote broadcast, audio queues of queue time and connection problems will be played through device ${
						device.device.label
					}.">
    					<input type="checkbox" class="form-check-input form-check-devices-queue" id="audio-queue-${index}" data-id="${
						device.device.deviceId
					}" ${device.settings.queue ? `checked` : ``}>
    					<label class="form-check-label" for="audio-queue-${index}">Audio Queues</label>
					  </div>
  					</div>
					</div>`;

					window.requestAnimationFrame(() => {
						$(`#audio-volume-${index}`).bootstrapSlider({
							min: 0,
							max: 2,
							step: 0.01,
							ticks: [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
							ticks_positions: [
								0,
								100 * (1 / 8),
								100 * (2 / 8),
								100 * (3 / 8),
								100 * (4 / 8),
								100 * (5 / 8),
								100 * (6 / 8),
								100 * (7 / 8),
								100,
							],
							ticks_labels: [
								"OFF",
								"25%",
								"50%",
								"75%",
								"100%",
								"125%",
								"150%",
								"175%",
								"200%",
							],
							ticks_snap_bounds: 0.025,
							value: device.settings.volume,
							orientation: "horizontal",
							selection: "before",
							tooltip: "show",
						});

						// Volume slider listener
						$(`#audio-volume-${index}`).off("change");
						$(`#audio-volume-${index}`).on("change", (obj) => {
							let deviceId = $(`#audio-volume-${index}`).data("id");
							window.ipc.main.send("audioChangeVolume", [
								deviceId,
								"audiooutput",
								obj.value.newValue,
							]);
						});

						// Checkbox listeners
						$(`#audio-output-${index}`).off("change");
						$(`#audio-output-${index}`).on("change", (e) => {
							if ($(`#audio-output-${index}`).prop("checked")) {
								$(`.form-check-devices-output`).each((index2, element) => {
									if (element.id !== `audio-output-${index}`) {
										$(element).prop({ checked: false });
									}
								});
								let deviceId = $(`#audio-output-${index}`).data("id");
								console.log(`Clicked output ${index}`);
								window.ipc.main.send("audioOutputSetting", [
									deviceId,
									"audiooutput",
									true,
								]);
							}
						});

						$(`#audio-queue-${index}`).off("change");
						$(`#audio-queue-${index}`).on("change", (e) => {
							if ($(`#audio-queue-${index}`).prop("checked")) {
								$(`.form-check-devices-queue`).each((index2, element) => {
									if (element.id !== `audio-queue-${index}`) {
										$(element).prop({ checked: false });
									}
								});
								let deviceId = $(`#audio-queue-${index}`).data("id");
								console.log(`Clicked queue ${index}`);
								window.ipc.main.send("audioQueueSetting", [
									deviceId,
									"audiooutput",
									true,
								]);
							}
						});
					});
				}
			});
		}

		$("#section-audio-devices-inputs").html(htmlInputs);
		$("#section-audio-devices-outputs").html(htmlOutputs);
	});

	// Crash checking
	window.ipc.on("processClosed", (event, arg) => {
		switch (arg[0]) {
			case "silence":
				$(".notifications-silence").removeClass("badge-success");
				$(".notifications-silence").removeClass("badge-warning");
				$(".notifications-silence").removeClass("badge-danger");
				$(".notifications-silence").addClass("badge-secondary");
				if (hosts.client.silenceDetection) {
					window.ipc.process.send("silence", ["open"]);
				}
				break;
			case "recorder":
				$(".notifications-recorder").removeClass("badge-success");
				$(".notifications-recorder").removeClass("badge-warning");
				$(".notifications-recorder").removeClass("badge-danger");
				$(".notifications-recorder").addClass("badge-secondary");
				if (hosts.client.recordAudio) {
					window.ipc.process.send("recorder", ["open"]);
				}
				break;
			case "remote":
				recipients.registerPeer(null);
				$(".notifications-remote").removeClass("badge-success");
				$(".notifications-remote").removeClass("badge-warning");
				$(".notifications-remote").removeClass("badge-danger");
				$(".notifications-remote").addClass("badge-secondary");

				// Re-open the process if we are supposed to be in a call
				if (
					meta.meta.hostCalled === hosts.client.ID ||
					meta.meta.hostCalling === hosts.client.ID
				) {
					window.ipc.process.send("remote", ["open"]);
				}
				break;
		}
	});

	// Delay system status returned from main process
	window.ipc.on("delay", (event, args) => {
		state.delayStatus({ seconds: args[0], bypass: args[1] });
	});

	// Construct serial port settings
	let serialPorts = window.ipc.getSerialPorts();
	let delayPorts = `<option value="">(NONE)</option>`;
	if (serialPorts.constructor === Array) {
		serialPorts.map((port) => {
			delayPorts += `<option value="${port.path}">${port.path}</option>`;
		});
	}
	$("#section-serial-delay-port").html(delayPorts);
	window.requestAnimationFrame(() => {
		let delaySettings = window.settings.delay;
		$("#section-serial-delay-port").val(delaySettings.port);
	})
	$("#section-serial-delay-port").on("change", (e) => {
		let val = $(e.target).val();
		window.saveSettings.delay("port", val);
	});

	/*
        SOCKET EVENTS AND FUNCTIONS
    */

	// Connected to WWSU
	socket.on("connect", () => {
		$("#reconnecting").addClass("d-none");
		$("#connecting").addClass("d-none");
		$("#unauthorized").addClass("d-none");
		$("#content").removeClass("d-none");
		socket._raw.io._reconnectionAttempts = Infinity;

		discipline.checkDiscipline(() => {
			hosts.get((success) => {
				if (success === 1) {
					meta.init();
					directors.init();
					djs.init();
					calendar.init();
					status.init();
					eas.init();
					announcements.init();
					requests.init();
					recipients.init();
					messages.init();
					climacell.init();
					inventory.init();
					version.init();
					if (hosts.client.admin) {
						$(".nav-admin").removeClass("d-none");
						announcements.initTable("#section-announcements-content");
						djs.initTable("#section-djs-content");
						directors.initTable("#section-directors-content");
						hosts.initTable("#section-hosts-content");
						inventory.initTable("#section-inventory-content");
						logs.initIssues();
						logs.initIssuesTable("#section-notifications-issues");
					}

					// If this DJ Controls is supposed to monitor/report silence, open the silence process, else close it.
					if (hosts.client.silenceDetection) {
						window.ipc.process.send("silence", ["open"]);
					} else {
						window.ipc.process.send("silence", ["close"]);
					}

					// If this DJ Controls is supposed to record, open the recorder process, else close it.
					if (hosts.client.recordAudio) {
						window.ipc.process.send("recorder", ["open"]);
					} else {
						window.ipc.process.send("recorder", ["close"]);
					}

					// Delay system
					window.ipc.restartDelay(hosts.client.delaySystem);
				} else if (success === -1) {
					$("#content").addClass("d-none");
					$("#already-connected").removeClass("d-none");
				} else if (success === 0) {
					$("#content").addClass("d-none");
					$("#unauthorized").removeClass("d-none");
				}
			});
		});
	});

	// Disconnected from WWSU
	socket.on("disconnect", () => {
		$("#reconnecting").removeClass("d-none");
		$("#connecting").addClass("d-none");
		$("#unauthorized").addClass("d-none");
		$("#content").addClass("d-none");
		window.ipc.flashMain(true);
	});

	// Connection error
	socket.on("reconnect_failed", (error) => {
		$("#unauthorized").removeClass("d-none");
		$("#connecting").addClass("d-none");
		$("#reconnecting").addClass("d-none");
		$("#content").addClass("d-none");
		window.ipc.flashMain(true);
	});

	socket.on("error", () => {
		if (!hosts.connectedBefore) {
			$("#unauthorized").removeClass("d-none");
			$("#connecting").addClass("d-none");
			$("#reconnecting").addClass("d-none");
			$("#content").addClass("d-none");
			window.ipc.flashMain(true);
		}
	});

	/*
        META EVENTS
    */

	// New meta information
	meta.on("newMeta", "renderer", (updated, fullMeta) => {
		try {
			// handle changingState blocking operations buttons
			if (typeof updated.changingState !== "undefined") {
				if (updated.changingState !== null) {
					$(".operations").block({
						message: `<h4>${updated.changingState}</h4>`,
						css: { border: "3px solid #a00" },
						timeout: 60000,
					});
				} else {
					$(".operations").unblock();
				}
			}

			// Changes in attendance ID? Update logs.
			if (typeof updated.attendanceID !== "undefined") {
				logs.setAttendanceID(updated.attendanceID);
			}

			// Update dump button seconds
			if (typeof updated.delaySystem !== "undefined") {
				$(".operation-dump-time").html(
					`${
						updated.delaySystem === null
							? `Turn On`
							: `${updated.delaySystem} sec`
					}`
				);
			}

			// On break voice queue
			if (
				typeof updated.state !== "undefined" &&
				hosts.isHost &&
				(fullMeta.state === "sports_break" ||
					fullMeta.state === "sports_halftime" ||
					fullMeta.state === "remote_break" ||
					fullMeta.state === "sportsremote_break" ||
					fullMeta.state === "sportsremote_halftime")
			) {
				sounds.onBreak.play();
			}

			// Update now playing info
			if (typeof updated.line1 !== "undefined") {
				animations.add("meta-line1", () => {
					$(".meta-line1").html(updated.line1);
				});
			}
			if (typeof updated.line2 !== "undefined") {
				animations.add("meta-line2", () => {
					$(".meta-line2").html(updated.line2);
				});
			}

			// Update online listeners
			if (typeof updated.listeners !== "undefined") {
				animations.add("meta-listeners", () => {
					$(".meta-listeners").html(updated.listeners);
				});
			}

			// Determine which operation buttons should be visible depending on system state
			// Also determine color of status info
			if (typeof updated.state !== "undefined") {
				animations.add("meta-state", () => {
					$(".operation-button").addClass("d-none");
					$(".card-meta").removeClass("bg-gray-dark");
					$(".card-meta").removeClass("bg-danger");
					$(".card-meta").removeClass("bg-warning");
					$(".card-meta").removeClass("bg-success");
					$(".card-meta").removeClass("bg-info");
					$(".card-meta").removeClass("bg-primary");
					$(".card-meta").removeClass("bg-indigo");
					$(".card-meta").removeClass("bg-secondary");
					$(".card-meta").removeClass("bg-pink");

					switch (updated.state) {
						case "automation_on":
						case "automation_break":
							$(".card-meta").addClass("bg-secondary");
							break;
						case "automation_playlist":
							$(".card-meta").addClass("bg-primary");
							break;
						case "automation_genre":
							$(".card-meta").addClass("bg-info");
							break;
						case "automation_prerecord":
						case "automation_live":
						case "automation_sports":
						case "automation_remote":
						case "automation_sportsremote":
							$(".card-meta").addClass("bg-warning");
							break;
						case "prerecord_on":
						case "prerecord_break":
							$(".card-meta").addClass("bg-pink");
							break;
						case "live_returning":
						case "live_break":
						case "live_on":
							$(".card-meta").addClass("bg-danger");
							break;
						case "remote_returning":
						case "remote_break":
						case "remote_on":
							$(".card-meta").addClass("bg-indigo");
							break;
						case "sports_returning":
						case "sportsremote_returning":
						case "sports_break":
						case "sports_halftime":
						case "sportsremote_break":
						case "sportsremote_halftime":
							$(".card-meta").addClass("bg-success");
							break;
						default:
							$(".card-meta").addClass("bg-secondary");
					}

					switch (updated.state) {
						case "automation_on":
						case "automation_break":
						case "automation_playlist":
						case "automation_genre":
						case "automation_prerecord":
						case "prerecord_on":
						case "prerecord_break":
							$(".operation-live").removeClass("d-none");
							$(".operation-remote").removeClass("d-none");
							$(".operation-sports").removeClass("d-none");
							$(".operation-sportsremote").removeClass("d-none");
							break;
						case "live_returning":
						case "remote_returning":
						case "sports_returning":
						case "sportsremote_returning":
						case "automation_live":
						case "automation_sports":
						case "automation_remote":
						case "automation_sportsremote":
							$(".operation-15-psa").removeClass("d-none");
							$(".operation-30-psa").removeClass("d-none");
							break;
						case "live_break":
						case "remote_break":
						case "sports_break":
						case "sports_halftime":
						case "sportsremote_break":
						case "sportsremote_halftime":
							$(".operation-resume").removeClass("d-none");
							$(".operation-automation").removeClass("d-none");
							$(".operation-switch").removeClass("d-none");
							break;
						case "live_on":
							$(".operation-automation").removeClass("d-none");
							$(".operation-switch").removeClass("d-none");
							$(".operation-break").removeClass("d-none");
							$(".operation-top-add").removeClass("d-none");
							$(".operation-log").removeClass("d-none");
							break;
						case "sports_on":
							$(".operation-automation").removeClass("d-none");
							$(".operation-switch").removeClass("d-none");
							$(".operation-break").removeClass("d-none");
							$(".operation-extended-break").removeClass("d-none");
							$(".operation-liner").removeClass("d-none");
							break;
						case "remote_on":
							$(".operation-automation").removeClass("d-none");
							$(".operation-switch").removeClass("d-none");
							$(".operation-break").removeClass("d-none");
							$(".operation-top-add").removeClass("d-none");
							$(".operation-log").removeClass("d-none");
							$(".operation-dump").removeClass("d-none");
							break;
						case "sportsremote_on":
							$(".operation-automation").removeClass("d-none");
							$(".operation-switch").removeClass("d-none");
							$(".operation-break").removeClass("d-none");
							$(".operation-extended-break").removeClass("d-none");
							$(".operation-liner").removeClass("d-none");
							$(".operation-dump").removeClass("d-none");
							break;
					}
				});
			}

			// Recorder stuff
			if (typeof updated.state !== "undefined") {
				startRecording();
			}

			// Remote broadcast stuff
			if (typeof updated.hostCalled !== "undefined") {
				// Close remote process when no longer doing a remote call
				if (updated.hostCalled === null) {
					window.ipc.process.send("remote", ["close"]);

					// Open the remote process when someone wants to call this host and we are allowed to accept calls
				} else if (
					updated.hostCalled === hosts.client.ID &&
					hosts.client.answerCalls
				) {
					window.ipc.process.send("remote", ["open"]);
				}
			}
		} catch (e) {
			console.error(e);
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error newMeta",
				body:
					"There was an error in meta.newMeta. Please report this to the engineer.",
				autoHide: true,
				delay: 10000,
				icon: "fas fa-skull-crossbones fa-lg",
			});
		}
	});

	// Meta ticker
	meta.on("metaTick", "renderer", (fullMeta) => {
		try {
			// Calculate queue time and countdown time
			queueLength =
				fullMeta.queueFinish !== null
					? Math.round(
							moment(fullMeta.queueFinish).diff(
								moment(fullMeta.time),
								"seconds"
							)
					  )
					: 0;
			countDown =
				fullMeta.countdown !== null
					? Math.round(
							moment(fullMeta.countdown).diff(moment(fullMeta.time), "seconds")
					  )
					: 0;
			if (queueLength < 0) {
				queueLength = 0;
			}
			if (countDown < 0) {
				countDown = 0;
			}

			if (queueLength > 0 && countDown > 0) {
				if (countDown > 100) {
					window.ipc.progressMain(1);
				} else {
					window.ipc.progressMain(countDown / 100);
				}
			} else {
				window.ipc.progressMain(-1);
			}

			// Update station time
			animations.add("meta-time", () => {
				$(".meta-time").html(moment.parseZone(fullMeta.time).format("llll"));
			});

			// Update trackFinish
			animations.add("meta-trackFinish", () => {
				$(".meta-trackFinish").html(
					fullMeta.trackFinish !== null
						? moment
								.duration(
									moment(fullMeta.trackFinish).diff(
										moment(fullMeta.time),
										"seconds"
									),
									"seconds"
								)
								.format("HH:mm:ss")
						: ""
				);
			});

			// Make queue timer show current queue length (when visible)
			// Also flash operations bar when about to go on the air
			animations.add("meta-queue", () => {
				// Queue length and first track
				$(".meta-queueLength").html(
					fullMeta.queueCalculating
						? `<i class="fas fa-hourglass-half"></i>`
						: moment.duration(queueLength, "seconds").format("HH:mm:ss")
				);
				$(".meta-firstTrack").html(
					fullMeta.queueCalculating || fullMeta.countdown === null
						? `<i class="fas fa-hourglass-half"></i>`
						: moment.duration(countDown, "seconds").format("HH:mm:ss")
				);
				if (
					fullMeta.queueMusic &&
					(fullMeta.state.startsWith("_returning") ||
						fullMeta.state.startsWith("automation_"))
				) {
					$(".operation-firstTrack").removeClass("d-none");
				} else {
					$(".operation-firstTrack").addClass("d-none");
				}

				// Flash the WWSU Operations box when queue time goes below 15 seconds.
				if (
					queueLength < 15 &&
					queueLength > 0 &&
					hosts.isHost &&
					(fullMeta.state.endsWith("_returning") ||
						fullMeta.state.startsWith("automation_"))
				) {
					$(".operations-bar").removeClass("navbar-gray-dark");
					$(".operations-bar").addClass("navbar-fuchsia");
					setTimeout(function () {
						$(".operations-bar").removeClass("navbar-fuchsia");
						$(".operations-bar").addClass("navbar-gray-dark");
					}, 500);
				}

				// Display queue time or "ON AIR" badge?
				if (
					!fullMeta.playing &&
					(fullMeta.state === "live_on" ||
						fullMeta.state === "remote_on" ||
						fullMeta.state === "sports_on" ||
						fullMeta.state === "sportsremote_on")
				) {
					$(".meta-queueLength").addClass("d-none");
					$(".meta-onAir").removeClass("d-none");
				} else {
					$(".meta-onAir").addClass("d-none");
					$(".meta-queueLength").removeClass("d-none");
				}
			});

			// Time remaining
			animations.add("meta-remaining", () => {
				if (fullMeta.scheduledEnd) {
					$(".meta-remaining").html(
						moment
							.duration(
								moment(fullMeta.scheduledEnd).diff(
									moment(fullMeta.time),
									"minutes"
								),
								"minutes"
							)
							.format("H [hrs] m [mins]")
					);
					if (
						fullMeta.scheduledStart &&
						moment(fullMeta.time).isSameOrAfter(moment(fullMeta.scheduledStart))
					) {
						var totalMinutes = moment(fullMeta.scheduledEnd).diff(
							moment(fullMeta.scheduledStart),
							"minutes"
						);
						var minutesLeft = moment(fullMeta.scheduledEnd).diff(
							moment(fullMeta.time),
							"minutes"
						);
						var progress =
							100 * (totalMinutes > 0 ? minutesLeft / totalMinutes : 0);
						if (progress >= 0) {
							$(".meta-remaining-progress").css("width", `${progress}%`);
						} else {
							$(".meta-remaining").html("OVER-RUN");
							$(".meta-remaining-progress").css("width", `0%`);
							$(".meta-remaining-box").removeClass("bg-teal");
							$(".meta-remaining-box").addClass("bg-warning");
							setTimeout(() => {
								$(".meta-remaining-box").removeClass("bg-warning");
								$(".meta-remaining-box").addClass("bg-teal");
							}, 250);
						}
					} else {
						$(".meta-remaining-progress").css("width", "100%");
					}
				} else {
					$(".meta-remaining").html("N/A");
					$(".meta-remaining-progress").css("width", "0%");
				}
			});

			// Tick clockwheel clock
			animations.add("clockwheel-clock", () => {
				computeTimePositions($h, $m, $s);
				setSize(
					$("#clockwheel-donut").width(),
					$("#clockwheel-donut").height()
				);
			});

			// Countdown voice queues
			if (hosts.isHost) {
				if (
					fullMeta.state === "sports_returning" ||
					fullMeta.state === "sportsremote_returning" ||
					fullMeta.state === "remote_returning" ||
					fullMeta.state === "automation_sports" ||
					fullMeta.state === "automation_sportsremote" ||
					fullMeta.state === "automation_remote" ||
					fullMeta.state === "sports_on" ||
					fullMeta.state === "sportsremote_on"
				) {
					if (queueLength === 60) {
						sounds.oneMinute.play();
					}
					if (queueLength === 30) {
						sounds.thirtySeconds.play();
					}
					if (queueLength === 15) {
						sounds.fifteenSeconds.play();
					}
					if (queueLength === 10) {
						sounds.tenSeconds.play();
					}
					if (queueLength === 5) {
						sounds.fiveSeconds.play();
					}
					if (queueLength === 1) {
						sounds.oneSecond.play();
					}
				}
			}

			// Every minute, update clockwheel
			if (moment(fullMeta.time).seconds() === 0) {
				updateClockwheel();
			}

			// Flash backgrounds
			animations.add("bg-flash", () => {
				$(".bg-flash-danger").addClass("bg-danger");
				$(".bg-flash-warning").addClass("bg-warning");
				$(".bg-flash-primary").addClass("bg-primary");
				$(".bg-flash-info").addClass("bg-info");
				$(".bg-flash-success").addClass("bg-success");
				setTimeout(() => {
					$(".bg-flash-danger").removeClass("bg-danger");
					$(".bg-flash-warning").removeClass("bg-warning");
					$(".bg-flash-primary").removeClass("bg-primary");
					$(".bg-flash-info").removeClass("bg-info");
					$(".bg-flash-success").removeClass("bg-success");
				}, 500);
			});

			// Top of hour ID break reminder
			if (
				moment(fullMeta.time).minutes() >= 2 &&
				moment(fullMeta.time).minutes() < 5 &&
				moment(fullMeta.time).diff(moment(fullMeta.lastID), "minutes") >= 10 &&
				hosts.isHost
			) {
				if (!breakNotified) {
					breakNotified = true;
					window.ipc.main.send("makeNotification", [
						{
							title: "Top of Hour Break",
							bg: "warning",
							header: "Do Not Forget the Top of the Hour Break!",
							flash: true,
							body:
								"You are required to take a break before :05 past the hour unless you are ending your broadcast before then.",
						},
					]);
					window.ipc.flashMain(true);
				}
			} else if (breakNotified) {
				breakNotified = false;
			}
		} catch (e) {
			console.error(e);
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Error metaTick",
				body:
					"There was an error in meta.metaTick. Please report this to the engineer.",
				autoHide: true,
				delay: 10000,
				icon: "fas fa-skull-crossbones fa-lg",
			});
		}
	});

	/*
        STATUS EVENTS
    */

	/**
	 * Function called on every change in status
	 *
	 * @param {array} db Array of status systems and their statuses from the WWSU model
	 */
	function processStatus(db) {
		var globalStatus = 5;

		// Process each status and generate content
		var html = `<ul>`;
		todos.status = {
			danger: 0,
			orange: 0,
			warning: 0,
			info: 0,
			primary: 0,
		};
		recountTodos();
		db.filter((record) => record.status <= 4)
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
                        </li>`;
						todos.status.orange++;
						break;
					case 3:
						html += `<li>
                        <span class="badge badge-warning">Minor</span> <strong>${record.label}</strong>: ${record.data}
                        </li>`;
						todos.status.warning++;
						break;
					case 4:
						html += `<li>
                        <span class="badge badge-info">Info</span> <strong>${record.label}</strong>: ${record.data}
                        </li>`;
						todos.status.info++;
						break;
				}
			});
		html += `</ul>`;
		recountTodos();

		animations.add("status-model", () => {
			status.statusModal.body = html;
			$(".system-status").html(html);
		});

		// Process global status indications
		animations.add("status-global", () => {
			$(".status-global-color").removeClass("bg-danger");
			$(".status-global-color").removeClass("bg-orange");
			$(".status-global-color").removeClass("bg-warning");
			$(".status-global-color").removeClass("bg-info");
			$(".status-global-color").removeClass("bg-success");
			$(".status-global-color").removeClass("bg-gray");
			switch (globalStatus) {
				case 1:
					$(".status-global").html("CRITICAL");
					$(".status-global-color").addClass("bg-danger");
					break;
				case 2:
					$(".status-global").html("Major");
					$(".status-global-color").addClass("bg-orange");
					break;
				case 3:
					$(".status-global").html("Minor");
					$(".status-global-color").addClass("bg-warning");
					break;
				case 4:
					$(".status-global").html("Info");
					$(".status-global-color").addClass("bg-info");
					break;
				case 5:
					$(".status-global").html("Good");
					$(".status-global-color").addClass("bg-success");
					break;
			}
		});
	}

	status.on("change", "renderer", (db) => {
		processStatus(db.get());
	});

	/*
        EAS EVENTS
    */

	/**
	 * Function called on every change in EAS
	 *
	 * @param {array} db Array of active EAS alerts
	 */
	function processEas(db) {
		var globalEas = 5;

		// Process each status and generate content
		var html = `<ul>`;
		db.map((record) => {
			switch (record.severity) {
				case "Extreme":
					html += `<li>
                        <span class="badge badge-danger">EXTREME</span> <strong>${
													record.alert
												}</strong>: in effect for ${
						record.counties
					} from ${moment
						.tz(
							record.starts,
							meta.meta ? meta.meta.timezone : moment.tz.guess()
						)
						.format("llll")} until ${moment
						.tz(
							record.expires,
							meta.meta ? meta.meta.timezone : moment.tz.guess()
						)
						.format("llll")}.
                        </li>`;
					if (globalEas > 1) {
						globalEas = 1;
						window.ipc.flashMain(true);
					}
					break;
				case "Severe":
					html += `<li>
                        <span class="badge bg-orange">Severe</span> <strong>${
													record.alert
												}</strong>: in effect for ${
						record.counties
					} from ${moment
						.tz(
							record.starts,
							meta.meta ? meta.meta.timezone : moment.tz.guess()
						)
						.format("llll")} until ${moment
						.tz(
							record.expires,
							meta.meta ? meta.meta.timezone : moment.tz.guess()
						)
						.format("llll")}.
                        </li>`;
					if (globalEas > 2) globalEas = 2;
					break;
				case "Moderate":
					html += `<li>
                        <span class="badge badge-warning">Moderate</span> <strong>${
													record.alert
												}</strong>: in effect for ${
						record.counties
					} from ${moment
						.tz(
							record.starts,
							meta.meta ? meta.meta.timezone : moment.tz.guess()
						)
						.format("llll")} until ${moment
						.tz(
							record.expires,
							meta.meta ? meta.meta.timezone : moment.tz.guess()
						)
						.format("llll")}.
                        </li>`;
					if (globalEas > 3) globalEas = 3;
					break;
				case "Minor":
					html += `<li>
                        <span class="badge badge-info">Minor</span> <strong>${
													record.alert
												}</strong>: in effect for ${
						record.counties
					} from ${moment
						.tz(
							record.starts,
							meta.meta ? meta.meta.timezone : moment.tz.guess()
						)
						.format("llll")} until ${moment
						.tz(
							record.expires,
							meta.meta ? meta.meta.timezone : moment.tz.guess()
						)
						.format("llll")}.
                        </li>`;
					if (globalEas > 4) globalEas = 4;
					break;
			}
		});
		html += `</ul>`;

		animations.add("eas-model", () => {
			eas.easModal.body = html;
		});

		// Process global status indications
		animations.add("eas-global", () => {
			$(".eas-global-color").removeClass("bg-danger");
			$(".eas-global-color").removeClass("bg-orange");
			$(".eas-global-color").removeClass("bg-warning");
			$(".eas-global-color").removeClass("bg-info");
			$(".eas-global-color").removeClass("bg-success");
			$(".eas-global-color").removeClass("bg-gray");
			switch (globalEas) {
				case 1:
					$(".eas-global").html("EXTREME");
					$(".eas-global-color").addClass("bg-danger");
					break;
				case 2:
					$(".eas-global").html("Severe");
					$(".eas-global-color").addClass("bg-orange");
					break;
				case 3:
					$(".eas-global").html("Moderate");
					$(".eas-global-color").addClass("bg-warning");
					break;
				case 4:
					$(".eas-global").html("Minor");
					$(".eas-global-color").addClass("bg-info");
					break;
				case 5:
					$(".eas-global").html("None");
					$(".eas-global-color").addClass("bg-success");
					break;
			}
		});
	}

	eas.on("change", "renderer", (db) => {
		processEas(db.get());
	});
	eas.on("newAlert", "renderer", (record) => {
		if (record.severity === "Extreme") {
			iziToast.show({
				class: "flash-bg",
				title: "Life-threatening Alert In Effect",
				message: `A <strong>${
					record.alert
				}</strong> is in effect for the counties of ${
					record.counties
				} from ${moment
					.tz(record.starts, meta.meta ? meta.meta.timezone : moment.tz.guess())
					.format("MM/DD h:mmA Z")} until ${moment
					.tz(
						record.expires,
						meta.meta ? meta.meta.timezone : moment.tz.guess()
					)
					.format(
						"MM/DD h:mmA Z"
					)}. <strong>This is a life threatening emergency! You are advised to seek shelter immediately and potentially end any broadcasts early if you are in these counties.</strong>`,
				timeout: 900000,
				close: true,
				color: "red",
				drag: false,
				position: "center",
				closeOnClick: false,
				overlay: true,
				overlayColor: "rgba(255, 0, 0, 0.33)",
				zindex: 5000,
				layout: 2,
				image: `assets/images/extremeWeather.png`,
				maxWidth: 640,
			});
		} else if (record.severity === "Severe") {
			iziToast.show({
				class: "iziToast-eas-severe",
				title: "Severe Alert in Effect",
				message: `A <strong>${
					record.alert
				}</strong> is in effect for the counties of ${
					record.counties
				} from ${moment
					.tz(record.starts, meta.meta ? meta.meta.timezone : moment.tz.guess())
					.format("MM/DD h:mmA Z")} until ${moment
					.tz(
						record.expires,
						meta.meta ? meta.meta.timezone : moment.tz.guess()
					)
					.format(
						"MM/DD h:mmA Z"
					)}. Please keep an eye on the weather / latest news.`,
				timeout: 900000,
				close: true,
				color: "yellow",
				drag: false,
				position: "center",
				closeOnClick: true,
				overlay: true,
				zindex: 4000,
				layout: 2,
				image: `assets/images/severeWeather.png`,
				maxWidth: 640,
			});
		}
	});

	/*
        ANNOUNCEMENTS EVENTS
    */

	/**
	 * Function called on every change in announcements
	 *
	 * @param {array} db Array of announcements
	 */
	function processAnnouncements(db) {
		animations.add("announcements", () => {
			// First, process djcontrols announcements for the dashboard
			var html = ``;
			db.filter(
				(record) =>
					record.type === "djcontrols" &&
					moment(meta.meta.time).isSameOrAfter(record.starts) &&
					moment(meta.meta.time).isBefore(record.expires)
			).map((record) => {
				if (record.level === "trivial") record.level === "secondary";
				html += `<div class="alert alert-${record.level}">
                <h5>${record.title}</h5>
                ${record.announcement}
              </div>`;
			});
			$(".announcements").html(html);

			// Then, if admin, process announcements for the announcements options menu.
			if (hosts.client.admin) {
				announcements.updateTable();
				djs.updateTable();
			}
		});
	}

	announcements.on("change", "renderer", (db) => {
		processAnnouncements(db.get());
	});

	/*
        CALENDAR EVENTS AND FUNCTIONS
    */

	function updateCalendar() {
		updateClockwheel();
		fullCalendar.refetchEvents();
	}

	function updateClockwheel() {
		// Ask the calendar process to recalculate clockwheel segments
		calendar.getEvents((events) =>
			window.ipc.calendar.send("update-clockwheel", [events, meta.meta])
		);
	}

	/**
	 * When the calendar process returns new data for the clockwheel, update the clockwheel
	 *
	 * @var {object} arg[0] New data object for the clockwheel Chart.js
	 */
	window.ipc.on("update-clockwheel", (event, arg) => {
		animations.add("update-clockwheel", () => {
			var clockwheelDonutData = arg[0];
			clockwheelDonut.data = clockwheelDonutData;
			clockwheelDonut.update();
		});
	});

	// execute updateCalendar function each time calendar has been changed, but add a 1-second buffer so we don't update a million times at once.
	var calTimer;
	calendar.on("calendarUpdated", "renderer", () => {
		clearTimeout(calTimer);
		calTimer = setTimeout(() => {
			updateCalendar();
		}, 1000);
	});

	/*
        LOGS FUNCTIONS
    */

	// Count event throws number of issues that need reviewed.
	logs.on("count", "renderer", (danger, orange, warning, info) => {
		todos.accountability = {
			danger,
			orange,
			warning,
			info,
			primary: 0,
		};
		recountTodos();
	});

	function recountTodos() {
		animations.add("recount-todos", () => {
			var danger =
				todos.status.danger +
				todos.accountability.danger +
				todos.timesheets.danger +
				todos.DJs.danger;
			var orange =
				todos.status.orange +
				todos.accountability.orange +
				todos.timesheets.orange +
				todos.DJs.orange;
			var warning =
				todos.status.warning +
				todos.accountability.warning +
				todos.timesheets.warning +
				todos.DJs.warning;
			var info =
				todos.status.info +
				todos.accountability.info +
				todos.timesheets.info +
				todos.DJs.info;
			var primary =
				todos.status.primary +
				todos.accountability.primary +
				todos.timesheets.primary +
				todos.DJs.primary;

			$(".notifications-danger").html(danger);
			$(".notifications-orange").html(orange);
			$(".notifications-warning").html(warning);
			$(".notifications-info").html(info);
			$(".notifications-primary").html(primary);

			$("#nav-notifications").removeClass("pulse-danger");
			$("#nav-notifications").removeClass("pulse-warning");
			$("#nav-notifications").removeClass("pulse-info");
			$("#nav-notifications").removeClass("pulse-primary");

			if (danger > 0) {
				$("#nav-notifications").addClass("pulse-danger");
			} else if (orange > 0) {
				$("#nav-notifications").addClass("pulse-warning");
			} else if (warning > 0) {
				$("#nav-notifications").addClass("pulse-warning");
			} else if (info > 0) {
				$("#nav-notifications").addClass("pulse-info");
			} else if (primary > 0) {
				$("#nav-notifications").addClass("pulse-primary");
			}
		});
	}

	/*
        TRACK REQUESTS FUNCTIONS
    */

	requests.on("change", "renderer", (db) => {
		requests.updateTable();
	});
	requests.on("trackRequested", "renderer", (request) => {
		$(document).Toasts("create", {
			class: "bg-primary",
			title: "Track Requested",
			autohide: true,
			delay: 30000,
			body: `A track was requested.<br />
Track: <strong>${request.trackname}</strong>`,
			icon: "fas fa-record-vinyl fa-lg",
			position: "bottomRight",
		});
		window.ipc.flashMain(true);
	});

	/*
        DJ FUNCTIONS
    */

	djs.on("change", "renderer", (db) => {
		djs.updateTable();
	});

	/*
		DIRECTOR FUNCTIONS
	*/

	directors.on("change", "renderer", (db) => {
		directors.updateTable();
	});

	/*
        RECIPIENTS FUNCTIONS
    */

	recipients.on("change", "renderer", (db) => {
		messages.updateRecipientsTable();

		// If this host wants to make a call, and the host we want to call is online and has a peer, start a call.
		if (
			meta.meta.hostCalling !== null &&
			hosts.client.ID === meta.meta.hostCalling
		) {
			let called = db.get().find((rec) => rec.hostID === meta.meta.hostCalled);
			if (called && called.peer && called.status === 5) {
				console.log(
					`Host ${rec.hostID} is ready to take the call. Asking remote process to start audio call if not already in one.`
				);
				window.ipc.remote.send("remoteStartCall", [called.peer]);
			}
		}
	});
	recipients.on("recipientChanged", "renderer", (recipient) => {
		messages.changeRecipient(recipient);
	});

	/*
        MESSAGES FUNCTIONS
    */
	messages.on("remove", "renderer", (query, db) => {
		messages.read = messages.read.filter((value) => value !== query);
		messages.notified = messages.notified.filter((value) => value !== query);
	});
	messages.on("change", "renderer", (db) => {
		messages.updateRecipient();
		messages.updateRecipientsTable();
	});
	messages.on("newMessage", (message) => {
		window.ipc.flashMain(true);
		$(document).Toasts("create", {
			class: "bg-primary",
			title: `New Message from ${message.fromFriendly}`,
			autohide: true,
			delay: 30000,
			body: message.message,
			icon: "fas fa-comment fa-lg",
			position: "bottomRight",
		});
	});

	/*
		HOSTS FUNCTIONS
	*/

	hosts.on("clientChanged", "renderer", (newClient) => {
		// If this DJ Controls is supposed to monitor/report silence, open the silence process, else close it.
		if (newClient.silenceDetection) {
			window.ipc.process.send("silence", ["open"]);
		} else {
			window.ipc.process.send("silence", ["close"]);
		}

		// If this DJ Controls is supposed to record, open the recorder process, else close it.
		if (newClient.recordAudio) {
			window.ipc.process.send("recorder", ["open"]);
			startRecording(-1);
		} else {
			window.ipc.process.send("recorder", ["close"]);
		}

		// Delay system
		window.ipc.restartDelay(newClient.delaySystem);
	});

	hosts.on("change", "renderer", (db) => {
		hosts.updateTable();
	});

	/*
		VERSION FUNCTIONS
	*/

	let newestVersion = ``;
	version.on("change", "renderer", (db) => {
		let record = db.get().find((rec) => rec.app === `wwsu-dj-controls`);
		if (!record) return;
		if (record.version !== newestVersion) {
			newestVersion = record.version;
			let isNewVersion = window.ipc.checkVersion(record.version);
			if (isNewVersion) {
				window.ipc.main.send("makeNotification", [
					{
						title: "New Version Available",
						bg: "success",
						header: "New version of DJ Controls available!",
						flash: false,
						body: `<p>A new version of DJ Controls is available for download. Features of this DJ Controls may no longer work until you update.</p>
				  <ul>
				  <li>Your version: ${isNewVersion.current}</li>
				  <li>Latest version: ${record.version}</li>
				  </ul>
				  <p>To download the latest version, <a href="${record.downloadURL}" target="_blank">click this link</a>. And under "Assets", download and run the installer appropriate for your operating system (.pkg for macOS, .rpm or .deb for Linux, .exe for Windows). </p>
				  <p><strong>Warning! WWSU DJ Controls is an unsigned application.</strong> Your operating system may warn you of this and require additional steps to install:</p>
				  <ul>
				  <li>Web browsers: Some web browsers such as Chrome may block the download of DJ Controls. You will need to unblock / choose the "keep" option.</li>
				  <li>MacOS: You may need to run the .pkg file from Finder. Open Finder, browse to the downloaded .pkg, and hold down the control key while clicking on it. Click "open" in the menu item. The warning dialog should now have an open button, allowing you to run the installer.</li>
				  <li>Windows (10): Run the exe installer. If Windows displays a warning, click "more info" to expose the "Run Anyway" button.</li>
				  <li>Antivirus / Firewall: Some antiviruses or firewalls may block the installer or DJ Controls application since it is unsigned. Add them as trusted applications.</li>
				  </ul>`,
					},
				]);
			}
		}
	});

	/*
		STATE EVENTS
	*/

	// When a remote broadcast is requested, begin the process of starting up an audio call
	state.on("startRemote", (host) => {
		console.log(`Requested remote broadcast with host ${host}`);

		// Check to make sure the selected host is online. If not, bail.
		let recipient = recipients.find({ hostID: host }, true);

		// Reject if the host recipient reports offline.
		if (!recipient || recipient.status !== 5) {
			state.unblockBroadcastModel();
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Remote broadcast failed",
				delay: 15000,
				autohide: true,
				body: `The host you selected to call is not online. Please try using a different host.`,
			});
		}

		pendingHostCall = host;

		// Close and re-open the remote process
		window.ipc.process.send("remote", ["close"]);
		window.ipc.process.send("remote", ["open"]);
	});

	window.ipc.on("remotePeerReady", (event, arg) => {
		recipients.registerPeer(arg[0]);
		if (pendingHostCall) {
			console.log(
				`Pending remote call to ${pendingHostCall}. Informing the API.`
			);
			remote.request({ ID: pendingHostCall });
			pendingHostCall = undefined;
		}
	});

	window.ipc.on("remotePeerUnavailable", (event, arg) => {
		state.unblockBroadcastModel();
		$(document).Toasts("create", {
			class: "bg-danger",
			title: "Remote broadcast failed",
			delay: 15000,
			autohide: true,
			body: `The host you selected to call did not answer the call. Please try using a different host.`,
		});
	});

	window.ipc.on("remoteIncomingCall", (event, arg) => {
		let recipient = recipients.find({
			peer: arg[0],
			makeCalls: true,
			authorized: true,
		});
		if (recipient) {
			console.log(
				`Peer ${arg[0]} is allowed to call. Requesting to auto-answer.`
			);
			window.ipc.remote.send("remoteAnswerCall", [arg[0]]);
		} else {
			console.log(
				`Peer ${arg[0]} does not match any authorized recipients who can make calls. Rejected.`
			);
		}
	});

	window.ipc.on("peerCallEstablished", (event, arg) => {
		state.finalizeRemote((success) => {
			state.unblockBroadcastModel();
			if (success) {
				state.broadcastModal.iziModal("close");
			}
		});
	});
});
