import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { GwtProjectsStore } from './gwtProjectsStore';
import { logInfo, logError, showLogs, disposeAllTerminals, disposeTerminal } from './logChannel';
import * as path from 'path';
import { spawnTaskKill } from './utils';
import { gwtUiProviderInstance as provider } from './gwtUiPanel';

/**
 * Returns a string with the first letter capitalized.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Creates the environment with JAVA_HOME overridden if necessary.
 */
function createEnv(javaPath?: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  if (javaPath && javaPath.trim() !== "" && javaPath !== "java") {
    env.JAVA_HOME = javaPath;
  }
  if (process.platform === 'win32' && env.JAVA_HOME) {
    env.JAVA_HOME = env.JAVA_HOME.replace(/\\/g, '/');
  }
  return env;
}

/**
 * Returns the environment configured according to the mode.
 * For 'jetty' mode includes the MAVEN_OPTS configuration.
 */
function getEnvForMode(mode: 'compile' | 'devmode' | 'codeserver' | 'jetty'): NodeJS.ProcessEnv {
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const javaPath = config.get<string>('javaPath')?.trim();
  let env = createEnv(javaPath);
  if (mode === 'jetty') {
    env.MAVEN_OPTS = (env.MAVEN_OPTS ? env.MAVEN_OPTS + " " : "") +
      "--add-opens=java.base/java.net=ALL-UNNAMED " +
      "--add-opens=java.base/java.lang=ALL-UNNAMED " +
      "--add-opens=java.base/java.util=ALL-UNNAMED " +
      "--add-opens=java.base/java.io=ALL-UNNAMED " +
      "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED " +
      "--add-opens=java.naming/javax.naming=ALL-UNNAMED";
    if (javaPath && javaPath.includes("1.8")) {
      delete env.MAVEN_OPTS;
    }
  }
  return env;
}

/**
 * Assembles Maven arguments according to the mode.
 */
function getArgsForMode(mode: 'compile' | 'devmode' | 'codeserver' | 'jetty'): string[] {
  const config = vscode.workspace.getConfiguration('gwtHelper');
  switch (mode) {
    case 'compile': {
      const compileGoals = config.get<string>('compileGoals')?.trim();
      const mavenCommand = config.get<string>('mavenCommand')?.trim();
      return mavenCommand ? [mavenCommand] : [compileGoals || 'gwt:compile'];
    }
    case 'devmode': {
      const devModeGoals = config.get<string>('devModeGoals')?.trim();
      const mavenCommand = config.get<string>('mavenCommand')?.trim();
      return mavenCommand ? [mavenCommand] : [devModeGoals || 'gwt:devmode'];
    }
    case 'codeserver': {
      return ['gwt:codeserver'];
    }
    case 'jetty': {
      const jettyGoals = config.get<string>('jettyGoals')?.trim();
      return [jettyGoals || 'jetty:run'];
    }
  }
}

/**
 * Discover the Maven command. If there is a custom configuration, use it.
 */
function getMavenCmd(): string {
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const custom = config.get<string>('mavenCommand')?.trim();
  if (custom) return custom;
  return 'mvn';
}

/**
 * Generic function for spawning Maven processes.
 * - mode: defines the type (compile, devmode, coserver, jetty)
 * - pomPath: path of the pom.xml file
 * - processSetter: store function to register/clean up the process
 * - attachStderr: if true, attaches the stderr handle (default true)
 */
