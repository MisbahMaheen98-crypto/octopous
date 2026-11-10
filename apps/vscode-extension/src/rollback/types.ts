import type * as vscode from 'vscode';
import type { SnapshotRecord } from '../contracts/snapshot';

export interface RollbackOptions {
  snapshot: SnapshotRecord;
  workspaceRoot: string;
  sessionCookie: string;
  projectId: string;
  cancellationToken?: vscode.CancellationToken;
  skipConfirmation?: boolean;
}

export interface RollbackReport {
  snapshotId: string;
  snapshotName: string;
  restoredAt: string;
  safetySnapshotId: string | null;
  filesRestored: string[];
  filesAdded: string[];
  filesRemoved: string[];
  failedOperations: Array<{ path: string; error: string }>;
  success: boolean;
}

export interface ArchiveFileEntry {
  relativePath: string;
  sizeBytes: number;
  crc32: number;
}

export interface FileComparisonItem {
  relativePath: string;
  status: 'modified' | 'added' | 'deleted' | 'identical';
  workspacePath: string;
  archiveSizeBytes: number;
  workspaceSizeBytes: number;
}
