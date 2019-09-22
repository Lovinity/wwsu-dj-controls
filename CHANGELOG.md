# Changelog
All notable changes to this project will be documented in this file as of version 4.5.0.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as of version 4.5.0.

## [Unreleased]
### Changed
 - Adjusted DJ Controls to utilize Meta.showCountdown and Meta.queueCalculating.

## [6.0.0 BETA]
### Added
- Support for new configuration system in the server via admin menu -> server configuration. [Issue 31](https://github.com/Lovinity/wwsu-dj-controls/issues/31)
- Make direct API queries to the WWSU system from the admin menu.
- Taskbar icon displays a progress bar counting down queue time from 100 seconds when starting a broadcast or returning from break.
- During a remote broadcast, the receiving DJ Controls will monitor for audio choppiness. If choppy, it will call call/bad, which triggers the other DJ Controls to restart the audio call. It may also request a lower bitrate in call/bad. If really bad, will trigger call/give-up, which sends the system into break.
- Notifications modal that displays notifications grouped by type (example, absent broadcasts / directors). Also provides action buttons for each notification. Also has an icon on the WWSU Operations block to open notifications.
- Additional DJ analytics on the DJ screens of Manage DJs.
- Attendance history buttons to mark certain records as excused in terms of the new DJ reputation analytics. Also, buttons to toggle between unexcused show absence and canceled show.
- Prompt for DJ Controls set to receive emergencies or accountability notifications when closing.
- Management of the airing of underwritings through DJ Controls.
- locking of hosts to a specific DJ (or no DJs) via manage hosts. When a DJ Controls is locked to a specific DJ, it will prevent starting any shows/broadcasts that are unscheduled or not under the DJ's name, and also will prevent interfering with other shows.
- Ability to change finalized show times in the schedule generator.
- Multiple instance checking via the server [Issue 39](https://github.com/Lovinity/wwsu-dj-controls/issues/39)
- Ability to specify DJ Web Panel password for DJs when adding or editing (DJ Web Panel is a future feature for the server).
- Initial silence detection both on outgoing and incoming DJ Controls when establishing an audio call.

### Changed
- Timesheet window in admin options -> manage directors -> timesheets now displays timesheets as vertical Gantt Charts.
- All applicable operation buttons and queue timer is now always visible in WWSU Operations.
- Using skywayJS instead of peerJS.
- DJ Controls uses a separate thread each for calendar processing, remote broadcast audio calling, and audio recording / silence detection. This should improve performance and audio quality.
- Updated instances of live_prerecord to utilize new prerecord_on and prerecord_break, including in the audio recorder.
- Audio calling utilizes new, more secure recipients system.
- Because sometimes depending on remote input device the automated countdown voice will go on the air, the "on the air" notification was removed and replaced with a 1 second warning.

### Fixed
- "Cannot read property muted of undefined" error that sometimes appeared and prevented operation buttons from appearing.
- Audio recorder should operate reliably and not go periods of time without recording.
- Audio recorder should properly save active recordings when shutting down DJ Controls and stall its closing until complete.
- Random high CPU use in some DJ Controls on slower systems. [Issue 28](https://github.com/Lovinity/wwsu-dj-controls/issues/28)

### Removed
- Pop-up notification boxes outside of the main application; no longer functional in Electron.js 5.

## [5.1.2] - 2019-03-23
### Added
- Notifications when directors cancel office hours or fail to clock in for scheduled office hours.

### Changed
- Timesheet screen under manage directors now color codes records based on whether or not they were scheduled, and also if the director failed to show up for scheduled hours or cancelled their hours.

### Fixed
- Audio error when trying to sink main audio device will only show if the host is responsible for silence detection or recording audio. Errors are only relevant if the host is responsible for audio recording or silence detection.

## [5.1.1] - 2019-03-20
### Added
- Notifications when a scheduled broadcast was cancelled.

### Changed
- Since deleted Google Calendar events are marked cancelled in the system instead of immediately removed, updated clockwheel to accommodate.

## [5.1.0] - 2019-03-15
### Added
- A bunch of tooltips to help DJ Controls users make more sense of what they are doing or seeing.
- Hosts edit screen has all available options, and will prevent editing of options with a warning if changing it would cause a conflict.
- **UNSTABLE; to be improved in 6.0.0** Peer.js audio calling between different DJ Controls via remote and sports remote states. This can be used for remote audio broadcasting.
- Audio options menu and telephone status indicator.
- Silence detection and audio recording.
- Discipline management in admin options. [Issue 11](https://github.com/Lovinity/wwsu-dj-controls/issues/11)
- DJ Controls will notify clients with emergencies notifications enabled of absent shows, unauthorized shows, and failed top of the hour ID breaks. [Issue 10](https://github.com/Lovinity/wwsu-dj-controls/issues/10)

### Changed
- The manage hosts overview screen shows authorized, can make calls, can answer calls, records audio, and detects silence... instead of the other settings.
- Top of hour break is now shaded between :55 and :05 after, and reminders are triggered at :02 after instead of :03 after, to comply with the new break settings in WWSU server.
- Non-show events are shaded halfway up the clockwheel.
- Recipients button in messenger is no longer an icon in the top left corner, but a "recipients" button in the bottom right.
- Mute button next to the close button in the top right corner in messenger is now a "mute" button in the bottom right. Also re-added the ban button.
- Mutes and bans prompt with a text field for a short reason why the user is banning/muting said device.
- Announcements no longer use accordions but instead modal boxes when clicked.

## [5.0.2] - 2019-02-02
### Added
- Remote/XP screens now allow for adding of notes to DJs. Notes/remotes/XP logs will now appear in this order: Notes first (brown), then remotes (yellow), then XP (blue).
- Ability to add sticky slides to public display signs via announcements.
- Set display time in seconds for display sign and website announcements.
- Topics for live, remote, and sports will default to what's in Google Calendar (first 140 characters) if nothing is typed in the box when starting a broadcast.
- Added sanitization for dashes in record filepaths so that RadioDJ does not get metadata confused.

### Changed
- Changed how DJ button attendance colors are calculated by using hours instead of days.

### Removed
- Removed form elements as they were causing the application to refresh when the enter key was pressed. Using div containers instead.

## [5.0.1] - 2019-01-28
### Added
- Announce queue times, silence, and connection changes on sports, sportsremote, and remote broadcasts. [Issue 19](https://github.com/Lovinity/wwsu-dj-controls/issues/19)
- wwsu.js. Currently not fully implemented in DJ Controls, but using the WWSUreq class for easy management of the new authentication system in v5.0.0.
- If a button is clicked on a DJ Controls that did not start the current broadcast (isHost=false), and the operation could disrupt the broadcast (such as ending the show), a confirmation window will appear, to prevent accidental clicks.

### Changed
- Implementing Material Design on top of Bootstrap for the user interface. Shadow effects and more vivid colors.
- Announcements are now expand/collapse accordions. System problems condensed into one announcement. EAS / Weather alerts condensed into one announcement.
- Several windows re-designed for material design, especially the messenger.
- WWSU Operations state badge changed to a chip.
- Optimized loading of DJs and logs to run faster.
- Use local isHost instead of deprecated Meta.djcontrols
- Manage DJ buttons; the color of each DJ button represents the following: Green, they did a show in the last week. Yellow, they did a show in the last month. Red, they didn't do any shows in the last month.

### Fixed
- DJs on the air might not get a silence detection warning if the DJ Controls they were using does not have client.emergencies being true.

## [4.5.1] - 2018-12-17
### Added
- View Log button for DJs. [Issue 7](https://github.com/Lovinity/wwsu-dj-controls/issues/7)
- "Please Wait" on applicable windows when fetching data. [Issue 9](https://github.com/Lovinity/wwsu-dj-controls/issues/9)
 
### Changed
- hide all state-changing buttons when something in RadioDJ is playing, and instead only show non-state-changing buttons (like add a log and view log). [Issue 12](https://github.com/Lovinity/wwsu-dj-controls/issues/12)
 
### Fixed
- Added webkit-transform on flickering elements. [Issue 1](https://github.com/Lovinity/wwsu-dj-controls/issues/1)
- Calendar events double up when mandatory ID break or RadioDJ queue item present. [Issue 13](https://github.com/Lovinity/wwsu-dj-controls/issues/13)

## [4.5.0] - 2018-12-14
### Added
- Manage DJ Controls hosts through the administration menu. [Issue 5](https://github.com/Lovinity/wwsu-dj-controls/issues/5)
 
### Changed
- Silence detection will only notify DJ Controls where emergencies is set to true.
- Updated node modules.