import * as vscode from 'vscode';
import { GWTUiProvider, gwtUiProviderInstance  } from './gwtUiPanel';
import { GWTDebugConfigurationProvider } from './gwtDebugProvider';
import { refreshProjects, runDevMode, stopDevMode, runCodeServer, stopCodeServer, stopAll, startJetty, stopJetty, runCompile, stopCompile } from './gwtService';
import { showLogs } from './logChannel';

export function activate(context: vscode.ExtensionContext) {
  // Registrar a view
  vscode.window.registerTreeDataProvider('gwtHelperView', gwtUiProviderInstance);

  // Registrar comandos
  context.subscriptions.push(
    vscode.commands.registerCommand('gwt.refreshProjects', refreshProjects),
    vscode.commands.registerCommand('gwt.runCompile', runCompile),
    vscode.commands.registerCommand('gwt.stopCompile', stopCompile),
    vscode.commands.registerCommand('gwt.runDevMode', runDevMode),
    vscode.commands.registerCommand('gwt.stopDevMode', stopDevMode),
    vscode.commands.registerCommand('gwt.runCodeServer', runCodeServer),
    vscode.commands.registerCommand('gwt.stopCodeServer', stopCodeServer),
    vscode.commands.registerCommand('gwt.startJetty', startJetty),
    vscode.commands.registerCommand('gwt.stopJetty', stopJetty),
    vscode.commands.registerCommand('gwt.stopAll', stopAll),
    vscode.commands.registerCommand('gwt.showLogs', showLogs),
    vscode.commands.registerCommand('gwt.openSettings', async () => {
      // Tentar abrir configurações filtradas em "gwtHelper"
      await vscode.commands.executeCommand('workbench.action.openSettings', { query: 'gwtHelper' });
    })
  );

  // Registrar debug provider
  const debugProvider = new GWTDebugConfigurationProvider();
  // context.subscriptions.push(
  //   vscode.debug.registerDebugConfigurationProvider('gwt', debugProvider)
  // );

  vscode.window.showInformationMessage("GWT Helper extension activated!");
}

export function deactivate() {
  // ...
}
