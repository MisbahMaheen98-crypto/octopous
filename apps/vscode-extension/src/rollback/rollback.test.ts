import crypto from 'node:crypto';
import fs from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';

import type { SnapshotRecord } from '../contracts/snapshot';
import { compareSnapshotWithWorkspace } from './compare-service';
import { extractArchiveToDirectory, getArchiveEntries, isPathSafe, verifyArchiveIntegrity } from './extract';
import {
  executeProjectRollback,
  getSnapshotDisplayName,
  normalizeEntryPaths,
} from './rollback-service';

function toCleanArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

async function createZipBuffer(files: Array<{ name: string; content: string }>): Promise<Buffer> {
  const archiverModule = await import('archiver');
  const archiverExport = archiverModule as unknown as { default?: unknown };
  const createArchive = (archiverExport.default ?? archiverModule) as unknown as (
    format: 'zip',
    options: { zlib: { level: number } },
  ) => {
    append: (source: string | Buffer, data: { name: string }) => void;
    finalize: () => Promise<void>;
    on: (event: string, listener: (arg?: unknown) => void) => void;
  };

  return new Promise((resolve, reject) => {
    const archive = createArchive('zip', { zlib: { level: 1 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: unknown) => chunks.push(Buffer.from(chunk as Uint8Array)));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))));

    for (const file of files) {
      archive.append(file.content, { name: file.name });
    }
    void archive.finalize();
  });
}

