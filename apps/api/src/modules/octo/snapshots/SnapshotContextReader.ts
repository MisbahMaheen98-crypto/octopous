/**
 * Snapshot Context Reader
 * Inspects a historical OCTOPUS snapshot archive directly from storage
 * and extracts directory structures, config metadata, and code files
 * to ground OCTOBOT's answers in historical snapshot mode.
 */

import path from 'node:path';
import yauzl from 'yauzl';
import { prisma } from '../../../db/client.js';
import { createSnapshotStorage, type SnapshotStorage } from '../../snapshots/snapshots.storage.js';
import { env } from '../../../config/env.js';
import { logger } from '../octo.logger.js';
import { SecurityGuard } from '../octo.security.js';

export interface SnapshotArchiveFile {
  relativePath: string;
  sizeBytes: number;
  crc32: number;
}

export interface SnapshotContextSummary {
  snapshotId: string;
  projectId: string;
  createdAt: string;
  fileCount: number;
  archiveSizeBytes: number;
  captureSource: string;
  fileList: string[];
  packageMetadata?: Record<string, any> | undefined;
  entryPointContents: Record<string, string>;
  relevantSnippets: Array<{ path: string; snippet: string }>;
}

export class SnapshotContextReader {
  private storage: SnapshotStorage;

  constructor() {
    this.storage = createSnapshotStorage();
  }

  /**
   * Reads all entries from a snapshot ZIP buffer.
   */
  public async getArchiveEntries(archiveBuffer: Buffer): Promise<SnapshotArchiveFile[]> {
    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(archiveBuffer, { lazyEntries: true, decodeStrings: true }, (err, zipFile) => {
        if (err || !zipFile) {
          return reject(err || new Error('Failed to open snapshot archive'));
        }

        const entries: SnapshotArchiveFile[] = [];

        zipFile.on('entry', (entry) => {
          if (!entry.fileName.endsWith('/')) {
            entries.push({
              relativePath: entry.fileName.replace(/\\/g, '/'),
              sizeBytes: entry.uncompressedSize,
              crc32: entry.crc32,
            });
          }
          zipFile.readEntry();
        });

        zipFile.on('end', () => {
          zipFile.close();
          resolve(entries);
        });

        zipFile.on('error', (zipErr) => {
          zipFile.close();
          reject(zipErr);
        });

        zipFile.readEntry();
      });
    });
  }

  /**
   * Reads the text content of a single file from the snapshot archive.
   */
  public async readFileContent(archiveBuffer: Buffer, targetPath: string, maxBytes: number = 256 * 1024): Promise<string | null> {
    const normalizedTarget = targetPath.replace(/\\/g, '/');

    return new Promise((resolve, reject) => {
      yauzl.fromBuffer(archiveBuffer, { lazyEntries: true, decodeStrings: true }, (err, zipFile) => {
        if (err || !zipFile) {
          return reject(err || new Error('Failed to open snapshot archive'));
        }

        let found = false;

        zipFile.on('entry', (entry) => {
          const entryNorm = entry.fileName.replace(/\\/g, '/');
          if (entryNorm === normalizedTarget || entryNorm.endsWith(`/${normalizedTarget}`)) {
            found = true;
            zipFile.openReadStream(entry, (streamErr, readStream) => {
              if (streamErr || !readStream) {
                zipFile.close();
                return resolve(null);
              }

              const chunks: Buffer[] = [];
              let total = 0;

              readStream.on('data', (chunk: Buffer) => {
                total += chunk.byteLength;
                if (total <= maxBytes) {
                  chunks.push(chunk);
                }
              });

              readStream.on('end', () => {
                zipFile.close();
                const buffer = Buffer.concat(chunks);
                resolve(buffer.toString('utf-8'));
              });

              readStream.on('error', () => {
                zipFile.close();
                resolve(null);
              });
            });
          } else {
            zipFile.readEntry();
          }
        });

        zipFile.on('end', () => {
          zipFile.close();
          if (!found) resolve(null);
        });

        zipFile.on('error', () => {
          zipFile.close();
          resolve(null);
        });

        zipFile.readEntry();
      });
    });
  }

  /**
   * Builds deep context for a specific snapshot to inject into OCTOBOT prompt.
   */
  public async getSnapshotContext(projectId: string, snapshotId: string, query?: string): Promise<SnapshotContextSummary | null> {
    const snapshot = await prisma.snapshot.findFirst({
      where: { id: snapshotId, projectId },
      include: { blueprint: true },
    });

    if (!snapshot || !snapshot.archiveStorageKey) {
      logger.warn('SnapshotContextReader', `Snapshot ${snapshotId} not found or missing archive`);
      return null;
    }

    let archiveBuffer: Buffer;
    try {
      archiveBuffer = await this.storage.readArchive(snapshot.archiveStorageKey);
    } catch (err: any) {
      logger.error('SnapshotContextReader', `Failed to read archive: ${err.message}`);
      return null;
    }

    const entries = await this.getArchiveEntries(archiveBuffer);
    const fileList = entries.map((e) => e.relativePath);

    // Read package.json if present
    let packageMetadata: Record<string, any> | undefined = undefined;
    const pkgPath = fileList.find((f) => f.endsWith('package.json'));
    if (pkgPath) {
      try {
        const pkgText = await this.readFileContent(archiveBuffer, pkgPath);
        if (pkgText) packageMetadata = JSON.parse(pkgText);
      } catch {}
    }

    // Read primary entry points (e.g. server.ts, main.tsx, app.ts)
    const entryCandidates = fileList.filter((f) =>
      /(server|main|index|app)\.(ts|tsx|js|jsx)$/i.test(f) && !f.includes('node_modules')
    ).slice(0, 3);

    const entryPointContents: Record<string, string> = {};
    for (const ep of entryCandidates) {
      const text = await this.readFileContent(archiveBuffer, ep, 64 * 1024);
      if (text) {
        entryPointContents[ep] = SecurityGuard.redactSecrets(text);
      }
    }

    // Snippets relevant to query
    const relevantSnippets: Array<{ path: string; snippet: string }> = [];
    if (query) {
      const qTokens = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matchedFiles = fileList
        .filter((f) => !f.includes('node_modules') && !f.includes('.git'))
        .filter((f) => qTokens.some((tok) => f.toLowerCase().includes(tok)))
        .slice(0, 3);

      for (const mf of matchedFiles) {
        const text = await this.readFileContent(archiveBuffer, mf, 32 * 1024);
        if (text) {
          relevantSnippets.push({
            path: mf,
            snippet: SecurityGuard.redactSecrets(text.slice(0, 1500)),
          });
        }
      }
    }

    return {
      snapshotId: snapshot.id,
      projectId: snapshot.projectId,
      createdAt: snapshot.createdAt.toISOString(),
      fileCount: snapshot.fileCount || entries.length,
      archiveSizeBytes: snapshot.archiveSizeBytes || 0,
      captureSource: snapshot.captureSource,
      fileList,
      packageMetadata,
      entryPointContents,
      relevantSnippets,
    };
  }
}
