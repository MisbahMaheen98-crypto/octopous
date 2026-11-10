/**
 * OCTOBOT Frontend API Client
 * Interfaces with the native OCTOBOT backend inside OCTOPUS
 */

import type {
  OctoPageContext,
  OctobotMode,
  AgentPlanStep,
  AgentTaskState,
  CommandExecutionResult,
  TestExecutionResult,
  ProjectMemoryEntry,
} from '@octopus/shared';

export type {
  OctobotMode,
  AgentPlanStep,
  AgentTaskState,
  CommandExecutionResult,
  TestExecutionResult,
  ProjectMemoryEntry,
};

export type OctoSummary = {
  greeting: string;
  projectCount: number;
  snapshotCount: number;
  suggestions: string[];
};

export type RecoveryRecommendation = {
  id: string;
  projectId: string;
  targetSnapshotId: string;
  targetSnapshotDate: string;
  confidence: number;
  rootCause: string;
  recommendedAction: string;
  strategySummary: string;
  affectedFiles: string[];
  requiresUserApproval: true;
  safetyCheck: {
    hasPreRestorationBackup: boolean;
    uncommittedWarning: boolean;
  };
};

export type PatchProposal = {
  patchId: string;
  projectId: string;
  filePath: string;
  originalCode: string;
  modifiedCode: string;
  diff: string;
  summary: string;
  status: 'pending' | 'applied' | 'rejected' | 'conflict';
  createdAt: string;
  appliedAt?: string | undefined;
  additions: number;
  deletions: number;
  hasRollbackBackup?: boolean | undefined;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'octo';
  content: string;
  timestamp: string;
  images?: string[] | undefined;
  fileReferences?: string[] | undefined;
  suggestedPatch?: PatchProposal | undefined;
  recoveryRecommendation?: RecoveryRecommendation | undefined;
  agentState?: AgentTaskState | undefined;
  isSimulated?: boolean | undefined;
};

export type ConversationSession = {
  id: string;
  userId?: string | undefined;
  projectId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

export type OctoResponse = {
  reply: string;
  intent: string;
  suggestions: string[];
  summary: OctoSummary;
  recoveryRecommendation?: RecoveryRecommendation;
  isSimulated?: boolean;
};

export type OctoAskRequest = {
  question: string;
  pageContext: OctoPageContext;
  projectId?: string | undefined;
  conversationId?: string | undefined;
  snapshotId?: string | undefined;
  messages?: ChatMessage[] | undefined;
  images?: string[] | undefined;
  selectedModel?: string | undefined;
};

export type AiModelOption = {
  id: string;
  name: string;
  provider: string;
  badge: string;
  badgeVariant: 'cyan' | 'emerald' | 'orange' | 'violet' | 'electric';
  supportsVision: boolean;
  description: string;
};

export type AiProviderStatus = {
  isLiveConfigured: boolean;
  providerName: string;
  configuredModel: string;
  supportedModels: string[];
  activeProvider?: string;
  hasApiKey?: boolean;
  geminiConfigured?: boolean;
  gemmaConfigured?: boolean;
  openaiConfigured?: boolean;
};

export type GraphNode = {
  id: string;
  name: string;
  label?: string;
  path: string;
  filePath?: string;
  type: 'file' | 'module' | 'function' | 'class' | 'interface' | 'endpoint';
  language: string;
  inDegree: number;
  outDegree: number;
  complexityScore: number;
  community: number;
  isGodNode?: boolean;
  line?: number;
  description?: string;
  metrics?: {
    inDegree: number;
    outDegree: number;
    centralityScore: number;
    isGodNode?: boolean;
  };
};

export type GraphEdge = {
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'extends' | 'defines' | 'implements' | 'depends_on' | 'references';
  label?: string;
};

export type CodebaseKnowledgeGraph = {
  projectId: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  communities: { id: number; name: string; memberCount: number }[];
  godNodes: GraphNode[];
  clusters?: { name: string; description: string; nodeIds: string[] }[];
  circularDependencies: string[][];
  metrics?: {
    totalNodes: number;
    totalEdges: number;
    density: number;
    averageDegree: number;
  };
  summary: {
    totalFiles: number;
    totalDependencies: number;
    architecturalHealthScore: number;
  };
};

export type GraphReport = {
  projectId: string;
  generatedAt: string;
  healthScore: number;
  summary?: string;
  findings: Array<{
    severity: 'info' | 'warning' | 'error';
    title: string;
    description: string;
    recommendation: string;
  }>;
  architectureClusters?: Array<{ name: string; description: string; files: string[] }>;
  godNodes?: Array<{ id: string; label: string; connectivity: number; reason: string }>;
  riskAreas?: Array<{ file: string; severity: 'high' | 'medium' | 'low'; description: string }>;
  recommendations?: string[];
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1';

export async function getOctoStatus(): Promise<AiProviderStatus | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/octo/status`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: AiProviderStatus };
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export async function getOctoModels(): Promise<AiModelOption[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/octo/models`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { success: boolean; data: { models: AiModelOption[] } };
    return data.success ? data.data.models : [];
  } catch {
    return [];
  }
}

