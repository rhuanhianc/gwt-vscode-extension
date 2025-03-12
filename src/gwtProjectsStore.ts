import { GwtProjectInfo } from './types';
import { ChildProcess } from 'child_process';
import * as vscode from 'vscode';
import { logInfo } from './logChannel';

// Keys for storage
const PROJECTS_STORAGE_KEY = 'gwtHelper.projects';
const JETTY_PROJECTS_STORAGE_KEY = 'gwtHelper.jettyProjects';
const CODE_SERVER_PORTS_KEY = 'gwtHelper.codeServerPorts';

interface GwtProjectRuntime {
  devModeProcess?: ChildProcess;
  codeServerProcess?: ChildProcess;
  jettyProcess?: ChildProcess;
  compileProcess?: ChildProcess;
  codeServerPort?: number;

  // Process metadata to persist between reloads
  devModeProcessActive?: boolean;
  codeServerProcessActive?: boolean;
  jettyProcessActive?: boolean;
  compileProcessActive?: boolean;
}

interface ProcessMetadata {
  [pomPath: string]: {
    devModeActive?: boolean;
    codeServerActive?: boolean;
    jettyActive?: boolean;
    compileActive?: boolean;
    codeServerPort?: number;
  }
}

export class GwtProjectsStore {
  private static instance: GwtProjectsStore;
  private projects: GwtProjectInfo[] = [];
  private jettyProjects: GwtProjectInfo[] = [];
  // pomPath -> GwtProjectRuntime
  private runtimeMap = new Map<string, GwtProjectRuntime>();
  private runtimeJettyMap = new Map<string, GwtProjectRuntime>();
  
  // Reference to extension context for storage
  public static extensionContext: vscode.ExtensionContext;

  private constructor() {
    // Load saved projects and process states when store is created
    this.loadFromStorage();
  }

  /**
   * Set the extension context for storage
   */
  public static setContext(context: vscode.ExtensionContext) {
    GwtProjectsStore.extensionContext = context;
  }

  public static getInstance(): GwtProjectsStore {
    if (!this.instance) {
      this.instance = new GwtProjectsStore();
    }
    return this.instance;
  }

  /**
   * Load projects and process states from persistent storage
   */
  private loadFromStorage() {
    if (!GwtProjectsStore.extensionContext) {
      console.warn('GwtProjectsStore: No context available for loading data');
      return;
    }

    try {
      // Load GWT projects
      const savedProjects = GwtProjectsStore.extensionContext.workspaceState.get<GwtProjectInfo[]>(PROJECTS_STORAGE_KEY);
      if (savedProjects && savedProjects.length > 0) {
        this.projects = savedProjects;
        
        // Initialize runtime map for loaded projects
        for (const p of this.projects) {
          this.runtimeMap.set(p.pomPath, {});
        }
      }

      // Load Jetty projects
      const savedJettyProjects = GwtProjectsStore.extensionContext.workspaceState.get<GwtProjectInfo[]>(JETTY_PROJECTS_STORAGE_KEY);
      if (savedJettyProjects && savedJettyProjects.length > 0) {
        this.jettyProjects = savedJettyProjects;
        
        // Initialize runtime map for loaded Jetty projects
        for (const p of this.jettyProjects) {
          this.runtimeJettyMap.set(p.pomPath, {});
        }
      }

      // Load process metadata (which processes were running)
      const savedProcesses = GwtProjectsStore.extensionContext.workspaceState.get<ProcessMetadata>('gwtHelper.processStates');
      if (savedProcesses) {
        // Set the runtime metadata flags - we'll need to check if processes are still running
        for (const [pomPath, metadata] of Object.entries(savedProcesses)) {
          const runtime = this.runtimeMap.get(pomPath) || this.runtimeJettyMap.get(pomPath);
          if (runtime) {
            runtime.devModeProcessActive = metadata.devModeActive;
            runtime.codeServerProcessActive = metadata.codeServerActive;
            runtime.jettyProcessActive = metadata.jettyActive;
            runtime.compileProcessActive = metadata.compileActive;
            runtime.codeServerPort = metadata.codeServerPort;
          }
        }
      }
    } catch (error) {
      console.error('Error loading GWT projects from storage', error);
    }
  }

  /**
   * Save projects and process states to persistent storage
   */
  private saveToStorage() {
    if (!GwtProjectsStore.extensionContext) {
      console.warn('GwtProjectsStore: No context available for saving data');
      return;
    }

    try {
      // Save GWT projects
      GwtProjectsStore.extensionContext.workspaceState.update(PROJECTS_STORAGE_KEY, this.projects);
      
      // Save Jetty projects
      GwtProjectsStore.extensionContext.workspaceState.update(JETTY_PROJECTS_STORAGE_KEY, this.jettyProjects);

      // Save process state metadata
      const processMetadata: ProcessMetadata = {};
      
      // Collect metadata from both runtime maps
      const allRuntimeEntries = [...this.runtimeMap.entries(), ...this.runtimeJettyMap.entries()];
      
      for (const [pomPath, runtime] of allRuntimeEntries) {
        processMetadata[pomPath] = {
          devModeActive: !!runtime.devModeProcess || runtime.devModeProcessActive,
          codeServerActive: !!runtime.codeServerProcess || runtime.codeServerProcessActive,
          jettyActive: !!runtime.jettyProcess || runtime.jettyProcessActive,
          compileActive: !!runtime.compileProcess || runtime.compileProcessActive,
          codeServerPort: runtime.codeServerPort
        };
      }
      
      GwtProjectsStore.extensionContext.workspaceState.update('gwtHelper.processStates', processMetadata);
    } catch (error) {
      console.error('Error saving GWT projects to storage', error);
    }
  }

