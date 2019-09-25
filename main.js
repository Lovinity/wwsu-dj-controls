// Modules to control application life and create native browser window
const { app, BrowserWindow, dialog, session, ipcMain } = require('electron')
const { machineIdSync } = require('node-machine-id')
const serialport = require('serialport')
const fs = require('fs')
const settings = require('electron-settings')

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
let mainWindow
let calendarWindow
let peerWindow
let audioWindow
let delaySerial
let delayData = ``
let delayTimer
let easSerial
let easData = ``
let easTimer
const Meta = {}

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({ width: 1600, minWidth: 800, height: 900, backgroundColor: '#263238', resizable: true, webPreferences: { backgroundThrottling: false, nodeIntegration: true } })
  mainWindow.once('focus', () => mainWindow.flashFrame(false))

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // webRTC = new BrowserWindow({width: 1600, height: 900, resizable: true, webPreferences: {backgroundThrottling: false}});
  // webRTC.loadURL(`chrome://webrtc-internals`);

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
    calendarWindow.close()
    calendarWindow = null
    peerWindow.close()
    peerWindow = null
    audioWindow.close()
    audioWindow = null
  })

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
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [ '*' ] }, (details, callback) => {
    details.requestHeaders[ 'Origin' ] = 'https://server.wwsu1069.org'
    // eslint-disable-next-line standard/no-callback-literal
    callback({ requestHeaders: details.requestHeaders })
  })

  createWindow()
  createPeerWindow()
  createAudioWindow()
  createCalendarWindow()
})

// Quit when all windows are closed, including on MacOS
app.on('window-all-closed', function () {
  app.quit()
})

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow()
    createPeerWindow()
    createAudioWindow()
    createCalendarWindow()
  }
})

ipcMain.on('process-calendar', (event, arg) => {
  try {
    calendarWindow.webContents.send('process-calendar', arg)
  } catch (e) {
  }
})

ipcMain.on('process-darksky', (event, arg) => {
  try {
    calendarWindow.webContents.send('process-darksky', arg)
  } catch (e) {
  }
})

ipcMain.on('processed-calendar', (event, arg) => {
  try {
    mainWindow.webContents.send('processed-calendar', arg)
  } catch (e) {
  }
})

ipcMain.on('processed-darksky', (event, arg) => {
  try {
    mainWindow.webContents.send('processed-darksky', arg)
  } catch (e) {
  }
})

