/* global iziToast */

/*
 * INITIALIZATION
 * Initialize variables and libraries on load.
 */

/*
 * CONSTANTS
 * Initialize constants and require necessary packages.
 */

/*
 * fs: Used to perform filesystem operations
 * @type Module fs|Module fs
 */
const fs = require('fs')

/*
 * main: Access to the main thread in this Electron application.
 * @type type
 */
const main = require('electron').remote.require('./main')

/*
 * Access remote toold in Electron.js
 * @type type
 */
const { remote } = window.require('electron')

/*
 * notifier: Used to pop up notifications as browserWindows on the computer desktop.
 * @type Module index|Module index
 */
const notifier = require('./electron-notifications/index.js')

/*
 * Sanitize: Used to sanitize strings to prevent issues in file names and file paths.
 * @type Module sanitize-filename|Module sanitize-filename
 */
const Sanitize = require('sanitize-filename')

/*
 * settings: Used to store and access settings for this application.
 * @type Module electron-settings|Module electron-settings
 */
const settings = require('electron-settings')

/*
 * hexRgb: Used to convert hexadecimal strings into object of red, green, blue, and alpha.
 * @type Module hexRgb|Module hexRgb
 */
const hexRgb = require('./assets/js/wwsu/hexRgb.js')

/*
 * audioWrapper: Used to manage Peer.js calls, silence detection, and audio recording.
 * @requires peer.js, WebAudioRecorder.js
 * @type Module audioWrapper|Module audioWrapper
 */
const audioWrapper = require('./assets/js/wwsu/audioWrapper.js')

/*
 * MAIN VARIABLES
 * Initialize the main variables used by the application
 */

// Initialize the web audio API
window.AudioContext = window.AudioContext || window.webkitAudioContext

// Set to true to disable audio recording
var development = false

console.dir(hexRgb(`#00ff78`))

/*
 * CLASSES
 */