  public setProjects(list: GwtProjectInfo[]) {
    // Create a new runtime map to preserve runtime info from existing projects
    const newRuntimeMap = new Map<string, GwtProjectRuntime>();
    
    // Transfer existing runtime info to the new map
    for (const p of list) {
      const existingRuntime = this.runtimeMap.get(p.pomPath);
      if (existingRuntime) {
        // If the project already exists, preserve its runtime state
        newRuntimeMap.set(p.pomPath, existingRuntime);
      } else {
        // Otherwise, create a new empty runtime
        newRuntimeMap.set(p.pomPath, {});
      }
    }
    
    // Update the projects list and runtime map
    this.projects = list;
    this.runtimeMap = newRuntimeMap;
    
    this.saveToStorage();
    
    // Log diagnostics
    logInfo('store', `Updated GWT projects. Total: ${list.length}. Active processes preserved.`);
    this.logActiveProcesses('GWT');
  }

  public setJettyProjects(list: GwtProjectInfo[]) {
    // Create a new runtime map to preserve runtime info from existing projects
    const newRuntimeMap = new Map<string, GwtProjectRuntime>();
    
    // Transfer existing runtime info to the new map
    for (const p of list) {
      const existingRuntime = this.runtimeJettyMap.get(p.pomPath);
      if (existingRuntime) {
        // If the project already exists, preserve its runtime state
        newRuntimeMap.set(p.pomPath, existingRuntime);
      } else {
        // Otherwise, create a new empty runtime
        newRuntimeMap.set(p.pomPath, {});
      }
    }
    
    // Update the projects list and runtime map
    this.jettyProjects = list;
    this.runtimeJettyMap = newRuntimeMap;
    
    this.saveToStorage();
    
    // Log diagnostics
    logInfo('store', `Updated Jetty projects. Total: ${list.length}. Active processes preserved.`);
    this.logActiveProcesses('Jetty');
  }
  
  /**
   * Helper to log active processes for diagnostics
   */
  private logActiveProcesses(type: 'GWT' | 'Jetty') {
    const map = type === 'GWT' ? this.runtimeMap : this.runtimeJettyMap;
    const active: string[] = [];
    
    map.forEach((runtime, pomPath) => {
      if (runtime.devModeProcess) active.push(`DevMode (${pomPath})`);
      if (runtime.codeServerProcess) active.push(`CodeServer (${pomPath})`);
      if (runtime.jettyProcess) active.push(`Jetty (${pomPath})`);
      if (runtime.compileProcess) active.push(`Compile (${pomPath})`);
    });
    
    if (active.length > 0) {
      logInfo('store', `Active ${type} processes after refresh: ${active.join(', ')}`);
    }
  }

  public getJettProjects(): GwtProjectInfo[] {
    return this.jettyProjects;
  }

  public getProjects(): GwtProjectInfo[] {
    return this.projects;
  }

  public getProjectByPomPath(pomPath: string): GwtProjectInfo | undefined {
    return this.projects.find(p => p.pomPath === pomPath);
  }

  // DevMode/CodeServer/Jetty process management
  public setDevModeProcess(pomPath: string, proc: ChildProcess | undefined) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.devModeProcess = proc;
    rt.devModeProcessActive = !!proc;
    this.saveToStorage();
  }

  public setCodeServerProcess(pomPath: string, proc: ChildProcess | undefined) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.codeServerProcess = proc;
    rt.codeServerProcessActive = !!proc;
    this.saveToStorage();
  }

  public setJettyProcess(pomPath: string, proc: ChildProcess | undefined) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.jettyProcess = proc;
    rt.jettyProcessActive = !!proc;
    this.saveToStorage();
  }

  // Compilation
  public setCompileProcess(pomPath: string, proc: ChildProcess | undefined) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.compileProcess = proc;
    rt.compileProcessActive = !!proc;
    this.saveToStorage();
  }

  public setCodeServerPort(pomPath: string, port: number) {
    const rt = this.runtimeMap.get(pomPath);
    if (!rt) return;
    rt.codeServerPort = port;
    this.saveToStorage();
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

  public getCodeServerPort(pomPath: string): number | undefined {
    return this.runtimeMap.get(pomPath)?.codeServerPort;
  }

  public wasDevModeActive(pomPath: string): boolean {
    return !!this.runtimeMap.get(pomPath)?.devModeProcessActive;
  }

  public wasCodeServerActive(pomPath: string): boolean {
    return !!this.runtimeMap.get(pomPath)?.codeServerProcessActive;
  }

  public wasJettyActive(pomPath: string): boolean {
    return !!this.runtimeMap.get(pomPath)?.jettyProcessActive;
  }

  public wasCompileActive(pomPath: string): boolean {
    return !!this.runtimeMap.get(pomPath)?.compileProcessActive;
  }

  /**
   * Reset process active flags when checking status
   */
  public resetProcessActiveFlags(pomPath: string) {
    const rt = this.runtimeMap.get(pomPath);
    if (rt) {
      rt.devModeProcessActive = !!rt.devModeProcess;
      rt.codeServerProcessActive = !!rt.codeServerProcess;
      rt.jettyProcessActive = !!rt.jettyProcess;
      rt.compileProcessActive = !!rt.compileProcess;
      this.saveToStorage();
    }
  }

  // Stop all processes
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