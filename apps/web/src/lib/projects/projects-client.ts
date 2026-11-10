import type { ApiEnvelope } from '../auth/types';
import { apiRequest } from '../api/client';
import type {
  Project,
  ProjectColor,
  ProjectListResponse,
  ProjectStatus,
  ProjectMode,
  ProjectRole,
  ProjectMember,
  ProjectActivityItem,
} from './types';

export async function createProject(input: {
  name: string;
  description?: string | undefined;
  color?: ProjectColor | undefined;
  mode?: ProjectMode | undefined;
  gitRemoteUrl?: string | undefined;
}) {
  return apiRequest<{ project: Project }>('/projects', {
    method: 'POST',
    body: input,
  }) as Promise<ApiEnvelope<{ project: Project }>>;
}

export async function listProjects(params?: { q?: string; status?: ProjectStatus }) {
  const search = new URLSearchParams();
  if (params?.q) {
    search.set('q', params.q);
  }

  if (params?.status) {
    search.set('status', params.status);
  }

  const queryString = search.toString();
  const path = queryString ? `/projects?${queryString}` : '/projects';

  return apiRequest<ProjectListResponse>(path, {
    method: 'GET',
  }) as Promise<ApiEnvelope<ProjectListResponse>>;
}

export async function getProject(projectId: string) {
  return apiRequest<{ project: Project }>(`/projects/${projectId}`, {
    method: 'GET',
  }) as Promise<ApiEnvelope<{ project: Project }>>;
}

export async function updateProject(
  projectId: string,
  input: {
    name?: string | undefined;
    description?: string | undefined;
    color?: ProjectColor | null | undefined;
    mode?: ProjectMode | undefined;
    gitRemoteUrl?: string | null | undefined;
    gitBranch?: string | null | undefined;
    gitSyncStatus?: string | null | undefined;
  }
) {
  return apiRequest<{ project: Project }>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: input,
  }) as Promise<ApiEnvelope<{ project: Project }>>;
}

export async function deleteProject(projectId: string) {
  return apiRequest<{ projectId: string; deleted: boolean }>(`/projects/${projectId}/permanent`, {
    method: 'DELETE',
  }) as Promise<ApiEnvelope<{ projectId: string; deleted: boolean }>>;
}

// --- Collaboration API ---

export async function listProjectMembers(projectId: string) {
  return apiRequest<{ members: ProjectMember[] }>(`/projects/${projectId}/members`, {
    method: 'GET',
  }) as Promise<ApiEnvelope<{ members: ProjectMember[] }>>;
}

export async function addProjectMember(
  projectId: string,
  input: { emailOrUsername: string; role?: 'DEVELOPER' | 'VIEWER' | undefined }
) {
  return apiRequest<{ member: ProjectMember }>(`/projects/${projectId}/members`, {
    method: 'POST',
    body: input,
  }) as Promise<ApiEnvelope<{ member: ProjectMember }>>;
}

export async function updateProjectMemberRole(
  projectId: string,
  memberId: string,
  role: 'DEVELOPER' | 'VIEWER'
) {
  return apiRequest<{ member: ProjectMember }>(`/projects/${projectId}/members/${memberId}`, {
    method: 'PATCH',
    body: { role },
  }) as Promise<ApiEnvelope<{ member: ProjectMember }>>;
}

export async function removeProjectMember(projectId: string, memberId: string) {
  return apiRequest<{ projectId: string; memberUserId: string; removed: boolean }>(
    `/projects/${projectId}/members/${memberId}`,
    {
      method: 'DELETE',
    }
  ) as Promise<ApiEnvelope<{ projectId: string; memberUserId: string; removed: boolean }>>;
}

export async function switchProjectMode(projectId: string, mode: ProjectMode) {
  return apiRequest<{ project: Project }>(`/projects/${projectId}/mode`, {
    method: 'PATCH',
    body: { mode },
  }) as Promise<ApiEnvelope<{ project: Project }>>;
}

export async function listProjectActivities(projectId: string) {
  return apiRequest<{ activities: ProjectActivityItem[] }>(`/projects/${projectId}/activities`, {
    method: 'GET',
  }) as Promise<ApiEnvelope<{ activities: ProjectActivityItem[] }>>;
}

export async function updateProjectGit(
  projectId: string,
  input: { gitRemoteUrl?: string | undefined; gitBranch?: string | undefined; gitSyncStatus?: string | undefined }
) {
  return apiRequest<{ project: Project }>(`/projects/${projectId}/git`, {
    method: 'PATCH',
    body: input,
  }) as Promise<ApiEnvelope<{ project: Project }>>;
}

export async function searchUsers(query: string) {
  return apiRequest<{ users: Array<{ id: string; username: string; email: string }> }>(
    `/users/search?q=${encodeURIComponent(query)}`,
    {
      method: 'GET',
    }
  ) as Promise<ApiEnvelope<{ users: Array<{ id: string; username: string; email: string }> }>>;
}

export function subscribeProjectEvents(
  projectId: string,
  onEvent: (event: { type: string; data?: any; timestamp: string }) => void
): () => void {
  const eventSource = new EventSource(`/api/v1/projects/${projectId}/events`);

  const handler = (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch {
      // Ignored
    }
  };

  eventSource.addEventListener('SNAPSHOT_CREATED', handler);
  eventSource.addEventListener('MEMBER_ADDED', handler);
  eventSource.addEventListener('MEMBER_REMOVED', handler);
  eventSource.addEventListener('ROLE_UPDATED', handler);
  eventSource.addEventListener('MODE_UPDATED', handler);
  eventSource.addEventListener('GIT_SYNC_UPDATED', handler);

  return () => {
    eventSource.close();
  };
}
