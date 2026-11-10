/**
 * Octo Controller
 * HTTP request handlers for OCTOBOT endpoints in Fastify.
 */

import type { FastifyReply, FastifyRequest } from 'fastify';
import { HttpError } from '../../core/errors/http-error.js';
import { OctoService } from './octo.service.js';
import type { ChatMessage, OctobotMode } from './octo.types.js';

export function createOctoController(octoService: OctoService) {
  return {
    async getModels(_request: FastifyRequest, reply: FastifyReply) {
      const models = octoService.getAvailableModels();
      return reply.code(200).send({
        success: true,
        data: { models },
      });
    },

    async getProviderStatus(_request: FastifyRequest, reply: FastifyReply) {
      const status = octoService.getProviderStatus();
      return reply.code(200).send({
        success: true,
        data: status,
      });
    },

    async chat(request: FastifyRequest, reply: FastifyReply) {
      const body = request.body as {
        projectId?: string | null;
        messages: ChatMessage[];
        forceDemoMode?: boolean;
        model?: string;
        mode?: OctobotMode;
        contextMode?: 'workspace' | 'snapshot' | 'compare' | 'none';
        snapshotId?: string;
        baseSnapshotId?: string;
        targetSnapshotId?: string;
      };

      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Messages array cannot be empty');
      }

      try {
        const result = await octoService.handleChat(body);
        return reply.code(200).send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(502, 'AI_PROVIDER_ERROR', err.message || 'AI request failed');
      }
    },

    async stream(request: FastifyRequest, reply: FastifyReply) {
      const body = request.body as {
        projectId?: string | null;
        messages: ChatMessage[];
        forceDemoMode?: boolean;
        model?: string;
        mode?: OctobotMode;
        contextMode?: 'workspace' | 'snapshot' | 'compare' | 'none';
        snapshotId?: string;
        baseSnapshotId?: string;
        targetSnapshotId?: string;
      };

      if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Messages array cannot be empty');
      }

      // Configure Fastify raw SSE headers WITH CORS
      const origin = (request.headers.origin as string) || 'http://localhost:5173';
      reply.raw.setHeader('Access-Control-Allow-Origin', origin);
      reply.raw.setHeader('Access-Control-Allow-Credentials', 'true');
      reply.raw.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      reply.raw.setHeader('Vary', 'Origin');
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders?.();

      const sendSse = (event: string, data: any) => {
        reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const result = await octoService.handleChat(body, (chunk: string) => {
          sendSse('chunk', { chunk, text: chunk });
        });

        // Send metadata matching octo-client onMeta expectation
        sendSse('meta', {
          fullText: result.text,
          provider: result.provider,
          model: result.model,
          isSimulated: result.isSimulated,
          fileReferences: result.fileReferences,
          snippetsCount: result.snippetsCount,
          category: result.category,
          agentState: (result as any).agentState,
        });

        // End stream with standard SSE sentinel
        reply.raw.write('data: [DONE]\n\n');
      } catch (err: any) {
        sendSse('error', { error: err.message || 'Stream processing failed', message: err.message });
      } finally {
        reply.raw.end();
      }
    },

    async getGraph(request: FastifyRequest, reply: FastifyReply) {
      const { projectId } = request.params as { projectId: string };
      const graph = await octoService.getProjectGraph(projectId);
      return reply.code(200).send({
        success: true,
        data: { graph },
      });
    },

    async getGraphReport(request: FastifyRequest, reply: FastifyReply) {
      const { projectId } = request.params as { projectId: string };
      const report = await octoService.getProjectGraphReport(projectId);
      return reply.code(200).send({
        success: true,
        data: { report },
      });
    },

    async refreshGraph(request: FastifyRequest, reply: FastifyReply) {
      const { projectId } = request.params as { projectId: string };
      const graph = await octoService.refreshProjectGraph(projectId);
      return reply.code(200).send({
        success: true,
        data: { graph },
      });
    },

    async findGraphPath(request: FastifyRequest, reply: FastifyReply) {
      const { projectId } = request.params as { projectId: string };
      const { start, end } = request.body as { start: string; end: string };
      const path = await octoService.findProjectGraphPath(projectId, start, end);
      return reply.code(200).send({
        success: true,
        data: { path },
      });
    },

    async getConversations(request: FastifyRequest, reply: FastifyReply) {
      const { projectId } = request.query as { projectId?: string };
      const conversations = octoService.getConversations(projectId);
      return reply.code(200).send({
        success: true,
        data: { conversations },
      });
    },

    async getConversation(request: FastifyRequest, reply: FastifyReply) {
      const { id } = request.params as { id: string };
      const conversation = octoService.getConversation(id);
      if (!conversation) {
        throw new HttpError(404, 'NOT_FOUND', 'Conversation not found');
      }
      return reply.code(200).send({
        success: true,
        data: { conversation },
      });
    },

    async createConversation(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, title } = (request.body || {}) as { projectId?: string; title?: string };
      const conversation = octoService.createConversation(projectId, title);
      return reply.code(201).send({
        success: true,
        data: { conversation },
      });
    },

    async addMessage(request: FastifyRequest, reply: FastifyReply) {
      const { id } = request.params as { id: string };
      const message = request.body as ChatMessage;
      const conversation = octoService.addMessage(id, message);
      return reply.code(200).send({
        success: true,
        data: { conversation },
      });
    },

    async deleteConversation(request: FastifyRequest, reply: FastifyReply) {
      const { id } = request.params as { id: string };
      const deleted = octoService.deleteConversation(id);
      return reply.code(200).send({
        success: true,
        data: { deleted },
      });
    },

    async preparePatch(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, filePath, proposedContent, summary } = request.body as {
        projectId: string;
        filePath: string;
        proposedContent: string;
        summary: string;
      };
      const patch = octoService.preparePatch(projectId, filePath, proposedContent, summary);
      return reply.code(201).send({
        success: true,
        data: { patch },
      });
    },

    async applyPatch(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, patchId, userApproved } = request.body as {
        projectId: string;
        patchId: string;
        userApproved: boolean;
      };
      const result = octoService.applyPatch(projectId, patchId, userApproved);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    },

    async rollbackPatch(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, patchId } = request.body as { projectId: string; patchId: string };
      const result = octoService.rollbackPatch(projectId, patchId);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    },

    // Backward-compatible ask endpoint
    async ask(request: FastifyRequest, reply: FastifyReply) {
      const userId = request.auth?.userId || 'user-default';
      const body = request.body as any;
      const response = await octoService.ask({
        question: body.question || '',
        pageContext: body.pageContext || 'DASHBOARD',
        projectId: body.projectId,
        snapshotId: body.snapshotId,
        userId,
        messages: body.messages,
        images: body.images,
        selectedModel: body.selectedModel,
      });
      return reply.code(200).send({
        success: true,
        data: response,
      });
    },

    async compareSnapshots(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, baseSnapshotId, targetSnapshotId } = request.body as {
        projectId: string;
        baseSnapshotId: string;
        targetSnapshotId: string;
      };
      if (!projectId || !baseSnapshotId || !targetSnapshotId) {
        throw new HttpError(400, 'INVALID_REQUEST', 'projectId, baseSnapshotId, and targetSnapshotId are required');
      }
      const comparison = await octoService.compareProjectSnapshots(projectId, baseSnapshotId, targetSnapshotId);
      return reply.code(200).send({
        success: true,
        data: comparison,
      });
    },

    async getSnapshotContext(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, snapshotId } = request.params as { projectId: string; snapshotId: string };
      const { query } = (request.query || {}) as { query?: string };
      const context = await octoService.getSnapshotContextSummary(projectId, snapshotId, query);
      return reply.code(200).send({
        success: true,
        data: context,
      });
    },

    async getArchitecture(request: FastifyRequest, reply: FastifyReply) {
      const { projectId } = request.params as { projectId: string };
      const architecture = await octoService.getArchitectureOverview(projectId);
      return reply.code(200).send({
        success: true,
        data: { architecture },
      });
    },

    async getMemories(request: FastifyRequest, reply: FastifyReply) {
      const { projectId } = request.params as { projectId: string };
      const memories = octoService.getProjectMemories(projectId);
      return reply.code(200).send({
        success: true,
        data: { memories },
      });
    },

    async addMemory(request: FastifyRequest, reply: FastifyReply) {
      const { projectId } = request.params as { projectId: string };
      const { category, key, content } = request.body as {
        category: 'architecture' | 'decision' | 'convention' | 'module' | 'issue';
        key: string;
        content: string;
      };
      if (!key || !content) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Key and content are required');
      }
      const memory = octoService.addProjectMemory(projectId, category || 'decision', key, content);
      return reply.code(201).send({
        success: true,
        data: { memory },
      });
    },

    async deleteMemory(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, memoryId } = request.params as { projectId: string; memoryId: string };
      const deleted = octoService.removeProjectMemory(projectId, memoryId);
      return reply.code(200).send({
        success: true,
        data: { deleted },
      });
    },

    async executeCommand(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, command, userApproved } = request.body as {
        projectId: string;
        command: string;
        userApproved: boolean;
      };
      if (!command) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Command is required');
      }
      const result = await octoService.executeCommand(projectId || 'general', command, userApproved);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    },

    async runTests(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, targetFile, userApproved } = request.body as {
        projectId: string;
        targetFile?: string;
        userApproved?: boolean;
      };
      const result = await octoService.runTests(projectId || 'general', targetFile, userApproved);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    },

    async prepareMultiPatch(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, edits } = request.body as {
        projectId: string;
        edits: Array<{ filePath: string; proposedContent: string; summary: string }>;
      };
      if (!Array.isArray(edits) || edits.length === 0) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Edits array cannot be empty');
      }
      const patches = octoService.prepareMultiPatch(projectId, edits);
      return reply.code(201).send({
        success: true,
        data: { patches },
      });
    },

    async applyPatchSet(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, patchIds, userApproved } = request.body as {
        projectId: string;
        patchIds: string[];
        userApproved: boolean;
      };
      if (!Array.isArray(patchIds) || patchIds.length === 0) {
        throw new HttpError(400, 'INVALID_REQUEST', 'PatchIds array cannot be empty');
      }
      const result = octoService.applyPatchSet(projectId, patchIds, userApproved);
      return reply.code(200).send({
        success: true,
        data: result,
      });
    },

    async createAgentTask(request: FastifyRequest, reply: FastifyReply) {
      const { projectId, goal } = request.body as { projectId: string; goal: string };
      if (!goal) {
        throw new HttpError(400, 'INVALID_REQUEST', 'Goal is required');
      }
      const task = await octoService.createAgentTask(projectId || 'general', goal);
      return reply.code(201).send({
        success: true,
        data: { task },
      });
    },

    async advanceAgentTask(request: FastifyRequest, reply: FastifyReply) {
      const { taskId } = request.params as { taskId: string };
      const { projectId, userApproved } = (request.body || {}) as {
        projectId?: string;
        userApproved?: boolean;
      };
      const task = await octoService.advanceAgentTask(projectId || 'general', taskId, userApproved);
      return reply.code(200).send({
        success: true,
        data: { task },
      });
    },

    async getAgentTask(request: FastifyRequest, reply: FastifyReply) {
      const { taskId } = request.params as { taskId: string };
      const task = octoService.getAgentTask(taskId);
      if (!task) {
        throw new HttpError(404, 'NOT_FOUND', `Task ${taskId} not found`);
      }
      return reply.code(200).send({
        success: true,
        data: { task },
      });
    },
  };
}
