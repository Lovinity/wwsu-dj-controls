// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
const path = require('path')
let mainWindow;
let calendarWindow;

function enforceCORS () {
  // Enforce CORS and Origin; skywayJS needs origin set to our server address, but everything else needs file origin.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // Does not work yet; need to modify this to allow devTools to work
        // 'Content-Security-Policy': [ `script-src 'self' https://server.wwsu1069.org https://webrtc.ecl.ntt.com` ],
        'Origin': details.url.includes('webrtc.ecl.ntt.com') ? "https://server.wwsu1069.org" : "file://"
      }
    })
  })
}

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 480,
    minHeight: 360,
    show: false,
    title: `WWSU DJ Controls`,
    autoHideMenuBar: true, // Do not show manu bar unless alt is pressed
    webPreferences: {
      // contextIsolation blocks window variable setting. Disable for now.
      // contextIsolation: true,
      enableRemoteModule: false, // electron's remote module is insecure
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: 1.25,
    }
  })

  // Do not show the window until DOM has loaded. Otherwise, we will get a white flash effect that is not pleasant.
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // When mainWindow is closed, all other processes should also be closed
  mainWindow.on('closed', function () {
    mainWindow = null

    calendarWindow.close()
    calendarWindow = null
  })

  mainWindow.on('focus', () => mainWindow.flashFrame(false))
}

function createCalendarWindow () {
  // Create the calendar process
  calendarWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    title: `WWSU DJ Controls - Calendar Process`,
    webPreferences: {
      // contextIsolation blocks window variable setting. Disable for now.
      // contextIsolation: true,
      enableRemoteModule: false, // electron's remote module is insecure
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false // Do not throttle this process. It doesn't do any work anyway unless told to by another process.
    }
  });
  calendarWindow.on('closed', function () {
    if (mainWindow !== null) { createCalendarWindow() }
  });
  calendarWindow.loadFile('calendar.html');
}

// Enforce sandboxing for security
app.enableSandbox();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(enforceCORS).then(createWindow).then(createCalendarWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// Prevent opening new windows in the app; use the default browser instead
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', async (event, navigationUrl) => {
    // In this example, we'll ask the operating system
    // to open this event's url in the default browser.
    event.preventDefault()

    await shell.openExternal(navigationUrl)
  })
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// Get the machine ID
const { machineIdSync } = require('./assets/wwsu-host-id');
ipcMain.on('get-machine-id', (event) => {
  event.returnValue = machineIdSync();
})

// Get app and version info
const pkg = require('./package.json');
ipcMain.on('get-app-version', (event) => {
  event.returnValue = `${pkg.name} v${pkg.version}`;
})

// IPC
// Args should be an array pair: [command string, [array of additional parameters] ]

// Messages to be sent to the renderer process
ipcMain.on('renderer', (event, arg) => {
  try {
    mainWindow.webContents.send(arg[ 0 ], arg[ 1 ]);
  } catch (e) {
    console.error(e);
  }
})

// Messages to be sent to the calendar process
ipcMain.on('calendar', (event, arg) => {
  try {
    calendarWindow.webContents.send(arg[ 0 ], arg[ 1 ]);
  } catch (e) {
    console.error(e);
  }
})

// Flash the icon in the taskbar
ipcMain.on('flashMain', (event, arg) => {
  try {
    mainWindow.flashFrame(arg)
  } catch (e) {
    console.error(e);
  }
});

// Set the progress bar on the taskbar icon (arg is the percent).
ipcMain.on('progressMain', (event, arg) => {
  try {
    mainWindow.setProgressBar(arg)
  } catch (e) {
    console.error(e);
  }
});