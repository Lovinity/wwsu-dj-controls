"use strict";

// Initialize unhandled exceptions handler first
const { is, openNewGitHubIssue, debugInfo } = require("electron-util");
const unhandled = require("electron-unhandled");
unhandled({
	reportButton: (error) => {
		openNewGitHubIssue({
			user: "Lovinity",
			repo: "wwsu-dj-controls",
			body: `
			<!-- Below, please describe what you were doing leading up to the issue (steps to reproduce) -->
			
			<!-- Below, please explain what you expected to happen -->
			
			<!-- Below, please explain what actually happened, including relevant error messages -->

			---
			The following is auto-generated information about the error you received.
			${error.message}
			${error.stack}
			
			---
			The following is auto-generated information about the app version you are using and the OS you are running.
			${debugInfo()}`,
		});
	},
});

// Require other constants
const fs = require("fs");
const path = require("path");
const {
	app,
	BrowserWindow,
	Menu,
	ipcMain,
	session,
	shell,
	contentTracing,
	webFrame,
} = require("electron");
const { autoUpdater } = require("electron-updater");
const debug = require("electron-debug");
const contextMenu = require("electron-context-menu");
const config = require("./config.js");
const menu = require("./menu");
const packageJson = require("./package.json");
const { machineIdSync } = require("./assets/wwsu-host-id");
const Sanitize = require("sanitize-filename");
const semver = require("semver");
const serialport = require("serialport");

// Initialize debug tools
debug();

// Initialize context menu
contextMenu();

app.setAppUserModelId(packageJson.appId);

/*
// Use custom update config
autoUpdater.updateConfigPath = path.join(__dirname, "app-update.yml");

// Do not auto download files because we are using unsigned programs
autoUpdater.autoDownload = false;

// Allow prereleases as we do these often
autoUpdater.allowPrerelease = true;

// Auto update interval (we do not immediate check for an update until mainWindow is ready to show)
const ONE_HOUR = 1000 * 60 * 60;
setInterval(() => {
	// autoUpdater.checkForUpdates();
}, ONE_HOUR);

autoUpdater.on("error", (e) => {
	console.error(e);
});

autoUpdater.on("update-available", (info) => {
	mainWindow.webContents.send("update-available", [info, packageJson]);
});
*/

// Prevent windows from being garbage collected
let loadingScreen;
let mainWindow;
let calendarWindow;
let audioWindow;
let silenceWindow;
let recorderWindow;
let remoteWindow;

const enforceCORS = () => {
	// On requests to skyway.js, we must use the WWSU server as the Origin so skyway can verify us.
	// For all other requests, we can use the default file origin (which we should, especially for the WWSU server)
	session.defaultSession.webRequest.onBeforeSendHeaders(
		{ urls: [`https://*.webrtc.ecl.ntt.com/*`] },
		(details, callback) => {
			callback({
				requestHeaders: {
					...details.requestHeaders,
					Origin: "https://server.wwsu1069.org",
				},
			});
		}
	);

	// Apply content security policy to all responses when not in development mode
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": !is.development
					? [
							`script-src 'self' https://server.wwsu1069.org https://webrtc.ecl.ntt.com`,
					  ]
					: [],
			},
		});
	});
};

const createLoadingScreen = () => {
	/// create a browser window
	loadingScreen = new BrowserWindow(
		Object.assign({
			/// define width and height for the window
			width: 200,
			height: 400,
			/// remove the window frame, so it will become a frameless window
			frame: false,
			/// and set the transparency, to remove any window background color
			transparent: true,
		})
	);
	loadingScreen.setResizable(false);
	loadingScreen.loadFile("splash.html");
	loadingScreen.on("closed", () => (loadingScreen = undefined));
	loadingScreen.webContents.on("did-finish-load", () => {
		loadingScreen.show();
	});
};

