import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OctoService } from './octo.service.js';
import { ProjectsRepository } from '../projects/projects.repository.js';
import { SnapshotsRepository } from '../snapshots/snapshots.repository.js';

describe('OCTOBOT into OCTOPUS Integration Tests', () => {
  let octoService: OctoService;
  let mockProjectsRepo: any;
  let mockSnapshotsRepo: any;

  beforeEach(() => {
    mockProjectsRepo = {
      listProjects: vi.fn().mockResolvedValue([
        {
          id: 'proj-1',
          name: 'OctoCommerce Service',
          color: 'CYAN',
          description: 'E-commerce payment and subscription service',
          status: 'ACTIVE',
        },
      ]),
    };

    mockSnapshotsRepo = {
      listSnapshotsByProject: vi.fn().mockResolvedValue([
        {
          id: 'snap-2',
          status: 'COMPLETED',
          captureSource: 'EXTENSION',
          createdAt: new Date('2026-10-31T12:00:00Z'),
          archiveSizeBytes: 20480,
          fileCount: 42,
          directoryCount: 8,
        },
        {
          id: 'snap-1',
          status: 'COMPLETED',
          captureSource: 'WEB',
          createdAt: new Date('2026-10-25T10:00:00Z'),
          archiveSizeBytes: 18400,
          fileCount: 38,
          directoryCount: 7,
        },
      ]),
      findBlueprintBySnapshotId: vi.fn().mockResolvedValue({
        projectType: 'TypeScript / Node.js Service',
        detectedFrameworks: ['Fastify', 'React', 'Prisma'],
        detectedLanguages: ['TypeScript', 'SQL'],
        importantConfigFiles: ['package.json', 'tsconfig.json'],
        entryPoints: ['src/server.ts', 'src/main.tsx'],
        detectedCommands: ['npm run dev', 'npm test'],
        summary: 'Full-stack Node.js and TypeScript service architecture',
      }),
    };

    octoService = new OctoService(
      mockProjectsRepo as unknown as ProjectsRepository,
      mockSnapshotsRepo as unknown as SnapshotsRepository
    );
  });

  it('1. OCTOBOT provides active provider and model status', () => {
    const status = octoService.getProviderStatus();
    expect(status.providerName).toContain('OCTOBOT');
    expect(status.configuredModel).toBeTruthy();
    expect(status.supportedModels.length).toBeGreaterThan(0);
  });

  it('2. OCTOBOT answers general programming and CS questions with code', async () => {
    const res = await octoService.ask({
      question: 'How do I push code to GitHub repository?',
      pageContext: 'DASHBOARD',
      userId: 'user-1',
    });

    expect(res.reply).toContain('git push');
    expect(res.reply).toContain('git commit');
  }, 15000);

  it('3. OCTOBOT compares snapshots using real workspace context', async () => {
    const res = await octoService.ask({
      question: 'Explain what changed between my last two snapshots',
      pageContext: 'DASHBOARD',
      projectId: 'proj-1',
      userId: 'user-1',
    });

    expect(res.reply).toContain('Snapshot Comparison');
    expect(res.reply).toContain('snap-2');
  });

  it('4. OCTOBOT explains project architecture based on blueprint', async () => {
    const res = await octoService.ask({
      question: 'Explain my project architecture',
      pageContext: 'DASHBOARD',
      projectId: 'proj-1',
      userId: 'user-1',
    });

    expect(res.reply).toContain('Architecture Overview');
    expect(res.reply).toContain('Fastify');
  });

  it('5. OCTOBOT generates AI-guided recovery recommendations with safety approvals', async () => {
    const rec = await octoService.getRecoveryRecommendation('user-1', 'proj-1', 'payment bug');

    expect(rec.requiresUserApproval).toBe(true);
    expect(rec.recommendedAction).toContain('Restore project state');
    expect(rec.safetyCheck.hasPreRestorationBackup).toBe(true);
  });

  it('6. OCTOBOT streams real-time responses chunk by chunk', async () => {
    const chunks: string[] = [];
    let metaReceived: any = null;

    await octoService.streamChat(
      'user-1',
      'proj-1',
      [{ id: 'msg-1', role: 'user', content: 'What is DSA?', timestamp: new Date().toISOString() }],
      (chunk: string) => chunks.push(chunk),
      (meta: any) => { metaReceived = meta; }
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('DSA');
    expect(metaReceived).not.toBeNull();
  }, 15000);

  it('7. OCTOBOT generates interactive Codebase Knowledge Graph', async () => {
    const graph = await octoService.getKnowledgeGraph('user-1', 'proj-1');

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.summary.architecturalHealthScore).toBeGreaterThanOrEqual(90);

    const report = await octoService.getKnowledgeGraphReport('user-1', 'proj-1');
    expect(report.healthScore).toBeGreaterThanOrEqual(90);
    expect(report.findings.length).toBeGreaterThan(0);
  });

  it('8. OCTOBOT manages multi-turn conversation sessions', () => {
    const session = (octoService as any).conversationManager.createSession('user-1', 'proj-1', 'Debug Session');
    expect(session.id).toContain('conv-');

    (octoService as any).conversationManager.addMessage(session.id, {
      id: 'msg-1',
      role: 'user',
      content: 'Can you help diagnose this error?',
      timestamp: new Date().toISOString(),
    });

    const retrieved = (octoService as any).conversationManager.getSession(session.id);
    expect(retrieved?.messages.length).toBe(1);

    const list = (octoService as any).conversationManager.listSessions('user-1', 'proj-1');
    expect(list.some((s: any) => s.id === session.id)).toBe(true);
  });
});
