import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { GwtProjectsStore } from './gwtProjectsStore';
import { logInfo, logError, showLogs, disposeAllTerminals, disposeTerminal } from './logChannel';
import * as path from 'path';
import { checkPortInUse, killProcessByPort, spawnTaskKill } from './utils';
import { gwtUiProviderInstance as provider } from './gwtUiPanel';
import { GwtProjectInfo } from './types';
import find from 'find-process';

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
 * Checks if the Java installation is version 8 by actually running java -version
 * and parsing the output.
 */
async function isJava8(env: NodeJS.ProcessEnv): Promise<boolean> {
  return new Promise((resolve) => {
    const javaCmd = env.JAVA_HOME ?
      path.join(env.JAVA_HOME, 'bin', 'java') : 'java';

    const javaCheck = spawn(javaCmd, ['-version'], { env });
    let versionOutput = '';

    // java -version outputs to stderr
    javaCheck.stderr.on('data', (data) => {
      versionOutput += data.toString();
    });

    javaCheck.on('close', () => {
      // Look for patterns like "1.8.0", "java version "1.8", etc.
      const isJava8 = /version "1\.8|^java version "1\.8|^openjdk version "1\.8|^jdk1\.8/.test(versionOutput);
      resolve(isJava8);
    });

    javaCheck.on('error', () => {
      // If we can't run java at all, we can't determine the version
      // Default to false to be safe
      resolve(false);
    });
  });
}
/**
 * Returns the environment configured according to the mode.
 * For 'jetty' mode includes the MAVEN_OPTS configuration.
 */
