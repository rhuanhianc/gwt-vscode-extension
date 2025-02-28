# GWT Helper

**Note:** This is a study project and is currently under development.

A VS Code extension for developing with GWT (Google Web Toolkit) in multi-module Maven projects.

## Key Features

- 🕵️ Automatic scanning of GWT projects through `pom.xml` files
- 🎮 Complete control of GWT processes:
  - ▶️/⏹️ GWT Compilation
  - ▶️/⏹️ GWT DevMode
  - ▶️/⏹️ GWT CodeServer
  - ▶️/⏹️ Jetty Server
  - 📊 GWT Debugging
- 🛠️ Dedicated graphical interface in the Activity Bar
- 📝 Colored and dedicated logs for each process
- ⚙️ Customizable paths and commands configuration
- 🔍 Support for multi-module Maven projects
- 🚨 Simultaneous termination of all processes

## Installation

1. Open VS Code
2. Go to the Extensions tab (Ctrl+Shift+X)
3. Search for "GWT Helper Extension"
4. Click Install

**Prerequisites:**
- Java JDK (8+ recommended)
- Apache Maven configured in PATH
- GWT project with Maven configuration

## Usage

### GWT Control Panel
1. Open the GWT panel in the Activity Bar (GWT icon)
2. Use the buttons to:
   - 🔄 Refresh project list
   - ⚡ Start/Stop processes
   - 📤 Access logs
   - ⚙️ Open settings

### Available Commands (Ctrl+Shift+P)
| Command                | Description                          |
|------------------------|-----------------------------------|
| GWT: Refresh Projects  | Re-detect projects in workspace    |
| GWT: Run Compile       | Start GWT compilation              |
| GWT: Stop Compile      | Stop running compilation           |
| GWT: Run DevMode       | Start GWT DevMode                  |
| GWT: Stop DevMode      | Stop running DevMode               |
| GWT: Run CodeServer    | Start GWT CodeServer               |
| GWT: Stop CodeServer   | Stop running CodeServer            |
| GWT: Start Jetty       | Start Jetty server                 |
| GWT: Stop Jetty        | Stop Jetty server                  |
| GWT: Stop All          | Stop all GWT processes             |
| GWT: Open Debug        | Open debug panel                   |
| GWT: Show Logs         | Display logs panel                 |
| GWT: Open Settings     | Open extension settings            |

## Configuration

Access settings (`File > Preferences > Settings` or Ctrl+,) and search for "GWT":

| Setting                      | Description                           | Default          |
|------------------------------|---------------------------------------|------------------|
| `gwtHelper.javaPath`         | Full Java path                        | `java`           |
| `gwtHelper.mavenCommand`     | Custom Maven command                  | `mvn`            |
| `gwtHelper.devModeGoals`     | Maven goals for DevMode               | `gwt:devmode`    |
| `gwtHelper.codeServerGoals`  | Maven goals for CodeServer            | `gwt:codeserver` |
| `gwtHelper.jettyGoals`       | Maven goals for Jetty                 | `jetty:run`      |
| `gwtHelper.compileGoals`     | Maven goals for compilation           | `gwt:compile`    |
| `gwtHelper.debugUrl`         | GWT DevMode debug URL                 | `http://localhost:8080` |

**Example configuration for Windows:**
```json
"gwtHelper.javaPath": "C:/Program Files/Java/jdk1.8.0_301",
"gwtHelper.mavenCommand": "mvn.cmd"
```

## Troubleshooting

### Common Issues
1. **Processes don't start:**
   - Check Java path in settings
   - Verify that Maven is installed and in PATH
   - Check logs (`GWT: Show Logs`)

2. **Port errors:**
   - Check the ports configured in `pom.xml`
   ```xml
   <devmodeArgs>
     <arg>-port</arg>
     <arg>8888</arg>
   </devmodeArgs>
   ```

3. **Projects not detected:**
   - Ensure the `pom.xml` contains the GWT plugin:
   ```xml
   <artifactId>gwt-maven-plugin</artifactId>
   ```

## Development

Contributions are welcome! Follow these steps:

1. Fork the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Modify the TypeScript code
4. Compile with:
   ```bash
   npm run compile
   ```
5. Install vspkg:
   ```bash
   npm install -g vsce
   ```
6. Package the extension:
   ```bash
   vsce package
   ```

## License

This project is licensed under the MIT License.

---

**Note:** This extension is not officially associated with Google or the GWT project.

**Observation:** This project is an example extension for GWT and can be adapted according to development needs.