// Calendar process
const createCalendarWindow = () => {
	// Create the calendar process
	calendarWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		show: false,
		title: `${app.name} - Calendar Process`,
		webPreferences: {
			contextIsolation: true,
			enableRemoteModule: false, // electron's remote module is insecure
			preload: path.join(__dirname, "preload-calendar.js"),
			backgroundThrottling: false, // Do not throttle this process. It doesn't do any work anyway unless told to by another process.
		},
	});

	calendarWindow.on("closed", function () {
		if (mainWindow !== null) {
			createCalendarWindow();
		}
	});
	calendarWindow.loadFile("calendar.html");
};

// Process for audio
const createAudioWindow = () => {

	// Create the audio process
	audioWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		show: false,
		title: `${app.name} - Audio Process`,
		webPreferences: {
			contextIsolation: true,
			enableRemoteModule: false, // electron's remote module is insecure
			preload: path.join(__dirname, "preload-audio.js"),
			backgroundThrottling: false, // Do not throttle this process. It doesn't do any work anyway unless told to by another process.
		},
	});

	audioWindow.on("closed", function () {
		if (mainWindow !== null) {
			createAudioWindow();
		}
	});
	audioWindow.loadFile("audio.html");
};

// Process for silence detection
const createSilenceWindow = () => {
	// Create the audio process
	silenceWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		show: false,
		title: `${app.name} - Silence Detection Process`,
		webPreferences: {
			contextIsolation: true,
			enableRemoteModule: false, // electron's remote module is insecure
			preload: path.join(__dirname, "preload-audio.js"),
			backgroundThrottling: false, // Do not throttle this process. It doesn't do any work anyway unless told to by another process.
		},
	});

	silenceWindow.on("closed", function () {
		silenceWindow = null;
		if (mainWindow !== null) {
			mainWindow.webContents.send("processClosed", ["silence"]);
		}
	});

	silenceWindow.loadFile("silence.html");
};

// Process for recorder
const createRecorderWindow = () => {
	// Create the audio process
	recorderWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		show: false,
		title: `${app.name} - Recorder Process`,
		webPreferences: {
			contextIsolation: true,
			enableRemoteModule: false, // electron's remote module is insecure
			preload: path.join(__dirname, "preload-audio.js"),
			backgroundThrottling: false, // Do not throttle this process. It doesn't do any work anyway unless told to by another process.
		},
	});

	recorderWindow.on("closed", function () {
		recorderWindow = null;
		if (mainWindow !== null) {
			mainWindow.webContents.send("processClosed", ["recorder"]);
		}
	});

	recorderWindow.loadFile("recorder.html");
};

// Process for remote broadcasts
const createRemoteWindow = () => {
	// Create the audio process
	remoteWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		show: false,
		title: `${app.name} - Remote Process`,
		webPreferences: {
			contextIsolation: true,
			enableRemoteModule: false, // electron's remote module is insecure
			preload: path.join(__dirname, "preload-audio.js"),
			backgroundThrottling: false, // Do not throttle this process. It doesn't do any work anyway unless told to by another process.
		},
	});

	remoteWindow.on("closed", function () {
		remoteWindow = null;
		if (mainWindow !== null) {
			mainWindow.webContents.send("processClosed", ["remote"]);
		}
	});

	remoteWindow.loadFile("remote.html");
};

