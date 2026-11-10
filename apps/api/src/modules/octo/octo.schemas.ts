import { z } from 'zod';
import type { OctoPageContext } from './octo.types.js';

export const octoPageContextSchema = z.enum([
  'DASHBOARD',
  'PROJECTS',
  'PROJECT_DETAILS',
  'SNAPSHOT',
  'BLUEPRINT',
  'SECRET_VAULT',
  'SETTINGS',
] as const satisfies readonly OctoPageContext[]);

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'octo']),
  content: z.string(),
  timestamp: z.string(),
  images: z.array(z.string()).optional(),
  fileReferences: z.array(z.string()).optional(),
  isSimulated: z.boolean().optional(),
});

export const octoRequestSchema = z.object({
  question: z.string().min(1).max(5000),
  pageContext: octoPageContextSchema.optional().default('DASHBOARD'),
  projectId: z.string().optional(),
  snapshotId: z.string().optional(),
  messages: z.array(chatMessageSchema).optional(),
  images: z.array(z.string()).optional(),
  selectedModel: z.string().optional(),
});

export type OctoRequestPayload = z.infer<typeof octoRequestSchema>;

export const octoResponseSchema = z.object({
  reply: z.string(),
  intent: z.string(),
  suggestions: z.array(z.string()),
  summary: z.object({
    greeting: z.string(),
    projectCount: z.number().nonnegative(),
    snapshotCount: z.number().nonnegative(),
    suggestions: z.array(z.string()),
  }),
});

export type OctoResponsePayload = z.infer<typeof octoResponseSchema>;
