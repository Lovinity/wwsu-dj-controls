# Changelog
All notable changes to this project will be documented in this file as of version 4.5.0.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as of version 4.5.0.

## [unreleased]
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