import fs from 'fs';
import path from 'path';
import * as diff from 'diff';
import { PatchProposal } from '../octo.types.js';
import { SecurityGuard } from '../octo.security.js';
import { logger } from '../octo.logger.js';

export interface ApplyPatchResult {
  success: boolean;
  patchId: string;
  filePath: string;
  appliedAt: string;
  backupPath: string;
  message: string;
}

export interface MultiFilePatchResult {
  success: boolean;
  appliedPatches: ApplyPatchResult[];
  message: string;
}

export class PatcherService {
  private patches: Map<string, PatchProposal> = new Map();
  private backups: Map<string, { originalPath: string; backupPath: string; timestamp: string }> = new Map();

  /**
   * Prepares a reviewable code patch with unified diff and line change counts.
   */
  public preparePatch(
    projectId: string,
    projectRoot: string,
    relativeFilePath: string,
    proposedContent: string,
    summary: string
  ): PatchProposal {
    const fullPath = SecurityGuard.validatePathWithinProject(projectRoot, relativeFilePath);
    
    let originalContent = '';
    if (fs.existsSync(fullPath)) {
      originalContent = fs.readFileSync(fullPath, 'utf-8');
    }

    const unifiedDiff = diff.createPatch(
      relativeFilePath,
      originalContent,
      proposedContent,
      'original',
      'proposed'
    );

    const patchLines = unifiedDiff.split('\n');
    let additions = 0;
    let deletions = 0;

    for (const line of patchLines) {
      if (line.startsWith('+') && !line.startsWith('+++')) additions++;
      if (line.startsWith('-') && !line.startsWith('---')) deletions++;
    }

    const patchId = `patch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const proposal: PatchProposal = {
      patchId,
      projectId,
      filePath: relativeFilePath,
      summary,
      originalContent,
      proposedContent,
      diff: unifiedDiff,
      additions,
      deletions,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    this.patches.set(patchId, proposal);
    logger.info('PatcherService', `Patch proposal prepared: ${patchId} for ${relativeFilePath}`);
    return proposal;
  }

  /**
   * Prepares a coordinated multi-file patch set across multiple components/services.
   */
  public prepareMultiFilePatch(
    projectId: string,
    projectRoot: string,
    edits: Array<{ filePath: string; proposedContent: string; summary: string }>
  ): PatchProposal[] {
    return edits.map((edit) =>
      this.preparePatch(projectId, projectRoot, edit.filePath, edit.proposedContent, edit.summary)
    );
  }

  public getPatch(patchId: string): PatchProposal | null {
    return this.patches.get(patchId) || null;
  }

  /**
   * Applies an approved patch.
   * Enforces:
   * 1. User approval verification
   * 2. Path safety check
   * 3. Conflict detection (if file was modified since patch preparation)
   * 4. Pre-modification rollback backup creation
   */
  public applyPatch(
    projectId: string,
    projectRoot: string,
    patchId: string,
    userApproved: boolean
  ): ApplyPatchResult {
    const patch = this.patches.get(patchId);
    if (!patch) {
      throw new Error(`Patch not found: ${patchId}`);
    }

    if (!userApproved) {
      patch.status = 'rejected';
      throw new Error('Patch application rejected: Explicit user approval is mandatory.');
    }

    const fullPath = SecurityGuard.validatePathWithinProject(projectRoot, patch.filePath);

    // 1. Conflict detection: Check current content on disk vs expected originalContent
    if (fs.existsSync(fullPath)) {
      const currentDiskContent = fs.readFileSync(fullPath, 'utf-8');
      if (currentDiskContent !== patch.originalContent) {
        patch.status = 'conflict';
        logger.warn('PatcherService', `Conflict detected applying ${patchId} to ${patch.filePath}`);
        throw new Error(
          `Conflict detected: The file '${patch.filePath}' has been modified on disk since this patch was generated. Please regenerate the patch.`
        );
      }
    }

    // 2. Create rollback backup
    const backupDir = path.join(projectRoot, '.octo-backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFileName = `${Date.now()}-${path.basename(patch.filePath)}.bak`;
    const backupFilePath = path.join(backupDir, backupFileName);

    if (fs.existsSync(fullPath)) {
      fs.copyFileSync(fullPath, backupFilePath);
    } else {
      // Empty backup marker for newly created file
      fs.writeFileSync(backupFilePath, '', 'utf-8');
    }

    // 3. Ensure target directory exists and write proposed content
    const targetDir = path.dirname(fullPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(fullPath, patch.proposedContent, 'utf-8');
    patch.status = 'applied';

    this.backups.set(patchId, {
      originalPath: fullPath,
      backupPath: backupFilePath,
      timestamp: new Date().toISOString(),
    });

    SecurityGuard.logAudit('APPLY_CODE_PATCH', {
      patchId,
      filePath: patch.filePath,
      backupFilePath,
      userApproved,
    });

    return {
      success: true,
      patchId,
      filePath: patch.filePath,
      appliedAt: new Date().toISOString(),
      backupPath: backupFilePath,
      message: `Patch successfully applied to ${patch.filePath}. Rollback backup created.`,
    };
  }

  /**
   * Applies multiple patches in a coordinated batch.
   */
  public applyPatchSet(
    projectId: string,
    projectRoot: string,
    patchIds: string[],
    userApproved: boolean
  ): MultiFilePatchResult {
    const results: ApplyPatchResult[] = [];
    for (const patchId of patchIds) {
      const res = this.applyPatch(projectId, projectRoot, patchId, userApproved);
      results.push(res);
    }
    return {
      success: true,
      appliedPatches: results,
      message: `Successfully applied ${results.length} patches.`,
    };
  }

  /**
   * Creates a new file with directory creation and security validation.
   */
  public createFile(
    projectId: string,
    projectRoot: string,
    relativeFilePath: string,
    content: string,
    userApproved: boolean
  ): ApplyPatchResult {
    const proposal = this.preparePatch(projectId, projectRoot, relativeFilePath, content, `Create new file: ${relativeFilePath}`);
    return this.applyPatch(projectId, projectRoot, proposal.patchId, userApproved);
  }

  /**
   * Safely deletes a file with a pre-deletion backup.
   */
  public deleteFile(
    projectId: string,
    projectRoot: string,
    relativeFilePath: string,
    userApproved: boolean
  ): { success: boolean; backupPath: string; message: string } {
    if (!userApproved) {
      throw new Error('File deletion requires explicit user approval.');
    }

    const fullPath = SecurityGuard.validatePathWithinProject(projectRoot, relativeFilePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${relativeFilePath}`);
    }

    // Create rollback backup before deletion
    const backupDir = path.join(projectRoot, '.octo-backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupFileName = `${Date.now()}-deleted-${path.basename(relativeFilePath)}.bak`;
    const backupFilePath = path.join(backupDir, backupFileName);
    fs.copyFileSync(fullPath, backupFilePath);

    fs.unlinkSync(fullPath);

    SecurityGuard.logAudit('DELETE_FILE', {
      filePath: relativeFilePath,
      backupFilePath,
      userApproved,
    });

    return {
      success: true,
      backupPath: backupFilePath,
      message: `File ${relativeFilePath} deleted safely. Pre-deletion backup saved.`,
    };
  }

  /**
   * Moves or renames a file within the project boundary.
   */
  public moveFile(
    projectId: string,
    projectRoot: string,
    sourceRelative: string,
    targetRelative: string,
    userApproved: boolean
  ): { success: boolean; message: string } {
    if (!userApproved) {
      throw new Error('File move requires explicit user approval.');
    }

    const sourcePath = SecurityGuard.validatePathWithinProject(projectRoot, sourceRelative);
    const targetPath = SecurityGuard.validatePathWithinProject(projectRoot, targetRelative);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source file not found: ${sourceRelative}`);
    }

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.renameSync(sourcePath, targetPath);

    SecurityGuard.logAudit('MOVE_FILE', {
      source: sourceRelative,
      target: targetRelative,
      userApproved,
    });

    return {
      success: true,
      message: `File moved from ${sourceRelative} to ${targetRelative}.`,
    };
  }

  /**
   * Rolls back an applied patch using the backup.
   */
  public rollbackPatch(patchId: string): { success: boolean; message: string } {
    const backup = this.backups.get(patchId);
    if (!backup || !fs.existsSync(backup.backupPath)) {
      throw new Error(`Rollback failed: No backup found for patch ${patchId}`);
    }

    const backupContent = fs.readFileSync(backup.backupPath, 'utf-8');
    fs.writeFileSync(backup.originalPath, backupContent, 'utf-8');

    SecurityGuard.logAudit('ROLLBACK_CODE_PATCH', {
      patchId,
      originalPath: backup.originalPath,
    });

    const patch = this.patches.get(patchId);
    if (patch) {
      patch.status = 'pending';
    }

    return {
      success: true,
      message: `File restored successfully to pre-patch state from backup.`,
    };
  }
}