export async function getOctoSummary(projectId?: string): Promise<OctoSummary | null> {
  try {
    const url = new URL(`${API_BASE_URL}/octo/summary`);
    if (projectId) {
      url.searchParams.set('projectId', projectId);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { success: boolean; data: OctoSummary };
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export async function askOcto(request: OctoAskRequest): Promise<OctoResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/octo/ask`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { success: boolean; data: OctoResponse };
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export type ContextMode = 'workspace' | 'snapshot' | 'compare' | 'none';

export interface ChatContextPayload {
  mode?: OctobotMode | undefined;
  contextMode?: ContextMode | undefined;
  snapshotId?: string | undefined;
  baseSnapshotId?: string | undefined;
  targetSnapshotId?: string | undefined;
}

export async function sendOctoChat(
  projectId: string | null | undefined,
  messages: ChatMessage[],
  forceDemoMode?: boolean,
  model?: string,
  images?: string[],
  contextPayload?: ChatContextPayload
): Promise<{
  message: ChatMessage;
  provider: string;
  model: string;
  retrievedSnippetsCount: number;
}> {
  const response = await fetch(`${API_BASE_URL}/octo/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: projectId || null,
      messages,
      forceDemoMode,
      model,
      images,
      ...(contextPayload || {}),
    }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to send chat message' }));
    throw new Error(err.error?.message || err.error || 'Failed to send chat message');
  }
  const result = await response.json();
  return result.data || result;
}

export async function streamOctoChat(
  projectId: string | null | undefined,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onMeta?: (meta: {
    fileReferences?: string[];
    isSimulated?: boolean;
    recoveryRecommendation?: RecoveryRecommendation;
    provider?: string;
    model?: string;
    agentState?: AgentTaskState;
  }) => void,
  signal?: AbortSignal,
  images?: string[],
  model?: string,
  forceDemoMode?: boolean,
  contextPayload?: ChatContextPayload
): Promise<void> {
  const init: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId: projectId || null,
      messages,
      images,
      model,
      forceDemoMode,
      ...(contextPayload || {}),
    }),
  };
  if (signal) {
    init.signal = signal;
  }

  const response = await fetch(`${API_BASE_URL}/octo/chat/stream`, init);

  if (!response.ok) {
    throw new Error(`Failed to stream chat response (${response.status})`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Response stream not readable');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      const eventMatch = line.match(/^event:\s*(\w+)/m);
      const dataMatch = line.match(/^data:\s*(.*)/m);

      if (eventMatch && dataMatch) {
        const event = eventMatch[1];
        try {
          const payload = (dataMatch[1] ?? '').trim();
          if (payload === '[DONE]') return;
          const data = JSON.parse(payload);
          if (event === 'chunk' && data.chunk) {
            onChunk(data.chunk);
          } else if (event === 'meta' && onMeta) {
            onMeta(data);
          } else if (event === 'error') {
            throw new Error(data.error || 'Stream error');
          }
        } catch (e: any) {
          if (e.message && !e.message.includes('JSON')) {
            throw e;
          }
        }
      } else if (line.startsWith('data: ')) {
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload);
          if (parsed.chunk) onChunk(parsed.chunk);
          if (parsed.meta && onMeta) onMeta(parsed.meta);
          if (parsed.error) throw new Error(parsed.error);
        } catch (e: any) {
          if (e.message && !e.message.includes('JSON')) {
            throw e;
          }
        }
      }
    }
  }
}

