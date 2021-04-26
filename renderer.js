"use strict";

// Machine ID
let machineID = window.ipc.getMachineId();
$(".connecting-id").html(machineID);

// Connection
io.sails.url = "https://server.wwsu1069.org";
io.sails.query = `host=${machineID}`;
io.sails.reconnectionAttempts = 3;
let socket = io.sails.connect();
$("#connecting").removeClass("d-none");
$("#loading").addClass("d-none");

// Add WWSU modules
let wwsumodules = new WWSUmodules(socket);
wwsumodules
	.add("WWSUanimations", WWSUanimations)
	.add(`WWSUutil`, WWSUutil)
	.add("WWSUNavigation", WWSUNavigation)
	.add("noReq", WWSUreq, { host: null })
	.add("WWSUMeta", WWSUMeta)
	.add("hostReq", WWSUreq, {
		host: machineID,
		usernameField: "host",
		authPath: "/auth/host",
		authName: "Host",
	})
	.add("WWSUdirectors", WWSUdirectors, { host: machineID })
	.add("directorReq", WWSUreq, {
		host: machineID,
		db: "WWSUdirectors",
		filter: null,
		usernameField: "name",
		authPath: "/auth/director",
		authName: "Director",
	})
	.add("adminDirectorReq", WWSUreq, {
		host: machineID,
		db: "WWSUdirectors",
		filter: { admin: true },
		usernameField: "name",
		authPath: "/auth/admin-director",
		authName: "Administrator Director",
	})
	.add("masterDirectorReq", WWSUreq, {
		host: machineID,
		db: "WWSUdirectors",
		filter: { ID: 1 },
		usernameField: "name",
		authPath: "/auth/admin-director",
		authName: "Master Director",
	})
	.add("WWSUconfig", WWSUconfig)
	.add("WWSUlogs", WWSUlogs)
	.add("WWSUdjs", WWSUdjs)
	.add("djReq", WWSUreq, {
		host: machineID,
		db: "WWSUdjs",
		filter: null,
		usernameField: "name",
		authPath: "/auth/dj",
		authName: "DJ",
	})
	.add("WWSUstatus", WWSUstatus)
	.add("WWSUeas", WWSUeas)
	.add("WWSUannouncements", WWSUannouncements, { types: ["all"] })
	.add("WWSUcalendar", WWSUcalendar)
	.add("WWSUsubscriptions", WWSUsubscriptions)
	.add("WWSUapi", WWSUapi)
	.add("WWSUdiscipline", WWSUdiscipline)
	.add("WWSUrecipients", WWSUrecipients)
	.add("WWSUhosts", WWSUhosts, {
		machineID: machineID,
		app: window.ipc.getAppVersion(),
	})
	.add("WWSUrequests", WWSUrequests)
	.add("WWSUtimesheet", WWSUtimesheet)
	.add("WWSUstate", WWSUstate)
	.add("WWSUclimacell", WWSUclimacell)
	.add("WWSUinventory", WWSUinventory)
	.add("WWSUmessages", WWSUmessages)
	.add("WWSUversion", WWSUversion, { app: "wwsu-dj-controls" })
	.add("WWSUSilence", WWSUSilence)
	.add("WWSUremote", WWSUremote)
	.add("WWSUremoteQuality", WWSUremoteQuality)
	.add("WWSUunderwritings", WWSUunderwritings)
	.add("WWSUsongs", WWSUsongs);

// Reference modules to variables
let animations = wwsumodules.get("WWSUanimations");
let util = wwsumodules.get("WWSUutil");
let navigation = wwsumodules.get("WWSUNavigation");
let meta = wwsumodules.get("WWSUMeta");
let directors = wwsumodules.get("WWSUdirectors");
let config = wwsumodules.get("WWSUconfig");
let logs = wwsumodules.get("WWSUlogs");
let djs = wwsumodules.get("WWSUdjs");
let status = wwsumodules.get("WWSUstatus");
let eas = wwsumodules.get("WWSUeas");
let announcements = wwsumodules.get("WWSUannouncements");
let calendar = wwsumodules.get("WWSUcalendar");
let subscriptions = wwsumodules.get("WWSUsubscriptions");
let api = wwsumodules.get("WWSUapi");
let discipline = wwsumodules.get("WWSUdiscipline");
let recipients = wwsumodules.get("WWSUrecipients");
let hosts = wwsumodules.get("WWSUhosts");
let requests = wwsumodules.get("WWSUrequests");
let timesheets = wwsumodules.get("WWSUtimesheet");
let state = wwsumodules.get("WWSUstate");
let climacell = wwsumodules.get("WWSUclimacell");
let messages = wwsumodules.get("WWSUmessages");
let inventory = wwsumodules.get("WWSUinventory");
let _version = wwsumodules.get("WWSUversion"); // "version" is already declared; use underscore
let silence = wwsumodules.get("WWSUSilence");
let remote = wwsumodules.get("WWSUremote");
let remoteQuality = wwsumodules.get("WWSUremoteQuality");
let underwritings = wwsumodules.get("WWSUunderwritings");
let songs = wwsumodules.get("WWSUsongs");

// Sound alerts
let sounds = {
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
	three: new Howl({ src: ["assets/voice-queues/three.mp3"] }),
	two: new Howl({ src: ["assets/voice-queues/two.mp3"] }),
	one: new Howl({ src: ["assets/voice-queues/one.mp3"] }),
	callQuality: new Howl({ src: ["assets/voice-queues/callQuality.mp3"] }),
	callSilence: new Howl({ src: ["assets/voice-queues/callSilence.mp3"] }),
	callTerminated: new Howl({
		src: ["assets/voice-queues/callTerminated.mp3"],
	}),
};

// letiables
let breakNotified = false; // Did we notify the DJ they have to take a top of hour ID break?

let queueLength = 0; // Current queue in seconds

let countDown = 0; // Countdown to on air in seconds

let audioDevices = [];

// Remote calls
let pendingHostCall;

let badQualityTimer;

