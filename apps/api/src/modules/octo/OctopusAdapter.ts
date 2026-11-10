import {
  Snapshot,
  SnapshotComparison,
  RecoveryPlan,
  ProjectDna,
  ProjectPulse,
  ProjectWill,
  ProjectInfo,
  OctopusContributor,
  OctopusProjectEvent,
  RecoveryExecutionResult,
} from './octo.types.js';

export interface OctopusAdapter {
  readonly isMock: boolean;
  readonly providerName: string;

  getProjectMetadata(projectId: string): Promise<ProjectInfo>;
  listSnapshots(projectId: string): Promise<Snapshot[]>;
  getSnapshot(projectId: string, snapshotId: string): Promise<Snapshot | null>;
  compareSnapshots(projectId: string, baseId: string, targetId: string): Promise<SnapshotComparison>;
  getProjectEvents(projectId: string, limit?: number): Promise<OctopusProjectEvent[]>;
  getContributors(projectId: string): Promise<OctopusContributor[]>;
  
  prepareRecovery(projectId: string, problemDescription: string): Promise<RecoveryPlan>;
  executeRecovery(projectId: string, planId: string, confirmed: boolean): Promise<RecoveryExecutionResult>;

  getProjectDna(projectId: string): Promise<ProjectDna>;
  getProjectPulse(projectId: string): Promise<ProjectPulse>;
  getProjectWill(projectId: string): Promise<ProjectWill>;
}
