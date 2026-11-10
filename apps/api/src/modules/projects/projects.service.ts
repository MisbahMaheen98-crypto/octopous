import { HttpError } from '../../core/errors/http-error.js';
import type { ProjectColor } from './projects.colors.js';
import { ProjectsRepository } from './projects.repository.js';
import type { ProjectMode, ProjectRole, PublicMember, PublicProject, PublicActivity } from './projects.types.js';
import { projectEventBus } from './projects.events.js';

type CreateProjectInput = {
  name: string;
  description?: string | undefined;
  color?: ProjectColor | undefined;
  mode?: ProjectMode | undefined;
  gitRemoteUrl?: string | undefined;
};

type ListProjectsInput = {
  status?: 'ACTIVE' | 'ARCHIVED' | undefined;
  q?: string | undefined;
};

type UpdateProjectInput = {
  name?: string | undefined;
  description?: string | undefined;
  color?: ProjectColor | null | undefined;
  mode?: ProjectMode | undefined;
  gitRemoteUrl?: string | null | undefined;
  gitBranch?: string | null | undefined;
  gitSyncStatus?: string | null | undefined;
};

export class ProjectsService {
  constructor(private readonly repository: ProjectsRepository) {}

  private async findProjectForUser(userId: string, projectId: string) {
    if (typeof (this.repository as any).findProjectByIdForUser === 'function') {
      return (this.repository as any).findProjectByIdForUser(userId, projectId);
    }
    const fallback = await this.repository.findProjectByIdForOwner(userId, projectId);
    if (!fallback) return null;
    return {
      ...fallback,
      userRole: 'OWNER' as ProjectRole,
      memberCount: 1,
      mode: 'INDIVIDUAL' as ProjectMode,
    };
  }

  async createProject(ownerId: string, input: CreateProjectInput): Promise<PublicProject> {
    const normalizedName = input.name.trim();
    const normalizedDescription = input.description?.trim();

    const existing = await this.repository.findProjectByOwnerAndName(ownerId, normalizedName);
    if (existing) {
      throw new HttpError(409, 'PROJECT_NAME_EXISTS', 'A project with this name already exists');
    }

    const project = await this.repository.createProject({
      ownerId,
      name: normalizedName,
      ...(normalizedDescription ? { description: normalizedDescription } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      mode: input.mode ?? 'INDIVIDUAL',
      ...(input.gitRemoteUrl !== undefined ? { gitRemoteUrl: input.gitRemoteUrl.trim() } : {}),
    });

    return this.toPublicProject(project, 'OWNER', 1);
  }

  async listProjects(userId: string, input: ListProjectsInput): Promise<PublicProject[]> {
    const projects = await this.repository.listProjects({
      userId,
      ownerId: userId,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.q !== undefined ? { q: input.q } : {}),
    });

    return projects.map((p) =>
      this.toPublicProject(p, (p as any).userRole ?? 'OWNER', (p as any).memberCount ?? 1)
    );
  }