// Create the main window, and also create the other renderer processes
const createWindows = () => {
	createLoadingScreen();

	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 720,
		minWidth: 480,
		minHeight: 360,
		show: false, // Do not show until we are ready to show via ready-to-show event
		title: app.name,
		autoHideMenuBar: true, // Do not show manu bar unless alt is pressed
		webPreferences: {
			contextIsolation: true,
			enableRemoteModule: false, // electron's remote module is insecure
			nativeWindowOpen: true, // Needed for Discord WidgetBot.io
			preload: path.join(__dirname, "preload-renderer.js"),
			zoomFactor: 1.25,
		},
	});

	// Do not show the window until DOM has loaded. Otherwise, we will get a white flash effect that is not pleasant.
	// Also, do not load other processes until renderer is ready.
	mainWindow.once("ready-to-show", () => {
		// Show the window and check for updates
		mainWindow.show();

		// Destroy loading screen
		loadingScreen.destroy();
		loadingScreen = undefined;

		// TODO: Check for updates (disabled as it does not work)
		// autoUpdater.checkForUpdates();

		createCalendarWindow();
		createAudioWindow();
	});

	// and load the renderer.html of the app.
	mainWindow.loadFile("renderer.html");

	// When mainWindow is closed, all other processes should also be closed
	mainWindow.on("closed", function () {
		mainWindow = null;

		try {
			// Recorder should be shut down gracefully to save current recording
			if (recorderWindow) {
				recorderWindow.webContents.send("shutDown");
			}

			calendarWindow.close();
			calendarWindow = null;

			audioWindow.close();
			audioWindow = null;

			if (silenceWindow) {
				silenceWindow.close();
				silenceWindow = null;
			}

			if (remoteWindow) {
				remoteWindow.close();
				remoteWindow = null;
			}
		} catch (eee) {}
	});

	mainWindow.on("focus", () => mainWindow.flashFrame(false));

	/* Electron v10
	mainWindow.webContents.on("render-process-gone", (event, details) => {
		console.log("Process gone!");
		makeNotification({
			title: "WWSU DJ Controls Crashed!",
			bg: "danger",
			header: "WWSU DJ Controls Crashed!",
			flash: true,
			body: `<p>Wuh oh! WWSU DJ Controls crashed, code ${details.reason}!</p><p>Please close and re-open DJ Controls.</p><p>If this problem continues, please contact the engineer or xanaftp@gmail.com.</p>`,
		});
		try {
			// Recorder should be shut down gracefully to save current recording
			if (recorderWindow) {
				recorderWindow.webContents.send("shutDown");
			}

			calendarWindow.close();
			calendarWindow = null;

			audioWindow.close();
			audioWindow = null;

			if (silenceWindow) {
				silenceWindow.close();
				silenceWindow = null;
			}

			if (remoteWindow) {
				remoteWindow.close();
				remoteWindow = null;
			}
		} catch (eee) {}
	});
	*/

	mainWindow.webContents.on("crashed", (event, killed) => {
		console.log("Main UI gone!");
		makeNotification({
			title: "WWSU DJ Controls Crashed!",
			bg: "danger",
			header: "WWSU DJ Controls Crashed!",
			flash: true,
			body: `<p>WWSU DJ Controls either crashed or was forcefully terminated. Please restart WWSU DJ Controls if you were using it, especially if doing a broadcast.</p>`,
		});

		try {
			// Recorder should be shut down gracefully to save current recording
			if (recorderWindow) {
				recorderWindow.webContents.send("shutDown");
			}

			calendarWindow.close();
			calendarWindow = null;

			audioWindow.close();
			audioWindow = null;

			if (silenceWindow) {
				silenceWindow.close();
				silenceWindow = null;
			}

			if (remoteWindow) {
				remoteWindow.close();
				remoteWindow = null;
			}
		} catch (eee) {}
	});
};

const makeNotification = (data) => {
	let notificationWindow = new BrowserWindow({
		width: 640,
		height: 480,
		show: false,
		center: true,
		alwaysOnTop: true,
		minimizable: false,
		maximizable: false,
		autoHideMenuBar: true, // Do not show manu bar unless alt is pressed
		title: `DJ Controls - ${data.title}`,
		webPreferences: {
			contextIsolation: true,
			enableRemoteModule: false, // electron's remote module is insecure
			preload: path.join(__dirname, "preload-notification.js"),
			backgroundThrottling: false, // Do not throttle this process.
			zoomFactor: 1.25,
		},
	});
	notificationWindow.once("ready-to-show", () => {
		notificationWindow.show();
		notificationWindow.webContents.send("notificationData", data);
	});
	notificationWindow.loadFile("notification.html");
};

