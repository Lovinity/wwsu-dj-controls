# Changelog for wwsu-dj-controls

## 8.0.0-alpha.18

### Removed

- [BREAKING] Config recorder.deviceId and silence.deviceId; to be replaced with audio array, each containing recorder and silence booleans whether or not they should be responsible for silence detection or recording.

### Changed

- Audio system split into multiple processes. Now supports multiple devices for recording / broadcasting / etc and volume adjustments.
- Due to no support for Javascript stereo MP3 recording, recorder will now save in webm Opus format.
- Skyway.js now utilizes authorization (credential token) via WWSU API to help prevent unauthorized use of the Skyway.js app.
- [BREAKING] Master director now uses ID 1 because server spits out a bunch of logs when using ID of 0

### Fixed

- Clockwheel tooltips issue where clock div was preventing tooltips on certain areas of the clockwheel doughnut.
- Added manually triggering window.resize when switching between menu pages as layout sometimes overlaps each other. This trigger forces a recalculation of screen size so content does not overlap.

### Added

- Support for timesheet notes
- Schema validation to config
- Indications of the status for each audio process
- Silence detection
- Splash screen (basic)
- Delay system tracking via serial port
- Ban / discipline management, and Mute/Ban functionality in the messages / chat
- npx electron-builder install-app-deps in .travis.yml to rebuild node-serialport upon compilation of DJ Controls installers
- Silence detection triggered notifications if this DJ Controls started the current broadcast

### Updated

- Packages
- Electron to the 11.x.x branch (we were running on 9.x.x in alpha.17).

## 8.0.0-alpha.17 - 2020-10-16

### Removed

- Buttons in notifications; they do not work with Electron IPC.

### Added

- Notification when the main UI of DJ Controls crashes.
- Informative messages on certain pages.
- Helper messages for check in due date and check in/out quantity fields in the inventory system.
- originalDuration property to events (for now, only when conflict checking).
- Remote office hours support in timesheet system.
- Support for master director (ID = 0): cannot be removed, disabled as admin, nor edited by anyone other than the master director.

### Changed

- Wording in the event conflicts window to be easier to read.

## 8.0.0-alpha.16 - 2020-10-13

### Added

- Delay system accountability logging
- Hosts management

### Changed

- Using CSS box shadow flashing for nav icons instead of flashing color class, which was unreliable.

### Updated

- Packages and plugins

## 8.0.0-alpha.15

### Added

- Inventory management and check in/out system.

## 8.0.0-alpha.14 - 2020-09-24

### Added

- Director management

### Changed

- Confirmation dialogs now use iziModal and Alpaca instead of iziToast as large iziToast messages do not scroll on mobile / small screens.
- Authorization prompts also use iziModal and Alpaca instead of iziToast.
- Meta info background color on the dashboard reflects the type of broadcast / state of WWSU.

### Fixed

- Changelog file had improper header levels for changed/added/removed/etc, which should have been h3 but were instead h2.
- Admin Director authorization was showing all directors in the dropdown selection instead of only admin directors; this was fixed.
- Open iziModals were on top of "connection lost" etc overlays when the overlays should have been on top of / blocking the modals.

## 8.0.0-alpha.13 - 2020-09-20

### Updated

- AdminLTE and plugins to latest versions
- NPM packages

### Changed

- Now using WCAG AAA compliant colors both in AdminLTE and in calendar colors
- Calendar event text will turn black if event background color is light so it can be read

## 8.0.0-alpha.12 - 2020-09-17

### Removed

- TinyMCE autosave plugin no longer used; caused a bug preventing DJ Controls from closing.

### Changed

- Installer packages. Now, MacOS will use .pkg (instead of .dmg) and Linux will use .deb or .rpm. Windows will still use .exe, but the installer now allows to install on entire machine.

### Fixed

- TinyMCE blocking DJ Controls from closing when clicking the close button (caused by TinyMCE autosave plugin; which we disabled).
- Timesheet edit bug which always required Clocked time in when it was supposed to only require that for certain approval statuses.
- Reduced padding on administration To-do menu item notification numbers so they do not run into the To-do text.
- Typo in recipients/add-computer (should be recipients/add-computers) preventing registering the host as online.

## 8.0.0-alpha.11 - 2020-09-15

### Added

- Timesheets tab for viewing and modifying director timesheets

### Changed

- Some of the language in the update available dialog.

## 8.0.0-alpha.10 - 2020-09-08

### Added

- Notifications when a new version of DJ Controls is available (uses WWSU API to check for updates instead of autoUpdater, which does not work).

## 8.0.0-alpha.9 - 2020-09-06

### Removed

- WebAudioRecorder.js as it no longer works; replacing with browser MediaRecorder.

### Added

- MP3 program recorder

## 8.0.0-alpha.8 - 2020-09-06

### Removed

- Auto update checking; still does not work and is taking more time than it is worth to try and get working.

### Updated

- Travis cache

## 8.0.0-alpha.7 - 2020-09-06

THIS IS A FAILED RELEASE. DO NOT USE.

### Added

- Activated update notification functionality (UNTESTED).

### Updated

- electron
- electron-store
- electron-builder
- np

## 8.0.0-alpha.6 - 2020-09-06

This is the first release of WWSU DJ Controls version 8 using Travis. It is still in alpha, and many things do not work yet. However, a working version was necessary for WWSU prior to exiting alpha stage.
