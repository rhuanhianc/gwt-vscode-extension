# GWT Helper Extension for Visual Studio Code

[![Version](https://img.shields.io/badge/version-0.3.2-blue.svg)](https://marketplace.visualstudio.com/items?itemName=RhuanHianc.gwt-helper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A powerful Visual Studio Code extension for GWT (Google Web Toolkit) development that simplifies your workflow by providing easy access to GWT development tools directly from VS Code.

## Features

- **Project Detection**: Automatically detects GWT and Jetty projects in your workspace
- **Integrated DevMode and CodeServer Management**: Start, stop, and monitor GWT DevMode and CodeServer
- **Maven Integration**: Run Maven commands for GWT tasks
- **Jetty Server Control**: Manage Jetty server instances for your projects
- **Debugging Support**: Integrated Chrome/Firefox debugging for GWT applications
- **User Interface**: Dedicated sidebar view for easy access to all controls

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "GWT Helper"
4. Click Install

## Requirements

- Java JDK (Java 8 or newer)
- Maven installed and available in PATH (or configured in settings)
- GWT project with Maven configuration

## Getting Started

1. Open a folder containing your GWT projects
2. Click the GWT icon in the activity bar to open the GWT Helper view
3. Click "Refresh Projects" to detect GWT and Jetty projects in your workspace
4. Select a project and use the commands to run DevMode, CodeServer, or Jetty

## Usage

### GWT Helper Sidebar

The extension adds a GWT icon to the activity bar. Clicking it opens the GWT Helper sidebar with the following features:

- **Top-level commands**:
  - Refresh Projects: Scan workspace for GWT and Jetty projects
  - Stop All: Stop all running processes (DevMode, CodeServer, Compile, Jetty)
  - Open Debug: Start debugging session with Chrome/Firefox
  - Configs: Open extension settings

- **Project Management**:
  - Projects are organized by type (GWT Projects and Jetty Projects)
  - Each project has specific actions available depending on its type

### Commands for GWT Projects

For each detected GWT project, you can:

- **Run/Stop DevMode**: Start or stop GWT DevMode for development
- **Run/Stop CodeServer**: Start or stop GWT CodeServer for Super Dev Mode
- **Run/Stop Compile**: Compile your GWT application

### Commands for Jetty Projects

For each detected Jetty project, you can:

- **Start/Stop Jetty**: Start or stop the Jetty web server

### Global Commands

These commands are available via the Command Palette (Ctrl+Shift+P):

- `GWT: Refresh Projects` - Scan workspace for GWT and Jetty projects
- `GWT: Run Compile` - Compile the selected GWT project
- `GWT: Stop Compile` - Stop compilation process
- `GWT: Init DevMode` - Start DevMode for selected project
- `GWT: Stop DevMode` - Stop DevMode process
- `GWT: Init CodeServer` - Start CodeServer for selected project
- `GWT: Stop CodeServer` - Stop CodeServer process
- `GWT: Init Jetty` - Start Jetty for selected project
- `GWT: Stop Jetty` - Stop Jetty process
- `GWT: Stop All` - Stop all running processes
- `GWT: Open Debug` - Start debugging session
- `GWT: Show Logs` - Show logs for running processes
- `GWT: Open Settings` - Open extension settings

## Debugging

The extension provides integrated debugging support for GWT applications:

1. Start a DevMode or CodeServer process for your project
2. Click "Open Debug" from the sidebar or run the `GWT: Open Debug` command
3. Select the project to debug
4. The extension will automatically configure debugging and launch a browser session

Debugging features include:

- Automatic source map configuration
- Browser debugging integration (Chrome or Firefox)
- Detection of CodeServer port

## Extension Settings

This extension contributes the following settings:

| Setting | Description | Default |
|---------|-------------|---------|
| `gwtHelper.javaPath` | Path to Java installation (e.g., C:/Program Files/Java/jdk-1.8) | `java` |
| `gwtHelper.mavenCommand` | Path/command for Maven; if empty, uses 'mvn' | `""` |
| `gwtHelper.devModeGoals` | Maven goals for running DevMode | `gwt:devmode` |
| `gwtHelper.codeServerGoals` | Maven goals for running CodeServer | `gwt:codeserver` |
| `gwtHelper.jettyGoals` | Maven goals for running Jetty | `jetty:run` |
| `gwtHelper.compileGoals` | Maven goals for compiling the project | `gwt:compile` |
| `gwtHelper.debugUrl` | URL to debug GWT | `http://localhost:8080` |
| `gwtHelper.debugBrowser` | Browser used for debugging | `chrome` |

## Project Detection

The extension automatically detects:

- **GWT Projects**: Projects with `gwt-maven-plugin` in their pom.xml
- **Jetty Projects**: Projects with any of these plugins in their pom.xml:
  - `jetty-maven-plugin`
  - `jetty-ee8-maven-plugin`
  - `jetty-ee9-maven-plugin`
  - `jetty-ee10-maven-plugin`

## Features in Detail

### DevMode and CodeServer

The extension detects and manages GWT DevMode and CodeServer processes:

- Automatic port detection
- Integrated log output in VS Code terminal
- Java compatibility handling (different flags for Java 8 vs. Java 9+)

### Intelligent Error Handling

When a process fails, the extension provides:

- Detailed error logs
- Suggestions for common issues
- Commands to help troubleshoot

### Logging

Each process type (Compile, DevMode, CodeServer, Jetty) has its own log terminal:

- Color-coded log output
- Error highlighting
- Auto-detection of important information (like server ports)

## Troubleshooting

### Common Issues

- **Maven not found**: Ensure Maven is installed and in your PATH, or configure the path in settings
- **Java issues**: Configure the correct Java path in settings
- **Port conflicts**: If you see "Address already in use" errors, ensure no other processes are using required ports

### Debug Log

If you encounter problems, check the logs:

1. Click "Show Logs" in the sidebar
2. Review the output for error messages and suggested solutions

## Release Notes

### 0.3.3

- Updated README.md
- Improvements to java error logging and detection

### 0.3.2

- Added support for automatic port detection
- Enhanced UI with status indicators

### 0.3.1

- Fixed process management on Windows
- Improved project detection

### 0.3.0

- Added Jetty integration
- Enhanced debugger configuration

### 0.2.0

- Correction of the debugger (workaround) to deal with projects inside and outside of Worskpace

### 0.1.0

- Initial release of GWT Helper Extension

## Contributing

This extension is open source! Contributions are welcome on the [GitHub repository](https://github.com/rhuanhianc/gwt-vscode-extension).

## License

This extension is licensed under the [MIT License](LICENSE).

## Author

- [Rhuan Hianc](https://github.com/rhuanhianc)

**Note:** This is a study project and is currently under development. Feedback and contributions are welcome!