// Enforce sandboxing for security
app.enableSandbox();

// Prevent multiple instances of the app
if (!app.requestSingleInstanceLock()) {
	app.quit();
}

// If a second instance is spawned, show the current instance
app.on("second-instance", () => {
	if (mainWindow) {
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}

		mainWindow.show();
	}
});

// Quit the app if all windows are closed
app.on("window-all-closed", () => {
	app.quit();
});

// If we do not have a mainWindow for whatever reason, restart the windows
app.on("activate", () => {
	if (!mainWindow) {
		createWindows();
	}
});

// Prevent opening new windows in the app browsers; use the default browser instead
// DISABLED as it interferes with WidgetBot.io
/*
app.on("web-contents-created", (event, contents) => {
	contents.on("new-window", async (event, navigationUrl) => {
		// In this example, we'll ask the operating system
		// to open this event's url in the default browser.
		event.preventDefault();

		await shell.openExternal(navigationUrl);
	});
});
*/

// Start loading the app
app
	.whenReady()
	.then(enforceCORS)
	.then(Menu.setApplicationMenu(menu))
	.then(createWindows);

/*
	IPC COMMUNICATIONS
*/

// Sync get the machine ID string for this installation
ipcMain.on("get-machine-id", (event) => {
	event.returnValue = machineIdSync();
});

// Sync Get the app and version info
ipcMain.on("get-app-version", (event) => {
	event.returnValue = `${packageJson.name} v${packageJson.version}`;
});

// Sync check if a version is newer than our version
ipcMain.on("check-version", (event, arg) => {
	if (semver.gt(arg, packageJson.version)) {
		event.returnValue = { current: packageJson.version };
	}
	event.returnValue = false;
});

// Sync return settings store
ipcMain.on("settings", (event, arg) => {
	event.returnValue = config.get(arg);
});

// Save new settings
ipcMain.on("saveSettings", (event, arg) => {
	console.log("saving settings");
	console.dir(arg);
	config.set(arg[0], arg[1]);
});

// Flash the icon in the taskbar
ipcMain.on("flashMain", (event, arg) => {
	try {
		mainWindow.flashFrame(arg);
	} catch (e) {
		console.error(e);
	}
});

// Set the progress bar on the taskbar icon (arg is the percent).
ipcMain.on("progressMain", (event, arg) => {
	try {
		mainWindow.setProgressBar(arg);
	} catch (e) {
		console.error(e);
	}
});

// Args should be an array pair: [command string, [array of additional parameters] ]

