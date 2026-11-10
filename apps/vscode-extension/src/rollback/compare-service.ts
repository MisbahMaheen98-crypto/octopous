import crypto from 'node:crypto';
import fs from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';

import { downloadSnapshotArchive } from '../api/snapshots';
import { createExclusionMatcher } from '../capture/exclusions';
import { getCaptureExcludePatterns, getRequestTimeoutMs } from '../config';
import type { SnapshotRecord } from '../contracts/snapshot';
import { getArchiveEntries, readEntryBuffer } from './extract';
import { getSnapshotDisplayName, normalizeEntryPaths, scanManagedWorkspaceFiles } from './rollback-service';
import type { FileComparisonItem } from './types';

/**
 * Computes difference between snapshot and current workspace.
 */
export async function compareSnapshotWithWorkspace(options: {
  snapshot: SnapshotRecord;
  workspaceRoot: string;
  sessionCookie: string;
  projectId: string;
  cancellationToken?: vscode.CancellationToken;
}): Promise<FileComparisonItem[]> {
  const { snapshot, workspaceRoot, sessionCookie, projectId, cancellationToken } = options;

  // Retrieve archive buffer from cache or download
  let archiveBuffer: Buffer | null = null;
  const localCachePath = path.join(workspaceRoot, '.octopus-storage', 'snapshots', `${snapshot.id}.zip`);

  if (fs.existsSync(localCachePath)) {
    try {
      archiveBuffer = await fs.promises.readFile(localCachePath);
    } catch {
      archiveBuffer = null;
    }
  }

  if (!archiveBuffer) {
    archiveBuffer = await downloadSnapshotArchive({
      projectId,
      snapshotId: snapshot.id,
      cookie: sessionCookie,
      timeoutMs: getRequestTimeoutMs(),
      ...(cancellationToken ? { cancellationToken } : {}),
    });
  }

  const rawEntries = await getArchiveEntries(archiveBuffer);
  const workspaceFolderName = path.basename(workspaceRoot);
  const normalizedEntries = normalizeEntryPaths(rawEntries, workspaceFolderName);

  const exclusionMatcher = createExclusionMatcher({
    customPatterns: getCaptureExcludePatterns(),
    excludeSensitiveFiles: false,
  });

  const currentManagedFiles = await scanManagedWorkspaceFiles(
    workspaceRoot,
    workspaceRoot,
    (relPath) => exclusionMatcher.shouldExcludePath(relPath),
  );

  const workspaceFileSet = new Set(currentManagedFiles);
  const comparisonItems: FileComparisonItem[] = [];

  // Check files in snapshot
  for (const [relPath, meta] of normalizedEntries.entries()) {
    const workspacePath = path.join(workspaceRoot, relPath);

    if (!workspaceFileSet.has(relPath)) {
      comparisonItems.push({
        relativePath: relPath,
        status: 'deleted',
        workspacePath,
        archiveSizeBytes: meta.sizeBytes,
        workspaceSizeBytes: 0,
      });
      continue;
    }

    // Both exist, check if modified
    try {
      const fileStat = await stat(workspacePath);
      if (fileStat.size !== meta.sizeBytes) {
        comparisonItems.push({
          relativePath: relPath,
          status: 'modified',
          workspacePath,
          archiveSizeBytes: meta.sizeBytes,
          workspaceSizeBytes: fileStat.size,
        });
        continue;
      }

      // Sizes match, compare hash
      const snapshotEntryBuffer = await readEntryBuffer(archiveBuffer, meta.originalPath);
      if (!snapshotEntryBuffer) {
        comparisonItems.push({
          relativePath: relPath,
          status: 'modified',
          workspacePath,
          archiveSizeBytes: meta.sizeBytes,
          workspaceSizeBytes: fileStat.size,
        });
        continue;
      }

      const workspaceContent = await fs.promises.readFile(workspacePath);
      const snapshotHash = crypto.createHash('sha256').update(snapshotEntryBuffer).digest('hex');
      const workspaceHash = crypto.createHash('sha256').update(workspaceContent).digest('hex');

      if (snapshotHash !== workspaceHash) {
        comparisonItems.push({
          relativePath: relPath,
          status: 'modified',
          workspacePath,
          archiveSizeBytes: meta.sizeBytes,
          workspaceSizeBytes: fileStat.size,
        });
      } else {
        comparisonItems.push({
          relativePath: relPath,
          status: 'identical',
          workspacePath,
          archiveSizeBytes: meta.sizeBytes,
          workspaceSizeBytes: fileStat.size,
        });
      }
    } catch {
      comparisonItems.push({
        relativePath: relPath,
        status: 'modified',
        workspacePath,
        archiveSizeBytes: meta.sizeBytes,
        workspaceSizeBytes: 0,
      });
    }
  }

  // Check files in workspace that are NOT in snapshot (added)
  for (const relPath of currentManagedFiles) {
    if (!normalizedEntries.has(relPath)) {
      const workspacePath = path.join(workspaceRoot, relPath);
      let size = 0;
      try {
        size = (await stat(workspacePath)).size;
      } catch {
        // Ignore stat error
      }

      comparisonItems.push({
        relativePath: relPath,
        status: 'added',
        workspacePath,
        archiveSizeBytes: 0,
        workspaceSizeBytes: size,
      });
    }
  }

  return comparisonItems;
}

