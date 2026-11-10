import type { FastifyReply, FastifyRequest } from 'fastify';

import { HttpError } from '../../core/errors/http-error.js';
import {
  addMemberSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  projectMemberParamsSchema,
  searchUsersQuerySchema,
  switchModeSchema,
  updateGitSettingsSchema,
  updateMemberRoleSchema,
  updateProjectSchema,
} from './projects.schemas.js';
import type { ProjectsService } from './projects.service.js';
import { projectEventBus } from './projects.events.js';

export function createProjectsController(service: ProjectsService) {
  return {
    create: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const payload = createProjectSchema.parse(request.body);
      const project = await service.createProject(request.auth.userId, {
        name: payload.name,
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.color !== undefined ? { color: payload.color } : {}),
        ...(payload.mode !== undefined ? { mode: payload.mode } : {}),
        ...(payload.gitRemoteUrl !== undefined ? { gitRemoteUrl: payload.gitRemoteUrl } : {}),
      });

      return reply.status(201).send({
        success: true,
        data: {
          project,
        },
      });
    },

    list: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const query = listProjectsQuerySchema.parse(request.query);
      const projects = await service.listProjects(request.auth.userId, {
        ...(query.status !== undefined ? { status: query.status } : {}),
        ...(query.q !== undefined ? { q: query.q } : {}),
      });

      return reply.status(200).send({
        success: true,
        data: {
          projects,
        },
      });
    },

    getById: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const project = await service.getProject(request.auth.userId, params.id);

      return reply.status(200).send({
        success: true,
        data: {
          project,
        },
      });
    },

    update: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const payload = updateProjectSchema.parse(request.body);
      const project = await service.updateProject(request.auth.userId, params.id, {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.description !== undefined ? { description: payload.description } : {}),
        ...(payload.color !== undefined ? { color: payload.color } : {}),
        ...(payload.mode !== undefined ? { mode: payload.mode } : {}),
        ...(payload.gitRemoteUrl !== undefined ? { gitRemoteUrl: payload.gitRemoteUrl } : {}),
        ...(payload.gitBranch !== undefined ? { gitBranch: payload.gitBranch } : {}),
        ...(payload.gitSyncStatus !== undefined ? { gitSyncStatus: payload.gitSyncStatus } : {}),
      });

      return reply.status(200).send({
        success: true,
        data: {
          project,
        },
      });
    },

    archive: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const project = await service.archiveProject(request.auth.userId, params.id);

      return reply.status(200).send({
        success: true,
        data: {
          project,
        },
      });
    },

    deletePermanent: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const result = await service.deleteProject(request.auth.userId, params.id);

      return reply.status(200).send({
        success: true,
        message: 'Project deleted successfully',
        data: result,
      });
    },

    // --- Collaboration Controllers ---

    listMembers: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const members = await service.listMembers(request.auth.userId, params.id);

      return reply.status(200).send({
        success: true,
        data: { members },
      });
    },

    addMember: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const payload = addMemberSchema.parse(request.body);
      const member = await service.addMember(request.auth.userId, params.id, payload);

      return reply.status(201).send({
        success: true,
        message: 'Team member added successfully',
        data: { member },
      });
    },

    updateMemberRole: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectMemberParamsSchema.parse(request.params);
      const payload = updateMemberRoleSchema.parse(request.body);
      const member = await service.updateMemberRole(request.auth.userId, params.id, params.memberId, payload.role);

      return reply.status(200).send({
        success: true,
        message: 'Member role updated successfully',
        data: { member },
      });
    },

    removeMember: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectMemberParamsSchema.parse(request.params);
      const result = await service.removeMember(request.auth.userId, params.id, params.memberId);

      return reply.status(200).send({
        success: true,
        message: 'Member access revoked successfully',
        data: result,
      });
    },

    switchMode: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const payload = switchModeSchema.parse(request.body);
      const project = await service.switchMode(request.auth.userId, params.id, payload.mode);

      return reply.status(200).send({
        success: true,
        message: `Project switched to ${payload.mode} mode`,
        data: { project },
      });
    },

    listActivities: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const activities = await service.listActivities(request.auth.userId, params.id);

      return reply.status(200).send({
        success: true,
        data: { activities },
      });
    },

    updateGitSettings: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      const payload = updateGitSettingsSchema.parse(request.body);
      const project = await service.updateGitSettings(request.auth.userId, params.id, payload);

      return reply.status(200).send({
        success: true,
        data: { project },
      });
    },

    searchUsers: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const query = searchUsersQuerySchema.parse(request.query);
      const users = await service.searchUsers(request.auth.userId, query.q);

      return reply.status(200).send({
        success: true,
        data: { users },
      });
    },

    streamEvents: async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.auth) {
        throw new HttpError(401, 'AUTH_REQUIRED', 'Authentication required');
      }

      const params = projectIdParamsSchema.parse(request.params);
      // Validate access to project
      await service.getProject(request.auth.userId, params.id);

      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders?.();

      // Send initial connection packet
      reply.raw.write(`event: connected\ndata: ${JSON.stringify({ connected: true, projectId: params.id })}\n\n`);

      const unsubscribe = projectEventBus.subscribe(params.id, (event) => {
        reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      request.raw.on('close', () => {
        unsubscribe();
      });
    },
  };
}
