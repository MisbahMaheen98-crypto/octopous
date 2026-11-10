import * as vscode from 'vscode';

import { me } from '../api/auth';
import { listSnapshots } from '../api/snapshots';
import { getSessionCookie } from '../auth/session';
import { getWorkspaceRoots } from '../capture/workspace-detection';
import { getRequestTimeoutMs } from '../config';
import type { SnapshotRecord } from '../contracts/snapshot';
import { ensureProjectSelection } from '../projects/selection';
import { runSnapshotComparison } from '../rollback/compare-service';
import {
  executeProjectRollback,
  formatRollbackReportMarkdown,
  getSnapshotDisplayName,
} from '../rollback/rollback-service';
import type { ExtensionViewState } from '../state';
import { SnapshotItem } from '../view/workspace-view';

/**
 * Ensures authenticated session cookie is available, prompting if necessary.
 */
async function resolveSessionCookie(context: vscode.ExtensionContext): Promise<string | null> {
  const cookie = await getSessionCookie(context);
  if (cookie) {
    try {
      await me({ cookie, timeoutMs: getRequestTimeoutMs() });
      return cookie;
    } catch {
      // Stale cookie
    }
  }

  const connectAction = await vscode.window.showInformationMessage(
    'Sign in to OCTOPUS to access snapshot history and rollback.',
    'Connect Account',
    'Cancel',
  );

  if (connectAction === 'Connect Account') {
    await vscode.commands.executeCommand('octopus.connectAccount');
    return (await getSessionCookie(context)) ?? null;
  }

  return null;
}

/**
 * Resolves active snapshot target, either from clicked TreeItem or via QuickPick.
 */
async function resolveTargetSnapshot(
  arg: unknown,
  snapshots: SnapshotRecord[],
  actionName: string,
): Promise<SnapshotRecord | null> {
  if (arg instanceof SnapshotItem) {
    return arg.snapshot;
  }

  if (arg && typeof arg === 'object' && 'id' in arg && 'projectId' in arg) {
    return arg as SnapshotRecord;
  }

  if (snapshots.length === 0) {
    vscode.window.showWarningMessage('No snapshots available for the current project.');
    return null;
  }

  type PickItem = vscode.QuickPickItem & { snapshot: SnapshotRecord };
  const items: PickItem[] = snapshots.map((s, index) => {
    const name = getSnapshotDisplayName(s);
    const date = new Date(s.createdAt).toLocaleString();
    const isLatest = index === 0;
    return {
      label: isLatest ? `$(star) ${name}` : `$(git-commit) ${name}`,
      description: isLatest ? `${date} • (Latest)` : date,
      detail: `ID: ${s.id} | Files: ${s.fileCount ?? '?'} | Status: ${s.status}`,
      snapshot: s,
    };
  });

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: `Select snapshot to ${actionName}`,
  });

  return selected ? selected.snapshot : null;
}

/**
 * Loads snapshots for the currently selected project and updates extension state.
 */
