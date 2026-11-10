/**
 * Octo Routes
 * Route registration for OCTOBOT endpoints in Fastify.
 */

import type { FastifyInstance } from 'fastify';
import { createOctoController } from './octo.controller.js';
import { OctoService } from './octo.service.js';
import { createRequireAuth } from '../auth/auth.middleware.js';
import { AuthService } from '../auth/auth.service.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { AuthMailer } from '../auth/auth.mailer.js';

export async function registerOctoRoutes(app: FastifyInstance) {
  // Initialize auth middleware
  const authRepository = new AuthRepository();
  const authMailer = new AuthMailer();
  const authService = new AuthService(authRepository, authMailer);
  const requireAuth = createRequireAuth(authService);

  const octoService = new OctoService();
  const controller = createOctoController(octoService);

  // Models & AI Provider Status
  app.get('/octo/models', { preHandler: requireAuth }, controller.getModels);
  app.get('/octo/provider-status', { preHandler: requireAuth }, controller.getProviderStatus);
  app.get('/octo/status', { preHandler: requireAuth }, controller.getProviderStatus);

  // Core Chat & Streaming
  app.post('/octo/chat', { preHandler: requireAuth }, controller.chat);
  app.post('/octo/chat/stream', { preHandler: requireAuth }, controller.stream);
  app.get('/octo/chat/stream', { preHandler: requireAuth }, controller.stream);
  app.post('/octo/stream', { preHandler: requireAuth }, controller.stream);
  app.post('/octo/ask', { preHandler: requireAuth }, controller.ask);

  // Conversation Session Management
  app.get('/octo/conversations', { preHandler: requireAuth }, controller.getConversations);
  app.get('/octo/conversations/:id', { preHandler: requireAuth }, controller.getConversation);
  app.post('/octo/conversations', { preHandler: requireAuth }, controller.createConversation);
  app.post('/octo/conversations/:id/messages', { preHandler: requireAuth }, controller.addMessage);
  app.delete('/octo/conversations/:id', { preHandler: requireAuth }, controller.deleteConversation);

  // Codebase Knowledge Graph (Graphify)
  app.get('/octo/graph/:projectId', { preHandler: requireAuth }, controller.getGraph);
  app.get('/octo/projects/:projectId/graph', { preHandler: requireAuth }, controller.getGraph);
  app.get('/octo/graph/:projectId/report', { preHandler: requireAuth }, controller.getGraphReport);
  app.get('/octo/projects/:projectId/graph/report', { preHandler: requireAuth }, controller.getGraphReport);
  app.post('/octo/graph/:projectId/refresh', { preHandler: requireAuth }, controller.refreshGraph);
  app.post('/octo/graph/:projectId/path', { preHandler: requireAuth }, controller.findGraphPath);

  // Safe Code Patching & Rollback
  app.post('/octo/patches/prepare', { preHandler: requireAuth }, controller.preparePatch);
  app.post('/octo/patches/multi-prepare', { preHandler: requireAuth }, controller.prepareMultiPatch);
  app.post('/octo/patches/apply', { preHandler: requireAuth }, controller.applyPatch);
  app.post('/octo/patches/multi-apply', { preHandler: requireAuth }, controller.applyPatchSet);
  app.post('/octo/patches/rollback', { preHandler: requireAuth }, controller.rollbackPatch);

  // Snapshot Understanding & Comparison
  app.post('/octo/snapshots/compare', { preHandler: requireAuth }, controller.compareSnapshots);
  app.get('/octo/snapshots/:projectId/:snapshotId/context', { preHandler: requireAuth }, controller.getSnapshotContext);

  // Architecture Intelligence
  app.get('/octo/projects/:projectId/architecture', { preHandler: requireAuth }, controller.getArchitecture);

  // Project Memory & Context Retention
  app.get('/octo/projects/:projectId/memories', { preHandler: requireAuth }, controller.getMemories);
  app.post('/octo/projects/:projectId/memories', { preHandler: requireAuth }, controller.addMemory);
  app.delete('/octo/projects/:projectId/memories/:memoryId', { preHandler: requireAuth }, controller.deleteMemory);

  // Sandboxed Command & Test Execution
  app.post('/octo/commands/execute', { preHandler: requireAuth }, controller.executeCommand);
  app.post('/octo/tests/run', { preHandler: requireAuth }, controller.runTests);

  // Autonomous Agent Task Planning & Multi-Step Execution
  app.post('/octo/agent/tasks', { preHandler: requireAuth }, controller.createAgentTask);
  app.get('/octo/agent/tasks/:taskId', { preHandler: requireAuth }, controller.getAgentTask);
  app.post('/octo/agent/tasks/:taskId/advance', { preHandler: requireAuth }, controller.advanceAgentTask);
}
