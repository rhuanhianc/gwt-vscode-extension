import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { GwtProjectsStore } from './gwtProjectsStore';
import { logInfo, logError, showLogs, disposeAllTerminals, disposeTerminal } from './logChannel';
import * as path from 'path';
import { spawnTaskKill } from './utils';
import { gwtUiProviderInstance } from './gwtUiPanel';


const provider = gwtUiProviderInstance;

export async function refreshProjects() {
  // Disparado pelo comando "gwt.refreshProjects"
  // Lê do gwtDetector e armazena no store
  const detector = await import('./gwtDetector'); // import dinâmico só por ex
  const list = await detector.detectGwtProjectsInWorkspace();
  GwtProjectsStore.getInstance().setProjects(list);
  vscode.window.showInformationMessage(`Detectados ${list.length} projetos GWT.`);
  provider?.refresh();

}

export async function runCompile() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects();
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum projeto GWT encontrado. Rode 'GWT: Refresh Projects'.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: "Selecione o projeto para compilar" }
  );
  if (!choice) return;

  const pomPath = choice.description || '';
  if (!pomPath) return;

  // Verificar se já está rodando
  const storeRuntime = store.getCompileProcess(pomPath);
  if (storeRuntime) {
    vscode.window.showWarningMessage("Compilação já está rodando para esse projeto.");
    return;
  }

  // Iniciar DevMode
  spawnCompile(pomPath);
}

export function spawnCompile(pomPath: string) {
  //show terminal
  showLogs('compile');
  //colorir [Compile] com azul
  const compileColored = `\x1b[34m[Compile]\x1b[0m`;
  const store = GwtProjectsStore.getInstance();
  logInfo('compile', `${compileColored} Iniciando compilação para pom: ${pomPath}`);

  const folder = path.dirname(pomPath);
  const mvnCmd = getMavenCmd();

  // Obter a configuração do javaPath
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const javaPath = config.get<string>('javaPath')?.trim();
  const mavenCommand = config.get<string>('mavenCommand')?.trim();
  const compileGoals = config.get<string>('compileGoals')?.trim();
  let args = ['gwt:compile'];
  if (compileGoals) {
    args = [compileGoals];
  }
  if (mavenCommand) {
    args = [mavenCommand];
  }

  // Criar um ambiente que sobrescreva JAVA_HOME, se javaPath estiver definido
  const env = { ...process.env };
  if (javaPath) {
    env.JAVA_HOME = javaPath;
  }

  //corrige barras do windows
  if (process.platform === 'win32') {
    env.JAVA_HOME = env.JAVA_HOME?.replace(/\\/g, '/');
  }

  const child = spawn(mvnCmd, args, {
    cwd: folder,
    shell: process.platform === 'win32',
    env // Passa o ambiente modificado
  });

  store.setCompileProcess(pomPath, child);

  child.stdout.on('data', (data) => {
    logInfo('compile', `${compileColored} ${data.toString()}`);
  });

  child.stderr.on('data', (data) => {
    logError('compile', `${compileColored} ${data.toString()}`);
  });

  child.on('close', (code) => {
    logInfo('compile', `${compileColored} finalizado (código: ${code}).`);
    store.setCompileProcess(pomPath, undefined);
  });
  provider?.refresh();
}

export async function stopCompile() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects().filter(p => store.getCompileProcess(p.pomPath));
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhuma compilação em execução.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: "Selecione qual compilação parar" }
  );
  if (!choice) return;

  const pomPath = choice.description || '';
  killProcessForPom(pomPath, 'compile');
  disposeTerminal('compile'); // fecha terminal de log
  provider?.refresh();
}

export async function runDevMode() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects();
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum projeto GWT encontrado. Rode 'GWT: Refresh Projects'.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: "Selecione o projeto para rodar DevMode" }
  );
  if (!choice) return;

  const pomPath = choice.description || '';
  if (!pomPath) return;

  // Verificar se já está rodando
  const storeRuntime = store.getDevModeProcess(pomPath);
  if (storeRuntime) {
    vscode.window.showWarningMessage("DevMode já está rodando para esse projeto.");
    return;
  }

  // Iniciar DevMode
  spawnDevMode(pomPath);
}