export async function refreshSnapshotHistory(options: {
  context: vscode.ExtensionContext;
  getViewState: () => ExtensionViewState;
  updateView: (updater: (state: ExtensionViewState) => ExtensionViewState) => void;
  silent?: boolean;
}): Promise<SnapshotRecord[]> {
  const { context, getViewState, updateView, silent } = options;
  const state = getViewState();

  const roots = getWorkspaceRoots();
  if (roots.length === 0) {
    return [];
  }

  const cookie = await getSessionCookie(context);
  if (!cookie) {
    return [];
  }

  let project = state.selectedProject;
  if (!project) {
    const workspaceName = roots.map((r) => r.name).join(', ');
    const workspaceKey = roots.map((r) => `${r.name}:${r.fsPath}`).sort().join('|');
    project = await ensureProjectSelection({
      context,
      sessionCookie: cookie,
      workspaceKey,
      workspaceName,
    });
    if (project) {
      updateView((s) => ({ ...s, selectedProject: project }));
    }
  }

  if (!project) {
    return [];
  }

  updateView((s) => ({ ...s, isLoadingSnapshots: true }));

  try {
    const snapshots = await listSnapshots({
      projectId: project.id,
      cookie,
      timeoutMs: getRequestTimeoutMs(),
    });

    // Sort latest first
    const sorted = [...snapshots].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    updateView((s) => ({
      ...s,
      snapshots: sorted,
      isLoadingSnapshots: false,
    }));

    if (!silent) {
      vscode.window.showInformationMessage(`Refreshed ${sorted.length} snapshots for project "${project.name}".`);
    }

    return sorted;
  } catch (error) {
    updateView((s) => ({ ...s, isLoadingSnapshots: false }));
    if (!silent) {
      vscode.window.showErrorMessage(
        `Failed to refresh snapshots: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return [];
  }
}

/**
 * Handles the `octopus.rollbackSnapshot` command.
 */
export async function handleRollbackCommand(
  context: vscode.ExtensionContext,
  getViewState: () => ExtensionViewState,
  updateView: (updater: (state: ExtensionViewState) => ExtensionViewState) => void,
  target?: unknown,
) {
  const roots = getWorkspaceRoots();
  const firstRoot = roots[0];
  if (!firstRoot) {
    vscode.window.showWarningMessage('Open a workspace folder in VS Code to perform a snapshot rollback.');
    return;
  }

  const cookie = await resolveSessionCookie(context);
  if (!cookie) {
    return;
  }

  const state = getViewState();
  let project = state.selectedProject;

  if (!project) {
    const workspaceName = roots.map((r) => r.name).join(', ');
    const workspaceKey = roots.map((r) => `${r.name}:${r.fsPath}`).sort().join('|');
    project = await ensureProjectSelection({
      context,
      sessionCookie: cookie,
      workspaceKey,
      workspaceName,
    });
    if (project) {
      updateView((s) => ({ ...s, selectedProject: project }));
    }
  }

  if (!project) {
    vscode.window.showWarningMessage('Select an OCTOPUS project before rolling back.');
    return;
  }

  // Ensure snapshots list is fresh if target wasn't explicitly supplied
  let snapshots = state.snapshots;
  if (!target && snapshots.length === 0) {
    snapshots = await refreshSnapshotHistory({ context, getViewState, updateView, silent: true });
  }

  const snapshot = await resolveTargetSnapshot(target, snapshots, 'rollback to');
  if (!snapshot) {
    return;
  }

  const snapshotName = getSnapshotDisplayName(snapshot);
  const workspaceRoot = firstRoot.fsPath;

  try {
    const report = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Restoring ${snapshotName}...`,
        cancellable: true,
      },
      async (progress, cancellationToken) => {
        return executeProjectRollback(
          {
            snapshot,
            workspaceRoot,
            sessionCookie: cookie,
            projectId: project.id,
            ...(cancellationToken ? { cancellationToken } : {}),
          },
          progress,
        );
      },
    );

    // Refresh history
    await refreshSnapshotHistory({ context, getViewState, updateView, silent: true });

    // Show success message with View Report action
    const choice = await vscode.window.showInformationMessage(
      `Project successfully rolled back to ${snapshotName}.`,
      'View Report',
    );

    if (choice === 'View Report') {
      const markdown = formatRollbackReportMarkdown(report);
      const doc = await vscode.workspace.openTextDocument({
        content: markdown,
        language: 'markdown',
      });
      await vscode.window.showTextDocument(doc, { preview: true });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancelled')) {
      vscode.window.showInformationMessage('Rollback was cancelled.');
      return;
    }

    vscode.window.showErrorMessage(
      `Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Handles the `octopus.compareSnapshot` command.
 */
export async function handleCompareCommand(
  context: vscode.ExtensionContext,
  getViewState: () => ExtensionViewState,
  updateView: (updater: (state: ExtensionViewState) => ExtensionViewState) => void,
  target?: unknown,
) {
  const roots = getWorkspaceRoots();
  const firstRoot = roots[0];
  if (!firstRoot) {
    vscode.window.showWarningMessage('Open a workspace folder in VS Code to compare with a snapshot.');
    return;
  }

  const cookie = await resolveSessionCookie(context);
  if (!cookie) {
    return;
  }

  const state = getViewState();
  let project = state.selectedProject;

  if (!project) {
    const workspaceName = roots.map((r) => r.name).join(', ');
    const workspaceKey = roots.map((r) => `${r.name}:${r.fsPath}`).sort().join('|');
    project = await ensureProjectSelection({
      context,
      sessionCookie: cookie,
      workspaceKey,
      workspaceName,
    });
    if (project) {
      updateView((s) => ({ ...s, selectedProject: project }));
    }
  }

  if (!project) {
    vscode.window.showWarningMessage('Select an OCTOPUS project before comparing snapshots.');
    return;
  }

  let snapshots = state.snapshots;
  if (!target && snapshots.length === 0) {
    snapshots = await refreshSnapshotHistory({ context, getViewState, updateView, silent: true });
  }

  const snapshot = await resolveTargetSnapshot(target, snapshots, 'compare with workspace');
  if (!snapshot) {
    return;
  }

  await runSnapshotComparison({
    snapshot,
    workspaceRoot: firstRoot.fsPath,
    sessionCookie: cookie,
    projectId: project.id,
  });
}
