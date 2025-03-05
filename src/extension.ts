import * as vscode from 'vscode';
import { gwtUiProviderInstance } from './gwtUiPanel';
import { refreshProjects, spawnCompile, stopCompile, spawnDevMode, stopDevMode, spawnCodeServer, stopCodeServer, spawnJetty, stopJetty, stopAll } from './gwtService';
import { GwtProjectInfo } from './types';
import { showLogs } from './logChannel';
import { openGWTDebugSession } from './gwtDebugManager';

export function activate(context: vscode.ExtensionContext) {
  vscode.window.registerTreeDataProvider('gwtHelperView', gwtUiProviderInstance);

  context.subscriptions.push(
    vscode.commands.registerCommand('gwt.refreshProjects', refreshProjects),
    vscode.commands.registerCommand('gwt.stopAll', stopAll),
    vscode.commands.registerCommand('gwt.openDebug', openGWTDebugSession),
    vscode.commands.registerCommand('gwt.showLogs', showLogs),
    vscode.commands.registerCommand('gwt.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', { query: 'gwtHelper' });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('gwt.runCompileForProject', (project: GwtProjectInfo) => {
      spawnCompile(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.stopCompileForProject', (project: GwtProjectInfo) => {
      stopCompile(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),

    vscode.commands.registerCommand('gwt.runDevModeForProject', (project: GwtProjectInfo) => {
      spawnDevMode(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.stopDevModeForProject', (project: GwtProjectInfo) => {
      stopDevMode(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),

    vscode.commands.registerCommand('gwt.runCodeServerForProject', (project: GwtProjectInfo) => {
      spawnCodeServer(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.stopCodeServerForProject', (project: GwtProjectInfo) => {
      stopCodeServer(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),

    vscode.commands.registerCommand('gwt.startJettyForProject', (project: GwtProjectInfo) => {
      spawnJetty(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.stopJettyForProject', (project: GwtProjectInfo) => {
      stopJetty(project.pomPath);
      gwtUiProviderInstance.refresh();
    })
  );

  vscode.window.showInformationMessage("GWT Helper extension activated!");
}

export function deactivate() {
  // ...
}
