import * as vscode from 'vscode';
import { GwtProjectInfo } from './types';
import { GwtProjectsStore } from './gwtProjectsStore';
import { ProcessStatsHelper, formatTime } from './processStatsHelper';
import * as path from 'path';

/**
* TreeDataProvider que exibe:
* - Nós "Refresh/StopAll/Debug" no topo
* - Um nó por projeto (ProjectNode)
* - Cada ProjectNode se expande em subitens (DevModeItem, CodeServerItem, etc.) com labels/ícones dinâmicos
*/
export class GWTUiProvider implements vscode.TreeDataProvider<GwtTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GwtTreeItem | undefined | void>();
  public readonly onDidChangeTreeData: vscode.Event<GwtTreeItem | undefined | void> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(element: GwtTreeItem): vscode.TreeItem {
    return element;
  }

  public getChildren(element?: GwtTreeItem): vscode.ProviderResult<GwtTreeItem[]> {
    if (!element) {
      // Root node: global items + project list
      const store = GwtProjectsStore.getInstance();
      const gwtProjects = store.getProjects();         
      const jettyProjects = store.getJettProjects(); 

      const topLevelItems: GwtTreeItem[] = [];
      

      const statsHelper = ProcessStatsHelper.getInstance();
      const averageCompileTime = statsHelper.getAverageCompileTime();
      const lastCompileTime = statsHelper.getLastCompileTime();
      
      topLevelItems.push(new InfoNode(
        "Statistics", [
          averageCompileTime > 0 ? `Average compilation time: ${formatTime(averageCompileTime)}` : "No registered builds",
          lastCompileTime ? `Last build: ${formatTime(lastCompileTime)}` : "",
          `Active processes: ${store.getAllProcesses().length}`
        ],
        "dashboard"
      ));
      
      // Comandos principais
      const actionItems: GwtTreeItem[] = [];
      actionItems.push(new SimpleCommandItem("Refresh Projects", "gwt.refreshProjects", "refresh"));
      actionItems.push(new SimpleCommandItem("Stop All", "gwt.stopAll", "close-all"));
      actionItems.push(new SimpleCommandItem("Open Debug", "gwt.openDebug", "debug-alt"));
      actionItems.push(new SimpleCommandItem("Show Logs", "gwt.showLogs", "output"));
      actionItems.push(new SimpleCommandItem("Configs", "gwt.openSettings", "gear"));
      topLevelItems.push(new FolderNode("Ações", actionItems, "play-circle"));

      if (gwtProjects.length > 0) {
        topLevelItems.push(new FolderNode("GWT Projects", gwtProjects, "folder"));
      }

      if (jettyProjects.length > 0) {
        topLevelItems.push(new FolderNode("Jetty Projects", jettyProjects, "folder"));
      }

      return topLevelItems;
    }
    
    if (element instanceof FolderNode) {
      if (element.folderLabel === "Ações") {
        return element.children as GwtTreeItem[];
      }
      
      if (Array.isArray(element.projects)) {
        return (element.projects as GwtProjectInfo[]).map(p => new ProjectNode(p, element));
      }
      
      return [];
    }
    
    if (element instanceof ProjectNode) {
      const folderNode = element.parent as FolderNode;
      const items = [];
      
      if (folderNode.folderLabel === "GWT Projects") {
        items.push(new DevModeItem(element.project));
        items.push(new CodeServerItem(element.project));
        items.push(new CompileItem(element.project));
      }
      
      if (folderNode.folderLabel === "Jetty Projects") {
        items.push(new JettyItem(element.project));
      }
      
      return items;
    }

    return [];
  }
}


export abstract class GwtTreeItem extends vscode.TreeItem {
  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
  }
}


export class InfoNode extends GwtTreeItem {
  constructor(label: string, infoLines: string[], icon: string) {
    super(label, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(icon); 
    const validLines = infoLines.filter(line => line.trim() !== '');
    this.description = validLines.length > 0 ? validLines[0] : "";
  
    if (validLines.length > 1) {
      this.tooltip = validLines.join('\n');
    }
  }
}

export class SimpleCommandItem extends GwtTreeItem {
  constructor(label: string, commandId: string, icon: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.iconPath = new vscode.ThemeIcon(icon);
    this.command = {
      command: commandId,
      title: label
    };
  }
}

export class FolderNode extends GwtTreeItem {
  constructor(
    public folderLabel: string,
    public projects: GwtProjectInfo[] | GwtTreeItem[],
    icon: string
  ) {
    super(folderLabel, vscode.TreeItemCollapsibleState.Expanded);
    this.iconPath = new vscode.ThemeIcon(icon);
    
    if (Array.isArray(this.projects) && this.projects.length > 0 && 'pomPath' in this.projects[0]) {
      this.description = `(${this.projects.length})`;
    }
    
    if (folderLabel === "GWT Projects" || folderLabel === "Jetty Projects") {
      const projectList = (this.projects as GwtProjectInfo[])
        .map(p => p.moduleName || path.basename(p.pomPath))
        .join('\n• ');
      this.tooltip = `${folderLabel}:\n• ${projectList}`;
    }
    
    this.children = this.projects as GwtTreeItem[];
  }
  