export async function getOctoConversations(projectId?: string | null): Promise<ConversationSession[]> {
  try {
    const url = new URL(`${API_BASE_URL}/octo/conversations`);
    if (projectId) url.searchParams.set('projectId', projectId);

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { success: boolean; data: { conversations: ConversationSession[] } };
    return data.success ? (data.data.conversations || (data.data as any)) : [];
  } catch {
    return [];
  }
}

export async function createOctoConversation(projectId?: string | null, title?: string): Promise<ConversationSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/octo/conversations`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: projectId || null, title }),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: { conversation: ConversationSession } };
    return data.success ? (data.data.conversation || (data.data as any)) : null;
  } catch {
    return null;
  }
}

export async function getOctoConversation(id: string): Promise<ConversationSession | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/octo/conversations/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: { conversation: ConversationSession } };
    return data.success ? (data.data.conversation || (data.data as any)) : null;
  } catch {
    return null;
  }
}

export async function addOctoMessage(conversationId: string, message: ChatMessage): Promise<ConversationSession | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/octo/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: { conversation: ConversationSession } };
    return data.success ? (data.data.conversation || (data.data as any)) : null;
  } catch {
    return null;
  }
}

export async function deleteOctoConversation(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/octo/conversations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function normalizeGraph(graph: any): CodebaseKnowledgeGraph | null {
  if (!graph) return null;
  const rawNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const nodes: GraphNode[] = rawNodes.map((n: any) => {
    const label = n.label || n.name || n.id || 'Unknown';
    const filePath = n.filePath || n.path || n.id || '';
    const inDegree = n.inDegree ?? n.metrics?.inDegree ?? 0;
    const outDegree = n.outDegree ?? n.metrics?.outDegree ?? 0;
    const complexityScore = n.complexityScore ?? n.metrics?.centralityScore ?? inDegree * 2 + outDegree;
    const isGodNode = Boolean(n.isGodNode ?? n.metrics?.isGodNode ?? (complexityScore >= 4 || inDegree >= 3));
    return {
      id: String(n.id || filePath),
      name: label,
      label,
      path: filePath,
      filePath,
      type: n.type || 'file',
      language: n.language || 'text',
      inDegree,
      outDegree,
      complexityScore,
      community: n.community ?? 1,
      isGodNode,
      line: n.line,
      description: n.description,
      metrics: {
        inDegree,
        outDegree,
        centralityScore: complexityScore,
        isGodNode,
      },
    };
  });

  const rawEdges = Array.isArray(graph.edges) ? graph.edges : [];
  const edges: GraphEdge[] = rawEdges.map((e: any) => ({
    source: e.source,
    target: e.target,
    type: e.type || 'imports',
    label: e.label,
  }));

  const godNodes = nodes.filter((n) => n.isGodNode);
  const totalFiles = nodes.filter((n) => n.type === 'file').length || nodes.length;
  const totalDependencies = edges.length;
  const architecturalHealthScore =
    graph.summary?.architecturalHealthScore ??
    Math.max(20, Math.min(100, Math.round(100 - godNodes.length * 6)));

  const clusters = Array.isArray(graph.clusters) ? graph.clusters : [];
  const communities = Array.isArray(graph.communities)
    ? graph.communities
    : clusters.map((c: any, idx: number) => ({
        id: idx + 1,
        name: c.name || `Cluster ${idx + 1}`,
        memberCount: Array.isArray(c.nodeIds) ? c.nodeIds.length : 0,
      }));

  return {
    projectId: graph.projectId || 'project',
    generatedAt: graph.generatedAt || new Date().toISOString(),
    nodes,
    edges,
    godNodes,
    clusters,
    communities,
    circularDependencies: graph.circularDependencies || [],
    metrics: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      density: graph.metrics?.density ?? 0,
      averageDegree: graph.metrics?.averageDegree ?? 0,
    },
    summary: {
      totalFiles,
      totalDependencies,
      architecturalHealthScore,
    },
  };
}

export function normalizeReport(report: any): GraphReport | null {
  if (!report) return null;
  const healthScore = report.healthScore ?? 85;
  const rawFindings = Array.isArray(report.findings) ? report.findings : [];
  const riskAreas = Array.isArray(report.riskAreas) ? report.riskAreas : [];
  const godNodes = Array.isArray(report.godNodes) ? report.godNodes : [];

  const findings = [...rawFindings];
  if (findings.length === 0 && (riskAreas.length > 0 || godNodes.length > 0)) {
    for (const gn of godNodes) {
      findings.push({
        severity: (gn.connectivity || 0) >= 6 ? 'error' : 'warning',
        title: `God Node: ${gn.label || gn.id}`,
        description: gn.reason || `Central hub with centrality score ${gn.connectivity}`,
        recommendation: `Refactor ${gn.label || gn.id} into isolated submodules.`,
      });
    }
    for (const r of riskAreas) {
      findings.push({
        severity: r.severity === 'high' ? 'error' : 'warning',
        title: `Risk Alert: ${r.file}`,
        description: r.description,
        recommendation: 'Increase test coverage and encapsulate public APIs.',
      });
    }
  }

  if (findings.length === 0) {
    findings.push({
      severity: 'info',
      title: 'Healthy Architecture',
      description: 'AST components adhere to modular separation without excessive God Node coupling.',
      recommendation: 'Continue regular architectural scans during code reviews.',
    });
  }

  return {
    projectId: report.projectId || 'project',
    generatedAt: report.generatedAt || new Date().toISOString(),
    healthScore,
    findings,
    summary: report.summary || 'Codebase architecture scan completed.',
    architectureClusters: report.architectureClusters || [],
    godNodes,
    riskAreas,
    recommendations: report.recommendations || [],
  };
}

export async function getProjectGraph(projectId?: string | null): Promise<CodebaseKnowledgeGraph | null> {
  try {
    const id = projectId || 'sample-project';
    const response = await fetch(`${API_BASE_URL}/octo/graph/${encodeURIComponent(id)}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: { graph: CodebaseKnowledgeGraph } };
    const raw = data.success ? (data.data.graph || (data.data as any)) : null;
    return normalizeGraph(raw);
  } catch {
    return null;
  }
}