function spawnMavenProcess(
  mode: 'compile' | 'devmode' | 'codeserver' | 'jetty',
  pomPath: string,
  processSetter: (pomPath: string, proc: ChildProcess | undefined) => void,
  attachStderr: boolean = true
) {
  showLogs(mode);
  const colored = `\x1b[34m[${capitalize(mode)}]\x1b[0m`;
  logInfo(mode, `${colored} Iniciando ${capitalize(mode)} para pom: ${pomPath}`);

  const folder = path.dirname(pomPath);
  let mavenCmd = getMavenCmd();
  // Para o devmode, se houver mavenCommand definido na configuração, utiliza-o como comando
  if (mode === 'devmode') {
    const config = vscode.workspace.getConfiguration('gwtHelper');
    const mavenCommand = config.get<string>('mavenCommand')?.trim();
    if (mavenCommand) mavenCmd = mavenCommand;
  }
  const args = getArgsForMode(mode);
  const env = getEnvForMode(mode);

  const child = spawn(mavenCmd, args, {
    cwd: folder,
    shell: process.platform === 'win32',
    env
  });

  processSetter(pomPath, child);
  const store = GwtProjectsStore.getInstance();
  child.stdout.on('data', (data) => {
    const codeServerColored = `\x1b[34m[CodeServer]\x1b[0m`;
    logInfo(mode, `${colored} ${data.toString()}`);
    // Verifica se o output contém a porta do CodeServer para os modos devmode e compile
    if (mode === 'devmode' || mode === 'compile') {
      const output = data.toString();
      // Procura pela linha que indica que o CodeServer está pronto e extrai a porta
      const portMatch = output.match(/The code server is ready at http:\/\/127\.0\.0\.1:(\d+)\//);
      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        logInfo('codeserver', `${codeServerColored} Porta detectada: ${port}`);
        store.setCodeServerPort(pomPath, port);
      }
    }

  });
  if (attachStderr) {
    child.stderr.on('data', (data) => {
      logError(mode, `${colored} ${data.toString()}`);
    });
  }
  child.on('close', (code) => {
    logInfo(mode, `${colored} finalizado (código: ${code}).`);
    processSetter(pomPath, undefined);
    provider?.refresh();
  });
  provider?.refresh();
}

/**
 * Auxiliary function to choose a project via QuickPick.
 */
async function pickProject(
  projects: { moduleName?: string, pomPath: string }[],
  placeholder: string
): Promise<string | undefined> {
  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: placeholder }
  );
  return choice?.description;
}

/**
 * Helper function to start a process (compile, devmode, coserver)
 * from project selection.
 */
async function runProcess(
  mode: 'compile' | 'devmode' | 'codeserver',
  getProcess: (pomPath: string) => ChildProcess | undefined,
  spawnFunc: (pomPath: string) => void,
  actionText: string
) {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects();
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum projeto GWT encontrado. Rode 'GWT: Refresh Projects'.");
    return;
  }
  const pomPath = await pickProject(projects, `Selecione o projeto para ${actionText}`);
  if (!pomPath) return;
  if (getProcess(pomPath)) {
    vscode.window.showWarningMessage(`${capitalize(mode)} já está rodando para esse projeto.`);
    return;
  }
  spawnFunc(pomPath);
}

/**
 * Helper function to stop a process (compile, devmode, coserver or jetty)
 * from project selection.
 */
async function stopProcess(
  mode: 'compile' | 'devmode' | 'codeserver' | 'jetty',
  getProcess: (pomPath: string) => ChildProcess | undefined,
  killMode: 'compile' | 'devmode' | 'codeserver' | 'jetty'
) {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects().filter(p => getProcess(p.pomPath));
  if (projects.length === 0) {
    const msg = mode === 'compile' ? "Nenhuma compilação" :
      mode === 'devmode' ? "Nenhum DevMode" :
        mode === 'codeserver' ? "Nenhum CodeServer" : "Nenhum Jetty";
    vscode.window.showWarningMessage(`${msg} em execução.`);
    return;
  }
  const pomPath = await pickProject(projects, `Selecione qual ${capitalize(mode)} parar`);
  if (!pomPath) return;
  killProcessForPom(pomPath, killMode);
  disposeTerminal(killMode);
  provider?.refresh();
}


export async function refreshProjects() {
  // Update projects from the detector
  const detector = await import('./gwtDetector');
  const list = await detector.detectGwtProjectsInWorkspace();
  const listJetty = await detector.detectJettyProjectsInWorkspace();
  const store = GwtProjectsStore.getInstance();
  store.setProjects(list);
  store.setJettyProjects(listJetty);
  vscode.window.showInformationMessage(`Detectados ${list.length} projetos GWT.`);
  provider?.refresh();
}

export async function runCompile() {
  const store = GwtProjectsStore.getInstance();
  await runProcess('compile', store.getCompileProcess.bind(store), spawnCompile, "compilar");
}

export function spawnCompile(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  spawnMavenProcess('compile', pomPath, store.setCompileProcess.bind(store));
}

