import type { Project } from './api/projects';
import type { SnapshotRecord } from './contracts/snapshot';

export type ExtensionViewState = {
  connectedUser: string | null;
  selectedProject: Project | null;
  lastCaptureSummary: string | null;
  exclusionPreview: string[];
  snapshots: SnapshotRecord[];
  isLoadingSnapshots: boolean;
};

export function createInitialViewState(): ExtensionViewState {
  return {
    connectedUser: null,
    selectedProject: null,
    lastCaptureSummary: null,
    exclusionPreview: [],
    snapshots: [],
    isLoadingSnapshots: false,
  };
}