  async getProject(userId: string, projectId: string): Promise<PublicProject> {
    const project = await this.findProjectForUser(userId, projectId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    return this.toPublicProject(project, project.userRole, project.memberCount);
  }

  async updateProject(userId: string, projectId: string, input: UpdateProjectInput): Promise<PublicProject> {
    const current = await this.findProjectForUser(userId, projectId);
    if (!current) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (current.userRole !== 'OWNER') {
      throw new HttpError(403, 'FORBIDDEN', 'Only the project Admin/Owner can modify project settings');
    }

    if (input.name) {
      const normalizedName = input.name.trim();
      const existing = await this.repository.findProjectByOwnerAndName(userId, normalizedName);
      if (existing && existing.id !== projectId) {
        throw new HttpError(409, 'PROJECT_NAME_EXISTS', 'A project with this name already exists');
      }
    }

    const result = await this.repository.updateProject(userId, projectId, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description.trim() } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.gitRemoteUrl !== undefined ? { gitRemoteUrl: input.gitRemoteUrl } : {}),
      ...(input.gitBranch !== undefined ? { gitBranch: input.gitBranch } : {}),
      ...(input.gitSyncStatus !== undefined ? { gitSyncStatus: input.gitSyncStatus } : {}),
    });

    if (result.count === 0) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    projectEventBus.publish(projectId, {
      type: 'MODE_UPDATED',
      userId,
      data: { updatedFields: Object.keys(input) },
    });

    return this.getProject(userId, projectId);
  }

  async archiveProject(userId: string, projectId: string): Promise<PublicProject> {
    const current = await this.findProjectForUser(userId, projectId);
    if (!current) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (current.userRole !== 'OWNER') {
      throw new HttpError(403, 'FORBIDDEN', 'Only the project Admin/Owner can archive this project');
    }

    const result = await this.repository.archiveProject(userId, projectId);
    if (result.count === 0) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    return this.getProject(userId, projectId);
  }

  async deleteProject(userId: string, projectId: string) {
    const current = await this.findProjectForUser(userId, projectId);
    if (!current) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (current.userRole !== 'OWNER') {
      throw new HttpError(403, 'FORBIDDEN', 'Only the project Admin/Owner can delete this project');
    }

    const result = await this.repository.deleteProjectIfNoSnapshots(userId, projectId);
    if (!result.projectFound) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (result.remainingSnapshots > 0) {
      throw new HttpError(
        409,
        'PROJECT_HAS_SNAPSHOTS',
        'Delete all snapshots before deleting this project.',
      );
    }

    return { projectId, deleted: true as const };
  }

  // --- Member Management (Admin Controlled) ---

  async listMembers(userId: string, projectId: string): Promise<PublicMember[]> {
    const project = await this.findProjectForUser(userId, projectId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    const members = await this.repository.listMembers(projectId);
    return members.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      userId: m.userId,
      role: m.role as ProjectRole,
      joinedAt: m.joinedAt.toISOString(),
      user: m.user,
    }));
  }

  async addMember(
    adminUserId: string,
    projectId: string,
    input: { emailOrUsername: string; role?: 'DEVELOPER' | 'VIEWER' | undefined }
  ): Promise<PublicMember> {
    const project = await this.findProjectForUser(adminUserId, projectId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (project.userRole !== 'OWNER') {
      throw new HttpError(403, 'FORBIDDEN', 'Only the project Admin/Owner can add team members');
    }

    const targetUser = await this.repository.findUserByEmailOrUsername(input.emailOrUsername);
    if (!targetUser) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'No registered user found with that email or username');
    }

    if (targetUser.id === adminUserId) {
      throw new HttpError(400, 'CANNOT_ADD_SELF', 'The Admin is already the primary owner of this project');
    }

    if (project.mode === 'INDIVIDUAL') {
      await this.repository.updateProject(adminUserId, projectId, { mode: 'COLLABORATIVE' });
    }

    const role: ProjectRole = input.role ?? 'DEVELOPER';
    const member = await this.repository.addMember(projectId, targetUser.id, role);

    await this.repository.recordActivity(projectId, adminUserId, 'MEMBER_ADDED', {
      addedUserId: targetUser.id,
      username: targetUser.username,
      role,
    });

    projectEventBus.publish(projectId, {
      type: 'MEMBER_ADDED',
      userId: adminUserId,
      data: { memberId: member.id, user: targetUser, role },
    });

    return {
      id: member.id,
      projectId: member.projectId,
      userId: member.userId,
      role: member.role as ProjectRole,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    };
  }

  async updateMemberRole(
    adminUserId: string,
    projectId: string,
    memberUserId: string,
    newRole: 'DEVELOPER' | 'VIEWER'
  ): Promise<PublicMember> {
    const project = await this.findProjectForUser(adminUserId, projectId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (project.userRole !== 'OWNER') {
      throw new HttpError(403, 'FORBIDDEN', 'Only the project Admin/Owner can change member roles');
    }

    if (memberUserId === adminUserId) {
      throw new HttpError(400, 'CANNOT_MODIFY_OWNER_ROLE', 'Cannot change the primary owner role');
    }

    const existing = await this.repository.findMember(projectId, memberUserId);
    if (!existing) {
      throw new HttpError(404, 'MEMBER_NOT_FOUND', 'User is not a member of this project');
    }

    const updated = await this.repository.updateMemberRole(projectId, memberUserId, newRole);

    await this.repository.recordActivity(projectId, adminUserId, 'ROLE_UPDATED', {
      memberUserId,
      username: existing.user.username,
      newRole,
    });

    projectEventBus.publish(projectId, {
      type: 'ROLE_UPDATED',
      userId: adminUserId,
      data: { memberUserId, newRole },
    });

    return {
      id: updated.id,
      projectId: updated.projectId,
      userId: updated.userId,
      role: updated.role as ProjectRole,
      joinedAt: updated.joinedAt.toISOString(),
      user: updated.user,
    };
  }

  async removeMember(adminUserId: string, projectId: string, memberUserId: string) {
    const project = await this.findProjectForUser(adminUserId, projectId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (project.userRole !== 'OWNER' && adminUserId !== memberUserId) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the project Admin/Owner can remove members');
    }

    if (memberUserId === project.ownerId) {
      throw new HttpError(400, 'CANNOT_REMOVE_OWNER', 'The primary project owner cannot be removed');
    }

    const existing = await this.repository.findMember(projectId, memberUserId);
    if (!existing) {
      throw new HttpError(404, 'MEMBER_NOT_FOUND', 'User is not a member of this project');
    }

    await this.repository.removeMember(projectId, memberUserId);

    await this.repository.recordActivity(projectId, adminUserId, 'MEMBER_REMOVED', {
      removedUserId: memberUserId,
      username: existing.user.username,
    });

    projectEventBus.publish(projectId, {
      type: 'MEMBER_REMOVED',
      userId: adminUserId,
      data: { removedUserId: memberUserId },
    });

    return { projectId, memberUserId, removed: true as const };
  }

  // --- Project Mode Switching ---

  async switchMode(adminUserId: string, projectId: string, mode: ProjectMode): Promise<PublicProject> {
    const project = await this.findProjectForUser(adminUserId, projectId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (project.userRole !== 'OWNER') {
      throw new HttpError(403, 'FORBIDDEN', 'Only the project Admin/Owner can change the project mode');
    }

    await this.repository.updateProject(adminUserId, projectId, { mode });

    await this.repository.recordActivity(projectId, adminUserId, 'MODE_UPDATED', { mode });

    projectEventBus.publish(projectId, {
      type: 'MODE_UPDATED',
      userId: adminUserId,
      data: { mode },
    });

    return this.getProject(adminUserId, projectId);
  }

  // --- Shared Live Activity Feed ---

  async listActivities(userId: string, projectId: string, limit = 50): Promise<PublicActivity[]> {
    const project = await this.findProjectForUser(userId, projectId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    const activities = await this.repository.listActivities(projectId, limit);
    return activities.map((a) => ({
      id: a.id,
      projectId: a.projectId,
      userId: a.userId,
      action: a.action,
      details: (a.details as Record<string, unknown>) ?? null,
      createdAt: a.createdAt.toISOString(),
      user: a.user,
    }));
  }

  async recordActivity(projectId: string, userId: string, action: string, details?: Record<string, unknown>) {
    return this.repository.recordActivity(projectId, userId, action, details);
  }

  // --- Git Sync Configuration ---

  async updateGitSettings(
    userId: string,
    projectId: string,
    input: { gitRemoteUrl?: string | undefined; gitBranch?: string | undefined; gitSyncStatus?: string | undefined }
  ): Promise<PublicProject> {
    const project = await this.findProjectForUser(userId, projectId);
    if (!project) {
      throw new HttpError(404, 'PROJECT_NOT_FOUND', 'Project not found');
    }

    if (project.userRole === 'VIEWER') {
      throw new HttpError(403, 'FORBIDDEN', 'Viewers cannot change Git synchronization settings');
    }

    await this.repository.updateProject(project.ownerId, projectId, {
      ...(input.gitRemoteUrl !== undefined ? { gitRemoteUrl: input.gitRemoteUrl } : {}),
      ...(input.gitBranch !== undefined ? { gitBranch: input.gitBranch } : {}),
      ...(input.gitSyncStatus !== undefined ? { gitSyncStatus: input.gitSyncStatus } : {}),
    });

    await this.repository.recordActivity(projectId, userId, 'GIT_SYNC_UPDATED', input);

    projectEventBus.publish(projectId, {
      type: 'GIT_SYNC_UPDATED',
      userId,
      data: input,
    });

    return this.getProject(userId, projectId);
  }

  // --- User Search ---

  async searchUsers(requesterId: string, query: string) {
    return this.repository.searchUsers(query, requesterId);
  }

  // --- Helper ---

  private toPublicProject(
    project: {
      id: string;
      ownerId: string;
      name: string;
      description: string | null;
      color: ProjectColor | null;
      status: 'ACTIVE' | 'ARCHIVED';
      mode?: ProjectMode | undefined;
      gitRemoteUrl?: string | null | undefined;
      gitBranch?: string | null | undefined;
      gitSyncStatus?: string | null | undefined;
      createdAt: Date;
      updatedAt: Date;
      archivedAt: Date | null;
    },
    userRole: ProjectRole = 'OWNER',
    memberCount = 1
  ): PublicProject {
    return {
      id: project.id,
      ownerId: project.ownerId,
      name: project.name,
      description: project.description,
      color: project.color,
      status: project.status,
      mode: (project.mode as ProjectMode) ?? 'INDIVIDUAL',
      userRole,
      memberCount,
      gitRemoteUrl: project.gitRemoteUrl ?? null,
      gitBranch: project.gitBranch ?? 'main',
      gitSyncStatus: project.gitSyncStatus ?? 'SYNCED',
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
    };
  }
}