function spawnDevMode(pomPath: string) {
  //show terminal
  showLogs('devmode');
  //colorir [DevMode] com azul
  const devModeColored = `\x1b[34m[DevMode]\x1b[0m`;
  const store = GwtProjectsStore.getInstance();
  logInfo('devmode', `${devModeColored} Iniciando DevMode para pom: ${pomPath}`);

  const folder = path.dirname(pomPath);
  let mvnCmd = getMavenCmd();
  let args = ['gwt:devmode'];

  // Obter a configuração do javaPath
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const javaPath = config.get<string>('javaPath')?.trim();
  const mavenCommand = config.get<string>('mavenCommand')?.trim();
  const devModeGoals = config.get<string>('devModeGoals')?.trim();
  if (devModeGoals) {
    args = [devModeGoals];
  }
  if (mavenCommand) {
    mvnCmd = mavenCommand;
  }

  // Criar um ambiente que sobrescreva JAVA_HOME, se javaPath estiver definido
  const env = { ...process.env };
  if (javaPath) {
    env.JAVA_HOME = javaPath;
  }

  //corrige barras do windows
  if (process.platform === 'win32') {
    env.JAVA_HOME = env.JAVA_HOME?.replace(/\\/g, '/');
  }

  const child = spawn(mvnCmd, args, {
    cwd: folder,
    shell: process.platform === 'win32',
    env // Passa o ambiente modificado
  });

  store.setDevModeProcess(pomPath, child);

  child.stdout.on('data', (data) => {
    logInfo('devmode', `${devModeColored} ${data.toString()}`);
  });

  child.stderr.on('data', (data) => {
    logError('devmode', `${devModeColored} ${data.toString()}`);
  });
  child.on('close', (code) => {
    logInfo('devmode', `${devModeColored} finalizado (código: ${code}).`);
    store.setDevModeProcess(pomPath, undefined);
  });

  provider?.refresh();
}

export async function stopDevMode() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects().filter(p => store.getDevModeProcess(p.pomPath));
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum DevMode em execução.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: "Selecione qual DevMode parar" }
  );
  if (!choice) return;

  const pomPath = choice.description || '';
  killProcessForPom(pomPath, 'devmode');
  disposeTerminal('devmode'); // fecha terminal de log
  provider?.refresh();
}

function killProcessForPom(pomPath: string, mode: 'devmode' | 'codeserver' | 'jetty' | 'compile') {
  const store = GwtProjectsStore.getInstance();
  const proc = (mode === 'devmode') ? store.getDevModeProcess(pomPath) : store.getCodeServerProcess(pomPath);
  if (!proc) {
    vscode.window.showWarningMessage(`Nenhum processo para ${pomPath}`);
    return;
  }
  if (process.platform === 'win32') {
    spawnTaskKill(proc.pid!); // forçar kill no Windows
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

// CodeServer 
export async function runCodeServer() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects();
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum projeto GWT encontrado. Rode 'GWT: Refresh Projects'.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: "Selecione o projeto para rodar CodeServer" }
  );
  if (!choice) return;

  const pomPath = choice.description || '';
  if (store.getCodeServerProcess(pomPath)) {
    vscode.window.showWarningMessage("CodeServer já está rodando para esse projeto.");
    return;
  }
  spawnCodeServer(pomPath);
}


function spawnCodeServer(pomPath: string) {
  //show terminal
  showLogs('codeserver');
  //colorir [CodeServer] com azul
  const codeServerColored = `\x1b[34m[CodeServer]\x1b[0m`;

  const store = GwtProjectsStore.getInstance();
  logInfo('codeserver', `${codeServerColored} Iniciando CodeServer para pom: ${pomPath}`);

  const folder = path.dirname(pomPath);
  const mvnCmd = getMavenCmd();
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const javaPath = config.get<string>('javaPath')?.trim();

  // Criar um ambiente que sobrescreva JAVA_HOME, se javaPath estiver definido
  const env = { ...process.env };
  if (javaPath) {
    env.JAVA_HOME = javaPath;
  }

  //corrige barras do windows
  if (process.platform === 'win32') {
    env.JAVA_HOME = env.JAVA_HOME?.replace(/\\/g, '/');
  }
  const child = spawn(mvnCmd, ['gwt:codeserver'], {
    cwd: folder,
    shell: process.platform === 'win32',
    env // Passa o ambiente modificado
  });

  store.setCodeServerProcess(pomPath, child);

  child.stdout.on('data', (data) => {
    logInfo('codeserver', `${codeServerColored} ${data.toString()}`);
  });
  child.on('close', (code) => {
    logInfo('codeserver', `CodeServer finalizado (código: ${code}).`);
    store.setCodeServerProcess(pomPath, undefined);
  });
  provider?.refresh();
}


