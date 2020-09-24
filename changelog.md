# Changelog for wwsu-dj-controls

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