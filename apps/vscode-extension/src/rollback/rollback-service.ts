import crypto from 'node:crypto';
import fs from 'node:fs';
import { mkdir, readdir, rm, stat, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';

import { createSnapshot, downloadSnapshotArchive, listSnapshots } from '../api/snapshots';
import { OctopusApiError } from '../api/types';
import { clearSessionCookie, getSessionCookie } from '../auth/session';
import { packageWorkspaceAsZip, cleanupTemporaryArchive } from '../capture/archive';
import { createExclusionMatcher, getDefaultExclusionPatterns } from '../capture/exclusions';
import { getWorkspaceRoots } from '../capture/workspace-detection';
import { scanWorkspace } from '../capture/workspace-scan';
import {
  getCaptureAnalyzeSecrets,
  getCaptureExcludePatterns,
  getCaptureExcludeSensitiveFiles,
  getCaptureMaxDirectories,
  getCaptureMaxFiles,
  getCaptureMaxTotalBytes,
  getCaptureMaxUploadBytes,
  getRequestTimeoutMs,
} from '../config';
import type { SnapshotRecord } from '../contracts/snapshot';
import { getRememberedProjectId } from '../projects/selection';
import { extractArchiveToDirectory, getArchiveEntries, isPathSafe } from './extract';
import type { RollbackOptions, RollbackReport } from './types';

/**
 * Returns formatted snapshot display name.
 */
export function getSnapshotDisplayName(snapshot: SnapshotRecord): string {
  const metadataName = snapshot.captureMetadata?.name;
  if (typeof metadataName === 'string' && metadataName.trim().length > 0) {
    return metadataName.trim();
  }
  return snapshot.id;
}

/**
 * Strips common prefix from entry relative paths if all entries are enclosed in a top folder.
 */
export function normalizeEntryPaths(
  entries: Array<{ relativePath: string; sizeBytes: number }>,
  workspaceName?: string,
): Map<string, { originalPath: string; sizeBytes: number }> {
  const map = new Map<string, { originalPath: string; sizeBytes: number }>();
  if (entries.length === 0) {
    return map;
  }

  // Check if all entries start with workspaceName + '/'
  const prefix = workspaceName ? `${workspaceName}/` : null;
  const allStartWithWorkspace = prefix ? entries.every((e) => e.relativePath.startsWith(prefix)) : false;

  let commonPrefix: string | null = null;
  if (allStartWithWorkspace && prefix) {
    commonPrefix = prefix;
  } else {
    // Check if all entries share a single root folder
    const firstSegment = entries[0]?.relativePath.split('/')[0];
    if (firstSegment && entries.every((e) => e.relativePath.startsWith(`${firstSegment}/`))) {
      commonPrefix = `${firstSegment}/`;
    }
  }

  for (const entry of entries) {
    const normalized = commonPrefix && entry.relativePath.startsWith(commonPrefix)
      ? entry.relativePath.slice(commonPrefix.length)
      : entry.relativePath;
    if (normalized.length > 0) {
      map.set(normalized, {
        originalPath: entry.relativePath,
        sizeBytes: entry.sizeBytes,
      });
    }
  }

  return map;
}

/**
 * Recursively scans directory for files within managed project scope.
 */
export async function scanManagedWorkspaceFiles(
  directory: string,
  baseDir: string,
  shouldExclude: (relPath: string) => boolean,
): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    // Never touch .git, node_modules, or .octopus-storage under any circumstances
    const topSegment = relPath.split('/')[0];
    if (topSegment === '.git' || topSegment === 'node_modules' || topSegment === '.octopus-storage') {
      continue;
    }

    if (shouldExclude(relPath) || shouldExclude(`root/${relPath}`)) {
      continue;
    }

    if (entry.isDirectory()) {
      const subFiles = await scanManagedWorkspaceFiles(fullPath, baseDir, shouldExclude);
      files.push(...subFiles);
    } else if (entry.isFile()) {
      files.push(relPath);
    }
  }

  return files;
}

/**
 * Removes empty directories recursively within managed scope.
 */
export async function removeEmptyDirs(dir: string, baseDir: string, shouldExclude: (relPath: string) => boolean) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(baseDir, full).replace(/\\/g, '/');
      const topSegment = rel.split('/')[0];
      if (topSegment === '.git' || topSegment === 'node_modules' || topSegment === '.octopus-storage') {
        continue;
      }
      if (!shouldExclude(rel)) {
        await removeEmptyDirs(full, baseDir, shouldExclude);
      }
    }
  }

  if (dir !== baseDir) {
    const remaining = await readdir(dir);
    if (remaining.length === 0) {
      try {
        await rm(dir, { recursive: true, force: true });
      } catch {
        // Ignore if cannot remove
      }
    }
  }
}

