# Change Log

All notable changes to the extension are documented in this file.

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

## [Unreleased]

- Using asynchronous file system operations.

## [0.3.1] - 2022-08-12

- Added verbose debug output during su file reading to understand individual problems better.
- Removed real path lookup for source files before fixing incomplete path entries (GCC<10).

## [0.3.0] - 2022-08-11

- Support GCC<10 where .su file entries do not contain full paths.

## [0.2.1] - 2022-08-08

- Internal refactoring.
- Slightly improved logging.

## [0.2.0] - 2022-08-06

- The extension is now logging to a vscode output channel.
- Optimized number of times that decorations are set to visible editors.

## [0.1.1] - 2022-07-29

- Bugfix: Support watching out-of-workspace builds.
- Bugfix: Tolerate missing or corrupt .su files.
- Bugfix: Correct parsing of function signatures with namespaces.

## [0.1.0] - 2022-07-26

- Added support for symbolinc links both within the stack usage files as well as within the opened folder.

## [0.0.1] - 2022-07-25

- Initial release