export async function stopCodeServer() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects().filter(p => store.getCodeServerProcess(p.pomPath));
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum CodeServer em execução.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: "Selecione qual CodeServer parar" }
  );
  if (!choice) return;

  const pomPath = choice.description || '';
  killProcessForPom(pomPath, 'codeserver');
  disposeTerminal('codeserver'); // fecha terminal de log
  provider?.refresh();
}

//jetty
export async function startJetty() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects();
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum projeto GWT encontrado. Rode 'GWT: Refresh Projects'.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: "Selecione o projeto para rodar Jetty" }
  );
  if (!choice) return;

  const pomPath = choice.description || '';
  if (store.getJettyProcess(pomPath)) {
    vscode.window.showWarningMessage("Jetty já está rodando para esse projeto.");
    return;
  }
  spawnJetty(pomPath);
}

export async function spawnJetty(pomPath: string) {
  //show terminal
  showLogs('jetty');
  //colorir [Jetty] com azul
  const jettyColored = `\x1b[34m[Jetty]\x1b[0m`;

  const store = GwtProjectsStore.getInstance();
  logInfo('jetty', `${jettyColored} Iniciando Jetty para pom: ${pomPath}`);

  const folder = path.dirname(pomPath);
  const mvnCmd = getMavenCmd();
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const custom = config.get<string>('jettyGoals')?.trim();
  const env = { ...process.env };
  const javaPath = config.get<string>('javaPath')?.trim();
  env.MAVEN_OPTS = (env.MAVEN_OPTS ? env.MAVEN_OPTS + " " : "") +
    "--add-opens=java.base/java.net=ALL-UNNAMED " +
    "--add-opens=java.base/java.lang=ALL-UNNAMED " +
    "--add-opens=java.base/java.util=ALL-UNNAMED " +
    "--add-opens=java.base/java.io=ALL-UNNAMED " +
    "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED " +
    "--add-opens=java.naming/javax.naming=ALL-UNNAMED";

  //se javaPath for 8 ou 1.8 ou menor remove MAVEN_OPTS
  if (javaPath && javaPath.includes("1.8")) {
    delete env.MAVEN_OPTS;
  }

  if (javaPath) {
    env.JAVA_HOME = javaPath;
  }

  //corrige barras do windows
  if (process.platform === 'win32') {
    env.JAVA_HOME = env.JAVA_HOME?.replace(/\\/g, '/');
  }
  const child = spawn(mvnCmd, [custom || 'jetty:run'], {
    cwd: folder,
    shell: process.platform === 'win32',
    env
  });

  store.setJettyProcess(pomPath, child);

  child.stdout.on('data', (data) => {
    logInfo('jetty', `${jettyColored} ${data.toString()}`);
  });
  child.on('close', (code) => {
    logInfo('jetty', `Jetty finalizado (código: ${code}).`);
    store.setJettyProcess(pomPath, undefined);
  });
  provider?.refresh();
}


export async function stopJetty() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects().filter(p => store.getJettyProcess(p.pomPath));
  if (projects.length === 0) {
    vscode.window.showWarningMessage("Nenhum Jetty em execução.");
    return;
  }

  const choice = await vscode.window.showQuickPick(
    projects.map(p => ({
      label: p.moduleName || '(sem moduleName)',
      description: p.pomPath
    })),
    { placeHolder: "Selecione qual Jetty parar" }
  );
  if (!choice) return;

  const pomPath = choice.description || '';
  killProcessForPom(pomPath, 'jetty');
  disposeTerminal('jetty'); // fecha terminal de log
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
  // Zera no store
  store.setProjects(store.getProjects()); // re-set, limpando runtimes
  vscode.window.showInformationMessage(`Parado(s) ${all.length} processo(s).`);
  disposeAllTerminals();
  provider?.refresh();
}

// Descobre o comando Maven
function getMavenCmd(): string {
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const custom = config.get<string>('mavenCommand')?.trim();
  if (custom) return custom;
  return (process.platform === 'win32') ? 'mvn' : 'mvn';
}
