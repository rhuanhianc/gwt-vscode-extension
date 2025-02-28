import * as vscode from 'vscode';
import * as path from 'path';
import { GwtProjectsStore } from './gwtProjectsStore';
import { detectGwtProjectsInWorkspace } from './gwtDetector';
import { GwtProjectInfo } from './types';

/**
 * Gets GWT projects: if they are already stored in the store, use them;
 * otherwise triggers detection.
 */
async function getProjects(): Promise<GwtProjectInfo[]> {
  let projects = GwtProjectsStore.getInstance().getProjects();
  if (projects.length === 0) {
    projects = await detectGwtProjectsInWorkspace();
    GwtProjectsStore.getInstance().setProjects(projects);
  }
  return projects;
}

/**
 * Allows you to select a project if there is more than one.
 * If there is only one, it is returned directly.
 */

async function pickProject(projects: GwtProjectInfo[]): Promise<GwtProjectInfo | undefined> {
  if (projects.length === 1) {
    return projects[0];
  }
  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || path.basename(p.pomPath),
      description: p.pomPath,
      project: p
    })),
    { placeHolder: "Selecione um projeto GWT para depuração" }
  );
  return choice?.project;
}

/**
 * Attempts to get the CodeServer port for the project.
 * If pom.xml already defines the port, it is returned.
 * Otherwise, null is returned, indicating that CodeServer must be started.
 */
async function getCodeServerPortForProject(project: GwtProjectInfo): Promise<number | null> {
  if (project.codeServerPort) {
    return project.codeServerPort;
  }
  const store = GwtProjectsStore.getInstance();
  if (store.getCodeServerPort(project.pomPath)) {
    return store.getCodeServerPort(project.pomPath) ?? null;
  }

  return null;
}

/**
 * Returns the workspaceFolder associated with the project.
 * Try to find the workspace whose path contains the project's pomPath.
 */
function getWorkspaceFolder(project: GwtProjectInfo): string {
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length) {
    const folder = vscode.workspace.workspaceFolders.find(f =>
      project.pomPath.startsWith(f.uri.fsPath)
    );
    if (folder) {
      return folder.uri.fsPath;
    }
    return vscode.workspace.workspaceFolders[0].uri.fsPath;
  }
  return '';
}

/**
 * Opens an integrated debug session (no need for launch.json),
 * dynamically configured based on extension settings and
 * in the selected GWT project data.
 */
export async function openGWTDebugSession() {
  // Read extension settings
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const debugUrl = config.get<string>('debugUrl') || 'http://localhost:8080';

  // Get the GWT projects
  const projects = await getProjects();
  if (projects.length === 0) {
    vscode.window.showErrorMessage("Nenhum projeto GWT detectado.");
    return;
  }

  const project = await pickProject(projects);
  if (!project) {
    return;
  }

  // Defines the webRoot based on the workspace and project module
  // set as example "webRoot": "${workspaceFolder:ProjetoFolder}", where ProjetoFolder is the last folder in the workspace path
  const workspaceFolder = getWorkspaceFolder(project);
  const lastFolder = workspaceFolder.split(path.sep).pop();
  const webRoot = "${workspaceFolder:" + lastFolder + "}";

  // Try to get the CodeServer port
  const codeServerPort = await getCodeServerPortForProject(project);
  if (!codeServerPort) {
    vscode.window.showErrorMessage("Não foi possível detectar a porta do CodeServer para o projeto. Inicie o CodeServer primeiro.");
    return;
  }

  // Set up sourceMapPathOverrides
  const clientName = project.moduleName ? project.moduleName.toLowerCase() : 'projeto';
  const sourceMapPathOverrides: { [key: string]: string } = {};
  sourceMapPathOverrides[`http://127.0.0.1:${codeServerPort}/sourcemaps/${clientName}/*`] = webRoot + '/src/*';

  // Debug configuration for the Chrome adapter
  const debugConfig: vscode.DebugConfiguration = {
    type: "chrome",
    request: "launch",
    name: "GWT Debug Session",
    url: debugUrl,
    webRoot: webRoot,
    sourceMaps: true,
    trace: true,
    sourceMapPathOverrides: sourceMapPathOverrides
  };

  // Start the debug session programmatically
  const started = await vscode.debug.startDebugging(undefined, debugConfig);
  vscode.window.showInformationMessage("Debugging GWT project " + project.moduleName);
  if (!started) {
    vscode.window.showErrorMessage("Falha ao iniciar a sessão de debug.");
  }
}
