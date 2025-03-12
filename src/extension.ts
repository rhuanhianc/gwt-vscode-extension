import * as vscode from 'vscode';
import { gwtUiProviderInstance } from './gwtUiPanel';
import { refreshProjects, spawnCompile, stopCompile, spawnDevMode, stopDevMode, spawnCodeServer, stopCodeServer, spawnJetty, stopJetty, stopAll, recoverProcesses } from './gwtService';
import { GwtProjectInfo } from './types';
import { showLogs } from './logChannel';
import { openGWTDebugSession } from './gwtDebugManager';
import { TelemetryService } from './telemetry';
import { GwtProjectsStore } from './gwtProjectsStore';
import { resetDevModeState, resetCodeServerState, resetCompileState, resetJettyState } from './gwtService';

let telemetryService: TelemetryService;

export function activate(context: vscode.ExtensionContext) {
  // Set the context in GwtProjectsStore for persistent storage
  GwtProjectsStore.setContext(context);
  
  telemetryService = TelemetryService.getInstance();  
  telemetryService.setExtensionContext(context);
  telemetryService.sendActivationEvent();
  
  // Register tree data provider
  vscode.window.registerTreeDataProvider('gwtHelperView', gwtUiProviderInstance);
  
  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('gwt.refreshProjects', refreshProjects),
    vscode.commands.registerCommand('gwt.stopAll', stopAll),
    vscode.commands.registerCommand('gwt.openDebug', openGWTDebugSession),
    vscode.commands.registerCommand('gwt.showLogs', showLogs),
    vscode.commands.registerCommand('gwt.openSettings', async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', { query: 'gwtHelper' });
    }),
    // Reset state commands
    vscode.commands.registerCommand('gwt.resetDevModeState', resetDevModeState),
    vscode.commands.registerCommand('gwt.resetCodeServerState', resetCodeServerState),
    vscode.commands.registerCommand('gwt.resetCompileState', resetCompileState),
    vscode.commands.registerCommand('gwt.resetJettyState', resetJettyState)
  );
  
  context.subscriptions.push(
    vscode.commands.registerCommand('gwt.runCompileForProject', (project: GwtProjectInfo) => {
      telemetryService.sendEvent('compileProject');
      spawnCompile(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.stopCompileForProject', (project: GwtProjectInfo) => {
      telemetryService.sendEvent('stopCompileProject');
      stopCompile(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.runDevModeForProject', (project: GwtProjectInfo) => {
      telemetryService.sendEvent('runDevModeProject');
      spawnDevMode(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.stopDevModeForProject', (project: GwtProjectInfo) => {
      telemetryService.sendEvent('stopDevModeProject');
      stopDevMode(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.runCodeServerForProject', (project: GwtProjectInfo) => {
      telemetryService.sendEvent('runCodeServerProject');
      spawnCodeServer(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.stopCodeServerForProject', (project: GwtProjectInfo) => {
      telemetryService.sendEvent('stopCodeServerProject');
      stopCodeServer(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.startJettyForProject', (project: GwtProjectInfo) => {
      telemetryService.sendEvent('startJettyProject');
      spawnJetty(project.pomPath);
      gwtUiProviderInstance.refresh();
    }),
    vscode.commands.registerCommand('gwt.stopJettyForProject', (project: GwtProjectInfo) => {
      telemetryService.sendEvent('stopJettyProject');
      stopJetty(project.pomPath);
      gwtUiProviderInstance.refresh();
    })
  );
  
  vscode.window.showInformationMessage("GWT Helper extension activated!");
  
  // Check if we need to recover any processes that were running before reload
  recoverProcesses();
}

export function deactivate() {
  if(telemetryService)
    telemetryService.dispose();
  
  // Make sure any running processes are properly stopped
  stopAll();
}