import * as vscode from 'vscode';

import type { SnapshotRecord } from '../contracts/snapshot';
import type { ExtensionViewState } from '../state';

function createThemeIcon(id: string, color?: vscode.ThemeColor): vscode.ThemeIcon {
  return new (vscode.ThemeIcon as unknown as new (iconId: string, iconColor?: vscode.ThemeColor) => vscode.ThemeIcon)(
    id,
    color,
  );
}

export class WorkspaceItem extends vscode.TreeItem {
  constructor(
    label: string,
    description?: string,
    command?: vscode.Command,
    collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
  ) {
    super(label, collapsibleState);
    if (description) {
      this.description = description;
    }

    if (command) {
      this.command = command;
    }
  }
}

export class SnapshotItem extends vscode.TreeItem {
  constructor(
    public readonly snapshot: SnapshotRecord,
    public readonly isLatest: boolean,
  ) {
    const rawName = snapshot.captureMetadata?.name;
    const name = typeof rawName === 'string' && rawName.trim().length > 0 ? rawName.trim() : snapshot.id;
    const dateStr = new Date(snapshot.createdAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const displayDesc = isLatest ? `${dateStr} • (Latest)` : dateStr;

    super(name, vscode.TreeItemCollapsibleState.None);

    this.description = displayDesc;
    this.contextValue = isLatest ? 'snapshotItemLatest' : 'snapshotItem';

    const fileSizeStr = snapshot.archiveSizeBytes
      ? `${(snapshot.archiveSizeBytes / 1024).toFixed(1)} KB`
      : 'Unknown size';
    const filesCountStr = snapshot.fileCount !== null ? `${snapshot.fileCount} files` : 'Files unknown';

    this.tooltip = [
      `Snapshot: ${snapshot.id}`,
      `Created: ${new Date(snapshot.createdAt).toLocaleString()}`,
      `Status: ${snapshot.status}`,
      `Contents: ${filesCountStr} (${fileSizeStr})`,
      ...(isLatest ? ['⭐ Latest workspace snapshot'] : []),
      'Click rollback icon to restore, or diff icon to compare.',
    ].join('\n');

    if (isLatest) {
      this.iconPath = createThemeIcon('history', new vscode.ThemeColor('charts.green'));
    } else if (snapshot.status === 'COMPLETED') {
      this.iconPath = createThemeIcon('git-commit');
    } else if (snapshot.status === 'PROCESSING' || snapshot.status === 'PENDING') {
      this.iconPath = createThemeIcon('sync~spin');
    } else {
      this.iconPath = createThemeIcon('error', new vscode.ThemeColor('charts.red'));
    }
  }
}

export class WorkspaceViewProvider implements vscode.TreeDataProvider<WorkspaceItem | SnapshotItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<WorkspaceItem | SnapshotItem | undefined | null>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly getState: () => ExtensionViewState) {}

  refresh() {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: WorkspaceItem | SnapshotItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: WorkspaceItem | SnapshotItem): Array<WorkspaceItem | SnapshotItem> {
    const state = this.getState();

    // If expanding the "Snapshot History" category in Workspace View
    if (element && element.label === 'Snapshot History') {
      if (state.isLoadingSnapshots) {
        return [new WorkspaceItem('Loading snapshots...', 'Please wait')];
      }

      if (!state.snapshots || state.snapshots.length === 0) {
        return [new WorkspaceItem('No snapshots recorded', 'Save a snapshot to begin history')];
      }

      return state.snapshots.map((snap, idx) => new SnapshotItem(snap, idx === 0));
    }

    if (element) {
      return [];
    }

    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    const workspaceName = workspaceFolders.length > 0 ? workspaceFolders.map((item) => item.name).join(', ') : 'No workspace open';
    const exclusionPreview = state.exclusionPreview.length > 0 ? state.exclusionPreview.join(', ') : 'No capture run yet';

    const historyCountDesc = state.isLoadingSnapshots
      ? 'Loading...'
      : state.snapshots.length > 0
        ? `${state.snapshots.length} available`
        : 'None';

    const saveSnapshotItem = new WorkspaceItem('Save Snapshot', 'Capture workspace and upload', {
      title: 'Save Snapshot',
      command: 'octopus.saveSnapshot',
    });
    saveSnapshotItem.iconPath = createThemeIcon('cloud-upload');

    const rollbackItem = new WorkspaceItem('Rollback to Snapshot', 'Restore project from a previous snapshot', {
      title: 'Rollback to Snapshot',
      command: 'octopus.rollbackSnapshot',
    });
    rollbackItem.iconPath = createThemeIcon('history');

    const compareItem = new WorkspaceItem('Compare Snapshot', 'Compare workspace with a previous snapshot', {
      title: 'Compare Snapshot',
      command: 'octopus.compareSnapshot',
    });
    compareItem.iconPath = createThemeIcon('diff');

    const historyItem = new WorkspaceItem(
      'Snapshot History',
      historyCountDesc,
      undefined,
      vscode.TreeItemCollapsibleState.Expanded,
    );
    historyItem.iconPath = createThemeIcon('history');

    const connectAccountItem = new WorkspaceItem('Connect Account', state.connectedUser ?? 'Not connected', {
      title: 'Connect OCTOPUS Account',
      command: 'octopus.connectAccount',
    });
    connectAccountItem.iconPath = createThemeIcon('account');

    const selectProjectItem = new WorkspaceItem('Select Project', state.selectedProject?.name ?? 'No project selected', {
      title: 'Select Project',
      command: 'octopus.selectProject',
    });
    selectProjectItem.iconPath = createThemeIcon('folder-active');

    const activeWorkspaceItem = new WorkspaceItem('Active workspace', workspaceName);
    activeWorkspaceItem.iconPath = createThemeIcon('root-folder');

    const lastCaptureItem = new WorkspaceItem('Last capture', state.lastCaptureSummary ?? 'No snapshot captured yet');
    lastCaptureItem.iconPath = createThemeIcon('clock');

    const exclusionsItem = new WorkspaceItem('Exclusions', exclusionPreview);
    exclusionsItem.iconPath = createThemeIcon('filter');

    const openWebItem = new WorkspaceItem('Open OCTOPUS Web App', 'Manage snapshots and project workspace', {
      title: 'Open OCTOPUS Web App',
      command: 'octopus.openWebApp',
    });
    openWebItem.iconPath = createThemeIcon('link-external');

    return [
      saveSnapshotItem,
      rollbackItem,
      compareItem,
      historyItem,
      connectAccountItem,
      selectProjectItem,
      activeWorkspaceItem,
      lastCaptureItem,
      exclusionsItem,
      openWebItem,
    ];
  }
}

