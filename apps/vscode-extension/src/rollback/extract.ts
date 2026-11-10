import crypto from 'node:crypto';
import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import yauzl from 'yauzl';
import type { ArchiveFileEntry } from './types';

/**
 * Validates that an archive entry relative path does not escape the destination directory (Zip-Slip protection).
 */
export function isPathSafe(baseDir: string, relativePath: string): boolean {
  const normalizedRelative = relativePath.replace(/\\/g, '/');
  if (normalizedRelative.startsWith('/') || /^[a-zA-Z]:/.test(normalizedRelative)) {
    return false;
  }
  const resolved = path.resolve(baseDir, normalizedRelative);
  const normalizedBase = path.resolve(baseDir);
  return resolved === normalizedBase || resolved.startsWith(normalizedBase + path.sep);
}

/**
 * Verifies SHA-256 hash of archive buffer against expected hash.
 */
export function verifyArchiveIntegrity(archiveBuffer: Buffer, expectedHash?: string | null): boolean {
  if (!expectedHash) {
    return true;
  }
  const actualHash = crypto.createHash('sha256').update(archiveBuffer).digest('hex');
  return actualHash.toLowerCase() === expectedHash.trim().toLowerCase();
}

/**
 * Lists all file entries in a zip buffer.
 */
export async function getArchiveEntries(archiveBuffer: Buffer): Promise<ArchiveFileEntry[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(archiveBuffer, { lazyEntries: true, decodeStrings: true }, (err, zipFile) => {
      if (err || !zipFile) {
        return reject(err ?? new Error('Corrupted or invalid snapshot zip archive'));
      }

      const entries: ArchiveFileEntry[] = [];

      zipFile.on('entry', (entry) => {
        const normalizedName = entry.fileName.replace(/\\/g, '/');
        if (!normalizedName.endsWith('/')) {
          entries.push({
            relativePath: normalizedName,
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
 * Reads a single entry from a zip buffer as a Buffer.
 */
export async function readEntryBuffer(archiveBuffer: Buffer, targetRelativePath: string): Promise<Buffer | null> {
  const normalizedTarget = targetRelativePath.replace(/\\/g, '/');

  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(archiveBuffer, { lazyEntries: true, decodeStrings: true }, (err, zipFile) => {
      if (err || !zipFile) {
        return reject(err ?? new Error('Corrupted or invalid snapshot zip archive'));
      }

      let found = false;

      zipFile.on('entry', (entry) => {
        const entryNorm = entry.fileName.replace(/\\/g, '/');
        if (entryNorm === normalizedTarget) {
          found = true;
          zipFile.openReadStream(entry, (streamErr, readStream) => {
            if (streamErr || !readStream) {
              zipFile.close();
              return reject(streamErr ?? new Error(`Failed to read entry stream: ${entry.fileName}`));
            }

            const chunks: Buffer[] = [];
            readStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            readStream.on('end', () => {
              zipFile.close();
              resolve(Buffer.concat(chunks));
            });
            readStream.on('error', (readErr) => {
              zipFile.close();
              reject(readErr);
            });
          });
          return;
        }

        zipFile.readEntry();
      });

      zipFile.on('end', () => {
        if (!found) {
          zipFile.close();
          resolve(null);
        }
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
 * Safely extracts a zip buffer to a destination directory with Zip-Slip protection.
 */
export async function extractArchiveToDirectory(options: {
  archiveBuffer: Buffer;
  destinationDir: string;
  expectedHash?: string | null;
  cancellationToken?: { isCancellationRequested: boolean };
}): Promise<{
  extractedFiles: string[];
  totalBytes: number;
  failedOperations: Array<{ path: string; error: string }>;
}> {
  const { archiveBuffer, destinationDir, expectedHash, cancellationToken } = options;

  // 1. Verify integrity if hash provided
  if (expectedHash && !verifyArchiveIntegrity(archiveBuffer, expectedHash)) {
    const actualHash = crypto.createHash('sha256').update(archiveBuffer).digest('hex');
    throw new Error(
      `Snapshot archive integrity verification failed (SHA-256 mismatch). Expected: ${expectedHash}, Actual: ${actualHash}`,
    );
  }

  const destinationRoot = path.resolve(destinationDir);
  await mkdir(destinationRoot, { recursive: true });

  const extractedFiles: string[] = [];
  const failedOperations: Array<{ path: string; error: string }> = [];
  let totalBytes = 0;

  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(archiveBuffer, { lazyEntries: true, decodeStrings: true }, (err, zipFile) => {
      if (err || !zipFile) {
        return reject(err ?? new Error('Corrupted or invalid snapshot zip archive'));
      }

      zipFile.on('entry', async (entry) => {
        if (cancellationToken?.isCancellationRequested) {
          zipFile.close();
          return reject(new Error('Rollback extraction cancelled by user'));
        }

        const normalizedName = entry.fileName.replace(/\\/g, '/');

        // Check for Zip-Slip attack
        if (!isPathSafe(destinationRoot, normalizedName)) {
          zipFile.close();
          return reject(new Error(`Security error: illegal Zip-Slip path in snapshot archive: ${entry.fileName}`));
        }

        const targetPath = path.resolve(destinationRoot, normalizedName);

        if (normalizedName.endsWith('/')) {
          // Directory entry
          try {
            await mkdir(targetPath, { recursive: true });
          } catch (dirErr) {
            failedOperations.push({
              path: normalizedName,
              error: dirErr instanceof Error ? dirErr.message : String(dirErr),
            });
          }
          zipFile.readEntry();
          return;
        }

        // File entry
        zipFile.openReadStream(entry, async (streamErr, readStream) => {
          if (streamErr || !readStream) {
            failedOperations.push({
              path: normalizedName,
              error: streamErr ? streamErr.message : 'Failed to open entry stream',
            });
            zipFile.readEntry();
            return;
          }

          try {
            await mkdir(path.dirname(targetPath), { recursive: true });

            const chunks: Buffer[] = [];
            readStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            readStream.on('end', async () => {
              try {
                const fileBuffer = Buffer.concat(chunks);
                await writeFile(targetPath, fileBuffer);
                extractedFiles.push(normalizedName);
                totalBytes += fileBuffer.byteLength;
              } catch (writeErr) {
                failedOperations.push({
                  path: normalizedName,
                  error: writeErr instanceof Error ? writeErr.message : String(writeErr),
                });
              }
              zipFile.readEntry();
            });
            readStream.on('error', (readErr) => {
              failedOperations.push({
                path: normalizedName,
                error: readErr instanceof Error ? readErr.message : String(readErr),
              });
              zipFile.readEntry();
            });
          } catch (prepErr) {
            failedOperations.push({
              path: normalizedName,
              error: prepErr instanceof Error ? prepErr.message : String(prepErr),
            });
            zipFile.readEntry();
          }
        });
      });

      zipFile.on('end', () => {
        zipFile.close();
        resolve({
          extractedFiles,
          totalBytes,
          failedOperations,
        });
      });

      zipFile.on('error', (zipErr) => {
        zipFile.close();
        reject(zipErr);
      });

      zipFile.readEntry();
    });
  });
}