export async function refreshProjectGraph(projectId?: string | null): Promise<CodebaseKnowledgeGraph | null> {
  try {
    const id = projectId || 'sample-project';
    const response = await fetch(`${API_BASE_URL}/octo/graph/${encodeURIComponent(id)}/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: { graph: CodebaseKnowledgeGraph } };
    const raw = data.success ? (data.data.graph || (data.data as any)) : null;
    return normalizeGraph(raw);
  } catch {
    return null;
  }
}

export async function findProjectGraphPath(
  projectId: string,
  start: string,
  end: string
): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/octo/graph/${encodeURIComponent(projectId)}/path`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start, end }),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { success: boolean; data: { path: string[] } };
    return data.success ? data.data.path : [];
  } catch {
    return [];
  }
}

export async function getProjectGraphReport(projectId?: string | null): Promise<GraphReport | null> {
  try {
    const id = projectId || 'sample-project';
    const response = await fetch(`${API_BASE_URL}/octo/graph/${encodeURIComponent(id)}/report`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: { report: GraphReport } };
    const raw = data.success ? (data.data.report || (data.data as any)) : null;
    return normalizeReport(raw);
  } catch {
    return null;
  }
}

export async function preparePatch(
  projectId: string,
  filePath: string,
  modifiedCode: string,
  summary: string
): Promise<PatchProposal> {
  const response = await fetch(`${API_BASE_URL}/octo/patches/prepare`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, filePath, modifiedCode, summary }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to prepare patch' }));
    throw new Error(err.error?.message || err.error || 'Failed to prepare patch');
  }
  const result = await response.json();
  return result.data?.patch || result.data;
}