let todos = {
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
navigation
	.addItem(
		"#nav-dashboard",
		"#section-dashboard",
		"Dashboard - WWSU DJ Controls",
		"/",
		true
	)
	.addItem(
		"#nav-announcements-view",
		"#section-announcements-view",
		"View Announcements - WWSU DJ Controls",
		"/announcements-view",
		false
	)
	.addItem(
		"#nav-chat",
		"#section-chat",
		"Messages / Chat - WWSU DJ Controls",
		"/chat",
		false
	)
	.addItem(
		"#nav-discord",
		"#section-discord",
		"Discord Chat - WWSU DJ Controls",
		"/discord",
		false
	)
	.addItem(
		"#nav-requests",
		"#section-requests",
		"Track requests - WWSU DJ Controls",
		"/requests",
		false
	)
	.addItem(
		"#nav-weather",
		"#section-weather",
		"Weather - WWSU DJ Controls",
		"/weather",
		false
	)
	.addItem(
		"#nav-report",
		"#section-report",
		"Report a Problem - WWSU DJ Controls",
		"/report",
		false
	)
	.addItem(
		"#nav-audio",
		"#section-audio",
		"Audio Settings - WWSU DJ Controls",
		"/audio",
		false,
		() => {
			$("#section-audio-recorder-form").alpaca({
				schema: {
					type: "object",
					properties: {
						delay: {
							type: "number",
							title: "Delay (milliseconds)",
						},
						recordPath: {
							type: "string",
							format: "uri",
							title: "Path to audio recordings",
						},
					},
				},
				options: {
					fields: {
						delay: {
							helper:
								"How much time passes between a state change and when the input device receives the audio? For example, if the input device is subject to a delay system, you would put the amount of delay time in here.",
							events: {
								change: function () {
									let value = this.getValue();
									if (!this.handleValidate()) {
										console.log(`invalid`);
										return;
									}
									window.saveSettings.recorder("delay", value);
								},
							},
						},
						// TODO: re-compile alpaca with the capability of choosing a folder.
						recordPath: {
							helpers: [
								`Write the full path to the directory you want audio files (webm format) to be saved`,
								`Sub-directories for automation, remote, live, and sports will be created automatically after the first recording is saved.`,
								`Additional sub-sub-directories will be created automatically to organize recordings by genre, show, or sport.`,
							],
							events: {
								change: function () {
									let value = this.getValue();
									if (!this.handleValidate()) {
										console.log(`invalid`);
										return;
									}
									window.saveSettings.recorder("recordPath", value);
									startRecording(0);
								},
							},
						},
					},
				},
				data: window.settings.recorder(),
			});
			$("#section-audio-silence-form").alpaca({
				schema: {
					type: "object",
					properties: {
						delay: {
							type: "number",
							title: "Delay (milliseconds)",
							required: true,
							minimum: 0,
						},
						threshold: {
							type: "number",
							title: "Threshold (percentile 0.0 - 1.0)",
							minimum: 0,
							maximum: 1,
							required: true,
						},
					},
				},
				options: {
					fields: {
						delay: {
							helper:
								"How much time should elapse when the volume of the combined input devices for silence monitoring drops below the threshold before DJ Controls triggers the silence alarm in WWSU?",
							events: {
								change: function () {
									let value = this.getValue();
									if (!this.handleValidate()) {
										console.log(`invalid`);
										return;
									}
									window.saveSettings.silence("delay", value);
									window.ipc.silence.setting([]);
								},
							},
						},
						threshold: {
							helper:
								"At what volume percentile (0.0 - 1.0) should silence be considered detected when the combined volumes of input devices with silence checked drop below this value?",
							events: {
								change: function () {
									let value = this.getValue();
									if (!this.handleValidate()) {
										console.log(`invalid`);
										return;
									}
									window.saveSettings.silence("threshold", value);
									window.ipc.silence.setting([]);
								},
							},
						},
					},
				},
				data: window.settings.silence(),
			});
		}
	)
	.addItem(
		"#nav-serial",
		"#section-serial",
		"Serial Port Settings - WWSU DJ Controls",
		"/serial",
		false
	)
	.addItem(
		"#nav-notifications",
		"#section-notifications",
		"Notifications / Todo - WWSU DJ Controls",
		"/notifications",
		false
	)
	.addItem(
		"#nav-announcements",
		"#section-announcements",
		"Manage Announcements - WWSU DJ Controls",
		"/announcements",
		false
	)
	.addItem(
		"#nav-api",
		"#section-api",
		"Make API Query - WWSU DJ Controls",
		"/api",
		false
	)
	.addItem(
		"#nav-bans",
		"#section-bans",
		"Manage Bans - WWSU DJ Controls",
		"/bans",
		false
	)
	.addItem(
		"#nav-calendar",
		"#section-calendar",
		"Manage Calendar - WWSU DJ Controls",
		"/calendar",
		false,
		() => {
			fullCalendar.updateSize();
		}
	)
	.addItem(
		"#nav-directors",
		"#section-directors",
		"Manage Directors - WWSU DJ Controls",
		"/directors",
		false
	)
	.addItem(
		"#nav-djs",
		"#section-djs",
		"Manage DJs - WWSU DJ Controls",
		"/djs",
		false
	)
	.addItem(
		"#nav-eas",
		"#section-eas",
		"Manage Internal EAS - WWSU DJ Controls",
		"/eas",
		false
	)
	.addItem(
		"#nav-hosts",
		"#section-hosts",
		"Manage Hosts - WWSU DJ Controls",
		"/hosts",
		false
	)
	.addItem(
		"#nav-inventory",
		"#section-inventory",
		"Manage Inventory - WWSU DJ Controls",
		"/inventory",
		false
	)
	.addItem(
		"#nav-logs",
		"#section-logs",
		"Operation Logs - WWSU DJ Controls",
		"/logs",
		false
	)
	.addItem(
		"#nav-timesheets",
		"#section-timesheets",
		"Director timesheets - WWSU DJ Controls",
		"/timesheets",
		false
	)
	.addItem(
		"#nav-underwritings",
		"#section-underwritings",
		"Manage Underwritings - WWSU DJ Controls",
		"/underwritings",
		false
	);

// Click events
$(".status-more").on("click", () => {
	status.statusModal.iziModal("open");
});
$(".eas-more").on("click", () => {
	eas.easModal.iziModal("open");
});
$(".btn-calendar-definitions").on("click", () => {
	calendar.definitionsModal.iziModal("open");
});
$(".btn-calendar-prerequisites").on("click", () => {
	calendar.prerequisitesModal.iziModal("open");
});
$(".btn-manage-events").on("click", () => {
	calendar.showSimpleEvents();
});
$("#section-logs-date-browse").on("click", () => {
	logs.showAttendance($("#section-logs-date").val());
});
$(".chat-recipients").on("click", () => {
	recipients.openRecipients();
});
$("#section-audio-devices-refresh").on("click", () => {
	$("#section-audio-devices").block({
		message: "<h1>Refreshing audio process...</h1>",
		css: { border: "3px solid #a00" },
		timeout: 30000,
		onBlock: () => {
			window.ipc.audioRefreshDevices(true);
		},
	});
});
$("#section-serial-delay-refresh").on("click", () => {
	$("#section-serial-delay").block({
		message: "<h1>Refreshing serial ports...</h1>",
		css: { border: "3px solid #a00" },
		timeout: 30000,
		onBlock: () => {
			refreshSerialPorts();
		},
	});
});
$(".chat-mute").on("click", () => {
	if (recipients.activeRecipient)
		discipline.simpleMuteForm(recipients.activeRecipient);
});
$(".chat-ban").on("click", () => {
	if (recipients.activeRecipient)
		discipline.simpleBanForm(recipients.activeRecipient);
});
$(".btn-dashboard-meta-clear").on("click", () => {
	hosts.promptIfNotHost(`Mark DJ / Producer as talking`, () => {
		logs.add(
			{
				logtype: "manual",
				logsubtype: meta.meta ? meta.meta.show : "",
				loglevel: "secondary",
				logIcon: "fas fa-file",
				title: "DJ / Producer began talking.",
			},
			true
		);
	});
});

// Operation click events
$(".btn-operation-resume").on("click", () => {
	if (
		meta.meta.hostCalling !== null &&
		hosts.client.ID === meta.meta.hostCalling &&
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_") ||
			pendingHostCall)
	) {
		let called = recipients
			.db()
			.get()
			.find((rec) => rec.hostID === meta.meta.hostCalled);
		if (!called || !called.peer || called.status !== 5) {
			$(document).Toasts("create", {
				class: "bg-warning",
				title: "Remote host not connected",
				delay: 30000,
				autohide: true,
				body: `The host receiving the audio for the broadcast is not connected. Please wait until the resume button flashes to indicate it re-connected, or end and restart the remote broadcast with a different host.`,
			});
			remote.request({ ID: meta.meta.hostCalled || pendingHostCall });
			return;
		}
	}
	state.return({});
});
$(".btn-operation-15-psa").on("click", () => {
	state.queuePSA({ duration: 15 });
});
$(".btn-operation-30-psa").on("click", () => {
	state.queuePSA({ duration: 30 });
});
$(".btn-operation-automation").on("click", () => {
	state.automation({ transition: false });
});
$(".btn-operation-break").on("click", () => {
	state.break({ halftime: false, problem: false });
});
$(".btn-operation-extended-break").on("click", () => {
	state.break({ halftime: true, problem: false });
});
$(".btn-operation-top-add").on("click", () => {
	state.queueTopAdd({});
});
$(".btn-operation-liner").on("click", () => {
	state.queueLiner({});
});
$(".btn-operation-dump").on("click", () => {
	state.dump({});
});
$(".btn-operation-live").on("click", () => {
	state.showLiveForm();
});
$(".btn-operation-remote").on("click", () => {
	state.showRemoteForm();
});
$(".btn-operation-log").on("click", () => {
	logs.showLogForm();
});
$(".btn-operation-sports").on("click", () => {
	state.showSportsForm();
});
$(".btn-operation-sportsremote").on("click", () => {
	state.showSportsRemoteForm();
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
	"#nav-chat"
);

// CLOCKWHEEL

// Initialize clockwheel
let clockwheelDonutCanvas = $("#clockwheel-donut").get(0).getContext("2d");
let clockwheelDonutData = {
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
let clockwheelDonutOptions = {
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
let clockwheelDonut = new Chart(clockwheelDonutCanvas, {
	type: "doughnut",
	data: clockwheelDonutData,
	options: clockwheelDonutOptions,
});

// Clockwheel Clock and functions
let $h = $("#hour"),
	$m = $("#minute"),
	$s = $("#second");

function computeTimePositions($h, $m, $s) {
	let now = moment.parseZone(meta.meta.time),
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
		let tickClass = "smallTick",
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
	let size = Math.min(width, height);
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
	let recordState = null;
	let preText = ``;
	let preText2 = ``;
	let temp = ``;

	if (meta.meta.state === "live_on") {
		recordState = "live";
		temp = meta.meta.show.split(" - ");
		preText = window.sanitize.string(temp[1]);
		preText2 = `${window.sanitize.string(meta.meta.show)}`;
	} else if (meta.meta.state === "prerecord_on") {
		recordState = "prerecord";
		temp = meta.meta.show.split(" - ");
		preText = window.sanitize.string(temp[1]);
		preText2 = `${window.sanitize.string(meta.meta.show)}`;
	} else if (meta.meta.state === "remote_on") {
		recordState = "remote";
		temp = meta.meta.show.split(" - ");
		preText = window.sanitize.string(temp[1]);
		preText2 = `${window.sanitize.string(meta.meta.show)}${
			meta.meta.state === `prerecord_on` ? ` PRERECORDED` : ``
		}`;
	} else if (
		meta.meta.state === "sports_on" ||
		meta.meta.state === "sportsremote_on"
	) {
		recordState = "sports";
		preText = window.sanitize.string(meta.meta.show);
		preText2 = window.sanitize.string(meta.meta.show);
	} else if (
		meta.meta.state === `automation_on` ||
		meta.meta.state === `automation_genre` ||
		meta.meta.state === `automation_playlist`
	) {
		recordState = "automation";
		preText = window.sanitize.string(meta.meta.genre);
		preText2 = window.sanitize.string(meta.meta.genre);
	} else if (
		meta.meta.state.includes("_break") ||
		meta.meta.state.includes("_returning") ||
		meta.meta.state.includes("_halftime")
	) {
		window.ipc.recorder.stop([delay]);
	} else {
		recordState = "automation";
		preText = window.sanitize.string(meta.meta.genre);
		preText2 = window.sanitize.string(meta.meta.genre);
	}
	if (recordState !== null) {
		if (hosts.client.recordAudio) {
			window.ipc.recorder.start([
				`${recordState}/${preText}/${preText2} (${moment().format(
					"YYYY_MM_DD HH_mm_ss"
				)})`,
				delay,
			]);
		} else {
			window.ipc.recorder.stop([-1]);
		}
	}
}

// CALENDAR

// Initialize Calendar
let calendarEl = document.getElementById("calendar");

let fullCalendar = new FullCalendar.Calendar(calendarEl, {
	headerToolbar: {
		start: "prev,next today",
		center: "title",
		end: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
	},
	initialView: "timeGridWeek",
	navLinks: true, // can click day/week names to navigate views
	selectable: true,
	selectMirror: true,
	nowIndicator: true,
	editable: true,
	eventResourceEditable: false,
	themeSystem: "bootstrap",
	dayMaxEvents: 5,
	slotDuration: "00:15:00",
	events: function (info, successCallback, failureCallback) {
		animations.add("calendar-update", () => {
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
									let temp = document.getElementById(`filter-${event.type}`);
									if (temp !== null && temp.checked) {
										return true;
									} else {
										return false;
									}
								})
								.map((event) => {
									let borderColor;
									let title = `${event.type}: ${event.hosts} - ${event.name}`;
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
										start: moment.parseZone(event.start).toISOString(true),
										end: moment.parseZone(event.end).toISOString(true),
										title: title,
										backgroundColor:
											["canceled", "canceled-system"].indexOf(
												event.scheduleType
											) === -1
												? event.color
												: "#161616",
										textColor: util.getContrastYIQ(event.color)
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
		});
	},

	eventClick: function (info) {
		calendar.showClickedEvent(info.event.extendedProps.event);
	},

	select: function (info) {
		calendar.newOccurrence(info.startStr, info.endStr);
	},

	eventDrop: function (info) {
		let duration = moment(info.event.end).diff(info.event.start, "minutes");
		if (duration > 60 * 24) {
			$(document).Toasts("create", {
				class: "bg-warning",
				title: "Multi-day Events Not Allowed",
				body:
					"Occurrences may not last more than 24 hours. Consider setting up a recurring schedule.",
				autohide: true,
				delay: 15000,
			});
			return;
		}
		calendar.showOccurrenceForm(
			info.event.extendedProps.event,
			info.event.startStr,
			duration
		);
		info.revert();
	},

	eventResize: function (info) {
		let duration = moment(info.event.end).diff(info.event.start, "minutes");
		if (duration > 60 * 24) {
			$(document).Toasts("create", {
				class: "bg-warning",
				title: "Multi-day Events Not Allowed",
				body:
					"Occurrences may not last more than 24 hours. Consider setting up a recurring schedule.",
				autohide: true,
				delay: 15000,
			});
			return;
		}
		calendar.showOccurrenceForm(
			info.event.extendedProps.event,
			info.event.startStr,
			duration
		);
		info.revert();
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
	let temp = document.getElementById(`filter-${type}`);
	if (temp !== null) {
		temp.addEventListener("click", (e) => {
			fullCalendar.refetchEvents();
		});
	}
});

// Add click events to filter group buttons
$("#filter-group-broadcasts").on("click", (e) => {
	[
		"genre",
		"event",
		"onair-booking",
		"prod-booking",
		"office-hours",
	].map((type) => $(`#filter-${type}`).prop("checked", false));
	["show", "sports", "remote", "prerecord", "playlist"].map((type) =>
		$(`#filter-${type}`).prop("checked", true)
	);
	fullCalendar.refetchEvents();
});
$("#filter-group-bookings").on("click", (e) => {
	[
		"show",
		"sports",
		"remote",
		"prerecord",
		"genre",
		"playlist",
		"event",
		"office-hours",
	].map((type) => $(`#filter-${type}`).prop("checked", false));
	["onair-booking", "prod-booking"].map((type) =>
		$(`#filter-${type}`).prop("checked", true)
	);
	fullCalendar.refetchEvents();
});
$("#filter-group-clear").on("click", (e) => {
	[
		"show",
		"sports",
		"remote",
		"prerecord",
		"genre",
		"playlist",
		"event",
		"office-hours",
		"onair-booking",
		"prod-booking",
	].map((type) => $(`#filter-${type}`).prop("checked", false));
	fullCalendar.refetchEvents();
});

window.ipc.on.console((event, arg) => {
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
window.ipc.on.recorderReady((event, arg) => {
	animations.add("notifications-recorder", () => {
		$(".notifications-recorder").removeClass("badge-secondary");
		$(".notifications-recorder").addClass("badge-warning");
	});
	startRecording(-1);
});

window.ipc.on.delayReady((event, arg) => {
	animations.add("notifications-delay", () => {
		$(".notifications-delay").removeClass("badge-secondary");
		$(".notifications-delay").removeClass("badge-warning");
		$(".notifications-delay").removeClass("badge-danger");
		$(".notifications-delay").addClass("badge-success");
	});
});

// Update recorder process status indication
window.ipc.on.recorderStarted((event, arg) => {
	animations.add("notifications-recorder", () => {
		$(".notifications-recorder").removeClass("badge-warning");
		$(".notifications-recorder").addClass("badge-success");
	});
});
window.ipc.on.recorderStopped((event, arg) => {
	animations.add("notifications-recorder", () => {
		$(".notifications-recorder").removeClass("badge-success");
		$(".notifications-recorder").addClass("badge-warning");
	});
	// Sometimes a recording is stopped if it runs too long; restart a new recording if we need to
	if (arg[0]) startRecording(-1);
});
window.ipc.on.recorderFailed((event, arg) => {
	// If there was a failure with the recording, log it and report it
	logs.add(
		{
			logtype: "recorder-failed",
			logsubtype: "automation",
			loglevel: "orange",
			logIcon: `fas fa-file-audio`,
			title: `A recording failed!`,
			event: `File: ${arg[0]}<br />Error: ${arg[1]}`,
		},
		true
	);
	status.recorder({
		status: 2,
		data: `There was an error saving the file ${arg[0]}<br />Error: ${arg[1]}<br /><strong>Be prepared to record your broadcasts manually</strong> until the recorder is fixed.`,
	});
});

window.ipc.on.silenceReady((event, arg) => {
	animations.add("notifications-silence", () => {
		$(".notifications-silence").removeClass("badge-secondary");
		$(".notifications-silence").removeClass("badge-warning");
		$(".notifications-silence").removeClass("badge-danger");
		$(".notifications-silence").addClass("badge-success");
	});
});

// Do things depending on state of silence detected
let prevSilenceState = -1;
window.ipc.on.silenceState((event, arg) => {
	animations.add("notifications-silence", () => {
		$(".notifications-silence").removeClass("badge-secondary");
		$(".notifications-silence").removeClass("badge-warning");
		$(".notifications-silence").removeClass("badge-danger");
		$(".notifications-silence").removeClass("badge-success");
	});

	switch (arg[0]) {
		case 0:
			animations.add("notifications-silence-2", () => {
				$(".notifications-silence").addClass("badge-success");
			});

			// Trigger inactive call only if re-calling or going from active silence to inactive silence
			if (prevSilenceState !== 1) silence.inactive();

			break;
		case 1:
			animations.add("notifications-silence-2", () => {
				$(".notifications-silence").addClass("badge-warning");
			});
			break;
		case 2:
			animations.add("notifications-silence-2", () => {
				$(".notifications-silence").addClass("badge-danger");
			});
			silence.active();
			break;
	}

	prevSilenceState = arg[0];
});

// Update VU meters
window.ipc.on.audioVolume((event, arg) => {
	((volumes) => {
		if (navigation.activeMenu !== `#nav-audio`) {
			return;
		}
		if (volumes.size > 0) {
			animations.add("audio-volume", () => {
				volumes.forEach((volume, device) => {
					$(`.vu-left-input-${device}`).width(`${volume[0] * 100}%`);
					$(`.vu-right-input-${device}`).width(
						`${
							typeof volume[1] !== "undefined"
								? volume[1] * 100
								: volume[0] * 100
						}%`
					);
				});
			});
		}
	})(arg[0]);
	arg = undefined;
});

// Add a log in WWSU when a recording was saved
window.ipc.on.recorderSaved((event, arg) => {
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
	status.recorder({
		status: 5,
		data: `Most recent file ${arg} was successfully saved.`,
	});
});

// Process audio devices when the audio process returns them
window.ipc.on.audioDevices((event, arg) => {
	console.log(`Audio: Received audio devices`);

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
						<div class="progress-bar bg-primary vu-left-input-${
							device.device.deviceId
						}" data-id="${
					device.device.deviceId
				}" role="progressbar" style="width: 0%; transition: none;"></div>
					</div>
					<div class="progress progress-xs">
						<div class="progress-bar bg-primary vu-right-input-${
							device.device.deviceId
						}" data-id="${
					device.device.deviceId
				}" role="progressbar" style="width: 0%; transition: none;"></div>
					</div>
					<div class="slider-primary" style="width: 100%;">
                      <input type="text" style="width: 100%;" id="audio-volume-input-${
												device.device.deviceId
											}" data-id="${
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
    					<input type="checkbox" class="form-check-input" id="audio-remote-input-${
								device.device.deviceId
							}" data-id="${device.device.deviceId}" ${
					device.settings.remote ? `checked` : ``
				}>
    					<label class="form-check-label" for="audio-remote-input-${
								device.device.deviceId
							}">Remote Broadcast (Input)</label>
					  </div>
					<div class="form-check form-check-inline" title="If checked, device ${
						device.device.label
					} will be recorded if this DJ Controls is responsible for recording on-air programming. ONLY CHECK for sources that get a direct feed from WWSU.">
    					<input type="checkbox" class="form-check-input" id="audio-recorder-input-${
								device.device.deviceId
							}" data-id="${device.device.deviceId}" ${
					device.settings.recorder ? `checked` : ``
				}>
    					<label class="form-check-label" for="audio-recorder-input-${
								device.device.deviceId
							}">Record</label>
					  </div>
					<div class="form-check form-check-inline" title="If checked, device ${
						device.device.label
					} will be monitored for silence if this DJ Controls is responsible for reporting silence. ONLY CHECK for sources that get a direct feed from WWSU.">
    					<input type="checkbox" class="form-check-input" id="audio-silence-input-${
								device.device.deviceId
							}" data-id="${device.device.deviceId}" ${
					device.settings.silence ? `checked` : ``
				}>
    					<label class="form-check-label" for="audio-silence-input-${
								device.device.deviceId
							}">Silence Detection</label>
  					</div>
					</div>`;

				window.requestAnimationFrame(() => {
					$(`#audio-volume-input-${device.device.deviceId}`).bootstrapSlider({
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
					$(`#audio-volume-input-${device.device.deviceId}`).off("change");
					$(`#audio-volume-input-${device.device.deviceId}`).on(
						"change",
						(obj) => {
							window.ipc.audioChangeVolume([
								device.device.deviceId,
								"audioinput",
								obj.value.newValue,
							]);
						}
					);

					// Checkbox listeners
					$(`#audio-remote-input-${device.device.deviceId}`).off("change");
					$(`#audio-remote-input-${device.device.deviceId}`).on(
						"change",
						(e) => {
							window.ipc.audioRemoteSetting([
								device.device.deviceId,
								"audioinput",
								e.target.checked,
							]);
						}
					);
					$(`#audio-recorder-input-${device.device.deviceId}`).off("change");
					$(`#audio-recorder-input-${device.device.deviceId}`).on(
						"change",
						(e) => {
							window.ipc.audioRecorderSetting([
								device.device.deviceId,
								"audioinput",
								e.target.checked,
							]);
						}
					);
					$(`#audio-silence-input-${device.device.deviceId}`).off("change");
					$(`#audio-silence-input-${device.device.deviceId}`).on(
						"change",
						(e) => {
							window.ipc.audioSilenceSetting([
								device.device.deviceId,
								"audioinput",
								e.target.checked,
							]);
						}
					);
				});
			} else if (device.device.kind === "audiooutput") {
				htmlOutputs += `<div class="p-2">
					<h5>${device.device.label}</h5>
					<div class="slider-primary" style="width: 100%;">
                      <input type="text" style="width: 100%;" id="audio-volume-output-${
												device.device.deviceId
											}" data-id="${
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
    					<input type="checkbox" class="form-check-input form-check-devices-output" id="audio-output-${
								device.device.deviceId
							}" data-id="${device.device.deviceId}" ${
					device.settings.output ? `checked` : ``
				}>
    					<label class="form-check-label" for="audio-output-${
								device.device.deviceId
							}">Remote Broadcast (Output)</label>
					  </div>
  					</div>
					</div>`;

				window.requestAnimationFrame(() => {
					$(`#audio-volume-output-${device.device.deviceId}`).bootstrapSlider({
						min: 0,
						max: 1,
						step: 0.01,
						ticks: [0, 0.25, 0.5, 0.75, 1],
						ticks_positions: [
							0,
							100 * (1 / 4),
							100 * (2 / 4),
							100 * (3 / 4),
							100 * (4 / 4),
						],
						ticks_labels: ["OFF", "25%", "50%", "75%", "100%"],
						ticks_snap_bounds: 0.025,
						value: device.settings.volume,
						orientation: "horizontal",
						selection: "before",
						tooltip: "show",
					});

					// Volume slider listener
					$(`#audio-volume-output-${device.device.deviceId}`).off("change");
					$(`#audio-volume-output-${device.device.deviceId}`).on(
						"change",
						(obj) => {
							window.ipc.audioChangeVolume([
								device.device.deviceId,
								"audiooutput",
								obj.value.newValue,
							]);
						}
					);

					// Checkbox listeners
					$(`#audio-output-${device.device.deviceId}`).off("change");
					$(`#audio-output-${device.device.deviceId}`).on("change", (e) => {
						if ($(`#audio-output-${device.device.deviceId}`).prop("checked")) {
							$(`.form-check-devices-output`).each((index2, element) => {
								if (element.id !== `audio-output-${device.device.deviceId}`) {
									$(element).prop({ checked: false });
								}
							});
							window.ipc.audioOutputSetting([
								device.device.deviceId,
								"audiooutput",
								true,
							]);
						}
					});

					$(`#audio-queue-output-${device.device.deviceId}`).off("change");
					$(`#audio-queue-output-${device.device.deviceId}`).on(
						"change",
						(e) => {
							if (
								$(`#audio-queue-output-${device.device.deviceId}`).prop(
									"checked"
								)
							) {
								$(`.form-check-devices-queue`).each((index2, element) => {
									if (
										element.id !==
										`audio-queue-output-${device.device.deviceId}`
									) {
										$(element).prop({ checked: false });
									}
								});
								window.ipc.audioQueueSetting([
									device.device.deviceId,
									"audiooutput",
									true,
								]);
							}
						}
					);
				});
			}
		});
	}

	$("#section-audio-devices-inputs").html(htmlInputs);
	$("#section-audio-devices-outputs").html(htmlOutputs);
});