ipcMain.on('peer-register', (event, arg) => {
  try {
    console.log(`Peer register ${arg}`)
    mainWindow.webContents.send('peer-register', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-try-calls', (event, arg) => {
  try {
    peerWindow.webContents.send('peer-try-calls', null)
  } catch (e) {

  }
})

ipcMain.on('peer-unavailable', (event, arg) => {
  try {
    console.log(`Peer unavailable ${arg}`)
    mainWindow.webContents.send('peer-unavailable', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-stop-trying', (event, arg) => {
  try {
    console.log(`Peer stop trying`)
    peerWindow.webContents.send('peer-stop-trying', null)
  } catch (e) {

  }
})

ipcMain.on('peer-incoming-call', (event, arg) => {
  try {
    console.log(`Peer incoming call ${arg}`)
    mainWindow.webContents.send('peer-incoming-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-answer-call', (event, arg) => {
  try {
    console.log(`Peer answer call`)
    peerWindow.webContents.send('peer-answer-call', null)
  } catch (e) {

  }
})

ipcMain.on('peer-check-better-bitrate', (event, arg) => {
  try {
    console.log(`Peer check better bitrate`)
    peerWindow.webContents.send('peer-check-better-bitrate', null)
  } catch (e) {

  }
})

ipcMain.on('new-meta', (event, arg) => {
  var doSend = false
  for (var key in arg) {
    if (Object.prototype.hasOwnProperty.call(arg, key)) {
      Meta[ key ] = arg[ key ]
      doSend = true
    }
  }
  try {
    if (doSend) {
      console.log(`new meta`)
      console.dir(arg)
      peerWindow.webContents.send('new-meta', arg)
      audioWindow.webContents.send('new-meta', arg)
    }
  } catch (e) {

  }
})

ipcMain.on('peer-ready', (event, arg) => {
  try {
    console.log(`Peer ready`)
    peerWindow.webContents.send('new-meta', Meta)
  } catch (e) {

  }
})

ipcMain.on('audio-ready', (event, arg) => {
  try {
    console.log(`Audio ready`)
    audioWindow.webContents.send('new-meta', Meta)
  } catch (e) {

  }
})

ipcMain.on('peer-bail-break', (event, arg) => {
  try {
    console.log(`Peer bail break`)
    mainWindow.webContents.send('peer-bail-break', null)
  } catch (e) {

  }
})

ipcMain.on('peer-bad-call', (event, arg) => {
  try {
    console.log(`Peer bad call ${arg}`)
    peerWindow.webContents.send('peer-bad-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-bad-call-send', (event, arg) => {
  try {
    mainWindow.webContents.send('peer-bad-call-send', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-very-bad-call', (event, arg) => {
  try {
    console.log(`Peer very bad call ${arg}`)
    peerWindow.webContents.send('peer-very-bad-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-silent-call', (event, arg) => {
  try {
    console.log(`Peer silent call ${arg}`)
    peerWindow.webContents.send('peer-silent-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-very-bad-call-send', (event, arg) => {
  try {
    mainWindow.webContents.send('peer-very-bad-call-send', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-very-bad-call-notify', (event, arg) => {
  try {
    console.log(`Peer very bad call notify`)
    mainWindow.webContents.send('peer-very-bad-call-notify', null)
  } catch (e) {

  }
})

ipcMain.on('peer-silent-call-notify', (event, arg) => {
  try {
    console.log(`Peer silent call notify`)
    mainWindow.webContents.send('peer-silent-call-notify', null)
  } catch (e) {

  }
})

ipcMain.on('peer-finalize-call', (event, arg) => {
  try {
    console.log(`Peer finalize call ${arg}`)
    peerWindow.webContents.send('peer-finalize-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-no-audio-incoming-notify', (event, arg) => {
  try {
    console.log(`Peer no audio incoming notify ${arg}`)
    mainWindow.webContents.send('peer-no-audio-incoming-notify', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-finalize-incoming', (event, arg) => {
  try {
    console.log(`Peer finalize incoming ${arg}`)
    mainWindow.webContents.send('peer-finalize-incoming', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-no-audio-outgoing', (event, arg) => {
  try {
    console.log(`Peer no audio outgoing`)
    mainWindow.webContents.send('peer-no-audio-outgoing', null)
  } catch (e) {

  }
})

ipcMain.on('peer-resume-call', (event, arg) => {
  try {
    console.log(`Peer resume call`)
    peerWindow.webContents.send('peer-resume-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-start-call', (event, arg) => {
  try {
    console.log(`Peer start call`)
    peerWindow.webContents.send('peer-start-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-set-bitrate', (event, arg) => {
  try {
    console.log(`Peer set bitrate ${arg}`)
    peerWindow.webContents.send('peer-set-bitrate', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-check-waiting', (event, arg) => {
  try {
    console.log(`Peer check waiting ${arg}`)
    peerWindow.webContents.send('peer-check-waiting', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-no-answer', (event, arg) => {
  try {
    console.log(`Peer no answer ${arg}`)
    mainWindow.webContents.send('peer-no-answer', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-waiting-answer', (event, arg) => {
  try {
    console.log(`Peer waiting answer ${arg}`)
    mainWindow.webContents.send('peer-waiting-answer', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-dropped-call', (event, arg) => {
  try {
    console.log(`Peer dropped call ${arg}`)
    mainWindow.webContents.send('peer-dropped-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-connecting-call', (event, arg) => {
  try {
    console.log(`Peer connecting call`)
    mainWindow.webContents.send('peer-connecting-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-connected-call', (event, arg) => {
  try {
    console.log(`Peer connected call`)
    mainWindow.webContents.send('peer-connected-call', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-get-host-info', (event, arg) => {
  try {
    console.log(`Peer get host info ${arg}.`)
    mainWindow.webContents.send('peer-get-host-info', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-host-info', (event, arg) => {
  try {
    console.log(`Peer host info`)
    console.dir(arg)
    peerWindow.webContents.send('peer-host-info', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-change-input-device', (event, arg) => {
  try {
    console.log(`Peer change input device ${arg}`)
    peerWindow.webContents.send('peer-change-input-device', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-change-output-device', (event, arg) => {
  try {
    console.log(`Peer change output device ${arg}`)
    peerWindow.webContents.send('peer-change-output-device', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-device-input-error', (event, arg) => {
  try {
    console.log(`Peer device input error`)
    mainWindow.webContents.send('peer-device-input-error', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-device-output-error', (event, arg) => {
  try {
    console.log(`Peer device output error`)
    mainWindow.webContents.send('peer-device-output-error', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-reregister', (event, arg) => {
  try {
    console.log(`Peer reregister`)
    peerWindow.webContents.send('peer-reregister', arg)
  } catch (e) {

  }
})

ipcMain.on('audio-silence', (event, arg) => {
  try {
    console.log(`Audio silence ${arg}`)
    mainWindow.webContents.send('audio-silence', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-audio-info-incoming', (event, arg) => {
  try {
    mainWindow.webContents.send('peer-audio-info-incoming', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-audio-info-outgoing', (event, arg) => {
  try {
    mainWindow.webContents.send('peer-audio-info-outgoing', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-call-quality', (event, arg) => {
  try {
    mainWindow.webContents.send('peer-call-quality', arg)
  } catch (e) {

  }
})

ipcMain.on('audio-audio-info', (event, arg) => {
  try {
    mainWindow.webContents.send('audio-audio-info', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-very-bad-call-send', (event, arg) => {
  try {
    console.log(`Peer very bad call send ${arg}`)
    mainWindow.webContents.send('peer-very-bad-call-send', arg)
  } catch (e) {

  }
})

ipcMain.on('audio-device-input-error', (event, arg) => {
  try {
    console.log(`Audio device input error`)
    mainWindow.webContents.send('audio-device-input-error', arg)
  } catch (e) {

  }
})

ipcMain.on('audio-change-input-device', (event, arg) => {
  try {
    console.log(`Audio change input device`)
    audioWindow.webContents.send('audio-change-input-device', arg)
  } catch (e) {

  }
})

ipcMain.on('audio-new-recording', (event, arg) => {
  try {
    console.log(`Audio new recording ${arg}`)
    mainWindow.webContents.send('audio-new-recording', arg)
  } catch (e) {

  }
})

ipcMain.on('audio-should-record', (event, arg) => {
  try {
    console.log(`Audio should record ${arg}`)
    audioWindow.webContents.send('audio-should-record', arg)
  } catch (e) {

  }
})

ipcMain.on('audio-save-file', (event, arg) => {
  try {
    console.log(`audio save file ${arg[ 0 ]}`)
    fs.writeFile(arg[ 0 ], arg[ 1 ], function (err) {
      if (err) {
        console.log('err', err)
      } else {
        audioWindow.webContents.send(`audio-file-saved`, arg[ 0 ])
        mainWindow.webContents.send(`audio-file-saved`, arg[ 0 ])
      }
    })
  } catch (e) {
    console.error(e)
  }
})

ipcMain.on('audio-shut-down', (event, arg) => {
  try {
    console.log(`audio shut down`)
    audioWindow.webContents.send('audio-shut-down', arg)
  } catch (e) {

  }
})

ipcMain.on('audio-nothing-to-save', (event, arg) => {
  try {
    console.log(`Audio nothing to save`)
    mainWindow.webContents.send('audio-file-saved', true)
  } catch (e) {

  }
})

ipcMain.on('audio-start-new-recording', (event, arg) => {
  try {
    console.log(`Audio start new recording ${arg}`)
    audioWindow.webContents.send('audio-start-new-recording', true)
  } catch (e) {

  }
})

ipcMain.on('peer-no-calls', (event, arg) => {
  try {
    console.log(`Peer no calls to resume`)
    mainWindow.webContents.send('peer-no-calls', true)
  } catch (e) {

  }
})

ipcMain.on('peer-silence-outgoing', (event, arg) => {
  try {
    console.log(`Peer silence`)
    mainWindow.webContents.send('peer-silence-outgoing', arg)
  } catch (e) {

  }
})

ipcMain.on('peer-silence-incoming', (event, arg) => {
  try {
    console.log(`Peer silence incoming`)
    mainWindow.webContents.send('peer-silence-incoming', arg)
  } catch (e) {

  }
})

ipcMain.on('main-log', (event, arg) => {
  try {
    console.log(`Main log ${arg}`)
    mainWindow.webContents.send('main-log', arg)
  } catch (e) {

  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

exports.flashTaskbar = () => {
  mainWindow.flashFrame(true)
}

exports.setProgressBar = (value) => {
  mainWindow.setProgressBar(value)
}

exports.getMachineID = () => {
  return machineIdSync()
}

exports.directoryBrowse = () => {
  return dialog.showOpenDialog({
    properties: [ 'openDirectory' ]
  })
}

exports.openDevTools = () => {
  mainWindow.webContents.openDevTools()
}

function createCalendarWindow () {
  calendarWindow = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, nodeIntegration: true } })
  calendarWindow.loadFile('calendar.html')

  calendarWindow.on('closed', function () {
    if (mainWindow !== null) { createCalendarWindow() }
  })
}

function createPeerWindow () {
  peerWindow = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, nodeIntegration: true } })
  peerWindow.loadFile('peer.html')

  peerWindow.on('closed', function () {
    if (mainWindow !== null) { createPeerWindow() }
  })
}

function createAudioWindow () {
  audioWindow = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, nodeIntegration: true } })
  audioWindow.loadFile('audio.html')

  audioWindow.on('closed', function () {
    if (mainWindow !== null) { createAudioWindow() }
  })
}

exports.getSerialPorts = (cb) => {
  serialport.list((err, ports) => {
    console.log('Serial port devices')
    if (err) {
      console.error(err)
      cb([])
    } else {
      cb(ports)
    }
  })
}

exports.restartDelay = () => {
  console.log('Restarting Delay Serial connection')
  mainWindow.webContents.send('main-log', `Restarting Delay System serial, device ${settings.get('serial.delay')}`)
  try {
    delaySerial.close()
  } catch (e) {
  }

  delaySerial = undefined
  delayData = ``
  clearTimeout(delayTimer)

  var device = settings.get('serial.delay')

  if (device && device !== null && device !== ``) {
    delaySerial = new serialport(settings.get('serial.delay'))

    delaySerial.on('error', (err) => {
      console.error(err)
      mainWindow.webContents.send('main-log', `Error on Delay System serial: ${err.message}`)
      if (err.disconnected) {
        mainWindow.webContents.send('main-log', `Delay System serial disconnected. Reconnecting in 10 seconds.`)
        setTimeout(() => {
          exports.restartDelay()
        }, 10000)
      }
    })

    delaySerial.on('data', (data) => {
      delayData += data.toString('hex')
      clearTimeout(delayTimer)
      delayTimer = setTimeout(() => {

        // Delay status
        if (delayData.includes('000c')) {
          console.log('Received delay system status')
          var index = delayData.indexOf('000c')
          var seconds = parseInt(delayData.substring(index + 6, index + 8), 16) / 10
          var bypass = parseInt(delayData.substring(index + 16, index + 18), 16)
          bypass = bypass >= 16
          mainWindow.webContents.send('main-log', `Delay System status: ${seconds} seconds, bypass = ${bypass}`)
          mainWindow.webContents.send('main-delay', [ seconds, bypass ])
        }

      }, 3000)
    })
  } else {
    mainWindow.webContents.send('main-log', `Delay System: Empty device selected. No ports opened.`)
  }
}

exports.restartEAS = () => {
  
}