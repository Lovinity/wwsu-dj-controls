# Changelog
All notable changes to this project will be documented in this file as of version 4.5.0.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) as of version 4.5.0.

## [Unreleased]
### Added

### Changed

### Fixed

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