// Crash checking
window.ipc.on.processClosed((event, arg) => {
	console.log(`Process closed: ${arg[0]}`);
	switch (arg[0]) {
		case "silence":
			animations.add("notifications-silence", () => {
				$(".notifications-silence").removeClass("badge-success");
				$(".notifications-silence").removeClass("badge-warning");
				$(".notifications-silence").removeClass("badge-danger");
				$(".notifications-silence").addClass("badge-secondary");
			});
			if (hosts.client.silenceDetection) {
				window.ipc.process.silence(["open"]);
			}
			break;
		case "recorder":
			animations.add("notifications-recorder", () => {
				$(".notifications-recorder").removeClass("badge-success");
				$(".notifications-recorder").removeClass("badge-warning");
				$(".notifications-recorder").removeClass("badge-danger");
				$(".notifications-recorder").addClass("badge-secondary");
			});
			if (hosts.client.recordAudio) {
				window.ipc.process.recorder(["open"]);
			}
			break;
		case "remote":
			recipients.registerPeer(null);
			remoteQuality.peerDestroyed();
			animations.add("notifications-remote", () => {
				$(".notifications-remote").removeClass("badge-success");
				$(".notifications-remote").removeClass("badge-warning");
				$(".notifications-remote").removeClass("badge-danger");
				$(".notifications-remote").removeClass("badge-info");
				$(".notifications-remote").removeClass("badge-primary");
				$(".notifications-remote").addClass("badge-secondary");
				$(".meta-callQuality").addClass("d-none");
			});

			// Re-open the process if we are supposed to be in a call
			if (
				(meta.meta.hostCalled === hosts.client.ID ||
					meta.meta.hostCalling === hosts.client.ID) &&
				(meta.meta.state.endsWith("_sportsremote") ||
					meta.meta.state.endsWith("_remote") ||
					meta.meta.state.startsWith("remote_") ||
					meta.meta.state.startsWith("sportsremote_"))
			) {
				window.ipc.process.remote(["open"]);
			}
			break;
		case "delay":
			animations.add("notifications-delay", () => {
				$(".notifications-delay").removeClass("badge-success");
				$(".notifications-delay").removeClass("badge-warning");
				$(".notifications-delay").removeClass("badge-danger");
				$(".notifications-delay").addClass("badge-secondary");
			});
			if (hosts.client.delaySystem) {
				window.ipc.process.delay(["open"]);
			}
			break;
	}
});

