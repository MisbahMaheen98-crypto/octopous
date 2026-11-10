import type { ProjectColor, ProjectMode } from './types';

export function buildCreateProjectInput(input: {
  name: string;
  description: string;
  color: ProjectColor | null;
  mode?: ProjectMode | undefined;
  gitRemoteUrl?: string | undefined;
}) {
  const trimmedDescription = input.description.trim();

  return {
    name: input.name,
    ...(trimmedDescription ? { description: trimmedDescription } : {}),
    ...(input.color ? { color: input.color } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.gitRemoteUrl ? { gitRemoteUrl: input.gitRemoteUrl.trim() } : {}),
  };
}

export function buildUpdateProjectInput(input: {
  name: string;
  description: string;
  color: ProjectColor | null;
  mode?: ProjectMode | undefined;
  gitRemoteUrl?: string | null | undefined;
  gitBranch?: string | null | undefined;
  gitSyncStatus?: string | null | undefined;
}) {
  return {
    name: input.name,
    description: input.description,
    color: input.color,
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.gitRemoteUrl !== undefined ? { gitRemoteUrl: input.gitRemoteUrl } : {}),
    ...(input.gitBranch !== undefined ? { gitBranch: input.gitBranch } : {}),
    ...(input.gitSyncStatus !== undefined ? { gitSyncStatus: input.gitSyncStatus } : {}),
  };
}

export function resolveEditProjectColor(color: ProjectColor | null | undefined) {
  return color ?? null;
}
