import { z } from 'zod';

import { PROJECT_COLORS } from './projects.colors.js';

export const projectStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export const projectColorSchema = z.enum(PROJECT_COLORS);
export const projectModeSchema = z.enum(['INDIVIDUAL', 'COLLABORATIVE']);
export const projectRoleSchema = z.enum(['OWNER', 'DEVELOPER', 'VIEWER']);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(120),
  description: z.string().trim().max(2000).optional(),
  color: projectColorSchema.optional(),
  mode: projectModeSchema.optional(),
  gitRemoteUrl: z.string().trim().max(500).optional(),
});

export const listProjectsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: projectStatusSchema.optional(),
});

export const projectIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const projectMemberParamsSchema = z.object({
  id: z.string().min(1),
  memberId: z.string().min(1),
});

export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).optional(),
    color: z.union([projectColorSchema, z.null()]).optional(),
    mode: projectModeSchema.optional(),
    gitRemoteUrl: z.string().trim().max(500).nullable().optional(),
    gitBranch: z.string().trim().max(120).nullable().optional(),
    gitSyncStatus: z.string().trim().max(120).nullable().optional(),
  })
  .refine(
    (input) =>
      input.name !== undefined ||
      input.description !== undefined ||
      input.color !== undefined ||
      input.mode !== undefined ||
      input.gitRemoteUrl !== undefined ||
      input.gitBranch !== undefined ||
      input.gitSyncStatus !== undefined,
    {
      message: 'At least one field is required for update',
    },
  );

export const addMemberSchema = z.object({
  emailOrUsername: z.string().trim().min(1, 'Username or email is required'),
  role: z.enum(['DEVELOPER', 'VIEWER']).optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['DEVELOPER', 'VIEWER']),
});

export const switchModeSchema = z.object({
  mode: projectModeSchema,
});

export const updateGitSettingsSchema = z.object({
  gitRemoteUrl: z.string().trim().max(500).optional(),
  gitBranch: z.string().trim().max(120).optional(),
  gitSyncStatus: z.string().trim().max(120).optional(),
});

export const searchUsersQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(100),
});

export type CreateProjectPayload = z.infer<typeof createProjectSchema>;
export type ListProjectsQueryPayload = z.infer<typeof listProjectsQuerySchema>;
export type UpdateProjectPayload = z.infer<typeof updateProjectSchema>;
export type AddMemberPayload = z.infer<typeof addMemberSchema>;
export type UpdateMemberRolePayload = z.infer<typeof updateMemberRoleSchema>;
