import * as vscode from 'vscode';
import { GwtProjectsStore } from './gwtProjectsStore';

export class GWTUiProvider implements vscode.TreeDataProvider<GWTItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GWTItem | undefined | void>();
  onDidChangeTreeData = this._onDidChangeTreeData.event;

  getTreeItem(element: GWTItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: GWTItem): GWTItem[] {
    if (!element) {
      const store = GwtProjectsStore.getInstance();
      const projects = store.getProjects();

      const compileRunning = projects.some(p => store.getCompileProcess(p.pomPath));
      const devModeRunning = projects.some(p => store.getDevModeProcess(p.pomPath));
      const codeServerRunning = projects.some(p => store.getCodeServerProcess(p.pomPath));
      const jettyRunning = projects.some(p => store.getJettyProcess(p.pomPath));

      return [
        new GWTItem("Refresh Projects", "gwt.refreshProjects", "refresh"),
        new GWTItem(
          compileRunning ? "Stop Compile" : "Run Compile",
          compileRunning ? "gwt.stopCompile" : "gwt.runCompile",
          compileRunning ? "stop" : "play"
        ),
        new GWTItem(
          devModeRunning ? "Stop DevMode" : "Run DevMode",
          devModeRunning ? "gwt.stopDevMode" : "gwt.runDevMode",
          devModeRunning ? "stop" : "play"
        ),
        new GWTItem(
          codeServerRunning ? "Stop CodeServer" : "Run CodeServer",
          codeServerRunning ? "gwt.stopCodeServer" : "gwt.runCodeServer",
          codeServerRunning ? "stop" : "run"
        ),
        new GWTItem(
          jettyRunning ? "Stop Jetty" : "Start Jetty",
          jettyRunning ? "gwt.stopJetty" : "gwt.startJetty",
          jettyRunning ? "stop" : "server-process"
        ),
        new GWTItem("Stop All", "gwt.stopAll", "close-all"),
        new GWTItem("Show Logs", "gwt.showLogs", "output"),
        new GWTItem("Configs", "gwt.openSettings", "gear")
      ];
    }
    return [];
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }
}

class GWTItem extends vscode.TreeItem {
  constructor(label: string, commandId: string, icon: string) {
    super(label);
    this.command = { command: commandId, title: label };
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

// Exporta a instância única do provider
export const gwtUiProviderInstance = new GWTUiProvider();