export async function stopCompile() {
  const store = GwtProjectsStore.getInstance();
  await stopProcess('compile', store.getCompileProcess.bind(store), 'compile');
}

export async function runDevMode() {
  const store = GwtProjectsStore.getInstance();
  await runProcess('devmode', store.getDevModeProcess.bind(store), spawnDevMode, "rodar DevMode");
}

function spawnDevMode(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  spawnMavenProcess('devmode', pomPath, store.setDevModeProcess.bind(store));
}

export async function stopDevMode() {
  const store = GwtProjectsStore.getInstance();
  await stopProcess('devmode', store.getDevModeProcess.bind(store), 'devmode');
}

export async function runCodeServer() {
  const store = GwtProjectsStore.getInstance();
  await runProcess('codeserver', store.getCodeServerProcess.bind(store), spawnCodeServer, "rodar CodeServer");
}

function spawnCodeServer(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  spawnMavenProcess('codeserver', pomPath, store.setCodeServerProcess.bind(store), false);
}

export async function stopCodeServer() {
  const store = GwtProjectsStore.getInstance();
  await stopProcess('codeserver', store.getCodeServerProcess.bind(store), 'codeserver');
}

export async function startJetty() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getJettProjects();
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum projeto Jetty encontrado. Rode 'GWT: Refresh Projects'.");
    return;
  }
  const pomPath = await pickProject(projects, "Selecione o projeto para rodar Jetty");
  if (!pomPath) return;
  if (store.getJettyProcess(pomPath)) {
    vscode.window.showWarningMessage("Jetty já está rodando para esse projeto.");
    return;
  }
  spawnJetty(pomPath);
}

export async function spawnJetty(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  spawnMavenProcess('jetty', pomPath, store.setJettyProcess.bind(store), false);
}

export async function stopJetty() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects().filter(p => store.getJettyProcess(p.pomPath));
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum Jetty em execução.");
    return;
  }
  const pomPath = await pickProject(projects, "Selecione qual Jetty parar");
  if (!pomPath) return;
  killProcessForPom(pomPath, 'jetty');
  disposeTerminal('jetty');
  provider?.refresh();
}

export function stopAll() {
  const store = GwtProjectsStore.getInstance();
  const all = store.getAllProcesses();
  if (all.length === 0) {
    vscode.window.showInformationMessage("Nenhum processo DevMode/CodeServer/Jetty em execução.");
    return;
  }
  for (const proc of all) {
    if (process.platform === 'win32') {
      spawnTaskKill(proc.pid!);
    } else {
      proc.kill('SIGTERM');
    }
  }
  // Clean up the processes in the store
  store.setProjects(store.getProjects());
  store.setJettyProjects(store.getJettProjects());
  vscode.window.showInformationMessage(`Parado(s) ${all.length} processo(s).`);
  disposeAllTerminals();
  provider?.refresh();
}

/**
 * Kills the process according to pomPath and past mode.
 */
function killProcessForPom(pomPath: string, mode: 'devmode' | 'codeserver' | 'jetty' | 'compile') {
  const store = GwtProjectsStore.getInstance();
  const proc = (mode === 'devmode')
    ? store.getDevModeProcess(pomPath)
    : mode === 'codeserver'
      ? store.getCodeServerProcess(pomPath)
      : mode === 'jetty'
        ? store.getJettyProcess(pomPath)
        : mode === 'compile'
          ? store.getCompileProcess(pomPath)
          : undefined;
  if (!proc) {
    vscode.window.showWarningMessage(`Nenhum processo para ${pomPath}`);
    return;
  }
  if (process.platform === 'win32') {
    spawnTaskKill(proc.pid!);
  } else {
    proc.kill('SIGTERM');
  }
  if (mode === 'devmode') {
    store.setDevModeProcess(pomPath, undefined);
  } else if (mode === 'codeserver') {
    store.setCodeServerProcess(pomPath, undefined);
  } else if (mode === 'jetty') {
    store.setJettyProcess(pomPath, undefined);
  } else if (mode === 'compile') {
    store.setCompileProcess(pomPath, undefined);
  }
  vscode.window.showInformationMessage(`${mode} parado para ${pomPath}`);
  provider?.refresh();
}
