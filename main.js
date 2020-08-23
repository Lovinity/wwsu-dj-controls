// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, session, shell } = require("electron");

// Config file for tokens etc
const config = require("./config");

// Filesystem
const fs = require("fs");
const path = require("path");

// Settings store
const Store = require("electron-store");

// Semver calculations (example, to check for DJ Controls updates)
const semver = require("semver");

// Window variables
let mainWindow;
let calendarWindow;
let skywayWindow;
let recorderWindow;

// Other variables
let metaState = `unknown`;

// Initialize Store
const store = new Store({
  name: "wwsu-dj-controls",
  encryptionKey: "(b8mGXxW=859[}}ivV-Cyeq)3U5h", // We do not care if this is in plain text; we are only using it for config file integrity
  clearInvalidConfig: true,
  defaults: {
    recorder: {
      deviceId: undefined,
      delay: 10000,
      recordPath: ".",
    },
    silence: {
      deviceId: undefined,
      threshold: 0.1,
      delay: 15000,
    },
  },

  // TODO: Keep this updated
  migrations: {},
});

function enforceCORS() {
  // Enforce CORS and Origin; skywayJS needs origin set to our server address, but everything else needs file origin.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // TODO: Enable before publishing to production
        // 'Content-Security-Policy': [ `script-src 'self' https://server.wwsu1069.org https://webrtc.ecl.ntt.com` ],
        Origin: details.url.includes("webrtc.ecl.ntt.com")
          ? "https://server.wwsu1069.org"
          : "file://",
      },
    });
  });
}

function createWindows() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 480,
    minHeight: 360,
    show: false, // Do not show until we are ready to show via ready-to-show event
    title: `WWSU DJ Controls`,
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
    mainWindow.show();
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
}

function createCalendarWindow() {
  // Create the calendar process
  calendarWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    title: `WWSU DJ Controls - Calendar Process`,
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
}

function createSkywayWindow() {
  // Create the skyway process
  skywayWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    title: `WWSU DJ Controls - Skywayjs Process`,
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
}

function createRecorderWindow() {
  // Create the recorder process
  recorderWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: true,
    title: `WWSU DJ Controls - Recorder Process`,
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
}

// Enforce sandboxing for security
app.enableSandbox();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(enforceCORS).then(createWindows);

// Quit when all windows are closed.
app.on("window-all-closed", function () {
  app.quit();
});

app.on("activate", function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindows();
});

// Prevent opening new windows in the app; use the default browser instead
app.on("web-contents-created", (event, contents) => {
  contents.on("new-window", async (event, navigationUrl) => {
    // In this example, we'll ask the operating system
    // to open this event's url in the default browser.
    event.preventDefault();

    await shell.openExternal(navigationUrl);
  });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Get the machine ID
const { machineIdSync } = require("./assets/wwsu-host-id");
ipcMain.on("get-machine-id", (event) => {
  event.returnValue = machineIdSync();
});

// Get app and version info
const pkg = require("./package.json");
ipcMain.on("get-app-version", (event) => {
  event.returnValue = `${pkg.name} v${pkg.version}`;
});

// IPC
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

// Return config file
ipcMain.on("config", (event, arg) => {
  event.returnValue = config && config[arg] ? config[arg] : null;
});

// Return duplet array: 0 is this DJ Controls version, 1 is whether or not this version is older than the provided newest available version
ipcMain.on("needsUpdate", (event, arg) => {
  const pjson = require("./package.json");
  event.returnValue = [pjson.version, semver.lt(pjson.version, arg)];
});