// Delay system status returned from main process
window.ipc.on.delay((event, args) => {
	state.delayStatus({ seconds: args[0], bypass: args[1] });
});

// Construct serial port settings

function refreshSerialPorts() {
	// Get available ports (via custom Electron event in index.js)

	navigator.serial.requestPort().then(() => {
		// Always returns empty; available serial ports are sent using the serialPorts event
	});
}
refreshSerialPorts();

// Available serial ports returned by index.js
window.ipc.on.serialPorts((event, ports) => {
	/*
		Delay System
	*/

	// Populate selection box with available serial ports
	let delayPorts = `<option value="">(NONE)</option>`;
	if (ports.constructor === Array && ports.length > 0) {
		ports.map((port) => {
			delayPorts += `<option value="${port.deviceInstanceId}">${port.displayName} (${port.portName})</option>`;
		});
	}
	$("#section-serial-delay-port").html(delayPorts);

	$("#section-serial-delay").unblock();

	// On next frame, select the port currently chosen for delay system as default
	window.requestAnimationFrame(() => {
		let delaySettings = window.settings.delay();
		$("#section-serial-delay-port").val(delaySettings.port);
	});

	// Add select box change handler for setting new port when changed
	$("#section-serial-delay-port").unbind("change");
	$("#section-serial-delay-port").on("change", (e) => {
		let val = $(e.target).val();
		window.saveSettings.delay("port", val);
		// Restart delay system by closing the process so we can use the new port
		window.ipc.process.delay(["close"]);
	});
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
				config.init();
				meta.init();
				djs.init();
				calendar.init();
				status.init();
				eas.init();
				announcements.init();
				requests.init();
				recipients.init();
				messages.init();
				climacell.init();
				_version.init();
				if (hosts.client.admin) {
					$(".nav-admin").removeClass("d-none");
					directors.init();
					discipline.init();
					discipline.initTable(`#section-bans-content`);
					announcements.initTable("#section-announcements-content");
					djs.initTable("#section-djs-content");
					directors.initTable("#section-directors-content");
					eas.initTable("#section-eas-content");
					hosts.initTable("#section-hosts-content");
					inventory.init();
					inventory.initTable("#section-inventory-content");
					underwritings.init();
					underwritings.initTable("#section-underwritings-content");
					logs.initIssues();
					logs.initIssuesTable("#section-notifications-issues");
				} else {
					$(".nav-admin").addClass("d-none");
				}

				// If this DJ Controls is supposed to monitor/report silence, open the silence process, else close it.
				if (hosts.client.silenceDetection) {
					window.ipc.process.silence(["open"]);
				} else {
					window.ipc.process.silence(["close"]);
				}

				// If this DJ Controls is supposed to record, open the recorder process, else close it.
				if (hosts.client.recordAudio) {
					window.ipc.process.recorder(["open"]);
				} else {
					window.ipc.process.recorder(["close"]);
				}

				// If this DJ Controls is responsible for the delay system, open the process, else close it.
				if (hosts.client.delaySystem) {
					window.ipc.process.delay(["open"]);
				} else {
					window.ipc.process.delay(["close"]);
				}

				// Discord iframe
				$("#section-chat-iframe").attr(
					"src",
					`https://titanembeds.com/embed/830253278465097758?defaultchannel=830253279166464042&theme=DiscordDark&username=${hosts.client.friendlyname.replace(
						/[^a-zA-Z0-9\d\-_\s]+/gi,
						""
					)}`
				);
			} else if (success === -1) {
				animations.add("socket-connect-2", () => {
					$("#content").addClass("d-none");
					$("#already-connected").removeClass("d-none");
				});
			} else if (success === 0) {
				animations.add("socket-connect-2", () => {
					$("#content").addClass("d-none");
					$("#unauthorized").removeClass("d-none");
				});
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

// When socket receives request to execute the dump button on the delay, we should do so if we are responsible
socket.on("delay-system-dump", () => {
	if (hosts.client.delaySystem) {
		window.ipc.delay.dump();
	}
});

animations.on("updateStatus", "renderer", (updating) => {
	if (updating) {
		$("#animation-refreshing").removeClass("d-none");
	} else {
		$("#animation-refreshing").addClass("d-none");
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
			animations.add("meta-changingState", () => {
				if (fullMeta.changingState !== null) {
					$(".operations").block({
						message: `<h4>${fullMeta.changingState}</h4>`,
						css: { border: "3px solid #a00" },
						timeout: 60000,
					});
				} else {
					$(".operations").unblock();
				}
			});
		}

		// Changes in attendance ID? Update logs.
		if (typeof updated.attendanceID !== "undefined") {
			logs.setAttendanceID(fullMeta.attendanceID);
		}

		// Update dump button seconds
		if (typeof updated.delaySystem !== "undefined") {
			animations.add("meta-delaySystem", () => {
				$(".operation-dump-time").html(
					`${
						fullMeta.delaySystem === null
							? `Turn On`
							: `${fullMeta.delaySystem} sec`
					}`
				);
			});
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
				$(".meta-line1").html(fullMeta.line1);
			});
		}
		if (typeof updated.line2 !== "undefined") {
			animations.add("meta-line2", () => {
				$(".meta-line2").html(fullMeta.line2);
			});
		}

		// Update online listeners
		if (typeof updated.listeners !== "undefined") {
			animations.add("meta-listeners", () => {
				$(".meta-listeners").html(fullMeta.listeners);
			});
		}

		if (
			typeof updated.playing !== "undefined" ||
			typeof updated.trackArtist !== "undefined" ||
			typeof updated.trackTitle !== "undefined" ||
			typeof updated.state !== "undefined"
		) {
			animations.add("meta-clear", () => {
				if (
					!fullMeta.state.endsWith("_on") ||
					fullMeta.state.startsWith("automation_") ||
					fullMeta.state.startsWith("playlist_") ||
					fullMeta.state.startsWith("genre_") ||
					fullMeta.state.startsWith("prerecord_") ||
					fullMeta.playing ||
					(!fullMeta.trackTitle && !fullMeta.trackArtist)
				) {
					$(".section-dashboard-meta").addClass("d-none");
				} else {
					$(".section-dashboard-meta").removeClass("d-none");
				}
			});
		}

		if (
			typeof updated.state !== "undefined" ||
			typeof updated.playing !== "undefined"
		) {
			remoteShouldBeMuted();
			if (
				updated.state &&
				(updated.state === "remote_on" || updated.state === "sportsremote_on")
			) {
				window.ipc.remote.restartSilenceTimer([]);
				window.ipc.remote.confirmActiveCall([]);
			}
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

				switch (fullMeta.state) {
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
					case "sportsremote_on":
					case "sports_on":
					case "sportsremote_halftime":
						$(".card-meta").addClass("bg-success");
						break;
					default:
						$(".card-meta").addClass("bg-secondary");
				}

				switch (fullMeta.state) {
					case "automation_on":
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
					case "automation_break":
						$(".operation-automation").removeClass("d-none");
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
						break;
					case "live_on":
						$(".operation-automation").removeClass("d-none");
						$(".operation-break").removeClass("d-none");
						$(".operation-top-add").removeClass("d-none");
						$(".operation-log").removeClass("d-none");
						break;
					case "sports_on":
						$(".operation-automation").removeClass("d-none");
						$(".operation-break").removeClass("d-none");
						$(".operation-extended-break").removeClass("d-none");
						$(".operation-liner").removeClass("d-none");
						break;
					case "remote_on":
						$(".operation-automation").removeClass("d-none");
						$(".operation-break").removeClass("d-none");
						$(".operation-top-add").removeClass("d-none");
						$(".operation-log").removeClass("d-none");
						$(".operation-dump").removeClass("d-none");
						break;
					case "sportsremote_on":
						$(".operation-automation").removeClass("d-none");
						$(".operation-break").removeClass("d-none");
						$(".operation-extended-break").removeClass("d-none");
						$(".operation-liner").removeClass("d-none");
						$(".operation-dump").removeClass("d-none");
						break;
				}
			});
		}

		// Recorder stuff
		if (
			(typeof updated.state !== "undefined" &&
				(updated.state.endsWith("_break") ||
					updated.state.endsWith("_halftime") ||
					updated.state.endsWith("_on"))) ||
			typeof updated.calendarUnique !== "undefined"
		) {
			startRecording();
		}

		// Close / re-open remote process if bad call quality and doing something other than going live or returning from break
		if (
			typeof updated.state !== "undefined" &&
			badQualityTimer &&
			[
				"sports_on",
				"sportsremote_on",
				"sports_returning",
				"sportsremote_returning",
			].indexOf(updated.state) === -1
		) {
			window.ipc.process.remote(["close"]);
			pendingHostCall = undefined;
			clearTimeout(badQualityTimer);
			badQualityTimer = undefined;
		}

		// Remote broadcast stuff
		if (
			typeof updated.hostCalled !== "undefined" ||
			typeof updated.hostCalling !== "undefined"
		) {
			if (
				meta.meta.hostCalled === hosts.client.ID ||
				meta.meta.hostCalling === hosts.client.ID
			) {
				if (!pendingHostCall) window.ipc.process.remote(["reload"]);
			} else {
				window.ipc.process.remote(["close"]);
			}
		}

		// Remove pulsing indication that remote host is connected when not doing a remote broadcast
		if (
			typeof updated.state !== "undefined" &&
			!updated.state.endsWith("_remote") &&
			!updated.state.endsWith("_sportsremote") &&
			!updated.state.startsWith("remote_") &&
			!updated.state.startsWith("sportsremote_")
		) {
			$(".btn-operation-resume").removeClass("pulse-success");
		}
	} catch (e) {
		console.error(e);
		$(document).Toasts("create", {
			class: "bg-danger",
			title: "Error newMeta",
			body:
				"There was an error in meta.newMeta. Please report this to the engineer.",
			autohide: true,
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
						moment(fullMeta.queueFinish).diff(moment(fullMeta.time), "seconds")
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
					? `${moment
							.duration(queueLength, "seconds")
							.format(
								"HH:mm:ss"
							)}<i class="fas fa-hourglass-half" title="Might be inaccurate"></i>`
					: moment.duration(queueLength, "seconds").format("HH:mm:ss")
			);
			$(".meta-firstTrack").html(
				fullMeta.queueCalculating || fullMeta.countdown === null
					? `${moment
							.duration(queueLength, "seconds")
							.format(
								"HH:mm:ss"
							)}<i class="fas fa-hourglass-half" title="Might be inaccurate"></i>`
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
				$(".operations-bar").addClass("navbar-orange");
				setTimeout(function () {
					$(".operations-bar").removeClass("navbar-orange");
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
					let totalMinutes = moment(fullMeta.scheduledEnd).diff(
						moment(fullMeta.scheduledStart),
						"minutes"
					);
					let minutesLeft = moment(fullMeta.scheduledEnd).diff(
						moment(fullMeta.time),
						"minutes"
					);
					let progress =
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
			setSize($("#clockwheel-donut").width(), $("#clockwheel-donut").height());
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
				if (queueLength === 3) {
					sounds.three.play();
				}
				if (queueLength === 2) {
					sounds.two.play();
				}
				if (queueLength === 1) {
					sounds.one.play();
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
			hosts.isHost &&
			!fullMeta.state.startsWith("automation_") &&
			!fullMeta.state.startsWith("prerecord_")
		) {
			if (!breakNotified) {
				breakNotified = true;
				window.ipc.makeNotification([
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

		animations.add("break-check", () => {
			// Flash break button when break is needed
			if (
				(moment(fullMeta.time).minutes() >= 58 ||
					moment(fullMeta.time).minutes() < 5) &&
				hosts.isHost &&
				!fullMeta.state.startsWith("automation_") &&
				!fullMeta.state.startsWith("prerecord_") &&
				moment(fullMeta.time).diff(moment(fullMeta.lastID), "minutes") >= 10
			) {
				$(".btn-operation-break").addClass("pulse-warning");
			} else {
				$(".btn-operation-break").removeClass("pulse-warning");
			}
		});
	} catch (e) {
		console.error(e);
		$(document).Toasts("create", {
			class: "bg-danger",
			title: "Error metaTick",
			body:
				"There was an error in meta.metaTick. Please report this to the engineer.",
			autohide: true,
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
	let globalStatus = 5;

	// Process each status and generate content
	let html = `<ul>`;
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
			// Notifications on silence detection
			if (record.name === `silence` && hosts.isHost) {
				window.ipc.makeNotification([
					{
						title: "Silence Detected",
						bg: "danger",
						header:
							"Silence detection triggered! Please ensure your audio levels are good and not too quiet.",
						flash: true,
						body: record.data,
					},
				]);
			}

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
	let globalEas = 5;

	// Process each status and generate content
	let html = `<ul>`;
	db.map((record) => {
		switch (record.severity) {
			case "Extreme":
				html += `<li>
                        <span class="badge badge-danger">EXTREME</span> <strong>${
													record.alert
												}</strong>: in effect for ${
					record.counties
				} from ${moment
					.tz(record.starts, meta.meta ? meta.meta.timezone : moment.tz.guess())
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
					.tz(record.starts, meta.meta ? meta.meta.timezone : moment.tz.guess())
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
					.tz(record.starts, meta.meta ? meta.meta.timezone : moment.tz.guess())
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
					.tz(record.starts, meta.meta ? meta.meta.timezone : moment.tz.guess())
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
				.tz(record.expires, meta.meta ? meta.meta.timezone : moment.tz.guess())
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
				.tz(record.expires, meta.meta ? meta.meta.timezone : moment.tz.guess())
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
		let html = ``;
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
	animations.add("clockwheel-update", () => {
		calendar.getEvents((events) => {
			window.ipc.calendar.updateClockwheel([events, meta.meta]);
		});
	});
}

/**
 * When the calendar process returns new data for the clockwheel, update the clockwheel
 *
 * @let {object} arg[0] New data object for the clockwheel Chart.js
 */
window.ipc.on.updateClockwheel((event, arg) => {
	animations.add("clockwheel-update-2", () => {
		clockwheelDonut.data = arg[0];
		clockwheelDonut.update();
	});
});

// execute updateCalendar function each time calendar has been changed, but add a 1-second buffer so we don't update a million times at once.
let calTimer;
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
		let danger =
			todos.status.danger +
			todos.accountability.danger +
			todos.timesheets.danger +
			todos.DJs.danger;
		let orange =
			todos.status.orange +
			todos.accountability.orange +
			todos.timesheets.orange +
			todos.DJs.orange;
		let warning =
			todos.status.warning +
			todos.accountability.warning +
			todos.timesheets.warning +
			todos.DJs.warning;
		let info =
			todos.status.info +
			todos.accountability.info +
			todos.timesheets.info +
			todos.DJs.info;
		let primary =
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
        RECIPIENTS FUNCTIONS
    */

recipients.on("change", "renderer", (db) => {
	messages.updateRecipientsTable();

	// If this host wants to make a call, and the host we want to call is online and has a peer, start a call.
	if (
		meta.meta.hostCalling !== null &&
		hosts.client.ID === meta.meta.hostCalling &&
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_") ||
			meta.meta.state === "automation_remote" ||
			meta.meta.state === "automation_sportsremote" ||
			pendingHostCall)
	) {
		let called = db.get().find((rec) => rec.hostID === meta.meta.hostCalled);
		if (called && called.peer && called.status === 5) {
			console.log(
				`Host ${called.hostID} is ready to take the call. Asking remote process to start audio call if not already in one.`
			);
			$(".remote-start-status").html("Starting audio call");
			window.ipc.remote.startCall([called.peer]);
		} else {
			$(".btn-operation-resume").removeClass("pulse-success");
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
messages.on("newMessage", "renderer", (message) => {
	window.ipc.flashMain(true);
	$(document).Toasts("create", {
		class: "bg-primary",
		title: `New Message from ${message.fromFriendly}`,
		autohide: true,
		delay: 30000,
		body: `${message.message}<p><strong>To reply:</strong> Click "Messages / Chat" in the left menu and select the recipient.</p>`,
		icon: "fas fa-comment fa-lg",
		position: "bottomRight",
	});
});

/*
		HOSTS FUNCTIONS
	*/

hosts.on("clientChanged", "renderer", (newClient) => {
	// Refresh the socket
	socket.disconnect();
	setTimeout(() => {
		socket.reconnect();
	}, 5000);
});

/*
		VERSION FUNCTIONS
	*/

let newestVersion = ``;
_version.on("change", "renderer", (db) => {
	let record = db.get().find((rec) => rec.app === `wwsu-dj-controls`);
	if (!record) return;
	if (record.version !== newestVersion) {
		newestVersion = record.version;
		let isNewVersion = window.ipc.checkVersion(record.version);
		if (isNewVersion) {
			window.ipc.makeNotification([
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
state.on("startRemote", "renderer", (host) => {
	console.log(`Requested remote broadcast with host ${host}`);

	// Check to make sure the selected host is online. If not, bail.
	let recipient = recipients.find({ hostID: host }, true);

	// Reject if the host recipient reports offline.
	if (!recipient || recipient.status !== 5) {
		$(".remote-start-status").html("");
		state.unblockBroadcastModal();
		$(document).Toasts("create", {
			class: "bg-danger",
			title: "Remote broadcast failed",
			delay: 15000,
			autohide: true,
			body: `The host you selected to call is not online. Please try using a different host.`,
		});
		window.ipc.process.remote(["close"]);
		pendingHostCall = null;
		return;
	}

	pendingHostCall = host;

	// Close and re-open the remote process
	$(".remote-start-status").html("Starting audio call process");
	window.ipc.process.remote(["reload"]);
});

window.ipc.on.remoteReady((event, arg) => {
	console.log(
		`Remote process ready. Grabbing a Skyway.js credential from WWSU.`
	);
	$(".remote-start-status").html("Getting a Skyway.js credential");
	remote.credentialComputer({}, (credential) => {
		console.dir(credential);
		if (!credential) {
			pendingHostCall = undefined;
			$(".remote-start-status").html("");
			state.unblockBroadcastModal();
			window.ipc.process.remote(["close"]);
			$(document).Toasts("create", {
				class: "bg-danger",
				title: "Remote broadcast failed",
				delay: 15000,
				autohide: true,
				body: `There was a problem getting a skyway.js authorization credential. Please report this to the engineer.`,
			});
		} else {
			console.log(
				`Credential received. Sending to remote to establish peer connection.`
			);
			$(".remote-start-status").html("Establishing Skyway.js connection");
			window.ipc.remote.peerCredential([
				credential.peerId,
				credential.apiKey,
				credential.authToken,
			]);
		}
	});
});

window.ipc.on.remotePeerReady((event, arg) => {
	animations.add("notifications-remote", () => {
		$(".notifications-remote").removeClass("badge-success");
		$(".notifications-remote").removeClass("badge-warning");
		$(".notifications-remote").removeClass("badge-danger");
		$(".notifications-remote").removeClass("badge-info");
		$(".notifications-remote").removeClass("badge-secondary");
		$(".notifications-remote").addClass("badge-primary");
	});
	remoteShouldBeMuted();
	recipients.registerPeer(arg[0]);
	console.dir(pendingHostCall);

	// Reconnect in the event we lost connection
	if (
		meta.meta.hostCalling === hosts.client.ID &&
		(meta.meta.state.endsWith("_remote") ||
			meta.meta.state.endsWith("_sportsremote") ||
			meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_"))
	)
		pendingHostCall = meta.meta.hostCalled;

	if (pendingHostCall) {
		let called = recipients
			.db()
			.get()
			.find((rec) => rec.hostID === pendingHostCall);
		if (
			called &&
			called.peer &&
			called.status === 5 &&
			meta.meta.hostCalled === pendingHostCall
		) {
			console.log(
				`Host ${called.hostID} is already connected and ready to take the call. Asking remote process to start audio call if not already in one.`
			);
			$(".remote-start-status").html("Starting audio call");
			window.ipc.remote.startCall([called.peer]);
		} else {
			console.log(
				`Asking host ${pendingHostCall} to load remote process and peer (via WWSU API).`
			);
			$(".remote-start-status").html("Waiting for remote host to connect");
			remote.request({ ID: pendingHostCall });
		}
	}
});

window.ipc.on.remotePeerUnavailable((event, arg) => {
	$(".remote-start-status").html("");
	state.unblockBroadcastModal();
	$(document).Toasts("create", {
		class: "bg-danger",
		title: "Remote broadcast failed",
		delay: 15000,
		autohide: true,
		body: `The host you selected to call did not answer the call. Please try using a different host.`,
	});
	window.ipc.process.remote(["close"]);
	pendingHostCall = null;
	remote.request({ ID: null });
});

window.ipc.on.remoteIncomingCall((event, arg) => {
	let recipient = recipients.find({
		peer: arg[0],
		makeCalls: true,
		authorized: true,
	});
	if (recipient) {
		console.log(
			`Peer ${arg[0]} is allowed to call. Requesting to auto-answer.`
		);
		window.ipc.remote.answerCall([arg[0]]);
	} else {
		console.log(
			`Peer ${arg[0]} does not match any authorized recipients who can make calls. Rejected.`
		);
	}
});

window.ipc.on.peerCallEstablished((event, arg) => {
	animations.add("notifications-remote", () => {
		$(".notifications-remote").removeClass("badge-primary");
		$(".notifications-remote").removeClass("badge-warning");
		$(".notifications-remote").removeClass("badge-danger");
		$(".notifications-remote").removeClass("badge-info");
		$(".notifications-remote").removeClass("badge-secondary");
		$(".notifications-remote").addClass("badge-success");
		$(".meta-callQuality").removeClass("d-none");
	});
	if (
		!meta.meta.state.startsWith("remote_") &&
		!meta.meta.state.startsWith("sportsremote_") &&
		!meta.meta.state.endsWith("_remote") &&
		!meta.meta.state.endsWith("_sportsremote")
	) {
		$(".remote-start-status").html("Starting remote broadcast");
		state.finalizeRemote((success) => {
			state.unblockBroadcastModal();
			if (success) {
				$(".remote-start-status").html("");
				pendingHostCall = undefined;
				state.broadcastModal.iziModal("close");
			} else {
				remote.request({ ID: null });
			}
		});
	} else {
		if (
			meta.meta.state === "sportsremote_break" ||
			meta.meta.state === "remote_break" ||
			meta.meta.state === "sportsremote_halftime"
		) {
			$(".btn-operation-resume").addClass("pulse-success");
		}
		$(document).Toasts("create", {
			class: "bg-success",
			title: "Remote call re-established",
			delay: 30000,
			autohide: true,
			body: `The remote audio call was re-established. You can resume / proceed with the broadcast.`,
		});
	}
});

window.ipc.on.peerCallAnswered((event, arg) => {
	animations.add("notifications-remote", () => {
		$(".notifications-remote").removeClass("badge-primary");
		$(".notifications-remote").removeClass("badge-warning");
		$(".notifications-remote").removeClass("badge-danger");
		$(".notifications-remote").removeClass("badge-success");
		$(".notifications-remote").removeClass("badge-secondary");
		$(".notifications-remote").addClass("badge-info");
		$(".meta-callQuality").removeClass("d-none");
	});
});

window.ipc.on.peerOutgoingSilence((event, arg) => {
	if (
		arg[0] &&
		(meta.meta.state === "remote_on" ||
			meta.meta.state === "sportsremote_on") &&
		hosts.client.ID === meta.meta.hostCalling &&
		!meta.meta.playing
	) {
		if (socket.isConnected()) state.break({ problem: true });
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").addClass("badge-danger");
		});
		window.ipc.makeNotification([
			{
				title: "Silence on Outgoing Audio",
				bg: "danger",
				header: "Silence on outgoing audio!",
				flash: true,
				body: `<p>Silence was detected for 15 seconds on outgoing audio. Remote broadcast has been sent to break. Please check your audio devices and DJ Controls' Audio settings.</p>`,
			},
		]);
		sounds.callSilence.play();
		window.ipc.process.remote(["close"]); // Restart process in case it is a process problem
	}
});

window.ipc.on.peerIncomingCallClosed((event, arg) => {
	remoteQuality.callClosed(arg[0]);
	if (
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_")) &&
		hosts.client.ID === meta.meta.hostCalled
	) {
		if (
			!meta.meta.state.endsWith("_break") &&
			!meta.meta.state.endsWith("_halftime")
		)
			state.break({ problem: true });
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").addClass("badge-danger");
			$(".meta-callQuality").addClass("d-none");
		});
	}
	window.ipc.process.remote(["close"]);
});

window.ipc.on.peerCallClosed((event, arg) => {
	remoteQuality.callClosed(arg[0]);
	if (
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_")) &&
		hosts.client.ID === meta.meta.hostCalling
	) {
		if (socket.isConnected()) state.break({ problem: true });
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").addClass("badge-danger");
			$(".meta-callQuality").addClass("d-none");
		});
		window.ipc.makeNotification([
			{
				title: "Audio Call was Closed!",
				bg: "danger",
				header: "Audio Call was Closed",
				flash: true,
				body: `<p>The audio call for the remote broadcast closed. The broadcast was sent to break. Please check your network settings and resume the broadcast when things are stable.</p><p>This could also be a network issue on WWSU's end. If so, please report this under "report a problem".</p>`,
			},
		]);
		sounds.callTerminated.play();

		pendingHostCall = undefined;
	}
	window.ipc.process.remote(["close"]);
});

window.ipc.on.peerDestroyed((event, arg) => {
	remoteQuality.peerDestroyed();
	if (
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_")) &&
		hosts.client.ID === meta.meta.hostCalling
	) {
		if (
			socket.isConnected() &&
			!meta.meta.state.endsWith("_break") &&
			!meta.meta.state.endsWith("_halftime")
		)
			state.break({ problem: true });
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").addClass("badge-danger");
			$(".meta-callQuality").addClass("d-none");
		});
		window.ipc.makeNotification([
			{
				title: "Audio Call was Closed!",
				bg: "danger",
				header: "Audio Call was Closed",
				flash: true,
				body: `<p>The audio call for the remote broadcast closed. The broadcast was sent to break. Please check your network settings and resume the broadcast when things are stable.</p><p>This could also be a network issue on WWSU's end. If so, please report this under "report a problem".</p>`,
			},
		]);
		sounds.callTerminated.play();
		pendingHostCall = undefined;
	}
	if (
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_")) &&
		hosts.client.ID === meta.meta.hostCalled
	) {
		if (
			socket.isConnected() &&
			!meta.meta.state.endsWith("_break") &&
			!meta.meta.state.endsWith("_halftime")
		)
			state.break({ problem: true });
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").addClass("badge-danger");
			$(".meta-callQuality").addClass("d-none");
		});
	}
	window.ipc.process.remote(["close"]);
});

