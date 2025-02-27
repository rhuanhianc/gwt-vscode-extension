import * as vscode from 'vscode';
import * as path from 'path';
import { GwtProjectInfo } from './types';

export async function detectGwtProjectsInWorkspace(): Promise<GwtProjectInfo[]> {
  const results: GwtProjectInfo[] = [];

  const folders = vscode.workspace.workspaceFolders || [];
  for (const folder of folders) {
    // Acha todos os pom.xml (excluindo pasta target)
    const pomFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, '**/pom.xml'),
      '**/target/**'
    );

    for (const pomUri of pomFiles) {
      try {
        const content = await vscode.workspace.fs.readFile(pomUri);
        const text = content.toString();

        const info = parsePomForGwtPlugin(pomUri.fsPath, text);
        if (info) {
          results.push(info);
        }
      } catch (e) {
        console.error('Erro lendo pom.xml', pomUri.fsPath, e);
      }
    }
  }

  return results;
}

export function parsePomForGwtPlugin(pomPath: string, text: string): GwtProjectInfo | null {
  // checa se existe artifactId gwt-maven-plugin
  if (!text.includes('<artifactId>gwt-maven-plugin</artifactId>')) {
    return null;
  }

  let pluginVersion = 'unknown';
  const versionMatch = text.match(/<artifactId>gwt-maven-plugin<\/artifactId>\s*<version>([^<]+)<\/version>/);
  if (versionMatch) {
    pluginVersion = versionMatch[1];
  }

  let moduleName: string | undefined;
  const moduleNameMatch = text.match(/<moduleName>([^<]+)<\/moduleName>/);
  if (moduleNameMatch) {
    moduleName = moduleNameMatch[1];
  }
  //extrair devModePort do <devmodeArgs>
  let devModePort: number | undefined;
  const devModePortMatch = text.match(/<devmodeArgs>[\s\S]*?<arg>-port<\/arg>\s*<arg>(\d+)<\/arg>/);
  if (devModePortMatch) {
    devModePort = parseInt(devModePortMatch[1], 10);
  }

  //  codeServerPort
  let codeServerPort: number | undefined;
  const codeServerPortMatch = text.match(/<codeserverArgs>[\s\S]*?<arg>-port<\/arg>\s*<arg>(\d+)<\/arg>/);
  if (codeServerPortMatch) {
    codeServerPort = parseInt(codeServerPortMatch[1], 10);
  }

  return {
    pomPath,
    pluginVersion,
    moduleName,
    devModePort,
    codeServerPort
  };
}
