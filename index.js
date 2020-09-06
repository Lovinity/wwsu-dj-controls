"use strict";

// Require constants
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
const { is } = require("electron-util");
const unhandled = require("electron-unhandled");
const debug = require("electron-debug");
const contextMenu = require("electron-context-menu");
const config = require("./config.js");
const menu = require("./menu");
const packageJson = require("./package.json");
const { machineIdSync } = require("./assets/wwsu-host-id");

// Initialize unhandled exceptions catcher
unhandled();

// Initialize debug tools
debug();

// Initialize context menu
contextMenu();

app.setAppUserModelId(packageJson.build.appId);

// Use custom update config
autoUpdater.updateConfigPath = path.join(__dirname, 'app-update.yml');

// Auto update interval (we do not immediate check for an update until mainWindow is ready to show)
const ONE_HOUR = 1000 * 60 * 60;
setInterval(() => {
	autoUpdater.checkForUpdates();
}, ONE_HOUR);

autoUpdater.on("update-available", (info) => {
	mainWindow.webContents.send("update-available", [info, packageJson]);
});

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
		autoUpdater.checkForUpdates();

		createCalendarWindow();
		createSkywayWindow();
		createRecorderWindow();
	});

	// and load the index.html of the app.
	mainWindow.loadFile("index.html");

	// When mainWindow is closed, all other processes should also be closed
	mainWindow.on("closed", function () {
		mainWindow = null;

		calendarWindow.close();
		calendarWindow = null;
		skywayWindow.close();
		skywayWindow = null;
		recorderWindow.close();
		recorderWindow = null;
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

// Sync return settings store
ipcMain.on("settings", (event, arg) => {
	event.returnValue = config.get(arg);
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
	} catch (e) {
		console.error(e);
	}
});

// Messages to be sent to the calendar process
ipcMain.on("calendar", (event, arg) => {
	try {
		calendarWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {
		console.error(e);
	}
});

// Messages to be sent to the skyway process
ipcMain.on("skyway", (event, arg) => {
	try {
		skywayWindow.webContents.send(arg[0], arg[1]);
	} catch (e) {
		console.error(e);
	}
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

		// When a buffer is ready to be saved to an audio file
		case "recorderBuffer":
			try {
				if (!fs.existsSync(path.dirname(args[0]))) {
					fs.mkdirSync(path.dirname(args[0]));
				}

				console.log(`audio save file ${args[0]}`);
				fs.writeFile(
					`${store.get("recorder.path")}/${args[0]}`,
					args[1],
					function (err) {
						if (err) {
							console.error(err);
						} else {
							recorderWindow.webContents.send(
								`recorderSaved`,
								`${store.get("recorder.path")}/${args[0]}`
							);
							mainWindow.webContents.send("console", [
								"log",
								`Recorder: File saved... ${store.get("recorder.path")}/${
									args[0]
								}`,
							]);
							mainWindow.webContents.send(
								`recorderSaved`,
								`${store.get("recorder.path")}/${args[0]}`
							);
						}
					}
				);
			} catch (e) {
				mainWindow.webContents.send("console", ["error", e]);
				console.error(e);
			}
			break;

		// Handle changes in meta.state
		// TODO
		case "metaState":
			metaState = args[0];

			break;
	}
});
