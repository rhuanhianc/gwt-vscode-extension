import * as vscode from 'vscode';

export class GWTDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration) {
    if (!config.name) {
      config.name = "Debug GWT (Chrome)";
    }
    if (!config.type) {
      config.type = "pwa-chrome"; // ou "chrome"
    }
    if (!config.request) {
      config.request = "launch";
    }
    if (!config.url) {
      config.url = "http://localhost:8080/";
    }
    if (!config.webRoot) {
      config.webRoot = "${workspaceFolder}";
    }
    if (!config.sourceMapPathOverrides) {
      config.sourceMapPathOverrides = {
        "http://127.0.0.1:9876/sourcemaps/*": "${workspaceFolder}/src/*"
      };
    }
    return config;
  }
}