/**
 * Performs full project rollback to selected snapshot.
 */
export async function executeProjectRollback(
  options: RollbackOptions,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<RollbackReport> {
  const { snapshot, workspaceRoot, sessionCookie, projectId, cancellationToken, skipConfirmation } = options;
  const snapshotName = getSnapshotDisplayName(snapshot);

  // 1. Confirmation dialog
  if (!skipConfirmation) {
    const confirmMessage = `Restore this project version?\nSelected Snapshot: ${snapshotName}\nThis operation will replace the current workspace state. OCTOPUS will automatically create a safety snapshot before restoration.`;
    const selected = await vscode.window.showWarningMessage(
      confirmMessage,
      { modal: true },
      'Confirm Rollback',
      'Cancel',
    );

    if (selected !== 'Confirm Rollback') {
      throw new Error('Rollback cancelled by user');
    }
  }

  if (cancellationToken?.isCancellationRequested) {
    throw new Error('Rollback cancelled');
  }

  progress.report({ message: 'Preparing pre-rollback safety snapshot...' });

  // 2. Create and verify automatic safety snapshot of current workspace
  let safetySnapshotId: string | null = null;
  let safetyTempDir: string | null = null;

  try {
    const detectedRoots = getWorkspaceRoots();
    const roots = detectedRoots.length > 0
      ? detectedRoots
      : [{ name: path.basename(workspaceRoot), fsPath: workspaceRoot }];

    const matcher = createExclusionMatcher({
      customPatterns: getCaptureExcludePatterns(),
      excludeSensitiveFiles: getCaptureExcludeSensitiveFiles(),
    });

    const currentScan = await scanWorkspace({
      roots,
      exclusionMatcher: matcher,
      maxFiles: getCaptureMaxFiles(),
      maxDirectories: getCaptureMaxDirectories(),
      maxTotalBytes: getCaptureMaxTotalBytes(),
      ...(cancellationToken ? { cancellationToken } : {}),
    });

    if (currentScan.files.length === 0) {
      safetySnapshotId = `safety-empty-workspace-${Date.now()}`;
    } else {
      const safetyArchive = await packageWorkspaceAsZip({
        files: currentScan.files,
        ...(cancellationToken ? { cancellationToken } : {}),
      });
      safetyTempDir = safetyArchive.tempDir;

      // Save local safety backup first for offline recovery
      const localStorageDir = path.join(workspaceRoot, '.octopus-storage', 'safety-snapshots');
      await mkdir(localStorageDir, { recursive: true });
      const localBackupPath = path.join(localStorageDir, `safety-pre-rollback-${Date.now()}.zip`);
      await fs.promises.copyFile(safetyArchive.archivePath, localBackupPath);

      // Upload safety snapshot to backend
      try {
        const uploadResult = await createSnapshot({
          projectId,
          cookie: sessionCookie,
          timeoutMs: getRequestTimeoutMs(),
          payload: {
            captureSource: 'EXTENSION',
            clientName: 'octopus-vscode-extension',
            clientVersion: '0.1.2',
            fileCount: currentScan.fileCount,
            directoryCount: currentScan.directoryCount,
            metadata: {
              isSafetySnapshot: true,
              safetyForSnapshotId: snapshot.id,
              description: `Automatic safety snapshot before rollback to ${snapshotName}`,
              analyzeSecrets: getCaptureAnalyzeSecrets(),
            },
            archive: {
              fileName: 'safety-snapshot.zip',
              contentType: 'application/zip',
              sizeBytes: safetyArchive.sizeBytes,
            },
          },
          archivePath: safetyArchive.archivePath,
          ...(cancellationToken ? { cancellationToken } : {}),
        });

        safetySnapshotId = uploadResult.snapshot.id;
      } catch (uploadError) {
        // If API upload fails, check if local safety snapshot is confirmed
        const localStat = await stat(localBackupPath);
        if (localStat.size > 0) {
          safetySnapshotId = `local-safety-${path.basename(localBackupPath)}`;
        } else {
          throw uploadError;
        }
      }
    }
  } catch (safetyError) {
    if (safetyTempDir) {
      await cleanupTemporaryArchive(safetyTempDir);
    }
    throw new Error(
      `Safety snapshot creation failed: ${safetyError instanceof Error ? safetyError.message : String(safetyError)}. Rollback aborted to protect your workspace.`,
    );
  } finally {
    if (safetyTempDir) {
      await cleanupTemporaryArchive(safetyTempDir);
    }
  }

  // Verify that safety snapshot was saved
  if (!safetySnapshotId) {
    throw new Error('Safety snapshot could not be verified. Rollback aborted to protect your workspace.');
  }

  progress.report({ message: 'Retrieving snapshot archive...' });

  // 3. Retrieve snapshot archive from local storage cache or API
  let archiveBuffer: Buffer | null = null;
  const localCachePath = path.join(workspaceRoot, '.octopus-storage', 'snapshots', `${snapshot.id}.zip`);

  try {
    if (fs.existsSync(localCachePath)) {
      const cached = await fs.promises.readFile(localCachePath);
      // Verify integrity of cached archive
      if (snapshot.integrityHash) {
        const hash = crypto.createHash('sha256').update(cached).digest('hex');
        if (hash.toLowerCase() === snapshot.integrityHash.toLowerCase()) {
          archiveBuffer = cached;
        }
      } else {
        archiveBuffer = cached;
      }
    }
  } catch {
    archiveBuffer = null;
  }

  if (!archiveBuffer) {
    try {
      archiveBuffer = await downloadSnapshotArchive({
        projectId,
        snapshotId: snapshot.id,
        cookie: sessionCookie,
        timeoutMs: getRequestTimeoutMs(),
        ...(cancellationToken ? { cancellationToken } : {}),
      });

      // Cache locally for offline availability
      try {
        await mkdir(path.dirname(localCachePath), { recursive: true });
        await writeFile(localCachePath, archiveBuffer);
      } catch {
        // Ignore cache write failure
      }
    } catch (downloadErr) {
      if (downloadErr instanceof OctopusApiError && downloadErr.statusCode === 404) {
        throw new Error(
          `Snapshot archive not found on server. This snapshot may have been created on an ephemeral cloud instance that restarted. Please capture a new snapshot to create a permanent rollback restore point.`,
        );
      }
      throw new Error(
        `Failed to retrieve snapshot archive: ${downloadErr instanceof Error ? downloadErr.message : String(downloadErr)}`,
      );
    }
  }

  // 4. Verify archive integrity
  progress.report({ message: 'Verifying archive integrity...' });
  if (snapshot.integrityHash) {
    const computedHash = crypto.createHash('sha256').update(archiveBuffer).digest('hex');
    if (computedHash.toLowerCase() !== snapshot.integrityHash.trim().toLowerCase()) {
      throw new Error(
        `Snapshot archive integrity verification failed. Expected SHA-256: ${snapshot.integrityHash}, Computed: ${computedHash}`,
      );
    }
  }

  // Verify ZIP structure and parse entries
  const rawEntries = await getArchiveEntries(archiveBuffer);
  if (rawEntries.length === 0) {
    throw new Error('Snapshot archive is empty or contains no files');
  }

  progress.report({ message: 'Scanning current workspace for changes...' });

  // 5. Build mapping of snapshot entries to relative paths
  const workspaceFolderName = path.basename(workspaceRoot);
  const normalizedEntries = normalizeEntryPaths(rawEntries, workspaceFolderName);
  const snapshotRelPaths = new Set(normalizedEntries.keys());

  // Exclusion matcher for managed scope
  const exclusionMatcher = createExclusionMatcher({
    customPatterns: getCaptureExcludePatterns(),
    excludeSensitiveFiles: false, // Don't delete sensitive files outside snapshot
  });

  // Current managed files in workspace
  const currentManagedFiles = await scanManagedWorkspaceFiles(
    workspaceRoot,
    workspaceRoot,
    (relPath) => exclusionMatcher.shouldExcludePath(relPath),
  );

  const existingFileSet = new Set(currentManagedFiles);

  // Files to remove: present in current workspace but NOT in snapshot
  const filesToRemove = currentManagedFiles.filter((rel) => !snapshotRelPaths.has(rel));

  progress.report({ message: 'Restoring files from snapshot...' });

  // 6. Extract snapshot archive over workspace
  const filesRestored: string[] = [];
  const filesAdded: string[] = [];
  const failedOperations: Array<{ path: string; error: string }> = [];

  // Extract to a temp directory first to ensure clean file extraction with safety checks
  const tempExtractDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'octopus-rollback-'));

  try {
    const extractResult = await extractArchiveToDirectory({
      archiveBuffer,
      destinationDir: tempExtractDir,
      ...(cancellationToken ? { cancellationToken } : {}),
    });

    failedOperations.push(...extractResult.failedOperations);

    // Copy extracted files to destination
    for (const [normRelPath, meta] of normalizedEntries.entries()) {
      if (cancellationToken?.isCancellationRequested) {
        throw new Error('Rollback cancelled');
      }

      if (!isPathSafe(workspaceRoot, normRelPath)) {
        failedOperations.push({
          path: normRelPath,
          error: 'Path escapes workspace directory',
        });
        continue;
      }

      const sourceFilePath = path.join(tempExtractDir, meta.originalPath);
      const destFilePath = path.join(workspaceRoot, normRelPath);

      try {
        await mkdir(path.dirname(destFilePath), { recursive: true });
        await fs.promises.copyFile(sourceFilePath, destFilePath);

        if (existingFileSet.has(normRelPath)) {
          filesRestored.push(normRelPath);
        } else {
          filesAdded.push(normRelPath);
        }
      } catch (copyErr) {
        failedOperations.push({
          path: normRelPath,
          error: copyErr instanceof Error ? copyErr.message : String(copyErr),
        });
      }
    }
  } finally {
    await rm(tempExtractDir, { recursive: true, force: true });
  }

  progress.report({ message: 'Removing files created after snapshot...' });

  // 7. Remove files created after snapshot within managed project scope
  const filesRemoved: string[] = [];
  for (const fileToRemove of filesToRemove) {
    if (cancellationToken?.isCancellationRequested) {
      break;
    }

    if (!isPathSafe(workspaceRoot, fileToRemove)) {
      continue;
    }

    const absPath = path.join(workspaceRoot, fileToRemove);
    try {
      await unlink(absPath);
      filesRemoved.push(fileToRemove);
    } catch (unlinkErr) {
      failedOperations.push({
        path: fileToRemove,
        error: unlinkErr instanceof Error ? unlinkErr.message : String(unlinkErr),
      });
    }
  }

  // Clean up any empty directories within managed scope
  try {
    await removeEmptyDirs(workspaceRoot, workspaceRoot, (relPath) => exclusionMatcher.shouldExcludePath(relPath));
  } catch {
    // Ignore error cleaning empty dirs
  }

  // 8. Refresh VS Code Explorer and affected editors
  try {
    await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
  } catch {
    // Ignore explorer refresh failure
  }

  const report: RollbackReport = {
    snapshotId: snapshot.id,
    snapshotName,
    restoredAt: new Date().toISOString(),
    safetySnapshotId,
    filesRestored,
    filesAdded,
    filesRemoved,
    failedOperations,
    success: failedOperations.length === 0,
  };

  return report;
}

