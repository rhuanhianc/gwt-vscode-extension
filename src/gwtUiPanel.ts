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

/**
* Each of the classes below represents a "subitem" of the project.
* The idea is to show "Run DevMode" or "Stop DevMode" dynamically,
* depending on the state of the process in the ProjectsStore.
*/
export class DevModeItem extends GwtTreeItem {
  constructor(public project: GwtProjectInfo) {
    super("", vscode.TreeItemCollapsibleState.None);
    this.updateLabelAndCommand();
  }

  private updateLabelAndCommand() {
    const store = GwtProjectsStore.getInstance();
    const isRunning = !!store.getDevModeProcess(this.project.pomPath);

    this.label = isRunning ? "Stop DevMode" : "Run DevMode";
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : "play");

    this.command = {
      command: isRunning ? "gwt.stopDevModeForProject" : "gwt.runDevModeForProject",
      title: this.label,
      arguments: [this.project]
    };
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

    this.label = isRunning ? "Stop CodeServer" : "Run CodeServer";
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : "run");

    this.command = {
      command: isRunning ? "gwt.stopCodeServerForProject" : "gwt.runCodeServerForProject",
      title: this.label,
      arguments: [this.project]
    };
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

    this.label = isRunning ? "Stop Compile" : "Run Compile";
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : "run");

    this.command = {
      command: isRunning ? "gwt.stopCompileForProject" : "gwt.runCompileForProject",
      title: this.label,
      arguments: [this.project]
    };
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

    this.label = isRunning ? "Stop Jetty" : "Start Jetty";
    this.iconPath = new vscode.ThemeIcon(isRunning ? "stop" : "server-process");

    this.command = {
      command: isRunning ? "gwt.stopJettyForProject" : "gwt.startJettyForProject",
      title: this.label,
      arguments: [this.project]
    };
  }
}
export const gwtUiProviderInstance = new GWTUiProvider();
