import * as vscode from 'vscode';
import { GwtProjectInfo } from './types';
import { GwtProjectsStore } from './gwtProjectsStore';

/**
* TreeDataProvider that displays:
* - "Refresh/StopAll/Debug" nodes at the top
* - One node per project (ProjectNode)
* - Each ProjectNode expands into subitems (DevModeItem, CodeServerItem, etc.) with dynamic labels/icons
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
      const Gwtprojects = store.getProjects();         
      const jettyProjects = store.getJettProjects(); 

      const topLevelItems: GwtTreeItem[] = [];
      topLevelItems.push(new SimpleCommandItem("Refresh Projects", "gwt.refreshProjects", "refresh"));
      topLevelItems.push(new SimpleCommandItem("Stop All", "gwt.stopAll", "close-all"));
      topLevelItems.push(new SimpleCommandItem("Open Debug", "gwt.openDebug", "debug-alt"));
    //  topLevelItems.push(new SimpleCommandItem("Show Logs", "gwt.showLogs", "output"));
      topLevelItems.push(new SimpleCommandItem("Configs", "gwt.openSettings", "gear"));

      if (Gwtprojects.length > 0) {
        topLevelItems.push(new FolderNode("GWT Projects", Gwtprojects, "folder"));
      }

      if (jettyProjects.length > 0) {
        topLevelItems.push(new FolderNode("Jetty Projects", jettyProjects, "folder"));
      }

      return topLevelItems;
    }
    if (element instanceof FolderNode) {
      return element.projects.map(p => new ProjectNode(p, element));
    }
    if (element instanceof ProjectNode) {
      // get the folderNode name to check if it is a jetty project
      const folderNode = element.parent as FolderNode;
      const items = [];
      if(folderNode.folderLabel === "GWT Projects"){
        items.push(new DevModeItem(element.project));
        items.push(new CodeServerItem(element.project));
        items.push(new CompileItem(element.project));
      }
      if(folderNode.folderLabel === "Jetty Projects"){
        items.push(new JettyItem(element.project));
      }
      return items;
    }

    return [];
  }
}

/** Base class for all TreeView items. */
export abstract class GwtTreeItem extends vscode.TreeItem {
  constructor(label: string, collapsibleState: vscode.TreeItemCollapsibleState) {
    super(label, collapsibleState);
  }
}

/** Simple item for fixed commands (no children). */
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

/** Folder that groups projects (e.g.: "GWT Projects", "Jetty Projects"). */
export class FolderNode extends GwtTreeItem {
  constructor(
    public folderLabel: string,
    public projects: GwtProjectInfo[],
    icon: string
  ) {
    super(folderLabel, vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon(icon);
  }
}

/** Project node 1. Will expand into subitems (DevMode, CodeServer, etc.). */
export class ProjectNode extends GwtTreeItem {
  constructor(public project: GwtProjectInfo, public parent: FolderNode) {
    super(
      project.moduleName || project.pomPath,
      vscode.TreeItemCollapsibleState.Collapsed
    );
    this.description = project.pomPath;
    this.iconPath = new vscode.ThemeIcon("project");
  }
}


export class DevModeItem extends GwtTreeItem {
  constructor(public project: GwtProjectInfo) {
    super("", vscode.TreeItemCollapsibleState.None);
    this.updateLabelAndCommand();
  }

  private updateLabelAndCommand() {
    const store = GwtProjectsStore.getInstance();
    // Check both current process and saved state
    const isRunning = !!store.getDevModeProcess(this.project.pomPath);
    const wasRunning = store.wasDevModeActive(this.project.pomPath);

    this.label = isRunning ? "Stop DevMode" : wasRunning ? "DevMode (Disconnected)" : "Run DevMode";
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : wasRunning ? "warning" : "play");

    // If it was running but now disconnected, show a different command
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
    const isRunning = !!store.getCodeServerProcess(this.project.pomPath);
    const wasRunning = store.wasCodeServerActive(this.project.pomPath);
    const port = store.getCodeServerPort(this.project.pomPath);

    // If we have a port but no process, it might still be running externally
    const potentiallyRunning = !isRunning && wasRunning && port !== undefined;

    this.label = isRunning ? "Stop CodeServer" : 
                potentiallyRunning ? `CodeServer (Port ${port})` : 
                "Run CodeServer";
    
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : 
                                         potentiallyRunning ? "warning" : 
                                         "run");

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
    const isRunning = !!store.getCompileProcess(this.project.pomPath);
    const wasRunning = store.wasCompileActive(this.project.pomPath);

    this.label = isRunning ? "Stop Compile" : 
                wasRunning ? "Compile (Disconnected)" : 
                "Run Compile";
    
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : 
                                         wasRunning ? "warning" : 
                                         "run");

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
    const isRunning = !!store.getJettyProcess(this.project.pomPath);
    const wasRunning = store.wasJettyActive(this.project.pomPath);

    this.label = isRunning ? "Stop Jetty" : 
                wasRunning ? "Jetty (Disconnected)" : 
                "Start Jetty";
    
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : 
                                         wasRunning ? "warning" : 
                                         "server-process");

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
