# Changelog for wwsu-dj-controls

## 8.18.0-alpha

### Added

- Email tab for writing and sending emails to DJs or directors in the system.
- Callout info boxes indicating logs/records are deleted after 2 years.
- Text to icon columns in tables
- Event listener for WWSUrecipients in WWSUmessages; when a recipient changes, updateRecipient() is called in case the recipient that changed was the active / selected recipient (updates the text at the top of the message window).

### Fixed

- Calendar actions dropdown did not proceed for editing / rescheduling an occurrance.
- WWSUcalendar should have been using WWSUdjs for determining which DJs can be chosen for event hosts, but it was instead using the available authorization users from djReq.
- doConflictCheck would call event.verify on event removals; this is not necessary and resulted in false errors.
- Responsive table bugs; sometimes actions buttons did not have priority
- Deleting a schedule did not properly display necessary info in confirm action window because we were using an undefined variable
- DJ attendance logs did not have a view log button for canceled / absent records; it should because there is a log for marking it excused or unexcused.

### Changed

- [BREAKING] Priority 0 events now operate differently; they can overlap other priority 0 events of different types but cannot overlap priority 0 events of the same type.
- [BREAKING] "Show" and "Sports" event types will always override onair-booking event type regardless of priority.
- Updated renderer and WWSUclimacell with new climacell API data
- DJ removal now marks DJ as inactive instead of fully removing them (inactive DJs are deleted after 1 year). However, DJs can be permanently removed after marked inactive.
  - Inactive DJs cannot be chosen for calendar/event hosts and other functions.
- Event list now includes inactive events
- Event removal now involves marking the event inactive first instead of immediately removing it
- Remote dump button is now visible for live and sports broadcasts just in case someone is more used to clicking that than pushing the physical button in the studio.

## 8.17.2-alpha - 2021-04-29

### Fixed

- Critical bug in the calendar system: cannot set start date later than end date.

## 8.17.1-alpha - 2021-04-26

### Fixed

- Silence inactive was not triggering every minute silence was inactive like it should have been.

## 8.17.0-alpha - 2021-04-26

BROKEN

### Added

- A few quick buttons on the calendar filters: "Broadcasts" which will turn all filters off except live/remote/sports/prerecord/playlist, "Bookings" which turns everything off except on-air and prod bookings, and "clear all" which turns everything off.

### Removed

- Next show button (see changed section for more info).

### Fixed

- Calendar system was not accounting for multiple schedule overrides correctly.
- Calendar system was not properly adding "canceled-changed" occurrences at original times when occurrences are rescheduled (does not apply in DJ Controls calendar page; this is mainly for the online calendar system).
- Calendar system did not properly list events where the original date/time was outside selected range, but re-scheduled time was.
- Shell is not defined in index.js.
- silence/inactive was being called literally every time audio was detected; it should only be called if silence was detected and is no longer detected.

### Changed

- [BREAKING] CalendarDb.whatIsPlaying(): added "isCanceled" parameter as third parameter. When true, function will also returned canceled events normally scheduled to take place now.
- Made human readable schedule text easier to read.
- "Automation" button is now "End Broadcast"
- The "end show" button was removed. Instead, DJs should always click "End Broadcast" to end their show.
  - In a future version, if a live show is on the schedule, system will go into automation_break and a prompt will ask if the next DJ is in the station. If no is clicked, system will go back to automation_on.
- WWSU moved Discord servers; updated this in DJ Controls.

## 8.16.0-alpha - 2021-04-06

### Added

- Serial support / delay system monitoring re-enabled using new Web Serial API.
  - Does not currently work due to an Electron.js bug!
- Added recorder error reporting and status checking to WWSU.

### Fixed

