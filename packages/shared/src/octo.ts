export const ASSISTANT_PAGE_CONTEXTS = [
  'DASHBOARD',
  'PROJECTS',
  'PROJECT_DETAILS',
  'SNAPSHOT',
  'BLUEPRINT',
  'SECRET_VAULT',
  'SETTINGS',
] as const;

export type OctoPageContext = (typeof ASSISTANT_PAGE_CONTEXTS)[number];

export type OctobotMode =
  | 'learn'
  | 'debug'
  | 'dsa'
  | 'code-review'
  | 'interview'
  | 'project-assistant'
  | 'agent'
  | 'architecture'
  | 'testing'
  | 'recovery';

export interface AgentPlanStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  tool?: string;
  toolParams?: any;
  toolResult?: any;
  requiresApproval?: boolean;
  isApproved?: boolean;
}

export interface CommandExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  isAllowed: boolean;
  blockedReason?: string;
}

export interface TestExecutionResult {
  framework: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: Array<{ testName: string; file?: string; error: string }>;
  buildStatus: 'success' | 'failed';
}

export interface AgentTaskState {
  taskId: string;
  goal: string;
  mode: OctobotMode;
  status: 'planning' | 'executing' | 'waiting_approval' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  steps: AgentPlanStep[];
  currentStepIndex: number;
  iteration: number;
  maxIterations: number;
  outputLog: string[];
  createdPatches?: PatchProposal[];
  executedCommands?: CommandExecutionResult[];
  testResults?: TestExecutionResult[];
}

export interface ProjectMemoryEntry {
  id: string;
  projectId: string;
  category: 'architecture' | 'decision' | 'convention' | 'module' | 'issue';
  key: string;
  content: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  images?: string[];
  fileReferences?: string[];
  suggestedPatch?: PatchProposal;
  toolCalls?: ToolExecutionRecord[];
  agentState?: AgentTaskState;
  isSimulated?: boolean;
}

export interface ConversationSession {
  id: string;
  userId?: string;
  projectId?: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface PatchProposal {
  patchId: string;
  projectId: string;
  filePath: string;
  summary: string;
  originalContent: string;
  proposedContent: string;
  diff: string;
  additions: number;
  deletions: number;
  createdAt: string;
  status: 'pending' | 'applied' | 'rejected' | 'conflict';
}

export interface ToolExecutionRecord {
  toolName: string;
  params: any;
  output: any;
  status: 'success' | 'error';
  executionTimeMs: number;
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'function' | 'class' | 'interface' | 'endpoint' | 'module';
  filePath: string;
  line?: number;
  description?: string;
  metrics?: {
    inDegree: number;
    outDegree: number;
    centralityScore: number;
    isGodNode?: boolean;
  };
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'defines' | 'implements' | 'depends_on' | 'references';
  label?: string;
}

export interface CodebaseKnowledgeGraph {
  projectId: string;
  generatedAt: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  godNodes: GraphNode[];
  clusters: {
    name: string;
    description: string;
    nodeIds: string[];
  }[];
  metrics: {
    totalNodes: number;
    totalEdges: number;
    density: number;
    averageDegree: number;
  };
}

export interface GraphReport {
  projectId: string;
  generatedAt: string;
  summary: string;
  architectureClusters: Array<{ name: string; description: string; files: string[] }>;
  godNodes: Array<{ id: string; label: string; connectivity: number; reason: string }>;
  riskAreas: Array<{ file: string; severity: 'high' | 'medium' | 'low'; description: string }>;
  recommendations: string[];
}

export interface AiModelOption {
  id: string;
  name: string;
  provider: string;
  badge: string;
  category: string;
  supportsVision: boolean;
}

export interface AiProviderStatus {
  isLiveConfigured: boolean;
  providerName: string;
  configuredModel: string;
  activeProviderType?: string;
}

export interface RecoveryOption {
  id: string;
  snapshotId: string;
  snapshotName: string;
  createdAt: string;
  recommended: boolean;
  pros: string[];
  cons: string[];
  riskLevel: 'low' | 'medium' | 'high';
  affectedFilesCount: number;
}

export interface RecoveryPlan {
  planId: string;
  projectId: string;
  problemStatement: string;
  recommendedSnapshotId: string;
  options: RecoveryOption[];
  previewChanges: {
    file: string;
    action: 'restore' | 'modify' | 'delete';
  }[];
  requiresConfirmation: true;
  status: 'prepared' | 'confirmed' | 'executed' | 'cancelled';
  executedAt?: string;
  executionResult?: string;
}

export interface SnapshotComparison {
  baseSnapshotId: string;
  targetSnapshotId: string;
  baseName: string;
  targetName: string;
  summary: string;
  files: {
    added: string[];
    modified: string[];
    deleted: string[];
  };
  breakingChanges: {
    severity: 'high' | 'medium' | 'low';
    description: string;
    affectedFile: string;
  }[];
  isMockData: boolean;
}

export interface ProjectDna {
  projectId: string;
  name: string;
  description: string;
  techStack: {
    language: string;
    framework: string;
    runtime: string;
    packageManager: string;
    dependencies: Record<string, string>;
  };
  metrics: {
    fileCount: number;
    totalLines: number;
    snapshotCount: number;
    contributorCount: number;
    recordedModifications: number;
    recordedRestorations: number;
    healthScore: number;
  };
  timeline: {
    event: string;
    timestamp: string;
    author: string;
  }[];
  generatedAt: string;
  isMockData: boolean;
}

export interface ProjectPulse {
  projectId: string;
  name: string;
  status: 'active' | 'stalled' | 'reviving' | 'healthy';
  lastActivity: string;
  blockers: string[];
  missingInformation: string[];
  immediateNextStep: string;
  revivalPlan: {
    step: number;
    title: string;
    action: string;
    estimatedMinutes: number;
  }[];
  knownErrors: {
    file: string;
    error: string;
    suggestedFix: string;
  }[];
  generatedAt: string;
}

export interface ProjectWill {
  projectId: string;
  name: string;
  version: string;
  generatedAt: string;
  purpose: string;
  architectureOverview: string;
  techStackSummary: string;
  setupInstructions: string[];
  buildAndTestCommands: {
    command: string;
    description: string;
  }[];
  deploymentInstructions: string[];
  knownErrorsAndLimitations: string[];
  lastKnownHealthyState: {
    snapshotId: string;
    snapshotName: string;
    verifiedAt: string;
  };
  ownershipNotes: string;
  recommendedNextActions: string[];
  excludedSecretsNotice: string;
}
