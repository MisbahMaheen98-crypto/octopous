import { prisma } from '../../db/client.js';
import type { ProjectColor } from './projects.colors.js';
import type { ProjectMode, ProjectRole } from './projects.types.js';

type ListProjectsInput = {
  userId?: string | undefined;
  ownerId?: string | undefined;
  status?: 'ACTIVE' | 'ARCHIVED' | undefined;
  q?: string | undefined;
};

export class ProjectsRepository {
  async createProject(input: {
    ownerId: string;
    name: string;
    description?: string | undefined;
    color?: ProjectColor | undefined;
    mode?: ProjectMode | undefined;
    gitRemoteUrl?: string | undefined;
  }) {
    const mode = input.mode ?? 'INDIVIDUAL';
    const data = {
      ownerId: input.ownerId,
      name: input.name,
      mode,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.gitRemoteUrl !== undefined ? { gitRemoteUrl: input.gitRemoteUrl } : {}),
    };

    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({ data });

      // Automatically register the owner in project members for collaborative tracking
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: input.ownerId,
          role: 'OWNER',
        },
      });

      // Record activity
      await tx.projectActivity.create({
        data: {
          projectId: project.id,
          userId: input.ownerId,
          action: 'PROJECT_CREATED',
          details: { mode, name: project.name },
        },
      });

      return project;
    });
  }

  async findProjectByOwnerAndName(ownerId: string, name: string) {
    return prisma.project.findFirst({
      where: {
        ownerId,
        status: 'ACTIVE',
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });
  }

  async listProjects(input: ListProjectsInput) {
    const userId = input.userId ?? input.ownerId ?? '';
    const { status, q } = input;
    const queryFilter = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { description: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const projects = await prisma.project.findMany({
      where: {
        AND: [
          {
            OR: [
              { ownerId: userId },
              {
                mode: 'COLLABORATIVE',
                members: { some: { userId } },
              },
            ],
          },
          ...(status ? [{ status }] : []),
          ...(q ? [queryFilter] : []),
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return projects.map((p) => {
      let userRole: ProjectRole = 'VIEWER';
      if (p.ownerId === userId) {
        userRole = 'OWNER';
      } else {
        const membership = p.members.find((m) => m.userId === userId);
        if (membership) {
          userRole = membership.role as ProjectRole;
        }
      }

      return {
        ...p,
        userRole,
        memberCount: p.members.length,
      };
    });
  }

  async findProjectByIdForUser(userId: string, projectId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          {
            mode: 'COLLABORATIVE',
            members: { some: { userId } },
          },
        ],
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true },
            },
          },
        },
      },
    });

    if (!project) return null;

    let userRole: ProjectRole = 'VIEWER';
    if (project.ownerId === userId) {
      userRole = 'OWNER';
    } else {
      const membership = project.members.find((m) => m.userId === userId);
      if (membership) {
        userRole = membership.role as ProjectRole;
      }
    }

    return {
      ...project,
      userRole,
      memberCount: project.members.length,
    };
  }

  async findProjectByIdForOwner(ownerId: string, id: string) {
    return prisma.project.findFirst({
      where: {
        id,
        ownerId,
      },
    });
  }

  async updateProject(
    ownerId: string,
    id: string,
    input: {
      name?: string | undefined;
      description?: string | undefined;
      color?: ProjectColor | null | undefined;
      mode?: ProjectMode | undefined;
      gitRemoteUrl?: string | null | undefined;
      gitBranch?: string | null | undefined;
      gitSyncStatus?: string | null | undefined;
    },
  ) {
    const data = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.mode !== undefined ? { mode: input.mode } : {}),
      ...(input.gitRemoteUrl !== undefined ? { gitRemoteUrl: input.gitRemoteUrl } : {}),
      ...(input.gitBranch !== undefined ? { gitBranch: input.gitBranch } : {}),
      ...(input.gitSyncStatus !== undefined ? { gitSyncStatus: input.gitSyncStatus } : {}),
    };

    return prisma.project.updateMany({
      where: {
        id,
        ownerId,
      },
      data,
    });
  }

  async archiveProject(ownerId: string, id: string) {
    return prisma.project.updateMany({
      where: {
        id,
        ownerId,
      },
      data: {
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });
  }

  async deleteProjectIfNoSnapshots(ownerId: string, id: string) {
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.findFirst({
        where: {
          id,
          ownerId,
        },
        select: {
          id: true,
        },
      });

      if (!project) {
        return {
          projectFound: false,
          remainingSnapshots: 0,
          deleted: false,
        } as const;
      }

      const remainingSnapshots = await tx.snapshot.count({
        where: {
          projectId: id,
        },
      });

      if (remainingSnapshots > 0) {
        return {
          projectFound: true,
          remainingSnapshots,
          deleted: false,
        } as const;
      }

      const deleted = await tx.project.deleteMany({
        where: {
          id,
          ownerId,
        },
      });

      return {
        projectFound: true,
        remainingSnapshots: 0,
        deleted: deleted.count > 0,
      } as const;
    });
  }

  // --- Collaboration: Member Management ---

  async listMembers(projectId: string) {
    return prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
  }

  async findMember(projectId: string, userId: string) {
    return prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async addMember(projectId: string, userId: string, role: ProjectRole) {
    return prisma.projectMember.upsert({
      where: {
        projectId_userId: { projectId, userId },
      },
      create: {
        projectId,
        userId,
        role,
      },
      update: {
        role,
      },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async updateMemberRole(projectId: string, userId: string, role: ProjectRole) {
    return prisma.projectMember.update({
      where: {
        projectId_userId: { projectId, userId },
      },
      data: { role },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async removeMember(projectId: string, userId: string) {
    return prisma.projectMember.deleteMany({
      where: {
        projectId,
        userId,
      },
    });
  }

  // --- Collaboration: Activity Tracking ---

  async recordActivity(projectId: string, userId: string, action: string, details?: Record<string, unknown>) {
    const data = {
      projectId,
      userId,
      action,
      ...(details !== undefined ? { details: details as any } : {}),
    };

    return prisma.projectActivity.create({
      data: data as any,
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
  }

  async listActivities(projectId: string, limit = 50) {
    return prisma.projectActivity.findMany({
      where: { projectId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, email: true } },
      },
    });
  }

  // --- Registered User Search for Team Invitations ---

  async searchUsers(query: string, excludeUserId: string, limit = 10) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    return prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
        OR: [
          { username: { contains: trimmed, mode: 'insensitive' } },
          { email: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
      take: limit,
    });
  }

  async findUserByEmailOrUsername(emailOrUsername: string) {
    const trimmed = emailOrUsername.trim();
    return prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: trimmed, mode: 'insensitive' } },
          { username: { equals: trimmed, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });
  }
}
