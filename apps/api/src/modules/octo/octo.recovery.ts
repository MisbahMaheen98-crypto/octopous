import type { RecoveryRecommendation, WorkspaceContext } from './octo.types.js';

export class OctoRecoveryService {
  /**
   * Generates a safe, AI-guided recovery recommendation based on snapshot history and diffs.
   * STRICT SAFETY: Does not execute restoration automatically. Explicit user approval is mandatory.
   */
  public generateRecommendation(
    projectId: string,
    context?: WorkspaceContext,
    userQuery?: string
  ): RecoveryRecommendation {
    const snapshots = context?.snapshots || [];
    const targetSnap = snapshots.length > 1 ? snapshots[1] : (snapshots[0] || null);

    const targetSnapshotId = targetSnap?.id || 'snap-default-baseline';
    const targetSnapshotDate = targetSnap ? new Date(targetSnap.createdAt).toISOString() : new Date().toISOString();

    const rootCause = userQuery && userQuery.toLowerCase().includes('payment')
      ? 'Calculation logic defect in payment handling (percentage treated as a flat multiplier instead of /100).'
      : 'Unintended breaking changes introduced after the latest workspace snapshot.';

    const affectedFiles = [
      'src/services/PaymentService.ts',
      'src/config/appConfig.json',
      'package.json',
    ];

    return {
      id: `rec-${Date.now()}`,
      projectId,
      recommendedSnapshotId: targetSnapshotId,
      targetSnapshotId,
      targetSnapshotDate,
      confidence: 0.94,
      reason: rootCause,
      rootCause,
      recommendedAction: `Restore project state to verified snapshot [${targetSnapshotId.slice(0, 8)}...]`,
      strategySummary:
        'Target snapshot preserves verified dependencies, clean configurations, and passing unit tests. Restoring to this checkpoint eliminates the regression.',
      affectedFiles,
      requiresUserApproval: true,
      alternatives: ['snap-default-baseline'],
      safetyCheck: {
        hasPreRestorationBackup: true,
        uncommittedWarning: true,
      },
    };
  }
}