window.ipc.on.peerNoCalls((event, arg) => {
	remoteQuality.peerDestroyed();
	if (
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_")) &&
		hosts.client.ID === meta.meta.hostCalling
	) {
		if (
			socket.isConnected() &&
			!meta.meta.state.endsWith("_break") &&
			!meta.meta.state.endsWith("_halftime")
		)
			state.break({ problem: true });
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").addClass("badge-danger");
			$(".meta-callQuality").addClass("d-none");
		});
		window.ipc.makeNotification([
			{
				title: "Audio Call was Closed!",
				bg: "danger",
				header: "Audio Call was Closed",
				flash: true,
				body: `<p>You tried to start / resume a broadcast when an audio call was not ongoing. The broadcast was sent to break. Please check your network settings and wait for the resume button to start pulsing.</p>`,
			},
		]);
		sounds.callTerminated.play();
		pendingHostCall = undefined;
	}
	if (
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_")) &&
		hosts.client.ID === meta.meta.hostCalled
	) {
		if (
			socket.isConnected() &&
			!meta.meta.state.endsWith("_break") &&
			!meta.meta.state.endsWith("_halftime")
		)
			state.break({ problem: true });
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").addClass("badge-danger");
			$(".meta-callQuality").addClass("d-none");
		});
	}
	window.ipc.process.remote(["close"]);
});