  public children: GwtTreeItem[];
}

/** Nó de projeto. Expandirá em subitens (DevMode, CodeServer, etc.). */
export class ProjectNode extends GwtTreeItem {
  constructor(public project: GwtProjectInfo, public parent: FolderNode) {
    super(
      project.moduleName || path.basename(path.dirname(project.pomPath)),
      vscode.TreeItemCollapsibleState.Expanded
    );
    
    this.description = path.basename(path.dirname(project.pomPath));
    this.iconPath = new vscode.ThemeIcon("project");
    this.tooltip = `Caminho: ${project.pomPath}\nVersão: ${project.pluginVersion || 'N/A'}`;
    
    // Para projetos GWT, adicionar a porta do CodeServer na descrição, se disponível
    const store = GwtProjectsStore.getInstance();
    const codeServerPort = store.getCodeServerPort(project.pomPath);
    if (codeServerPort) {
      this.description = `${this.description} (CodeServer: ${codeServerPort})`;
    }
  }
}

export class DevModeItem extends GwtTreeItem {
  constructor(public project: GwtProjectInfo) {
    super("", vscode.TreeItemCollapsibleState.None);
    this.updateLabelAndCommand();
  }

  private updateLabelAndCommand() {
    const store = GwtProjectsStore.getInstance();
    const process = store.getDevModeProcess(this.project.pomPath);
    const isRunning = !!process;
    const wasRunning = store.wasDevModeActive(this.project.pomPath);

    let statsInfo = "";
    if (process?.pid) {
      const stats = ProcessStatsHelper.getInstance().getProcessStats(process.pid);
      if (stats) {
        const runningTime = new Date().getTime() - stats.startTime.getTime();
        statsInfo = ` (${formatTime(runningTime)})`;
      }
    }

    this.label = isRunning ? `Stop DevMode${statsInfo}` : 
                 wasRunning ? "DevMode (Disconnected)" : 
                 "Run DevMode";
                 
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : 
                                         wasRunning ? "warning" : 
                                         "play");

    // Tooltip com mais informações
    if (isRunning && process?.pid) {
      const stats = ProcessStatsHelper.getInstance().getProcessStats(process.pid);
      if (stats) {
        this.tooltip = `PID: ${stats.pid}\nStarted: ${stats.startTime.toLocaleTimeString()}\nRunning for: ${formatTime(new Date().getTime() - stats.startTime.getTime())}`;
        
        if (stats.importantLogs.length > 0) {
          this.tooltip += `\n\nLogs importantes:\n${stats.importantLogs.join('\n')}`;
        }
      } else {
        this.tooltip = `PID: ${process.pid}`;
      }
    }

    // Comandos
    if (!isRunning && wasRunning) {
      this.command = {
        command: "gwt.resetDevModeState",
        title: "Reset DevMode state",
        arguments: [this.project]
      };
    } else {
      this.command = {
        command: isRunning ? "gwt.stopDevModeForProject" : "gwt.runDevModeForProject",
        title: this.label,
        arguments: [this.project]
      };
    }
  }
}

export class CodeServerItem extends GwtTreeItem {
  constructor(public project: GwtProjectInfo) {
    super("", vscode.TreeItemCollapsibleState.None);
    this.updateLabelAndCommand();
  }

  private updateLabelAndCommand() {
    const store = GwtProjectsStore.getInstance();
    const process = store.getCodeServerProcess(this.project.pomPath);
    const isRunning = !!process;
    const wasRunning = store.wasCodeServerActive(this.project.pomPath);
    const port = store.getCodeServerPort(this.project.pomPath);

    let statsInfo = "";
    if (process?.pid) {
      const stats = ProcessStatsHelper.getInstance().getProcessStats(process.pid);
      if (stats) {
        const runningTime = new Date().getTime() - stats.startTime.getTime();
        statsInfo = ` (${formatTime(runningTime)})`;
      }
    }

    // Se temos uma porta mas nenhum processo, pode ainda estar rodando externamente
    const potentiallyRunning = !isRunning && wasRunning && port !== undefined;

    this.label = isRunning ? `Stop CodeServer${statsInfo}` : 
                 potentiallyRunning ? `CodeServer (Port ${port})` : 
                 "Run CodeServer";
    
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : 
                                         potentiallyRunning ? "warning" : 
                                         "run");