// Messages to be sent to the renderer process
ipcMain.on("renderer", (event, arg) => {
	try {
		if (mainWindow) mainWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {}
});

// Messages to be sent to the calendar process
ipcMain.on("calendar", (event, arg) => {
	try {
		if (calendarWindow) calendarWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {}
});

// Messages to be sent to the audio process
ipcMain.on("audio", (event, arg) => {
	try {
		if (audioWindow) audioWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {
		console.error(e);
	}
});

ipcMain.on("remote", (event, arg) => {
	try {
		if (remoteWindow) remoteWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {
		console.error(e);
	}
});

// Messages to be sent to the recorder process
ipcMain.on("recorder", (event, arg) => {
	try {
		if (recorderWindow) recorderWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {}
});

// Process tasks
ipcMain.on("process", (event, arg) => {
	let args = arg[1];
	switch (arg[0]) {
		case "silence":
			if (args[0] === "open" && !silenceWindow) {
				createSilenceWindow();
			}
			if (args[0] === "close" && silenceWindow) {
				silenceWindow.close();
			}
			if (args[0] === "reload" && silenceWindow) {
				silenceWindow.reload();
			}
			break;
		case "recorder":
			if (args[0] === "open" && !recorderWindow) {
				createRecorderWindow();
			}
			if (args[0] === "close" && recorderWindow) {
				recorderWindow.webContents.send("shutDown");
			}
			// Reload is not supported for the recorder
			break;
		case "remote":
			if (args[0] === "open" && !remoteWindow) {
				createRemoteWindow();
			}
			if (args[0] === "close" && remoteWindow) {
				remoteWindow.close();
			}
			if (args[0] === "reload" && remoteWindow) {
				remoteWindow.reload();
			}
			break;
	}
});

// Tasks to be completed by the main process
ipcMain.on("main", (event, arg) => {
	let args = arg[1];
	switch (arg[0]) {
		// Generate a notification window
		case "makeNotification":
			makeNotification(arg[1][0]);
			break;

		// When a file reader is ready to be saved to an audio file
		case "recorderEncoded":
			try {
				// Enforce webm type
				args[0] = `${args[0]}.webm`;

				let arrayBuffer = Buffer.from(new Uint8Array(args[1]));

				// If the base path does not exist, create it
				if (
					!fs.existsSync(path.resolve(`${config.get("recorder.recordPath")}/`))
				) {
					console.log(`base does not exist`);
					fs.mkdirSync(path.resolve(`${config.get("recorder.recordPath")}/`));
				}

				// Make subdirectories if they do not exist
				["live", "remote", "sports", "automation"].map((subdir) => {
					if (
						!fs.existsSync(
							path.resolve(`${config.get("recorder.recordPath")}/${subdir}/`)
						)
					) {
						console.log(`Subdirectory ${subdir} does not exist`);
						fs.mkdirSync(
							path.resolve(`${config.get("recorder.recordPath")}/${subdir}/`)
						);
					}
				});

				// If the specialized sub subdirectory does not exist, make it.
				console.log(
					path.resolve(
						path.dirname(`${config.get("recorder.recordPath")}/${args[0]}`)
					)
				);
				if (
					!fs.existsSync(
						path.resolve(
							path.dirname(`${config.get("recorder.recordPath")}/${args[0]}`)
						)
					)
				) {
					console.log(`Special directory does not exist.`);
					fs.mkdirSync(
						path.resolve(
							path.dirname(`${config.get("recorder.recordPath")}/${args[0]}`)
						)
					);

					// Write a README file
					fs.writeFile(
						`${path.resolve(
							path.dirname(`${config.get("recorder.recordPath")}/${args[0]}`)
						)}/README.txt`,
						`Audio files are recorded in webm/Opus format because the MP3 format is proprietary, and webm/opus works best with DJ Controls. If you need to convert these to another format for free, you can use a free online converter such as https://anyconv.com/webm-to-mp3-converter/ or a downloadable application that can convert WEBM Opus files .` +
							"\n\n" +
							`BE AWARE recordings are only stored temporarily! WWSU reserves the right to delete, modify, and/or monitor any and all recordings at any time without notice. Be sure to save a copy of your recordings ASAP after each show.` +
							"\n\n" +
							`WWSU does not guarantee the reliability of automatic recordings! You should always make your own recordings as well, especially if you want your recordings to be higher than 128kbps.`,
						(err) => {
							console.error(err);
						}
					);
				}

				console.log(`audio save file ${args[0]}`);
				fs.writeFile(
					`${config.get("recorder.recordPath")}/${args[0]}`,
					arrayBuffer,
					function (err) {
						if (err) {
							console.error(err);
						} else {
							recorderWindow.webContents.send(
								`recorderSaved`,
								`${config.get("recorder.recordPath")}/${args[0]}`
							);
							if (mainWindow) {
								mainWindow.webContents.send("console", [
									"log",
									`Audio: Recording ${config.get("recorder.recordPath")}/${
										args[0]
									} saved.`,
								]);
								mainWindow.webContents.send(
									`recorderSaved`,
									`${config.get("recorder.recordPath")}/${args[0]}`
								);
							}
						}
					}
				);
			} catch (e) {
				console.error(e);
				if (mainWindow) mainWindow.webContents.send("console", ["error", e]);
			}
			break;

		// Call to refresh audio devices in all audio processes
		case "audioRefreshDevices":
			if (audioWindow)
				audioWindow.webContents.send("audioRefreshDevices", args);
			if (remoteWindow)
				remoteWindow.webContents.send("audioRefreshDevices", args);
			if (silenceWindow)
				silenceWindow.webContents.send("audioRefreshDevices", args);
			if (recorderWindow)
				recorderWindow.webContents.send("audioRefreshDevices", args);
			break;

		// Reload audio processes
		case "audioReload":
			if (audioWindow) audioWindow.reload();
			if (remoteWindow) remoteWindow.reload();
			if (silenceWindow) silenceWindow.reload();
			if (recorderWindow) recorderWindow.webContents.send("shutDown");
			break;

		// Change the gain on a device
		case "audioChangeVolume":
			try {
				// Update settings
				updateAudioSettings(args[0], args[1], { volume: args[2] });

				// Send new volume gain info to audio processes
				if (audioWindow)
					audioWindow.webContents.send("audioChangeVolume", args);
				if (remoteWindow)
					remoteWindow.webContents.send("audioChangeVolume", args);
				if (silenceWindow)
					silenceWindow.webContents.send("audioChangeVolume", args);
				if (recorderWindow)
					recorderWindow.webContents.send("audioChangeVolume", args);
			} catch (eee) {
				// Ignore errors
				console.error(eee);
			}
			break;

		// Change whether or not a device should be recorded
		case "audioRecorderSetting":
			try {
				// Update settings
				updateAudioSettings(args[0], args[1], { recorder: args[2] });

				// Send new volume gain info to relevant audio processes
				if (recorderWindow)
					recorderWindow.webContents.send("audioRecorderSetting", args);
			} catch (eee) {
				// Ignore errors
				console.error(eee);
			}
			break;

		// Change whether or not a device should be recorded
		case "audioSilenceSetting":
			try {
				// Update settings
				updateAudioSettings(args[0], args[1], { silence: args[2] });

				// Send new volume gain info to relevant audio processes
				if (silenceWindow)
					silenceWindow.webContents.send("audioSilenceSetting", args);
			} catch (eee) {
				// Ignore errors
				console.error(eee);
			}
			break;

		// Change whether or not a device should be broadcast on a remote stream
		case "audioRemoteSetting":
			try {
				// Update settings
				updateAudioSettings(args[0], args[1], { remote: args[2] });

				// Send new volume gain info to relevant audio processes
				if (remoteWindow)
					remoteWindow.webContents.send("audioRemoteSetting", args);
			} catch (eee) {
				// Ignore errors
				console.error(eee);
			}
			break;

		// Change which device is the output device for incoming remote calls
		case "audioOutputSetting":
			try {
				// Update settings; only one device should be allowed to have output as true
				let settings = config.get(`audio`);
				settings = settings.map((set) =>
					updateAudioSettings(set.deviceId, set.kind, { output: false })
				);
				updateAudioSettings(args[0], args[1], { output: args[2] });

				// Send new volume gain info to relevant audio processes
				if (remoteWindow)
					remoteWindow.webContents.send("audioOutputSetting", args);
			} catch (eee) {
				// Ignore errors
				console.error(eee);
			}
			break;
	}
});

// use sanitize-filename
ipcMain.on("sanitize", (event, arg) => {
	event.returnValue = Sanitize(arg);
});

/*
		SERIAL PORTS
	*/

let delaySerial;
let delayData = ``;
let delayTimer;
let delayStatusTimer;

// Sync get available serial ports
ipcMain.on("getSerialPorts", (event) => {
	serialport
		.list()
		.then((ports) => {
			if (!ports) {
				event.returnValue = [];
			} else {
				event.returnValue = ports;
			}
		})
		.catch((err) => {
			console.error(err);
			event.returnValue = [];
		});
});

// Restart delay system
ipcMain.on("delayRestart", (event, arg) => {
	restartDelay(arg);
});

// Dump delay system (or deactivate bypass)
ipcMain.on("delayDump", (event) => {
	dumpDelay();
});

function restartDelay(arg) {
	console.log("Restarting Delay Serial connection");
	mainWindow.webContents.send("console", [
		"log",
		`Restarting Delay System serial, device ${config.get(
			"delay.port"
		)}, active = ${arg}`,
	]);
	try {
		delaySerial.close();
	} catch (e) {}

	delaySerial = undefined;
	delayData = ``;
	clearTimeout(delayTimer);
	clearInterval(delayStatusTimer);

	if (arg) {
		// Delay connecting to port 5 seconds to accommodate close method
		setTimeout(() => {
			let device = config.get("delay.port");

			if (device && device !== null && device !== ``) {
				delaySerial = new serialport(device, {
					baudRate: 38400,
				});

				delaySerial.on("error", (err) => {
					console.error(err);
					mainWindow.webContents.send("console", ["error", err]);
					mainWindow.webContents.send("delayError", [err]);
					if (
						err.disconnected ||
						typeof delaySerial === "undefined" ||
						typeof delaySerial.isOpen === "undefined" ||
						!delaySerial.isOpen
					) {
						mainWindow.webContents.send("console", [
							"log",
							`Delay system serial disconnected. Trying to reconnect in 15 seconds.`,
						]);
						setTimeout(() => {
							restartDelay();
						}, 15000);
					}
				});

				delaySerial.on("data", (data) => {
					mainWindow.webContents.send("console", [
						"log",
						`Main: Delay system data received: ${data.toString("hex")}`,
					]);
					delayData += data.toString("hex");
					clearTimeout(delayTimer);
					delayTimer = setTimeout(() => {
						// Delay status
						if (delayData.includes("000c")) {
							let index = delayData.indexOf("000c");
							let seconds =
								parseInt(delayData.substring(index + 6, index + 8), 16) / 10;
							let bypass = hex2bin(delayData.substring(index + 16, index + 18));
							bypass = parseInt(bypass.substring(7, 8)) === 1;
							mainWindow.webContents.send("console", [
								"log",
								`Main: Delay System status is ${seconds} seconds, bypass = ${bypass}`,
							]);
							mainWindow.webContents.send("delay", [seconds, bypass]);
						}

						delayData = ``;
					}, 1000);
				});

				delaySerial.on("open", () => {
					mainWindow.webContents.send("console", [
						"log",
						`Main: Delay System port opened.`,
					]);

					let buffer;

					// Request status after opening
					buffer = new Buffer.alloc(6);
					buffer[0] = 0xfb;
					buffer[1] = 0xff;
					buffer[2] = 0x00;
					buffer[3] = 0x02;
					buffer[4] = 0x11;
					buffer[5] = 0xed;
					delaySerial.write(buffer);

					clearInterval(delayStatusTimer);
					delayStatusTimer = setInterval(() => {
						mainWindow.webContents.send("console", [
							"log",
							`Main: Delay System querying status...`,
						]);
						buffer = new Buffer.alloc(6);
						buffer[0] = 0xfb;
						buffer[1] = 0xff;
						buffer[2] = 0x00;
						buffer[3] = 0x02;
						buffer[4] = 0x11;
						buffer[5] = 0xed;
						delaySerial.write(buffer);
					}, 15000);
				});
			} else {
				mainWindow.webContents.send("console", [
					"log",
					`Main: Delay System no devices selected / ports opened.`,
				]);
			}
		}, 5000);
	}
}

function dumpDelay() {
	if (delaySerial) {
		mainWindow.webContents.send("console", [
			"log",
			`Main: Received request to dump delay system.`,
		]);

		// Deactivate bypass
		mainWindow.webContents.send("console", [
			"log",
			`Main: Delay System deactivating bypass (in case it is activated).`,
		]);
		let buffer;

		buffer = new Buffer.alloc(7);
		buffer[0] = 0xfb;
		buffer[1] = 0xff;
		buffer[2] = 0x00;
		buffer[3] = 0x03;
		buffer[4] = 0x91;
		buffer[5] = 0x00;
		buffer[6] = 0x6c;
		delaySerial.write(buffer);

		// Activate Delay
		mainWindow.webContents.send("console", [
			"log",
			`Main: Delay System activating dump button.`,
		]);
		buffer = new Buffer.alloc(7);
		buffer[0] = 0xfb;
		buffer[1] = 0xff;
		buffer[2] = 0x00;
		buffer[3] = 0x03;
		buffer[4] = 0x90;
		buffer[5] = 0x08;
		buffer[6] = 0x65;
		delaySerial.write(buffer);

		setTimeout(() => {
			// Push the start button
			mainWindow.webContents.send("console", [
				"log",
				`Main: Delay System activating start button to rebuild delay.`,
			]);
			let buffer;

			buffer = new Buffer.alloc(7);
			buffer[0] = 0xfb;
			buffer[1] = 0xff;
			buffer[2] = 0x00;
			buffer[3] = 0x03;
			buffer[4] = 0x90;
			buffer[5] = 0x02;
			buffer[6] = 0x6b;
			delaySerial.write(buffer);

			// Deactivate buttons
			mainWindow.webContents.send("console", [
				"log",
				`Main: Delay System deactivating dump button.`,
			]);
			buffer = new Buffer.alloc(7);
			buffer[0] = 0xfb;
			buffer[1] = 0xff;
			buffer[2] = 0x00;
			buffer[3] = 0x03;
			buffer[4] = 0x90;
			buffer[5] = 0x00;
			buffer[6] = 0x6d;
			delaySerial.write(buffer);

			// Request status after dumping
			mainWindow.webContents.send("console", [
				"log",
				`Main: Delay System querying new status.`,
			]);
			buffer = new Buffer.alloc(6);
			buffer[0] = 0xfb;
			buffer[1] = 0xff;
			buffer[2] = 0x00;
			buffer[3] = 0x02;
			buffer[4] = 0x11;
			buffer[5] = 0xed;
			delaySerial.write(buffer);
		}, 200);
	}
}

/*
		FUNCTIONS
	*/

/**
 * Update config for an audio device.
 *
 * @param {string} deviceId ID of the audio device via web audio API
 * @param {string} kind Device kind
 * @param {object} setting Setting(s) to update
 */
function updateAudioSettings(deviceId, kind, setting) {
	let settings = config.get(`audio`);

	// Try to find existing settings for the device
	let device = settings.find(
		(sett) => sett.deviceId === deviceId && sett.kind === kind
	);

	// If device settings exist, filter audio array to exclude that device, then push in the new settings for the device
	if (device) {
		settings = settings.filter(
			(sett) => sett.deviceId !== deviceId || sett.kind !== kind
		);
		settings.push(Object.assign(device, setting));

		// Otherwise, make a new item in the audio array for the device
	} else {
		settings.push(
			Object.assign({ deviceId: deviceId, kind: kind, volume: 1 }, setting)
		);
	}
	config.set(`audio`, settings);
}

/**
 * Convert hexadecimal value to binary
 *
 * @param {string} hex Hex value
 * @returns {string} Binary value
 */
function hex2bin(hex) {
	return parseInt(hex, 16).toString(2).padStart(8, "0");
}

function getMemory() {
	console.dir(process.getHeapStatistics());
	console.log("------");

	console.dir(process.getBlinkMemoryInfo());
	console.log("------");

	process.getProcessMemoryInfo().then((info) => {
		console.log(`PROCESS`);
		console.dir(info);
		console.log("------");
	});

	console.dir(process.getSystemMemoryInfo());
	console.log("------");
}

setInterval(getMemory, 5000);