window.ipc.on.peerQualityProblem((event, arg) => {
	remoteQuality.qualityProblem(arg[0], arg[1], arg[2]);
});

remoteQuality.on("quality", "renderer", (connection, reason, quality) => {
	if (hosts.client.ID === meta.meta.hostCalled) {
		console.log(`Call quality ${connection}: ${quality}% because ${reason}`);
		remote.sendQuality({ quality });
	}
});

remote.on("callQuality", "renderer", (quality) => {
	if (
		quality <= 0 &&
		(meta.meta.state.startsWith("remote_") ||
			meta.meta.state.startsWith("sportsremote_")) &&
		hosts.client.ID === meta.meta.hostCalling
	) {
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").addClass("badge-danger");
		});
		if (!badQualityTimer) {
			window.ipc.makeNotification([
				{
					title: "Poor Audio Call Quality",
					bg: "warning",
					header: "Poor Audio Call Quality",
					flash: true,
					body: `<p>Audio call quality is poor; call will be restarted the next time you take a break (unless it improves). Please check your network connection and ensure you are not running CPU-heavy programs.</p>`,
				},
			]);
			badQualityTimer = setTimeout(() => {
				badQualityTimer = undefined;
			}, 300000);
		}
	}

	if (quality >= 100 && badQualityTimer) {
		clearTimeout(badQualityTimer);
		badQualityTimer = undefined;
	}

	animations.add("callquality", () => {
		$(".meta-callQuality-progress").css("width", `${quality}%`);
	});

	if (hosts.client.ID === meta.meta.hostCalling) {
		animations.add("notifications-remote", () => {
			$(".notifications-remote").removeClass("badge-primary");
			$(".notifications-remote").removeClass("badge-warning");
			$(".notifications-remote").removeClass("badge-info");
			$(".notifications-remote").removeClass("badge-success");
			$(".notifications-remote").removeClass("badge-secondary");
			$(".notifications-remote").removeClass("badge-danger");
			if (quality <= 33) {
				$(".notifications-remote").addClass("badge-danger");
			} else if (quality <= 66) {
				$(".notifications-remote").addClass("badge-warning");
			} else {
				$(".notifications-remote").addClass("badge-success");
			}
		});
	}

	console.log(`Remote host: Call quality reported at ${quality}%.`);
});

function remoteShouldBeMuted() {
	if (
		(meta.meta.state !== "remote_on" &&
			meta.meta.state !== "sportsremote_on") ||
		meta.meta.playing
	) {
		console.log(`Muting remote audio`);
		window.ipc.remote.mute([true]);
	} else {
		console.log(`Un-muting remote audio`);
		window.ipc.remote.mute([false]);
	}
}