/**
 * Formats the markdown Restoration Report.
 */
export function formatRollbackReportMarkdown(report: RollbackReport): string {
  const lines: string[] = [
    `# OCTOPUS Rollback Report`,
    ``,
    `Project was successfully restored to **${report.snapshotName}**.`,
    ``,
    `| Attribute | Value |`,
    `| :--- | :--- |`,
    `| **Snapshot Name** | ${report.snapshotName} |`,
    `| **Snapshot ID** | \`${report.snapshotId}\` |`,
    `| **Restoration Timestamp** | ${new Date(report.restoredAt).toLocaleString()} |`,
    `| **Safety Snapshot ID** | \`${report.safetySnapshotId ?? 'None'}\` |`,
    `| **Files Restored / Overwritten** | ${report.filesRestored.length} |`,
    `| **Files Added Back** | ${report.filesAdded.length} |`,
    `| **Files Removed** | ${report.filesRemoved.length} |`,
    `| **Failed Operations** | ${report.failedOperations.length} |`,
    ``,
  ];

  if (report.failedOperations.length > 0) {
    lines.push(`## ⚠️ Failed Operations`, ``);
    for (const fail of report.failedOperations) {
      lines.push(`- \`${fail.path}\`: ${fail.error}`);
    }
    lines.push(``);
  }

  if (report.filesRestored.length > 0) {
    lines.push(`## Restored / Overwritten Files (${report.filesRestored.length})`, ``);
    for (const file of report.filesRestored.slice(0, 50)) {
      lines.push(`- \`${file}\``);
    }
    if (report.filesRestored.length > 50) {
      lines.push(`- *...and ${report.filesRestored.length - 50} more*`);
    }
    lines.push(``);
  }

  if (report.filesAdded.length > 0) {
    lines.push(`## Added Back Files (${report.filesAdded.length})`, ``);
    for (const file of report.filesAdded.slice(0, 50)) {
      lines.push(`- \`${file}\``);
    }
    if (report.filesAdded.length > 50) {
      lines.push(`- *...and ${report.filesAdded.length - 50} more*`);
    }
    lines.push(``);
  }

  if (report.filesRemoved.length > 0) {
    lines.push(`## Removed Files (${report.filesRemoved.length})`, ``);
    for (const file of report.filesRemoved.slice(0, 50)) {
      lines.push(`- \`${file}\``);
    }
    if (report.filesRemoved.length > 50) {
      lines.push(`- *...and ${report.filesRemoved.length - 50} more*`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}