/**
 * Interactive compare UI: presents diff list and launches VS Code diff viewer.
 */
export async function runSnapshotComparison(options: {
  snapshot: SnapshotRecord;
  workspaceRoot: string;
  sessionCookie: string;
  projectId: string;
}) {
  const { snapshot, workspaceRoot, sessionCookie, projectId } = options;
  const snapshotName = getSnapshotDisplayName(snapshot);

  let tempDir: string | null = null;

  try {
    const diffs = await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Comparing workspace with snapshot ${snapshotName}...`,
        cancellable: true,
      },
      async (_progress, cancellationToken) => {
        return compareSnapshotWithWorkspace({
          snapshot,
          workspaceRoot,
          sessionCookie,
          projectId,
          ...(cancellationToken ? { cancellationToken } : {}),
        });
      },
    );

    const changedItems = diffs.filter((d) => d.status !== 'identical');

    if (changedItems.length === 0) {
      vscode.window.showInformationMessage(
        `No differences found: workspace matches snapshot "${snapshotName}" completely.`,
      );
      return;
    }

    type DiffQuickPickItem = vscode.QuickPickItem & { item: FileComparisonItem };

    const quickPickItems: DiffQuickPickItem[] = changedItems.map((item) => {
      let icon = '$(diff-modified)';
      let description = 'Modified';
      let detail = `Snapshot: ${item.archiveSizeBytes} bytes ↔ Workspace: ${item.workspaceSizeBytes} bytes`;

      if (item.status === 'added') {
        icon = '$(diff-added)';
        description = 'New in workspace (will be removed on rollback)';
        detail = `Workspace file: ${item.workspaceSizeBytes} bytes`;
      } else if (item.status === 'deleted') {
        icon = '$(diff-removed)';
        description = 'Missing in workspace (will be restored on rollback)';
        detail = `Snapshot file: ${item.archiveSizeBytes} bytes`;
      }

      return {
        label: `${icon} ${item.relativePath}`,
        description,
        detail,
        item,
      };
    });

    const selected = await vscode.window.showQuickPick(quickPickItems, {
      placeHolder: `Select a file to inspect diff against snapshot "${snapshotName}" (${changedItems.length} changes)`,
      matchOnDescription: true,
      matchOnDetail: true,
    });

    if (!selected) {
      return;
    }

    const { item } = selected;

    // Load archive to extract snapshot version for diffing
    let archiveBuffer: Buffer | null = null;
    const localCachePath = path.join(workspaceRoot, '.octopus-storage', 'snapshots', `${snapshot.id}.zip`);

    if (fs.existsSync(localCachePath)) {
      try {
        archiveBuffer = await fs.promises.readFile(localCachePath);
      } catch {
        archiveBuffer = null;
      }
    }

    if (!archiveBuffer) {
      archiveBuffer = await downloadSnapshotArchive({
        projectId,
        snapshotId: snapshot.id,
        cookie: sessionCookie,
        timeoutMs: getRequestTimeoutMs(),
      });
    }

    const rawEntries = await getArchiveEntries(archiveBuffer);
    const workspaceFolderName = path.basename(workspaceRoot);
    const normalizedEntries = normalizeEntryPaths(rawEntries, workspaceFolderName);
    const entryMeta = normalizedEntries.get(item.relativePath);

    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'octopus-diff-'));
    const tempSnapshotFile = path.join(tempDir, path.basename(item.relativePath));

    if (entryMeta) {
      const buffer = await readEntryBuffer(archiveBuffer, entryMeta.originalPath);
      await writeFile(tempSnapshotFile, buffer ?? Buffer.alloc(0));
    } else {
      await writeFile(tempSnapshotFile, Buffer.alloc(0));
    }

    const snapshotUri = vscode.Uri.file(tempSnapshotFile);
    const workspaceUri = vscode.Uri.file(item.workspacePath);

    if (item.status === 'modified') {
      await vscode.commands.executeCommand(
        'vscode.diff',
        snapshotUri,
        workspaceUri,
        `${path.basename(item.relativePath)} (Snapshot: ${snapshotName} ↔ Workspace)`,
      );
    } else if (item.status === 'deleted') {
      await vscode.commands.executeCommand('vscode.open', snapshotUri);
      vscode.window.showInformationMessage(
        `Previewing snapshot version of "${item.relativePath}". This file will be restored on rollback.`,
      );
    } else if (item.status === 'added') {
      await vscode.commands.executeCommand('vscode.open', workspaceUri);
      vscode.window.showInformationMessage(
        `"${item.relativePath}" exists in workspace but not in snapshot "${snapshotName}". It will be removed on rollback.`,
      );
    }
  } catch (error) {
    vscode.window.showErrorMessage(
      `Comparison failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
