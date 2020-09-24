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
let mainWindow;
let calendarWindow;
let skywayWindow;
let recorderWindow;

// Other variables
let metaState = `unknown`;
let latestVersion = ``;

const enforceCORS = () => {
	// Enforce CORS and Origin; skywayJS needs origin set to our server address, but everything else needs file origin.
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		callback({
			responseHeaders: {
				...details.responseHeaders,
				"Content-Security-Policy": !is.development
					? [
							`script-src 'self' https://server.wwsu1069.org https://webrtc.ecl.ntt.com`,
					  ]
					: [],
				Origin: details.url.includes("webrtc.ecl.ntt.com")
					? "https://server.wwsu1069.org"
					: "file://",
			},
		});
	});
};

// Create the main window, and also create the other renderer processes
const createWindows = () => {
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
			preload: path.join(__dirname, "preload-renderer.js"),
			zoomFactor: 1.25,
		},
	});

	// Do not show the window until DOM has loaded. Otherwise, we will get a white flash effect that is not pleasant.
	// Also, do not load other processes until renderer is ready.
	mainWindow.once("ready-to-show", () => {
		// Show the window and check for updates
		mainWindow.show();

		// TODO: Check for updates (disabled as it does not work)
		// autoUpdater.checkForUpdates();

		createCalendarWindow();
		createSkywayWindow();
		createRecorderWindow();
	});

	// and load the renderer.html of the app.
	mainWindow.loadFile("renderer.html");

	// When mainWindow is closed, all other processes should also be closed
	mainWindow.on("closed", function () {
		mainWindow = null;

		calendarWindow.close();
		calendarWindow = null;
		skywayWindow.close();
		skywayWindow = null;
		recorderWindow.webContents.send("shutDown");
	});

	mainWindow.on("focus", () => mainWindow.flashFrame(false));

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

	// Skyway.js process for remote audio streaming / calling
	const createSkywayWindow = () => {
		// Create the skyway process
		skywayWindow = new BrowserWindow({
			width: 1280,
			height: 720,
			show: false,
			title: `${app.name} - Skyway.js Process`,
			webPreferences: {
				contextIsolation: true,
				enableRemoteModule: false, // electron's remote module is insecure
				preload: path.join(__dirname, "preload-skyway.js"),
				backgroundThrottling: false, // Do not throttle this process. It doesn't do any work anyway unless told to by another process.
			},
		});

		skywayWindow.on("closed", function () {
			if (mainWindow !== null) {
				createSkywayWindow();
			}
		});
		skywayWindow.loadFile("skyway.html");
	};

	// Process for recording audio / programming
	const createRecorderWindow = () => {
		// Create the recorder process
		recorderWindow = new BrowserWindow({
			width: 1280,
			height: 720,
			show: false,
			title: `${app.name} - Recorder Process`,
			webPreferences: {
				contextIsolation: true,
				enableRemoteModule: false, // electron's remote module is insecure
				preload: path.join(__dirname, "preload-recorder.js"),
				backgroundThrottling: false, // Do not throttle this process. It doesn't do any work anyway unless told to by another process.
			},
		});

		recorderWindow.on("closed", function () {
			if (mainWindow !== null) {
				createRecorderWindow();
			}
		});
		recorderWindow.loadFile("recorder.html");
	};
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
app.on("web-contents-created", (event, contents) => {
	contents.on("new-window", async (event, navigationUrl) => {
		// In this example, we'll ask the operating system
		// to open this event's url in the default browser.
		event.preventDefault();

		await shell.openExternal(navigationUrl);
	});
});

// Start loading the app
app
	.whenReady()
	.then(Menu.setApplicationMenu(menu))
	.then(enforceCORS)
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
		mainWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {}
});

// Messages to be sent to the calendar process
ipcMain.on("calendar", (event, arg) => {
	try {
		calendarWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {}
});

// Messages to be sent to the skyway process
ipcMain.on("skyway", (event, arg) => {
	try {
		skywayWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {}
});

// Messages to be sent to the recorder process
ipcMain.on("recorder", (event, arg) => {
	try {
		recorderWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {
		console.error(e);
	}
});

// Tasks to be completed by the main process
ipcMain.on("main", (event, arg) => {
	var args = arg[1];
	switch (arg[0]) {
		// Generate a notification window
		case "makeNotification":
			((data) => {
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
			})(arg[1][0]);
			break;

		// When a file reader is ready to be saved to an audio file
		case "recorderEncoded":
			try {
				var arrayBuffer = Buffer.from(new Uint8Array(args[1]));

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
									`Recorder: Recording ${config.get("recorder.recordPath")}/${
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

		// Handle changes in meta.state
		// TODO
		case "metaState":
			metaState = args[0];

			break;
	}
});

// use sanitize-filename
ipcMain.on("sanitize", (event, arg) => {
	event.returnValue = Sanitize(arg);
});
