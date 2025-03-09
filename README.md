# GWT Helper for VS Code

[![Version](https://img.shields.io/badge/version-0.3.2-blue.svg)](https://marketplace.visualstudio.com/items?itemName=RhuanHianc.gwt-helper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Streamline your GWT (Google Web Toolkit) development workflow with direct access to essential tools right from VS Code.

![GWT Helper Banner](https://via.placeholder.com/800x200?text=GWT+Helper+Banner)

## ✨ Features

- **Smart Project Detection** - Automatic identification of GWT and Jetty projects in your workspace
- **Integrated Development Tools** - Seamlessly manage GWT DevMode and CodeServer
- **Maven Integration** - Execute Maven commands for GWT tasks with a single click
- **Jetty Server Control** - Start, stop, and monitor Jetty server instances
- **Debugging Support** - Integrated Chrome/Firefox debugging with source maps
- **Intuitive UI** - Dedicated sidebar for quick access to all functionality

## 🚀 Quick Start

1. **Install** the extension from the VS Code Marketplace
2. **Open** a folder containing GWT projects
3. **Click** the GWT icon in the activity bar
4. **Select** "Refresh Projects" to detect your GWT and Jetty projects
5. **Choose** a project and start developing!

## 📋 Requirements

- Java JDK (Java 8 or newer)
- Maven (installed and available in PATH or configured in settings)
- GWT project with Maven configuration

## 🔧 Installation

1. Launch VS Code
2. Open Extensions (Ctrl+Shift+X)
3. Search for "GWT Helper"
4. Click Install

## 📘 Detailed Usage

### GWT Helper Sidebar

The extension adds a GWT icon to your activity bar that opens a sidebar with these features:

#### Global Actions
- 🔄 **Refresh Projects** - Scan workspace for GWT and Jetty projects
- ⏹️ **Stop All** - Terminate all running processes
- 🐞 **Open Debug** - Start a debugging session
- ⚙️ **Configs** - Access extension settings

#### Project-Specific Actions

For **GWT Projects**:
- ▶️/⏹️ **DevMode** - Start or stop GWT DevMode
- ▶️/⏹️ **CodeServer** - Manage Super Dev Mode
- ▶️/⏹️ **Compile** - Compile your GWT application

For **Jetty Projects**:
- ▶️/⏹️ **Jetty** - Control the Jetty web server

### Command Palette Integration

Access all functions through the Command Palette (Ctrl+Shift+P) with these commands:

- `GWT: Refresh Projects`
- `GWT: Run/Stop Compile`
- `GWT: Init/Stop DevMode`
- `GWT: Init/Stop CodeServer`
- `GWT: Init/Stop Jetty`
- `GWT: Stop All`
- `GWT: Open Debug`
- `GWT: Show Logs`
- `GWT: Open Settings`

## 🔍 Debugging

Integrated debugging support makes development easier:

1. Start DevMode or CodeServer for your project
2. Select "Open Debug" from the sidebar
3. Choose your project
4. Begin debugging with automatic source map configuration

## ⚙️ Configuration Options

| Setting | Description | Default |
|---------|-------------|---------|
| `gwtHelper.javaPath` | Java installation path | `java` |
| `gwtHelper.mavenCommand` | Maven command or path | `""` (uses 'mvn') |
| `gwtHelper.devModeGoals` | Maven goals for DevMode | `gwt:devmode` |
| `gwtHelper.codeServerGoals` | Maven goals for CodeServer | `gwt:codeserver` |
| `gwtHelper.jettyGoals` | Maven goals for Jetty | `jetty:run` |
| `gwtHelper.compileGoals` | Maven goals for compilation | `gwt:compile` |
| `gwtHelper.debugUrl` | URL for debugging | `http://localhost:8080` |
| `gwtHelper.debugBrowser` | Browser for debugging | `chrome` |

## 🔎 Advanced Features

### Intelligent Process Management

- **Automatic Port Detection** - No manual configuration needed
- **Integrated Logging** - Color-coded output in VS Code terminals
- **Error Handling** - Detailed logs and troubleshooting suggestions

### Project Detection Logic

The extension identifies:
- **GWT Projects**: Projects with `gwt-maven-plugin` in pom.xml
- **Jetty Projects**: Projects with Jetty plugins in pom.xml

## 🛠️ Troubleshooting

### Common Issues

- **Maven not found** - Ensure Maven is in PATH or configure path in settings
- **Java issues** - Verify correct Java path in settings
- **Port conflicts** - Check for processes using required ports

### Debug Logs

If you encounter problems:
1. Click "Show Logs" in the sidebar
2. Review the output for errors and suggestions

## 📝 Release Notes

### 0.3.3
- Updated documentation
- Improved Java error detection and logging

### 0.3.2
- Added automatic port detection
- Enhanced UI with status indicators

### 0.3.1
- Fixed process management on Windows
- Improved project detection

### 0.3.0
- Added Jetty integration
- Enhanced debugger configuration

### 0.2.0
- Fixed debugger to handle projects inside and outside workspace

### 0.1.0
- Initial release

## 👥 Contributing

This extension is open source! Contributions are welcome on the [GitHub repository](https://github.com/rhuanhianc/gwt-vscode-extension).

## 📄 License

Licensed under the [MIT License](LICENSE).

## ✍️ Author

Created by [Rhuan Hianc](https://github.com/rhuanhianc)

---

**Note:** This project is under active development. Feedback and contributions are appreciated!
