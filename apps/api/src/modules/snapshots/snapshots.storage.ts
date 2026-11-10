import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../../config/env.js';
import { HttpError } from '../../core/errors/http-error.js';
import { assertSafeRelativePath } from '../../core/security/secure-file-path.js';
import { decryptSnapshotArchive, encryptSnapshotArchive } from '../secrets/secrets.crypto.js';

export type StoreSnapshotArchiveInput = {
  ownerId: string;
  projectId: string;
  snapshotId: string;
  buffer: Buffer;
  contentType: string;
};

export type StoreSnapshotArchiveResult = {
  storageKey: string;
  sizeBytes: number;
  integrityAlgorithm: 'sha256';
  integrityHash: string;
};

export interface SnapshotStorage {
  storeArchive(input: StoreSnapshotArchiveInput): Promise<StoreSnapshotArchiveResult>;
  deleteArchive(storageKey: string): Promise<void>;
  readArchive(storageKey: string): Promise<Buffer>;
}

const extensionByContentType: Record<string, string> = {
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/gzip': 'gz',
  'application/x-gzip': 'gz',
  'application/x-tar': 'tar',
  'application/octet-stream': 'bin',
};

export const allowedArchiveContentTypes = new Set(Object.keys(extensionByContentType));

export class LocalSnapshotStorage implements SnapshotStorage {
  private readonly rootDir = path.resolve(env.SNAPSHOT_STORAGE_LOCAL_ROOT);

  async storeArchive(input: StoreSnapshotArchiveInput): Promise<StoreSnapshotArchiveResult> {
    const fileExtension = extensionByContentType[input.contentType];

    if (!fileExtension) {
      throw new HttpError(
        400,
        'SNAPSHOT_UNSUPPORTED_ARCHIVE_TYPE',
        'Unsupported archive content type',
      );
    }

    const relativeStorageKey = assertSafeRelativePath(
      `${input.ownerId}/${input.projectId}/${input.snapshotId}/project.${fileExtension}`,
    );

    const absolutePath = this.toSafeStoragePath(relativeStorageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, encryptSnapshotArchive(input.buffer));

    // Calculate the hash directly from the existing buffer.
    // This avoids reading the entire saved archive back into memory.
    const hash = createHash('sha256')
      .update(input.buffer)
      .digest('hex');

    return {
      storageKey: relativeStorageKey,
      sizeBytes: input.buffer.byteLength,
      integrityAlgorithm: 'sha256',
      integrityHash: hash,
    };
  }

  async deleteArchive(storageKey: string): Promise<void> {
    const safeStorageKey = assertSafeRelativePath(storageKey);
    const candidatePaths = this.getCandidateStoragePaths(safeStorageKey);
    for (const candidatePath of candidatePaths) {
      await rm(candidatePath, { force: true }).catch(() => undefined);
    }
  }

  async readArchive(storageKey: string): Promise<Buffer> {
    const safeStorageKey = assertSafeRelativePath(storageKey);
    const candidatePaths = this.getCandidateStoragePaths(safeStorageKey);

    let lastError: any = null;
    for (const candidatePath of candidatePaths) {
      try {
        const encrypted = await readFile(candidatePath);
        return decryptSnapshotArchive(encrypted);
      } catch (error: any) {
        lastError = error;
        if (error?.code !== 'ENOENT') {
          console.warn(`[LocalSnapshotStorage] Error reading/decrypting candidate ${candidatePath}:`, error?.message);
        }
      }
    }

    const primaryPath = this.toSafeStoragePath(safeStorageKey);
    try {
      const encrypted = await readFile(primaryPath);
      return decryptSnapshotArchive(encrypted);
    } catch (primaryError: any) {
      if (lastError && primaryError?.code === 'ENOENT') {
        throw lastError;
      }
      throw primaryError;
    }
  }

  private getCandidateStoragePaths(storageKey: string): string[] {
    const primary = this.toSafeStoragePath(storageKey);
    const candidates = [primary];

    const fallbackRoots = [
      path.resolve(process.cwd(), 'apps/api/.octopus-storage/snapshots'),
      path.resolve(process.cwd(), '.octopus-storage/snapshots'),
      path.resolve(process.cwd(), '../apps/api/.octopus-storage/snapshots'),
      path.resolve(process.cwd(), '../.octopus-storage/snapshots'),
      path.resolve(process.cwd(), '../../apps/api/.octopus-storage/snapshots'),
      path.resolve(process.cwd(), '../../.octopus-storage/snapshots'),
    ];

    for (const fallbackRoot of fallbackRoots) {
      const resolved = path.resolve(fallbackRoot, storageKey);
      if (!candidates.includes(resolved)) {
        candidates.push(resolved);
      }
    }

    return candidates;
  }

  private toSafeStoragePath(storageKey: string) {
    const resolved = path.resolve(this.rootDir, storageKey);
    const rootWithSep = `${this.rootDir}${path.sep}`;

    if (resolved !== this.rootDir && !resolved.startsWith(rootWithSep)) {
      throw new HttpError(400, 'UNSAFE_PATH', 'Path traversal attempt detected');
    }

    return resolved;
  }
}

export function createSnapshotStorage(): SnapshotStorage {
  if (env.SNAPSHOT_STORAGE_PROVIDER === 'local') {
    return new LocalSnapshotStorage();
  }

  throw new HttpError(500, 'SNAPSHOT_STORAGE_PROVIDER_INVALID', 'Unsupported snapshot storage provider');
}