export async function applyPatch(
  projectId: string,
  patchId: string,
  createBackup = true
): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/octo/patches/apply`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, patchId, createBackup }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to apply patch' }));
    throw new Error(err.error?.message || err.error || 'Failed to apply patch');
  }
  return true;
}

export async function rollbackPatch(patchId: string): Promise<boolean> {
  const response = await fetch(`${API_BASE_URL}/octo/patches/rollback`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patchId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Failed to rollback patch' }));
    throw new Error(err.error?.message || err.error || 'Failed to rollback patch');
  }
  return true;
}

export async function getRecoveryRecommendation(projectId: string, query?: string): Promise<RecoveryRecommendation | null> {
  try {
    const url = new URL(`${API_BASE_URL}/octo/projects/${encodeURIComponent(projectId)}/recovery/recommend`);
    if (query) url.searchParams.set('query', query);

    const response = await fetch(url.toString(), {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { success: boolean; data: RecoveryRecommendation };
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

export interface SnapshotComparisonResponse {
  baseSnapshotId: string;
  targetSnapshotId: string;
  baseCreatedAt: string;
  targetCreatedAt: string;
  projectName: string;
  filesSummary: {
    added: string[];
    modified: string[];
    deleted: string[];
    totalAdded: number;
    totalModified: number;
    totalDeleted: number;
  };
  fileDiffs: Array<{
    filePath: string;
    status: 'added' | 'modified' | 'deleted';
    additions: number;
    deletions: number;
    patch?: string;
    summary: string;
  }>;
  structuralChanges: Array<{
    category: 'dependency' | 'route' | 'schema' | 'export' | 'config';
    action: 'added' | 'removed' | 'modified';
    target: string;
    detail: string;
    isBreaking: boolean;
  }>;
  breakingChangesCount: number;
  tenPointReport: string;
}

export async function compareSnapshots(
  projectId: string,
  baseSnapshotId: string,
  targetSnapshotId: string
): Promise<SnapshotComparisonResponse | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/octo/snapshots/compare`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, baseSnapshotId, targetSnapshotId }),
    });
    if (!response.ok) return null;
    const res = await response.json();
    return res.data;
  } catch {
    return null;
  }
}

export interface PreservedScreenshot {
  id: string;
  name: string;
  dataUrl: string;
  timestamp: string;
  sizeBytes?: number;
}

const PRESERVED_SCREENSHOTS_KEY = 'octobot_preserved_screenshots';