export class SnapshotHistoryViewProvider implements vscode.TreeDataProvider<SnapshotItem | WorkspaceItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<SnapshotItem | WorkspaceItem | undefined | null>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  constructor(private readonly getState: () => ExtensionViewState) {}

  refresh() {
    this.onDidChangeTreeDataEmitter.fire();
  }

  getTreeItem(element: SnapshotItem | WorkspaceItem): vscode.TreeItem {
    return element;
  }

  getChildren(): Array<SnapshotItem | WorkspaceItem> {
    const state = this.getState();

    if (state.isLoadingSnapshots) {
      const loading = new WorkspaceItem('Loading snapshots...', 'Fetching history from OCTOPUS');
      loading.iconPath = createThemeIcon('sync~spin');
      return [loading];
    }

    if (!state.connectedUser) {
      const connect = new WorkspaceItem('Connect Account', 'Sign in to view snapshot history', {
        title: 'Connect Account',
        command: 'octopus.connectAccount',
      });
      connect.iconPath = createThemeIcon('account');
      return [connect];
    }

    if (!state.selectedProject) {
      const selectProj = new WorkspaceItem('Select Project', 'Select a project to view snapshots', {
        title: 'Select Project',
        command: 'octopus.selectProject',
      });
      selectProj.iconPath = createThemeIcon('folder-active');
      return [selectProj];
    }

    if (!state.snapshots || state.snapshots.length === 0) {
      const empty = new WorkspaceItem('No snapshots found', 'Create a snapshot to populate history', {
        title: 'Save Snapshot',
        command: 'octopus.saveSnapshot',
      });
      empty.iconPath = createThemeIcon('info');
      return [empty];
    }

    return state.snapshots.map((snapshot, index) => new SnapshotItem(snapshot, index === 0));
  }
}
