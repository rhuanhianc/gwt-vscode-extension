import { GwtProjectInfo } from './types';
import { ChildProcess } from 'child_process';

interface GwtProjectRuntime {
  devModeProcess?: ChildProcess;
  codeServerProcess?: ChildProcess;
  jettyProcess?: ChildProcess;
  compileProcess?: ChildProcess;
}

export class GwtProjectsStore {
  private static instance: GwtProjectsStore;
  private projects: GwtProjectInfo[] = [];

  //  pomPath -> GwtProjectRuntime
  private runtimeMap = new Map<string, GwtProjectRuntime>();

  private constructor() {}

  public static getInstance(): GwtProjectsStore {
    if (!this.instance) {
      this.instance = new GwtProjectsStore();
    }
    return this.instance;
  }

  public setProjects(list: GwtProjectInfo[]) {
    this.projects = list;
    // zera o runtimeMap? ou mantem 
    this.runtimeMap.clear();
    for (const p of list) {
      this.runtimeMap.set(p.pomPath, {});
    }
  }

  public getProjects(): GwtProjectInfo[] {
    return this.projects;
  }

  public getProjectByPomPath(pomPath: string): GwtProjectInfo | undefined {
    return this.projects.find(p => p.pomPath === pomPath);
  }

  // DevMode/CodeServer/Jetty
  public setDevModeProcess(pomPath: string, proc: ChildProcess | undefined) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.devModeProcess = proc;
  }

  public setCodeServerProcess(pomPath: string, proc: ChildProcess | undefined) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.codeServerProcess = proc;
  }

  public setJettyProcess(pomPath: string, proc: ChildProcess | undefined) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.jettyProcess = proc;
  }

  // Compilação
  public setCompileProcess(pomPath: string, proc: ChildProcess | undefined) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.compileProcess = proc;
  }

  public getDevModeProcess(pomPath: string): ChildProcess | undefined {
    return this.runtimeMap.get(pomPath)?.devModeProcess;
  }

  public getCodeServerProcess(pomPath: string): ChildProcess | undefined {
    return this.runtimeMap.get(pomPath)?.codeServerProcess;
  }

  public getJettyProcess(pomPath: string): ChildProcess | undefined {
    return this.runtimeMap.get(pomPath)?.jettyProcess;
  }

  public getCompileProcess(pomPath: string): ChildProcess | undefined {
    return this.runtimeMap.get(pomPath)?.compileProcess;
  }

  // Parar todos
  public getAllProcesses(): ChildProcess[] {
    const list: ChildProcess[] = [];
    this.runtimeMap.forEach(rt => {
      if (rt.devModeProcess) list.push(rt.devModeProcess);
      if (rt.codeServerProcess) list.push(rt.codeServerProcess);
      if (rt.jettyProcess) list.push(rt.jettyProcess);
      if (rt.compileProcess) list.push(rt.compileProcess);
    });
    return list;
  }
}