    // Tooltip com mais informações
    if (isRunning && process?.pid) {
      const stats = ProcessStatsHelper.getInstance().getProcessStats(process.pid);
      if (stats) {
        this.tooltip = `PID: ${stats.pid}\nPort: ${port || 'Unknown'}\nStarted: ${stats.startTime.toLocaleTimeString()}\nRunning for: ${formatTime(new Date().getTime() - stats.startTime.getTime())}`;
        
        if (stats.importantLogs.length > 0) {
          this.tooltip += `\n\nImportant Logs:\n${stats.importantLogs.join('\n')}`;
        }
      } else {
        this.tooltip = `PID: ${process.pid}\nPort: ${port || 'Unknown'}`;
      }
    } else if (potentiallyRunning) {
      this.tooltip = `The port ${port} may be in use by a CodeServer that is not being monitored by the extension`;
    }

    // Comandos
    if (potentiallyRunning) {
      this.command = {
        command: "gwt.resetCodeServerState",
        title: "Reset CodeServer state",
        arguments: [this.project]
      };
    } else {
      this.command = {
        command: isRunning ? "gwt.stopCodeServerForProject" : "gwt.runCodeServerForProject",
        title: this.label,
        arguments: [this.project]
      };
    }
  }
}

export class CompileItem extends GwtTreeItem {
  constructor(public project: GwtProjectInfo) {
    super("", vscode.TreeItemCollapsibleState.None);
    this.updateLabelAndCommand();
  }

  private updateLabelAndCommand() {
    const store = GwtProjectsStore.getInstance();
    const process = store.getCompileProcess(this.project.pomPath);
    const isRunning = !!process;
    const wasRunning = store.wasCompileActive(this.project.pomPath);

    let statsInfo = "";
    if (process?.pid) {
      const stats = ProcessStatsHelper.getInstance().getProcessStats(process.pid);
      if (stats) {
        const runningTime = new Date().getTime() - stats.startTime.getTime();
        statsInfo = ` (${formatTime(runningTime)})`;
      }
    }

    this.label = isRunning ? `Stop Compile${statsInfo}` : 
                 wasRunning ? "Compile (Disconnected)" : 
                 "Run Compile";
    
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : 
                                         wasRunning ? "warning" : 
                                         "run");

    if (isRunning && process?.pid) {
      const stats = ProcessStatsHelper.getInstance().getProcessStats(process.pid);
      if (stats) {
        this.tooltip = `PID: ${stats.pid}\nStarted: ${stats.startTime.toLocaleTimeString()}\nRunning for: ${formatTime(new Date().getTime() - stats.startTime.getTime())}`;
        
        if (stats.importantLogs.length > 0) {
          this.tooltip += `\n\nImportant Logs:\n${stats.importantLogs.join('\n')}`;
        }
      } else {
        this.tooltip = `PID: ${process.pid}`;
      }
    }

    // Comandos
    if (!isRunning && wasRunning) {
      this.command = {
        command: "gwt.resetCompileState",
        title: "Reset Compile state",
        arguments: [this.project]
      };
    } else {
      this.command = {
        command: isRunning ? "gwt.stopCompileForProject" : "gwt.runCompileForProject",
        title: this.label,
        arguments: [this.project]
      };
    }
  }
}

export class JettyItem extends GwtTreeItem {
  constructor(public project: GwtProjectInfo) {
    super("", vscode.TreeItemCollapsibleState.None);
    this.updateLabelAndCommand();
  }

  private updateLabelAndCommand() {
    const store = GwtProjectsStore.getInstance();
    const process = store.getJettyProcess(this.project.pomPath);
    const isRunning = !!process;
    const wasRunning = store.wasJettyActive(this.project.pomPath);

    // Obter estatísticas, se disponíveis
    let statsInfo = "";
    if (process?.pid) {
      const stats = ProcessStatsHelper.getInstance().getProcessStats(process.pid);
      if (stats) {
        const runningTime = new Date().getTime() - stats.startTime.getTime();
        statsInfo = ` (${formatTime(runningTime)})`;
      }
    }

    this.label = isRunning ? `Stop Jetty${statsInfo}` : 
                 wasRunning ? "Jetty (Disconnected)" : 
                 "Start Jetty";
    
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : 
                                         wasRunning ? "warning" : 
                                         "server-environment");

    if (isRunning && process?.pid) {
      const stats = ProcessStatsHelper.getInstance().getProcessStats(process.pid);
      if (stats) {
        this.tooltip = `PID: ${stats.pid}\nStarted: ${stats.startTime.toLocaleTimeString()}\nRunning for: ${formatTime(new Date().getTime() - stats.startTime.getTime())}`;
        
        if (stats.importantLogs.length > 0) {
          this.tooltip += `\n\nImportant Logs:\n${stats.importantLogs.join('\n')}`;
        }
      } else {
        this.tooltip = `PID: ${process.pid}`;
      }
    }

    // Comandos
    if (!isRunning && wasRunning) {
      this.command = {
        command: "gwt.resetJettyState",
        title: "Reset Jetty state",
        arguments: [this.project]
      };
    } else {
      this.command = {
        command: isRunning ? "gwt.stopJettyForProject" : "gwt.startJettyForProject",
        title: this.label,
        arguments: [this.project]
      };
    }
  }
}

export const gwtUiProviderInstance = new GWTUiProvider();