describe('Snapshot Rollback Engine', () => {
  let tempWorkspace: string;
  const tempDirsToClean: string[] = [];

  beforeEach(async () => {
    tempWorkspace = await mkdtemp(path.join(os.tmpdir(), 'octopus-test-workspace-'));
    tempDirsToClean.push(tempWorkspace);

    const configMap: Record<string, unknown> = {
      environment: 'development',
      developmentApiBaseUrl: 'http://localhost:4000/api/v1',
      requestTimeoutMs: 120000,
      'capture.maxUploadBytes': 31457280,
      'capture.maxFiles': 50000,
      'capture.maxDirectories': 10000,
      'capture.maxTotalBytes': 150000000,
      'capture.excludeSensitiveFiles': false,
      'capture.excludePatterns': [],
      'capture.analyzeSecrets': true,
    };

    vi.stubGlobal('vscode', {
      ...vscode,
      window: {
        showWarningMessage: vi.fn(async () => 'Confirm Rollback'),
        showInformationMessage: vi.fn(async () => 'View Report'),
        showErrorMessage: vi.fn(),
        withProgress: vi.fn(async (_opts, task) => {
          return task({ report: vi.fn() }, { isCancellationRequested: false });
        }),
      },
      commands: {
        executeCommand: vi.fn(async () => undefined),
      },
      workspace: {
        workspaceFolders: [
          {
            name: path.basename(tempWorkspace),
            uri: { fsPath: tempWorkspace },
          },
        ],
        getConfiguration: vi.fn((section?: string) => ({
          get: vi.fn((key: string, defaultValue?: unknown) => {
            const fullKey = section && section !== 'octopus' ? `${section}.${key}` : key;
            return configMap[fullKey] ?? defaultValue;
          }),
        })),
      },
    });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await Promise.all(tempDirsToClean.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  describe('Zip-Slip and Security', () => {
    it('detects and blocks path traversal attempts', () => {
      const baseDir = 'C:\\workspace\\project';
      expect(isPathSafe(baseDir, 'src/index.ts')).toBe(true);
      expect(isPathSafe(baseDir, 'nested/sub/file.txt')).toBe(true);
      expect(isPathSafe(baseDir, '../outside.txt')).toBe(false);
      expect(isPathSafe(baseDir, '../../windows/system32/cmd.exe')).toBe(false);
      expect(isPathSafe(baseDir, '/etc/passwd')).toBe(false);
      expect(isPathSafe(baseDir, 'C:/windows/system32')).toBe(false);
    });

    it('rejects zip archive extraction with illegal zip-slip paths', async () => {
      const destDir = await mkdtemp(path.join(os.tmpdir(), 'octopus-slip-test-'));
      tempDirsToClean.push(destDir);

      // Create a valid zip with filename of exact length 11 ('zz_slip.txt')
      const baseZip = await createZipBuffer([
        { name: 'safe.txt', content: 'safe' },
        { name: 'zz_slip.txt', content: 'malicious' },
      ]);

      // Patch the entry filename to '../slip.txt' (exact same length of 11 characters)
      const rawString = baseZip.toString('binary');
      const patchedString = rawString.replaceAll('zz_slip.txt', '../slip.txt');
      const maliciousZip = Buffer.from(patchedString, 'binary');

      await expect(
        extractArchiveToDirectory({
          archiveBuffer: maliciousZip,
          destinationDir: destDir,
        }),
      ).rejects.toThrow(/(Zip-Slip|invalid relative path)/i);
    });
  });

  describe('Integrity Verification', () => {
    it('verifies SHA-256 hash match', async () => {
      const buffer = Buffer.from('test archive contents');
      const expectedHash = crypto.createHash('sha256').update(buffer).digest('hex');

      expect(verifyArchiveIntegrity(buffer, expectedHash)).toBe(true);
      expect(verifyArchiveIntegrity(buffer, 'wronghash')).toBe(false);
      expect(verifyArchiveIntegrity(buffer, null)).toBe(true);
    });

    it('extractArchiveToDirectory throws error on corrupted hash', async () => {
      const destDir = await mkdtemp(path.join(os.tmpdir(), 'octopus-corrupt-test-'));
      tempDirsToClean.push(destDir);
      const buffer = await createZipBuffer([{ name: 'test.txt', content: 'test' }]);

      await expect(
        extractArchiveToDirectory({
          archiveBuffer: buffer,
          destinationDir: destDir,
          expectedHash: '0000000000000000000000000000000000000000000000000000000000000000',
        }),
      ).rejects.toThrow(/integrity verification failed/i);
    });
  });

  describe('Full Project Rollback', () => {
    it('restores deleted files and removes post-snapshot files while preserving .git and node_modules', async () => {
      const wsName = path.basename(tempWorkspace);

      // 1. Initial files (as they existed in the snapshot)
      const snapshotFiles = [
        { name: `${wsName}/src/index.ts`, content: 'console.log("v1");' },
        { name: `${wsName}/src/utils/math.ts`, content: 'export const add = (a, b) => a + b;' },
        { name: `${wsName}/README.md`, content: '# My Project v1' },
      ];

      const snapshotZipBuffer = await createZipBuffer(snapshotFiles);
      const snapshotHash = crypto.createHash('sha256').update(snapshotZipBuffer).digest('hex');

      // 2. Current workspace state before rollback:
      // - src/index.ts was MODIFIED to v2
      // - src/utils/math.ts was DELETED
      // - src/new-feature.ts was ADDED after snapshot (should be removed!)
      // - node_modules/library.js was ADDED (excluded, must NEVER be removed!)
      // - .git/config exists (excluded, must NEVER be removed!)
      await mkdir(path.join(tempWorkspace, 'src', 'utils'), { recursive: true });
      await mkdir(path.join(tempWorkspace, 'node_modules'), { recursive: true });
      await mkdir(path.join(tempWorkspace, '.git'), { recursive: true });

      await writeFile(path.join(tempWorkspace, 'src', 'index.ts'), 'console.log("v2 modified");');
      await writeFile(path.join(tempWorkspace, 'src', 'new-feature.ts'), 'export const newFeature = true;');
      await writeFile(path.join(tempWorkspace, 'README.md'), '# My Project v2');
      await writeFile(path.join(tempWorkspace, 'node_modules', 'library.js'), 'module.exports = {};');
      await writeFile(path.join(tempWorkspace, '.git', 'config'), '[core]\nrepositoryformatversion = 0');

      // Mock snapshot record
      const snapshotRecord: SnapshotRecord = {
        id: 'snap_v1',
        projectId: 'proj_123',
        status: 'COMPLETED',
        captureSource: 'EXTENSION',
        clientName: 'octopus-vscode-extension',
        clientVersion: '0.1.2',
        archiveStorageKey: 'storage-snap_v1',
        archiveContentType: 'application/zip',
        archiveSizeBytes: snapshotZipBuffer.byteLength,
        fileCount: 3,
        directoryCount: 2,
        integrityAlgorithm: 'sha256',
        integrityHash: snapshotHash,
        failureCode: null,
        failureReason: null,
        captureMetadata: { name: 'Initial Release v1' },
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock fetch for safety snapshot upload and archive download
      vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.includes('/download')) {
          return {
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/zip' }),
            arrayBuffer: async () => toCleanArrayBuffer(snapshotZipBuffer),
          } as Response;
        }

        if (urlStr.includes('/snapshots') && !urlStr.includes('/download')) {
          // Safety snapshot creation
          return {
            ok: true,
            status: 201,
            text: async () => JSON.stringify({ success: true, data: { snapshot: { id: 'safety_snap_456' } } }),
          } as Response;
        }

        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ success: true, data: {} }),
        } as Response;
      }));

      const progressReports: string[] = [];
      const report = await executeProjectRollback(
        {
          snapshot: snapshotRecord,
          workspaceRoot: tempWorkspace,
          sessionCookie: 'octopus_session=test',
          projectId: 'proj_123',
          skipConfirmation: true,
        },
        { report: (p) => progressReports.push(p.message ?? '') },
      );

      // Verify report
      expect(report.success).toBe(true);
      expect(report.snapshotName).toBe('Initial Release v1');
      expect(report.safetySnapshotId).toBe('safety_snap_456');
      expect(report.filesRestored).toContain('src/index.ts');
      expect(report.filesRestored).toContain('README.md');
      expect(report.filesAdded).toContain('src/utils/math.ts');
      expect(report.filesRemoved).toContain('src/new-feature.ts');

      // Verify files in workspace match snapshot v1
      const restoredIndex = await readFile(path.join(tempWorkspace, 'src', 'index.ts'), 'utf8');
      expect(restoredIndex).toBe('console.log("v1");');

      const restoredMath = await readFile(path.join(tempWorkspace, 'src', 'utils', 'math.ts'), 'utf8');
      expect(restoredMath).toBe('export const add = (a, b) => a + b;');

      const restoredReadme = await readFile(path.join(tempWorkspace, 'README.md'), 'utf8');
      expect(restoredReadme).toBe('# My Project v1');

      // Verify post-snapshot file was removed
      expect(fs.existsSync(path.join(tempWorkspace, 'src', 'new-feature.ts'))).toBe(false);

      // Verify protected items outside managed scope were NEVER removed
      expect(fs.existsSync(path.join(tempWorkspace, 'node_modules', 'library.js'))).toBe(true);
      expect(fs.existsSync(path.join(tempWorkspace, '.git', 'config'))).toBe(true);
    });

    it('aborts rollback and preserves workspace if safety snapshot fails', async () => {
      const wsName = path.basename(tempWorkspace);
      await writeFile(path.join(tempWorkspace, 'important.txt'), 'do not touch');

      const snapshotZipBuffer = await createZipBuffer([{ name: `${wsName}/important.txt`, content: 'overwritten' }]);

      const snapshotRecord: SnapshotRecord = {
        id: 'snap_v2',
        projectId: 'proj_123',
        status: 'COMPLETED',
        captureSource: 'EXTENSION',
        clientName: 'octopus-vscode-extension',
        clientVersion: '0.1.2',
        archiveStorageKey: 'storage-snap_v2',
        archiveContentType: 'application/zip',
        archiveSizeBytes: snapshotZipBuffer.byteLength,
        fileCount: 1,
        directoryCount: 0,
        integrityAlgorithm: 'sha256',
        integrityHash: null,
        failureCode: null,
        failureReason: null,
        captureMetadata: { name: 'v2' },
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Mock fetch: safety snapshot POST fails with 500 error
      vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
        const urlStr = String(url);
        if (urlStr.includes('/snapshots') && !urlStr.includes('/download')) {
          return {
            ok: false,
            status: 500,
            text: async () => JSON.stringify({ success: false, error: { code: 'SERVER_ERROR', message: 'DB down' } }),
          } as Response;
        }
        return { ok: true, status: 200, text: async () => '{}' } as Response;
      }));

      const badWorkspaceRoot = path.join(os.tmpdir(), 'non-existent-ws-' + Date.now());

      await expect(
        executeProjectRollback(
          {
            snapshot: snapshotRecord,
            workspaceRoot: badWorkspaceRoot,
            sessionCookie: 'octopus_session=test',
            projectId: 'proj_123',
            skipConfirmation: true,
          },
          { report: vi.fn() },
        ),
      ).rejects.toThrow(/Safety snapshot/i);

      // Verify original file was not touched
      const fileContent = await readFile(path.join(tempWorkspace, 'important.txt'), 'utf8');
      expect(fileContent).toBe('do not touch');
    });
  });

  describe('Snapshot Comparison Service', () => {
    it('detects modified, added, and deleted files against workspace', async () => {
      const wsName = path.basename(tempWorkspace);

      const snapshotZipBuffer = await createZipBuffer([
        { name: `${wsName}/src/index.ts`, content: 'v1' },
        { name: `${wsName}/src/removed.ts`, content: 'was in snapshot' },
        { name: `${wsName}/src/same.ts`, content: 'identical' },
      ]);

      await mkdir(path.join(tempWorkspace, 'src'), { recursive: true });
      await writeFile(path.join(tempWorkspace, 'src', 'index.ts'), 'v2-modified');
      await writeFile(path.join(tempWorkspace, 'src', 'same.ts'), 'identical');
      await writeFile(path.join(tempWorkspace, 'src', 'new.ts'), 'added-in-ws');

      const snapshotRecord: SnapshotRecord = {
        id: 'snap_comp',
        projectId: 'proj_comp',
        status: 'COMPLETED',
        captureSource: 'EXTENSION',
        clientName: 'octopus-vscode-extension',
        clientVersion: '0.1.2',
        archiveStorageKey: 'key',
        archiveContentType: 'application/zip',
        archiveSizeBytes: snapshotZipBuffer.byteLength,
        fileCount: 3,
        directoryCount: 1,
        integrityAlgorithm: 'sha256',
        integrityHash: null,
        failureCode: null,
        failureReason: null,
        captureMetadata: null,
        processedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.stubGlobal('fetch', vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/zip' }),
        arrayBuffer: async () => toCleanArrayBuffer(snapshotZipBuffer),
      } as Response)));

      const diffs = await compareSnapshotWithWorkspace({
        snapshot: snapshotRecord,
        workspaceRoot: tempWorkspace,
        sessionCookie: 'session',
        projectId: 'proj_comp',
      });

      const modified = diffs.find((d) => d.relativePath === 'src/index.ts');
      const deleted = diffs.find((d) => d.relativePath === 'src/removed.ts');
      const added = diffs.find((d) => d.relativePath === 'src/new.ts');
      const identical = diffs.find((d) => d.relativePath === 'src/same.ts');

      expect(modified?.status).toBe('modified');
      expect(deleted?.status).toBe('deleted');
      expect(added?.status).toBe('added');
      expect(identical?.status).toBe('identical');
    });
  });

  describe('Path Normalization and Display Names', () => {
    it('formats display name correctly with fallback to ID', () => {
      const snapWithName: SnapshotRecord = {
        id: 'snap_1',
        projectId: 'p',
        status: 'COMPLETED',
        captureSource: 'EXTENSION',
        clientName: null,
        clientVersion: null,
        archiveStorageKey: null,
        archiveContentType: null,
        archiveSizeBytes: null,
        fileCount: null,
        directoryCount: null,
        integrityAlgorithm: null,
        integrityHash: null,
        failureCode: null,
        failureReason: null,
        captureMetadata: { name: 'Sprint 24 Final' },
        processedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(getSnapshotDisplayName(snapWithName)).toBe('Sprint 24 Final');

      const snapWithoutName: SnapshotRecord = {
        ...snapWithName,
        id: 'snap_2',
        captureMetadata: null,
      };

      expect(getSnapshotDisplayName(snapWithoutName)).toBe('snap_2');
    });

    it('normalizes common top-level directory prefix in snapshot archives', () => {
      const entries = [
        { relativePath: 'my-app/src/index.ts', sizeBytes: 10 },
        { relativePath: 'my-app/package.json', sizeBytes: 20 },
      ];

      const normalized = normalizeEntryPaths(entries, 'my-app');
      expect(Array.from(normalized.keys())).toEqual(['src/index.ts', 'package.json']);
    });
  });
});
