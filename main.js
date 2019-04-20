// Modules to control application life and create native browser window
const {app, BrowserWindow, dialog, session} = require('electron');
const {machineId, machineIdSync} = require('node-machine-id');

/*
 const electronInstaller = require('electron-winstaller');
 
 
 resultPromise = electronInstaller.createWindowsInstaller({
 appDirectory: require('path').dirname(require.main.filename),
 outputDirectory: require('path').dirname(require.main.filename) + '/build',
 authors: 'WWSU 106.9 FM',
 exe: 'wwsu-dj-controls.exe'
 });
 
 resultPromise.then(() => console.log("It worked!"), (e) => console.log(`No dice: ${e.message}`));
 */



// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let webRTC;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({width: 1600, minWidth: 800, height: 900, backgroundColor: '#263238', resizable: true, webPreferences: {backgroundThrottling: false, nodeIntegration: true}});
    mainWindow.once('focus', () => mainWindow.flashFrame(false));

    // and load the index.html of the app.
    mainWindow.loadFile('index.html');

    //Open the DevTools.
    mainWindow.webContents.openDevTools();

    webRTC = new BrowserWindow({width: 1600, height: 900, resizable: true, webPreferences: {backgroundThrottling: false}});
    webRTC.loadURL(`chrome://webrtc-internals`);

    // Emitted when the window is closed.
    mainWindow.on('closed', function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });

    /*
     webRTC.on('closed', function () {
     // Dereference the window object, usually you would store windows
     // in an array if your app supports multi windows, this is the time
     // when you should delete the corresponding element.
     webRTC = null;
     });
     */
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    // Set custom headers
    session.defaultSession.webRequest.onBeforeSendHeaders({urls: ['*']}, (details, callback) => {
        details.requestHeaders['Origin'] = 'https://server.wwsu1069.org';
        callback({requestHeaders: details.requestHeaders});
    });

    createWindow();
});

// Quit when all windows are closed, including on MacOS
app.on('window-all-closed', function () {
    app.quit();
});

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

exports.flashTaskbar = () => {
    mainWindow.flashFrame(true);
};

exports.setProgressBar = (value) => {
    mainWindow.setProgressBar(value);
};

exports.getMachineID = () => {
    return machineIdSync();
};

exports.directoryBrowse = () => {
    return dialog.showOpenDialog({
        properties: ['openDirectory']
    });
}