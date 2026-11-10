import * as vscode from 'vscode';

import { startHeartbeat, stopHeartbeat } from './auth/heartbeat';
import { runSnapshotCapture } from './capture/save-snapshot';
import { connectOctopusAccount } from './commands/connect-account';
import { openOctopusWeb } from './commands/open-web';
import {
  handleCompareCommand,
  handleRollbackCommand,
  refreshSnapshotHistory,
} from './commands/rollback-command';
import { selectOctopusProject } from './commands/select-project';
import { createInitialViewState, type ExtensionViewState } from './state';
import {
  SnapshotHistoryViewProvider,
  SnapshotItem,
  WorkspaceItem,
  WorkspaceViewProvider,
} from './view/workspace-view';

export function activate(context: vscode.ExtensionContext) {
  let viewState: ExtensionViewState = createInitialViewState();

  const updateView = (updater: (state: ExtensionViewState) => ExtensionViewState) => {
    viewState = updater(viewState);
    workspaceViewProvider.refresh();
    historyViewProvider.refresh();
  };

  const getViewState = () => viewState;

  const workspaceViewProvider = new WorkspaceViewProvider(getViewState);
  const historyViewProvider = new SnapshotHistoryViewProvider(getViewState);

  startHeartbeat(context);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider<WorkspaceItem | SnapshotItem>(
      'octopus.workspaceView',
      workspaceViewProvider,
    ),
    vscode.window.registerTreeDataProvider<SnapshotItem | WorkspaceItem>(
      'octopus.snapshotHistoryView',
      historyViewProvider,
    ),
    { dispose: stopHeartbeat },
  );

  const openPanelCommand = vscode.commands.registerCommand('octopus.openControlPanel', async () => {
    await vscode.commands.executeCommand('workbench.view.extension.octopus');
  });

  const saveSnapshotCommand = vscode.commands.registerCommand('octopus.saveSnapshot', async () => {
    await runSnapshotCapture({
      context,
      updateView,
    });
    // Refresh snapshot history after saving snapshot
    await refreshSnapshotHistory({ context, getViewState, updateView, silent: true });
  });

  const connectAccountCommand = vscode.commands.registerCommand('octopus.connectAccount', async () => {
    await connectOctopusAccount({
      context,
      updateView,
    });
    await refreshSnapshotHistory({ context, getViewState, updateView, silent: true });
  });

  const selectProjectCommand = vscode.commands.registerCommand('octopus.selectProject', async () => {
    await selectOctopusProject({
      context,
      updateView,
    });
    await refreshSnapshotHistory({ context, getViewState, updateView, silent: true });
  });

  const openWebAppCommand = vscode.commands.registerCommand('octopus.openWebApp', async () => {
    await openOctopusWeb();
  });

  const rollbackSnapshotCommand = vscode.commands.registerCommand(
    'octopus.rollbackSnapshot',
    async (target?: unknown) => {
      await handleRollbackCommand(context, getViewState, updateView, target);
    },
  );

  const compareSnapshotCommand = vscode.commands.registerCommand(
    'octopus.compareSnapshot',
    async (target?: unknown) => {
      await handleCompareCommand(context, getViewState, updateView, target);
    },
  );

  const refreshSnapshotsCommand = vscode.commands.registerCommand(
    'octopus.refreshSnapshots',
    async () => {
      await refreshSnapshotHistory({ context, getViewState, updateView, silent: false });
    },
  );

  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBar.command = 'octopus.saveSnapshot';
  statusBar.text = '$(cloud-upload) OCTOPUS Save Snapshot';
  statusBar.tooltip = 'Capture workspace and save OCTOPUS snapshot';
  statusBar.show();

  const rollbackStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  rollbackStatusBar.command = 'octopus.rollbackSnapshot';
  rollbackStatusBar.text = '$(history) OCTOPUS Rollback';
  rollbackStatusBar.tooltip = 'Restore project to a previous snapshot';
  rollbackStatusBar.show();

  context.subscriptions.push(
    openPanelCommand,
    saveSnapshotCommand,
    connectAccountCommand,
    selectProjectCommand,
    openWebAppCommand,
    rollbackSnapshotCommand,
    compareSnapshotCommand,
    refreshSnapshotsCommand,
    statusBar,
    rollbackStatusBar,
  );

  // Initial silent load of snapshots if session is active
  setTimeout(() => {
    void refreshSnapshotHistory({ context, getViewState, updateView, silent: true });
  }, 1000);
}

export function deactivate() {
  stopHeartbeat();
}