- Discord window did not allow discord.gg navigation
- Force sports selection when a sports is not scheduled (instead of defaulting in error to Men's Baseball).
- Meta updates sometimes did not update on the UI if inactive and later active.
- WWSUreq token error handling was inconsistent; should always check for errToken (not tokenErr).
- Notification for new message was not displaying.
- "autoHide" property of Bootstrap toasts was invalid; it was supposed to be "autohide".

### Updated

- AdminLTE
- Plugins
- NPM packages
- Electron.js

### Changed

- Silence detection inactive will be triggered every minute silence is not detected. That way, WWSU knows silence monitoring is still active.

## 8.15.0-alpha

### Fixed

- Editing anything with a date/time would cause the date/time to load up in UTC but save in ET (causing times to advance 4-5 hours).
- this.meta in wwsu-calendar-class was undefined; it should have been using this.manager.get("WWSUMeta").
- Duration bug where re-scheduling / editing an event displayed "NaN" for duration when it should have been empty.
- Event name validation fails when editing a sports occurrance (you had to type it in again). There should be no validation if the box is empty and we are editing.
- Event conflict window should not allow clicking "continue" button if an error occurred (aka. trying to schedule the same event more than once in the same time frame).
- WWSU confirmDialog did not force a string comparison; passing a number in for confirmation resulted in the inability to confirm an action.

### Changed

- [BREAKING] We've been in alpha for a long time and plan to take a while longer. Decided to make versions easier by modifying this version according to major.minor.patch schema (and will continue going forward, just with an alpha tag and we will not be bumping major until we reach stable and then make a breaking change [API should be considered unstable for now]).
- Styling tweaks on dashboard
- Table updating events etc moved to the modules script instead of the renderer one.

### Updated

- AdminLTE and packages
- Electron.js to version 12
  - Serial Port / Delay system functionality is scheduled to be re-implemented once Electron updates their docs for web serial API

### Added

- Underwritings management
- Songs module
- Re-activated main messages system alongside Discord chat; Discord chat was not popular.
- Re-added setting on live, remote, sports, and sports remote forms allowing to disable the web chat during the show.
- "Message sent" toast message on successful sending of a message
- Bulletins on Discord tab to indicate messages are not notified in DJ Controls and to use the main Discord app where possible.

## 8.0.0-alpha.34 - 2021-01-21

### Fixed

- Recorder sometimes did not start if UI was inactive.

## 8.0.0-alpha.33 - 2021-01-19

### Removed

- [BREAKING] This version does NOT support delay system / serial ports. This feature has been disabled until Electron 12 / Chrome 89 / Web Serial API is ready. Node-serialport has become too unstable for our standards.

### Changed

- We are no longer creating a new MediaRecorder for every new recording; audio recorder class creates a single MediaRecorder that is used for the lifetime of the process.
- Recorder now dumps blobs every 5 minutes into blob array before saving

### Added

- Process restarting until memory leaks are resolved (recorder restarts after every recording; audio and silence restart every hour)
- [UNTESTED] Maximum recording duration of 3 hours. After that, recorder triggers a new recording.

### Fixed

- Notification windows... again...
- [UNTESTED] Remote process is restarting/reloading once when initiating a remote broadcast; it should not do that
- [PARTIAL] Calendar conflict checking bugs (Still does not work when un-cancelling a recurring event that overrode other events; this will require an API change which will be done in a later version).
- Calls to send to break during remote broadcast no longer queued when DJ Controls is disconnected from WWSU (it should not have done this).
- Recorder was going over the max allowed Opus bitrate; fixed to 128kbps
- Potential infinite loop scenario when recorder closes/restarts after a DJ goes to break

### Updated

- Electron 11.2.0

## 8.0.0-alpha.32 - 2021-01-11

### Added

- Throw error if trying to load a WWSU module that was not yet added
- Try re-requesting remote call if remote host is not connected when someone wants to resume broadcast

### Changed

- [UNTESTED] Disconnect audio call during remote broadcast when on extended break; reconnect when resuming.
- "reload" process command for silence and remote will now open the process if it is not opened instead of ignoring.
- Changes in meta hostCalled or hostCalling will now trigger remote process reloading instead of open (which is ignored if it is already opened, which it should not; it should re-load the process).
- Audio call, if dropped to 0 but later goes up to 100, will not be restarted at next break.
- Made poor audio quality notification message more clear.

### Fixed

- Inventory management bug with meta not defined
- Typo in check to see if remote process should be re-opened when closed, specifically when in sportsremote state.
- Typo in calendar-class
- Typo in remote process

### Updated

- NPM packages

## 8.0.0-alpha.31 - 2020-12-26 - BROKEN

### Fixed

- Unnecessary extra clockwheel updates when DJ Controls becomes active from inactivity.
- Remote process not closing when remote call drops when it should

## 8.0.0-alpha.30.1 - 2020-12-19

### Fixed

- Yet more unacceptable idiotic bugs of mine

## 8.0.0-alpha.30 - 2020-12-19 - BROKEN

### Fixed

- Null errors on audio saving

### Changed

- Now using Titan for Discord Chat; old WidgetBot was very unreliable and did not support banning.
- Re-enabled serialport, however it is still not working at this time. Instead, changed Lovinity/wwsu to not critical-error if no devices are selected to monitor for delay system. Will be disabling that until serialport works again.
- WWSUanimations uses requestAnimationFrame instead of intervals/timeouts.
- WWSUqueue utilizes an idle callback like interface instead of making a bunch of setTimeouts.

### Added

- Quick links to WSU Guardian, WSU Newsroom, WSU Raiders, and Horizon League.

## 8.0.0-alpha.29 - 2020-12-17

### Fixed

- More stupid unacceptable bugs on my part: null paths for recording.

## 8.0.0-alpha.28.3 - 2020-12-17

### Changed

- [BREAKING] Temporarily disabled delay system capabilities due to a blocking bug in @serialport/bindings@9.0.4

### Fixed

- Fixes to errors I made that were unacceptable and should have been tested prior to release.

## 8.0.0-alpha.28 - 2020-12-17 - BROKEN

### Fixed

- More memory leak fix attempts
- Several request bugs

### Updated

- Electron to v11
- node-serialport
- AdminLTE to 3.1.0-rc1
- Node packages/plugins

### Added

- More security in preload scripts
- Exporting data on some relevant datatables in CSV, PDF, or print formats

### Changed

- Prerecorded shows save in a "Prerecord" folder instead of "live"
- Keep displaying queue time even if inaccurate; display hourglass beside the time instead of only the hourglass
- Queue time slightly smaller size text

## 8.0.0-alpha.27 - 2020-12-15

### Added

- More security checks in app

### Changed

- Another memory leak fix attempt using invoke/handle for VU meters instead of send/on

## 8.0.0-alpha.26 - 2020-12-11

### Fixed

- Nasty memory info bug

## 8.0.0-alpha.25 - 2020-12-05

### Fixed

- Nasty sports remote bug

## 8.0.0-alpha.24.1 - 2020-12-04

### Changed

- Disabled access-control-allow-origin for now; it was blocking Widgetbot.

## 8.0.0-alpha.24 - 2020-12-04

### Changed

- When call quality drops to 0, instead of sending the broadcast to break, DJ Controls will pop up a call quality warning (but will not do so again for 5 minutes). If user goes to break within 5 minutes, the remote process and audio call is restarted during the break.
- End Time no longer required on calendar schedules if not using recurring rules.

### Fixed

- CallQuality termination was not working; fixed and changed behavior (see changed section).

### Added

- "Updating user interface" message when DJ Controls was hidden and the UI is catching up elements (intentional defer)
- Link to open Discord in another window in the Discord chat page; recommended to use that instead of the widget
- Ability to add occurrences and schedules to the calendar by click-dragging and selecting a time frame.
- Ability to re-schedule occurrences by resizing or dragging them on the calendar.

## 8.0.0-alpha.23 - 2020-12-03

### Changed

- Replaced chat system with a widget to the WWSU Discord server, which can be used to chat with people in Discord (and those listening from the website also have a widget to chat in Discord).

### Added

- Delay system dumping (whoops, that was supposed to be added in 8.0.0-alpha.18 but wasn't)

## 8.0.0-alpha.22.1 - 2020-11-30

### Fixed

- Bug in meta newMeta event introduced from bug fix attempt in 8.0.0-alpha.22

## 8.0.0-alpha.22 - 2020-11-30

### Fixed

- Nasty bug where the recorder was creating new recordings every 20-30 seconds

## 8.0.0-alpha.21 - 2020-11-30

### Fixed

- Host to Call field (remote broadcasts) empty on non-admin hosts
- Recorder does not start new recordings on genre changes
- Broadcast descriptions not truncating to 256 character maximum when loading "start broadcast" window
- Calendar schedule removing does nothing (errors with schedule not being defined)

## 8.0.0-alpha.20 - 2020-11-23

### Changed

- [BREAKING] Added module manager to manage each of WWSU's classes
- [BUGS POSSIBLE] Switched all var variables to let and const variables
- WWSUNavigation addItem and removeItem now returns "this" so they can be chained

### Fixed

- DJ Controls not auto-reconnecting audio call in remote broadcast when restarted or disconnected from internet
- (admin) Hosts management responsive table not prioritizing actions buttons
- [NOT FULLY TESTED] Attempted to fix memory leak via the Audio VU meters by reducing the number of ipc events it sends.

### Added

- (admin) EAS management
- "use strict" on all WWSU js files to prevent global variable memory leaks
- Check when remote broadcasts go live to ensure a call is active; immediately go to break if not so

### Removed

- DOMContentLoaded, and moved renderer javascript to the bottom of the body.

## 8.0.0-alpha.19 - 2020-11-20

### Fixed

- hex2bin

## 8.0.0-alpha.18 - 2020-11-20

### Removed

- [BREAKING] Config recorder.deviceId and silence.deviceId; to be replaced with audio array, each containing recorder and silence booleans whether or not they should be responsible for silence detection or recording.

### Changed

- Audio system split into multiple processes. Now supports multiple devices for recording / broadcasting / etc and volume adjustments.
- Due to no support for Javascript stereo MP3 recording (and MP3 being properietary), recorder will now save in webm Opus format. README files will be created in each folder explaining this.
- Skyway.js now utilizes authorization (credential token) via WWSU API to help prevent unauthorized use of the Skyway.js app.
- [BREAKING] Master director now uses ID 1 because server spits out a bunch of logs when using ID of 0

### Fixed

- Clockwheel tooltips issue where clock div was preventing tooltips on certain areas of the clockwheel doughnut.
- Added manually triggering window.resize when switching between menu pages as layout sometimes overlaps each other. This trigger forces a recalculation of screen size so content does not overlap.

### Added

- Remote broadcasting via Skyway.js
- Audio call quality meter under the queue time in the top-bar (operations buttons) when doing a remote broadcast. Visible on the sending and receiving DJ Controls.
- Audio limiter for remote broadcasts to help prevent peaks / clipping
- Support for timesheet notes
- Schema validation to config
- Indications of the status for each audio process
- Silence detection
- Splash screen (basic)
- Delay system tracking via serial port
- Ban / discipline management, and Mute/Ban functionality in the messages / chat
- npx electron-builder install-app-deps in .travis.yml to rebuild node-serialport upon compilation of DJ Controls installers
- Silence detection triggered notifications if this DJ Controls started the current broadcast
- Add a Log and a box in the Dashboard that becomes visible, allowing a producer to click it to clear meta when talking
- Live and remote sports broadcasting

### Updated

- Packages

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