async function getEnvForMode(mode: 'compile' | 'devmode' | 'codeserver' | 'jetty'): Promise<NodeJS.ProcessEnv> {
  const config = vscode.workspace.getConfiguration('gwtHelper');
  const javaPath = config.get<string>('javaPath')?.trim();
  let env = createEnv(javaPath);
  if (mode === 'jetty') {
    // Check if we're using Java 8
    const usingJava8 = await isJava8(env);
    // Log for debugging
    logInfo(mode, `[${capitalize(mode)}] Detected Java version: ${usingJava8 ? 'Java 8' : 'Java 9+'}`);
    if (!usingJava8) {
      // Only add these flags for Java 9+
      env.MAVEN_OPTS = (env.MAVEN_OPTS ? env.MAVEN_OPTS + " " : "") +
        "--add-opens=java.base/java.net=ALL-UNNAMED " +
        "--add-opens=java.base/java.lang=ALL-UNNAMED " +
        "--add-opens=java.base/java.util=ALL-UNNAMED " +
        "--add-opens=java.base/java.io=ALL-UNNAMED " +
        "--add-opens=java.base/java.lang.reflect=ALL-UNNAMED " +
        "--add-opens=java.naming/javax.naming=ALL-UNNAMED";
    } else {
      logInfo(mode, `[${capitalize(mode)}] Using Java 8, no need for --add-opens flags`);
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
async function spawnMavenProcess(
  mode: 'compile' | 'devmode' | 'codeserver' | 'jetty',
  pomPath: string,
  processSetter: (pomPath: string, proc: ChildProcess | undefined) => void,
  attachStderr: boolean = true
) {
  showLogs(mode);
  const colored = `\x1b[34m[${capitalize(mode)}]\x1b[0m`;
  logInfo(mode, `${colored} Iniciando ${capitalize(mode)} para pom: ${pomPath}`);

  // Buffers para coleta de informações
  let errorBuffer: string[] = [];
  let outputBuffer: string[] = [];
  const MAX_BUFFER_LINES = 50;

  const folder = path.dirname(pomPath);
  let mavenCmd = getMavenCmd();

// For devmode, if there is mavenCommand defined in the configuration, use it as command
  if (mode === 'devmode') {
    const config = vscode.workspace.getConfiguration('gwtHelper');
    const mavenCommand = config.get<string>('mavenCommand')?.trim();
    if (mavenCommand) mavenCmd = mavenCommand;
  }

  const args = getArgsForMode(mode);
  const env = await getEnvForMode(mode);

  // Log do comando completo para diagnóstico
  const fullCommand = `${mavenCmd} ${args.join(' ')}`;
  logInfo(mode, `${colored} Executing command: ${fullCommand}`);

  // Log das variáveis de ambiente relevantes
  logInfo(mode, `${colored} Environment: JAVA_HOME=${env.JAVA_HOME || 'not defined'}`);
  if (env.MAVEN_OPTS) {
    logInfo(mode, `${colored} MAVEN_OPTS=${env.MAVEN_OPTS}`);
  }

  try {
    // Pre-check de configurações importantes
    await checkJavaConfiguration(mode, env);

    const child = spawn(mavenCmd, args, {
      cwd: folder,
      shell: process.platform === 'win32',
      env
    });

    if (!child || !child.pid) {
      logError(mode, `${colored} Failed to start Maven process. Check if Maven is installed and in PATH.`);
      return;
    }

    processSetter(pomPath, child);
    const store = GwtProjectsStore.getInstance();

    child.stdout.on('data', (data) => {
      const output = data.toString();
      const lines = output.split('\n');

// Store output lines for diagnostics
      outputBuffer = [...outputBuffer, ...lines.filter((line: string) => line.trim() !== '')].slice(-MAX_BUFFER_LINES);

      const codeServerColored = `\x1b[34m[CodeServer]\x1b[0m`;
      logInfo(mode, `${colored} ${output}`);

      // Check if the output contains the CodeServer port for devmode and compile modes
      if (mode === 'devmode' || mode === 'compile') {
        // Procura pela linha que indica que o CodeServer está pronto e extrai a porta
        const portMatch = output.match(/The code server is ready at http:\/\/127\.0\.0\.1:(\d+)\//);
        if (portMatch) {
          const port = parseInt(portMatch[1], 10);
          logInfo('codeserver', `${codeServerColored} Porta detectada: ${port}`);
          store.setCodeServerPort(pomPath, port);
        }
      }

      // Catch errors that may appear on stdout
      if (output.includes('ERROR') || output.includes('[ERROR]') ||
        output.includes('Exception') || output.includes('Failure')) {
        const errorLines = lines.filter((line: string | string[]) =>
          line.includes('ERROR') || line.includes('[ERROR]') ||
          line.includes('Exception') || line.includes('Failure') ||
          line.includes('Caused by:') || line.includes('Failed to')
        );
        errorBuffer = [...errorBuffer, ...errorLines].slice(-MAX_BUFFER_LINES);
      }
    });

    if (attachStderr) {
      child.stderr.on('data', (data) => {
        const errorOutput = data.toString();
        errorBuffer = [...errorBuffer, ...errorOutput.split('\n').filter((line: string) => line.trim() !== '')].slice(-MAX_BUFFER_LINES);
        logError(mode, `${colored} ${errorOutput}`);
      });
    }

    child.on('error', (error) => {
      logError(mode, `${colored} Error starting process: ${error.message}`);
      errorBuffer.push(`Error starting process:: ${error.message}`);

      // Additional diagnostics
      if (error.message.includes('ENOENT')) {
        logError(mode, `${colored} The command '${mavenCmd}' not found. Make sure Maven is installed and in the PATH.`);
        checkMavenInstallation(mode);
      }

      processSetter(pomPath, undefined);
      provider?.refresh();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        logError(mode, `${colored} Process ended with error (code: ${code}).`);

        // If we have collected errors, display them
        if (errorBuffer.length > 0) {
          logError(mode, `${colored} Error details:`);
          errorBuffer.forEach(line => logError(mode, `${colored} ${line}`));
        } else {

          // If we have no specific errors in the buffer, show the last lines of output
          logError(mode, `${colored} Last lines of output before error:`);
          outputBuffer.forEach(line => logError(mode, `${colored} ${line}`));
        }

        // Suggest possible solutions
        suggestSolutions(mode, errorBuffer.concat(outputBuffer), pomPath, env);
      } else {
        logInfo(mode, `${colored} Process completed successfully.`);
      }

      logInfo(mode, `${colored} finished (code: ${code}).`);
      processSetter(pomPath, undefined);
      provider?.refresh();
    });

    provider?.refresh();

  } catch (error) {
    logError(mode, `${colored} Exception when starting process: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logError(mode, `${colored} Stack: ${error.stack}`);
    }
    processSetter(pomPath, undefined);
    provider?.refresh();
  }
}


/**
* Checks if the Java configuration is correct
*/
async function checkJavaConfiguration(mode: string, env: NodeJS.ProcessEnv): Promise<void> {
  const colored = `\x1b[34m[${capitalize(mode)}]\x1b[0m`;
  
  return new Promise((resolve) => {
    try {
      // Command to check Java version
      const javaCmd = env.JAVA_HOME ? 
        path.join(env.JAVA_HOME, 'bin', 'java') : 'java';
      
      const javaCheck = spawn(javaCmd, ['-version'], { env });
      let versionOutput = '';
      
      javaCheck.stderr.on('data', (data) => {
        // java -version outputs to stderr
        versionOutput += data.toString();
        logInfo(mode, `${colored} Java version: ${data.toString().trim()}`);
      });
      
      javaCheck.on('close', () => {
        // Extract the actual version number for more precise logging
        const versionMatch = versionOutput.match(/"([\d\.]+_\d+|[\d\.]+)"/);
        if (versionMatch) {
          const version = versionMatch[1];
          logInfo(mode, `${colored} Java version detected: ${version}`);
          
          // Provide additional information about Java version compatibility
          if (version.startsWith('1.8')) {
            logInfo(mode, `${colored} Java 8 detected - supported in all modes`);
          } else if (parseFloat(version) >= 9) {
            logInfo(mode, `${colored} Java ${parseFloat(version)}+ detected - --add-opens flags will be required for Jetty`);
          }
        }
        
        resolve();
      });
      
      javaCheck.on('error', (error) => {
        logError(mode, `${colored} Error checking Java: ${error.message}`);
        logError(mode, `${colored} WARNING: Problem with Java configuration. Make sure Java is installed and configured correctly.`);
        
        if (env.JAVA_HOME) {
          logError(mode, `${colored} JAVA_HOME set to: ${env.JAVA_HOME}`);
          logError(mode, `${colored} Verify that this path exists and contains a valid Java installation.`);
        } else {
          logError(mode, `${colored} JAVA_HOME is not set. Consider setting it in the extension settings.`);
        }
        
        resolve();
      });
    } catch (error) {
      logError(mode, `${colored} Failed to verify Java configuration: ${error instanceof Error ? error.message : String(error)}`);
      resolve();
    }
  });
}

/**
 * Verifica se o Maven está instalado corretamente
 */
function checkMavenInstallation(mode: string) {
  const colored = `\x1b[34m[${capitalize(mode)}]\x1b[0m`;

  try {
    // Verificar caminho do Maven
    const mvnCheck = spawn('where', ['mvn'], {
      shell: process.platform === 'win32'
    });

    mvnCheck.stdout.on('data', (data) => {
      logInfo(mode, `${colored} Maven's Path: ${data.toString().trim()}`);
    });

    mvnCheck.on('error', () => {
      logError(mode, `${colored} Could not locate Maven in PATH.`);
    });
  } catch (error) {
    // Ignore errors
  }
}

/**
* Suggests solutions based on the errors found
*/
function suggestSolutions(mode: string, outputLines: string[], pomPath: string, env: NodeJS.ProcessEnv) {
  const colored = `\x1b[34m[${capitalize(mode)}]\x1b[0m`;
  const allOutput = outputLines.join('\n');

// Java Problems
  if (allOutput.includes('no java executable found') ||
    allOutput.includes('No such file or directory') && env.JAVA_HOME) {
    logError(mode, `${colored} Problem detected: Invalid Java configuration.`);
    logError(mode, `${colored} Solution: Check the JAVA_HOME path (${env.JAVA_HOME}) is valid.`);
    logError(mode, `${colored} Make sure this directory exists and contains the 'bin' folder with the 'java' executable.`);
  }
  // Port issues
  else if (allOutput.includes('Address already in use') ||
    allOutput.includes('Port is already in use') ||
    allOutput.includes('BindException')) {
    logError(mode, `${colored} Problem detected: Port is already in use.`);
    logError(mode, `${colored} Solution: Check if there is no other process using the same port.`);
    logError(mode, `${colored} Use 'netstat -ano' (Windows) or 'lsof -i' (Linux/Mac) to identify the process.`);
  }
  // Memory issues
  else if (allOutput.includes('OutOfMemoryError') || allOutput.includes('PermGen space')) {
    logError(mode, `${colored} Problem detected: Out of memory.`);
    logError(mode, `${colored} Solution: Increase Maven memory settings with MAVEN_OPTS="-Xmx1024m -XX:MaxPermSize=256m".`);
  }
  // Connection problems
  else if (allOutput.includes('Connection refused') || allOutput.includes('Conexão recusada')) {
    logError(mode, `${colored} Problem detected: Connection refused.`);
    logError(mode, `${colored} Solution: Check if all required services are running.`);
  }
  // Dependency issues
  else if (allOutput.includes('Failed to resolve artifact') || allOutput.includes('Could not resolve dependencies')) {
    logError(mode, `${colored} Problem detected: Failed to resolve dependencies.`);
    logError(mode, `${colored} Solution: Check your internet connection and Maven repository configuration.`);
    logError(mode, `${colored} Try running 'mvn clean install -U' to force update dependencies.`);
  }
  // Compilation issues
  else if (allOutput.includes('Compilation failure')) {
    logError(mode, `${colored} Problem detected: Compilation error.`);
    logError(mode, `${colored} Solution: Check the compilation errors in the above logs.`);
  }
  // Other problems
  else {
    logError(mode, `${colored} For additional debugging, try running the command manually:`);
    logError(mode as 'compile' | 'devmode' | 'codeserver' | 'jetty', `${colored} cd "${path.dirname(pomPath)}" && ${getMavenCmd()} ${getArgsForMode(mode as 'compile' | 'devmode' | 'codeserver' | 'jetty').join(' ')}`);
  }
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
    vscode.window.showWarningMessage("No GWT projects found. Run 'GWT: Refresh Projects'.");
    return;
  }
  const pomPath = await pickProject(projects, `Select the project to ${actionText}`);
  if (!pomPath) return;
  if (getProcess(pomPath)) {
    vscode.window.showWarningMessage(`${capitalize(mode)} is already running for this project.`);
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
  pomPath: string,
  killMode: 'compile' | 'devmode' | 'codeserver' | 'jetty'
) {
  const store = GwtProjectsStore.getInstance();
  if (pomPath === undefined) {
    const msg = mode === 'compile' ? "Nenhuma compilação" :
      mode === 'devmode' ? "Nenhum DevMode" :
        mode === 'codeserver' ? "Nenhum CodeServer" : "Nenhum Jetty";
    vscode.window.showWarningMessage(`${msg} em execução.`);
    return;
  }
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
  const activeProcessesCountBefore = store.getAllProcesses().length;
  
  // Update the projects in the store
  store.setProjects(list);
  store.setJettyProjects(listJetty);
  const activeProcessesCountAfter = store.getAllProcesses().length;
  
  vscode.window.showInformationMessage(
    `Detected ${list.length} GWT projects and ${listJetty.length} Jetty projects. ` +
    `Active processes: ${activeProcessesCountAfter}.`
  );

  if (activeProcessesCountBefore > 0 && activeProcessesCountAfter > 0) {
    logInfo('refresh', `Preserved ${activeProcessesCountAfter}/${activeProcessesCountBefore} active processes during refresh.`);
  }
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

export async function stopCompile(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  await stopProcess('compile', pomPath, 'compile');
}

export async function runDevMode() {
  const store = GwtProjectsStore.getInstance();
  await runProcess('devmode', store.getDevModeProcess.bind(store), spawnDevMode, "rodar DevMode");
}

export function spawnDevMode(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  spawnMavenProcess('devmode', pomPath, store.setDevModeProcess.bind(store));
}

export async function stopDevMode(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  await stopProcess('devmode', pomPath, 'devmode');
}

export async function runCodeServer() {
  const store = GwtProjectsStore.getInstance();
  await runProcess('codeserver', store.getCodeServerProcess.bind(store), spawnCodeServer, "rodar CodeServer");
}

export function spawnCodeServer(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  spawnMavenProcess('codeserver', pomPath, store.setCodeServerProcess.bind(store), false);
}

export async function stopCodeServer(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  await stopProcess('codeserver', pomPath, 'codeserver');
}

export async function startJetty() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getJettProjects();
  if (projects.length === 0) {
    vscode.window.showWarningMessage("No Jetty projects found. Run 'GWT: Refresh Projects'.");
    return;
  }
  const pomPath = await pickProject(projects, "Select the project to run Jetty");
  if (!pomPath) return;
  if (store.getJettyProcess(pomPath)) {
    vscode.window.showWarningMessage("Jetty is already running for this project.");
    return;
  }
  spawnJetty(pomPath);
}

export async function spawnJetty(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  spawnMavenProcess('jetty', pomPath, store.setJettyProcess.bind(store), false);
}

export async function stopJetty(pomPath: string) {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getJettyProcess(pomPath);
  if (projects === undefined) {
    vscode.window.showWarningMessage("Nenhum Jetty em execução.");
    return;
  }
  killProcessForPom(pomPath, 'jetty');
  disposeTerminal('jetty');
  provider?.refresh();
}

export function stopAll() {
  const store = GwtProjectsStore.getInstance();
  const all = store.getAllProcesses();
  if (all.length === 0) {
    vscode.window.showInformationMessage("No DevMode/CodeServer/Jetty processes running.");
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
  vscode.window.showInformationMessage(`Stopped ${all.length} process(es).`);
  disposeAllTerminals();
  provider?.refresh();
}


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
  vscode.window.showInformationMessage(`${mode} stopped for ${pomPath}`);
  provider?.refresh();
}

export function resetDevModeState(project: GwtProjectInfo) {
  const store = GwtProjectsStore.getInstance();
  
  vscode.window.showWarningMessage(
    `DevMode for ${project.moduleName || path.basename(project.pomPath)} was running but is no longer connected.`,
    'Clear State', 
    'Restart'
  ).then(selection => {
    if (selection === 'Clear State') {
      store.setDevModeProcess(project.pomPath, undefined);
      provider?.refresh();
    } else if (selection === 'Restart') {
      spawnDevMode(project.pomPath);
    }
  });
}


export function resetCodeServerState(project: GwtProjectInfo) {
  const store = GwtProjectsStore.getInstance();
  const port = store.getCodeServerPort(project.pomPath);
  
  vscode.window.showWarningMessage(
    `CodeServer for ${project.moduleName || path.basename(project.pomPath)} might still be running on port ${port}.`,
    'Clear State', 
    'Check Port', 
    'Restart'
  ).then(async selection => {
    if (selection === 'Clear State') {
      store.setCodeServerProcess(project.pomPath, undefined);
      provider?.refresh();
    } else if (selection === 'Check Port') {
      try {
        // Try to find processes on this port
        const findProcess = require('find-process');
        const processes = await findProcess('port', port);
        
        if (processes.length > 0) {
          const proc = processes[0];
          vscode.window.showInformationMessage(
            `Port ${port} is being used by ${proc.name} (PID: ${proc.pid})`,
            'Kill Process', 
            'Ignore'
          ).then(choice => {
            if (choice === 'Kill Process') {
              if (process.platform === 'win32') {
                spawnTaskKill(proc.pid);
              } else {
                process.kill(proc.pid, 'SIGTERM');
              }
              store.setCodeServerProcess(project.pomPath, undefined);
              provider?.refresh();
            }
          });
        } else {
          vscode.window.showInformationMessage(`No process found using port ${port}`);
          store.setCodeServerProcess(project.pomPath, undefined);
          provider?.refresh();
        }
      } catch (error) {
        logError('codeserver', `Error checking port: ${error}`);
        vscode.window.showErrorMessage(`Error checking port: ${error}`);
      }
    } else if (selection === 'Restart') {
      spawnCodeServer(project.pomPath);
    }
  });
}


export function resetCompileState(project: GwtProjectInfo) {
  const store = GwtProjectsStore.getInstance();
  
  vscode.window.showWarningMessage(
    `Compile for ${project.moduleName || path.basename(project.pomPath)} was running but is no longer connected.`,
    'Clear State', 
    'Restart'
  ).then(selection => {
    if (selection === 'Clear State') {
      store.setCompileProcess(project.pomPath, undefined);
      provider?.refresh();
    } else if (selection === 'Restart') {
      spawnCompile(project.pomPath);
    }
  });
}

export function resetJettyState(project: GwtProjectInfo) {
  const store = GwtProjectsStore.getInstance();
  
  vscode.window.showWarningMessage(
    `Jetty for ${project.moduleName || path.basename(project.pomPath)} was running but is no longer connected.`,
    'Clear State', 
    'Restart'
  ).then(selection => {
    if (selection === 'Clear State') {
      store.setJettyProcess(project.pomPath, undefined);
      provider?.refresh();
    } else if (selection === 'Restart') {
      spawnJetty(project.pomPath);
    }
  });
}


/**
 * Checks if processes that were running before reload are still running
 * and updates the store accordingly
 */
export async function recoverProcesses() {
  const store = GwtProjectsStore.getInstance();
  const projects = store.getProjects();
  const jettyProjects = store.getJettProjects();
  const allProjects = [...projects, ...jettyProjects];
  
  // Only attempt recovery if we have projects
  if (allProjects.length === 0) {
    return;
  }

  vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "GWT Helper: Checking process states...",
    cancellable: false
  }, async (progress) => {
    try {
      for (const project of allProjects) {
        const { pomPath } = project;
        
        // Check process states
        if (store.wasDevModeActive(pomPath)) {
          logInfo('recover', `Checking DevMode process status for ${pomPath}...`);
          store.setDevModeProcess(pomPath, undefined);
        }
        
        if (store.wasCodeServerActive(pomPath)) {
          logInfo('recover', `Checking CodeServer process status for ${pomPath}...`);
          // We can try to check if the CodeServer port is still in use
          const port = store.getCodeServerPort(pomPath);
          if (port) {
            try {
              // Check if the port is in use
              const isPortInUse = await checkPortInUse(port);
              if (isPortInUse) {
                logInfo('recover', `Found CodeServer on port ${port} still running`);

                store.setCodeServerPort(pomPath, port);
                
                // Show info to user about port still being used
                vscode.window.showInformationMessage(
                  `CodeServer for ${project.moduleName || path.basename(pomPath)} appears to be running on port ${port}`,
                  'Show Logs',
                  'Stop Server'
                ).then(selection => {
                  if (selection === 'Show Logs') {
                    showLogs('codeserver');
                  } else if (selection === 'Stop Server') {
                    // Try to kill the process by port
                    killProcessByPort(port);
                    store.setCodeServerProcess(pomPath, undefined);
                    provider?.refresh();
                  }
                });
              } else {
                // No process found on that port
                store.setCodeServerProcess(pomPath, undefined);
              }
            } catch (error) {
              logError('recover', `Error checking CodeServer port: ${error}`);
              store.setCodeServerProcess(pomPath, undefined);
            }
          } else {
            store.setCodeServerProcess(pomPath, undefined);
          }
        }
        
        if (store.wasJettyActive(pomPath)) {
          logInfo('recover', `Checking Jetty process status for ${pomPath}...`);
          // Similar to CodeServer, we can't recover the actual ChildProcess
          store.setJettyProcess(pomPath, undefined);
        }
        
        if (store.wasCompileActive(pomPath)) {
          logInfo('recover', `Checking Compile process status for ${pomPath}...`);
          store.setCompileProcess(pomPath, undefined);
        }
        
        // Make sure the flags are reset to match current state
        store.resetProcessActiveFlags(pomPath);
      }
    } catch (error) {
      logError('recover', `Error during process recovery: ${error}`);
    }
    
    // Refresh the UI after recovery
    provider?.refresh();
  });
}