export function getPreservedScreenshots(): PreservedScreenshot[] {
  try {
    const raw = localStorage.getItem(PRESERVED_SCREENSHOTS_KEY);
    if (!raw) {
      return [
        {
          id: 'ps-login',
          name: 'OCTOPUS Login View',
          dataUrl: '/screenshots/login.png',
          timestamp: '2026-10-31T15:03:00Z',
        },
        {
          id: 'ps-signup',
          name: 'OCTOPUS Signup View',
          dataUrl: '/screenshots/signup.png',
          timestamp: '2026-10-31T15:03:00Z',
        },
      ];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function savePreservedScreenshot(item: PreservedScreenshot): void {
  try {
    const existing = getPreservedScreenshots();
    const updated = [item, ...existing.filter((s) => s.id !== item.id)].slice(0, 30);
    localStorage.setItem(PRESERVED_SCREENSHOTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to preserve screenshot', err);
  }
}

export function deletePreservedScreenshot(id: string): void {
  try {
    const existing = getPreservedScreenshots();
    const updated = existing.filter((s) => s.id !== id);
    localStorage.setItem(PRESERVED_SCREENSHOTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete preserved screenshot', err);
  }
}

async function jsonRequest<T>(endpoint: string, options: { method?: string; body?: any } = {}): Promise<T | null> {
  try {
    const init: RequestInit = {
      method: options.method || 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    if (options.body !== undefined) {
      init.body = JSON.stringify(options.body);
    }
    const response = await fetch(`${API_BASE_URL}${endpoint}`, init);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getProjectArchitecture(projectId: string) {
  const res = await jsonRequest<{ architecture: any }>(`/octo/projects/${projectId}/architecture`, { method: 'GET' });
  return res?.architecture ?? null;
}

export async function getProjectMemories(projectId: string): Promise<ProjectMemoryEntry[]> {
  const res = await jsonRequest<{ memories: ProjectMemoryEntry[] }>(`/octo/projects/${projectId}/memories`, { method: 'GET' });
  return res?.memories ?? [];
}

export async function addProjectMemory(
  projectId: string,
  category: ProjectMemoryEntry['category'],
  key: string,
  content: string
): Promise<ProjectMemoryEntry | null> {
  const res = await jsonRequest<{ memory: ProjectMemoryEntry }>(`/octo/projects/${projectId}/memories`, {
    method: 'POST',
    body: { category, key, content },
  });
  return res?.memory ?? null;
}

export async function deleteProjectMemory(projectId: string, memoryId: string): Promise<boolean> {
  const res = await jsonRequest<{ deleted: boolean }>(`/octo/projects/${projectId}/memories/${memoryId}`, { method: 'DELETE' });
  return Boolean(res?.deleted);
}

export async function executeAgentCommand(
  projectId: string,
  command: string,
  userApproved: boolean = false
): Promise<CommandExecutionResult | null> {
  const res = await jsonRequest<CommandExecutionResult>('/octo/commands/execute', {
    method: 'POST',
    body: { projectId, command, userApproved },
  });
  return res ?? null;
}

export async function runAgentTests(
  projectId: string,
  targetFile?: string,
  userApproved: boolean = true
): Promise<TestExecutionResult | null> {
  const res = await jsonRequest<TestExecutionResult>('/octo/tests/run', {
    method: 'POST',
    body: { projectId, targetFile, userApproved },
  });
  return res ?? null;
}

export async function createAgentTask(projectId: string, goal: string): Promise<AgentTaskState | null> {
  const res = await jsonRequest<{ task: AgentTaskState }>('/octo/agent/tasks', {
    method: 'POST',
    body: { projectId, goal },
  });
  return res?.task ?? null;
}

export async function advanceAgentTask(
  projectId: string,
  taskId: string,
  userApproved: boolean = false
): Promise<AgentTaskState | null> {
  const res = await jsonRequest<{ task: AgentTaskState }>(`/octo/agent/tasks/${taskId}/advance`, {
    method: 'POST',
    body: { projectId, userApproved },
  });
  return res?.task ?? null;
}

export async function prepareMultiPatch(
  projectId: string,
  edits: Array<{ filePath: string; proposedContent: string; summary: string }>
): Promise<PatchProposal[]> {
  const res = await jsonRequest<{ patches: PatchProposal[] }>('/octo/patches/multi-prepare', {
    method: 'POST',
    body: { projectId, edits },
  });
  return res?.patches ?? [];
}

export async function applyPatchSet(
  projectId: string,
  patchIds: string[],
  userApproved: boolean
): Promise<{ success: boolean; appliedPatches: any[]; message: string } | null> {
  const res = await jsonRequest<{ success: boolean; appliedPatches: any[]; message: string }>(
    '/octo/patches/multi-apply',
    {
      method: 'POST',
      body: { projectId, patchIds, userApproved },
    }
  );
  return res ?? null;
}

// Unified export API object for components that import { octoApi } or { api }
export const octoApi = {
  getProviderStatus: getOctoStatus,
  getAvailableModels: getOctoModels,
  sendChat: sendOctoChat,
  compareSnapshots,
  getProjectArchitecture,
  getProjectMemories,
  addProjectMemory,
  deleteProjectMemory,
  executeAgentCommand,
  runAgentTests,
  createAgentTask,
  advanceAgentTask,
  prepareMultiPatch,
  applyPatchSet,
  streamChat: (
    projectId: string | null | undefined,
    messages: ChatMessage[],
    forceDemoMode: boolean,
    onChunk: (chunk: string) => void,
    onMeta?: (meta: any) => void,
    model?: string,
    images?: string[],
    contextPayload?: any
  ) => streamOctoChat(projectId, messages, onChunk, onMeta, undefined, images, model, forceDemoMode, contextPayload),
  getConversations: getOctoConversations,
  getConversation: getOctoConversation,
  createConversation: createOctoConversation,
  addConversationMessage: addOctoMessage,
  deleteConversation: deleteOctoConversation,
  getProjectGraph: async (projectId: string) => {
    const graph = await getProjectGraph(projectId);
    return { graph: graph! };
  },
  refreshProjectGraph: async (projectId: string) => {
    const graph = await refreshProjectGraph(projectId);
    return { graph: graph! };
  },
  findProjectGraphPath: async (projectId: string, start: string, end: string) => {
    const path = await findProjectGraphPath(projectId, start, end);
    return { path };
  },
  getProjectGraphReport: async (projectId: string) => {
    const report = await getProjectGraphReport(projectId);
    return { report: report! };
  },
  preparePatch,
  applyPatch,
  rollbackPatch,
  getFileContent: async (_projectId: string, _path: string) => {
    return '// Workspace file content';
  },
};
