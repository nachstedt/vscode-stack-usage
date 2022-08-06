# Stack Usage

This Visual Studio Code extension allows you to display the per function stack usage analysis information produced by gcc for c++ projects next to the respective implementation.

## Features

- Display maximum amount of stack usage per function next to the function implementation.

## Requirements

The source code must be compiled using gcc and the `-fstack-usage` flag.
This will produce \*.su files for every compiled unit which are read by the extension.
To make the extension discover these files, a `compile_commands.json` or a link to it must be located at the root folder of your project.

Further Information:

- [Static Stack Usage Analysis with gcc](https://gcc.gnu.org/onlinedocs/gnat_ugn/Static-Stack-Usage-Analysis.html)
- [Generating compile_commands.json with CMake](https://cmake.org/cmake/help/latest/variable/CMAKE_EXPORT_COMPILE_COMMANDS.html)

<!--
## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

- `myExtension.enable`: enable/disable this extension
- `myExtension.thing`: set to `blah` to do something

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.
-->
