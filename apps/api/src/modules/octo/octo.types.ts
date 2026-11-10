/**
 * Octo - Native OCTOPUS & OCTOBOT Intelligence Engine Types
 */

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
  tool?: string | undefined;
  toolParams?: any;
  toolResult?: any;
  requiresApproval?: boolean | undefined;
  isApproved?: boolean | undefined;
}

export interface CommandExecutionResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  isAllowed: boolean;
  blockedReason?: string | undefined;
}

export interface TestExecutionResult {
  framework: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  failures: Array<{ testName: string; file?: string | undefined; error: string }>;
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
  createdPatches?: PatchProposal[] | undefined;
  executedCommands?: CommandExecutionResult[] | undefined;
  testResults?: TestExecutionResult[] | undefined;
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
  images?: string[] | undefined;
  fileReferences?: string[] | undefined;
  suggestedPatch?: PatchProposal | undefined;
  toolCalls?: ToolExecutionRecord[] | undefined;
  agentState?: AgentTaskState | undefined;
  isSimulated?: boolean | undefined;
}

export interface ConversationSession {
  id: string;
  userId?: string | undefined;
  projectId?: string | null | undefined;
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
  name?: string | undefined; // Frontend compatibility
  type: 'file' | 'function' | 'class' | 'interface' | 'endpoint' | 'module';
  filePath: string;
  path?: string | undefined; // Frontend compatibility
  line?: number | undefined;
  description?: string | undefined;
  language?: string | undefined;
  inDegree?: number | undefined;
  outDegree?: number | undefined;
  complexityScore?: number | undefined;
  community?: number | undefined;
  isGodNode?: boolean | undefined;
  metrics?: {
    inDegree: number;
    outDegree: number;
    centralityScore: number;
    isGodNode?: boolean | undefined;
  } | undefined;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'imports' | 'calls' | 'defines' | 'implements' | 'depends_on' | 'references';
  label?: string | undefined;
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
  communities?: { id: number; name: string; memberCount: number }[] | undefined;
  circularDependencies?: string[][] | undefined;
  metrics: {
    totalNodes: number;
    totalEdges: number;
    density: number;
    averageDegree: number;
  };
  summary?: {
    totalFiles: number;
    totalDependencies: number;
    architecturalHealthScore: number;
  } | undefined;
}

export interface GraphReport {
  projectId: string;
  generatedAt: string;
  summary: string;
  healthScore?: number | undefined;
  findings?: Array<{
    severity: 'info' | 'warning' | 'error';
    title: string;
    description: string;
    recommendation: string;
  }> | undefined;
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
  activeProviderType?: string | undefined;
  geminiConfigured?: boolean | undefined;
  gemmaConfigured?: boolean | undefined;
  openaiConfigured?: boolean | undefined;
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
  executedAt?: string | undefined;
  executionResult?: string | undefined;
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

export interface Snapshot {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  author: string;
  fileCount: number;
  tags: string[];
  isRestorable: boolean;
  commitHash?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface ProjectInfo {
  id: string;
  name: string;
  rootPath: string;
  description: string;
  version: string;
  repository?: string | undefined;
  framework?: string | undefined;
  language: string;
  isSample?: boolean | undefined;
}

export interface FileMetadata {
  path: string;
  relativePath: string;
  name: string;
  extension: string;
  sizeBytes: number;
  lineCount: number;
  lastModified: string;
  symbols?: string[] | undefined;
  imports?: string[] | undefined;
}

export interface ProjectIndex {
  projectId: string;
  indexedAt: string;
  totalFiles: number;
  totalLines: number;
  fileTypes: Record<string, number>;
  files: Record<string, FileMetadata>;
  symbols: Record<string, { relativePath: string; line: number; type: string }>;
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
}

export interface SearchMatch {
  relativePath: string;
  line: number;
  lineContent: string;
  preview: string;
}

export interface RetrievedSnippet {
  relativePath: string;
  startLine: number;
  endLine: number;
  content: string;
  reason: string;
}

export interface OctopusContributor {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'lead_developer' | 'contributor' | 'reviewer';
  avatarUrl?: string | undefined;
  commitCount: number;
  lastActive: string;
}

export interface OctopusProjectEvent {
  id: string;
  projectId: string;
  type: 'snapshot_created' | 'recovery_executed' | 'patch_applied' | 'test_run' | 'branch_merged';
  title: string;
  description: string;
  author: string;
  timestamp: string;
  metadata?: Record<string, any> | undefined;
}

export interface RecoveryExecutionResult {
  success: boolean;
  planId: string;
  restoredSnapshotId: string;
  timestamp: string;
  message: string;
  filesRestored: string[];
  isSimulation: boolean;
}

export type OctoIntentType =
  | 'PROJECT_COUNT'
  | 'PROJECT_LIST'
  | 'PROJECT_DETAILS'
  | 'PROJECT_EDIT_GUIDANCE'
  | 'PROJECT_DELETE_GUIDANCE'
  | 'SNAPSHOT_COUNT'
  | 'SNAPSHOT_COUNT_IN_PROJECT'
  | 'LATEST_SNAPSHOT'
  | 'PROJECT_WITH_MOST_SNAPSHOTS'
  | 'SNAPSHOT_DELETE_BEHAVIOR'
  | 'COMPARE_SNAPSHOTS'
  | 'RESTORE_GUIDANCE'
  | 'BLUEPRINT_EXPLANATION'
  | 'BLUEPRINT_ARCHITECTURE'
  | 'BLUEPRINT_METADATA'
  | 'PROJECT_STRUCTURE'
  | 'FRAMEWORK_DETECTION'
  | 'WHAT_IS_OCTOPUS'
  | 'WHAT_IS_SNAPSHOT'
  | 'WHAT_IS_BLUEPRINT'
  | 'WHAT_IS_SECRET_VAULT'
  | 'WHAT_IS_INSTANT_REBIRTH'
  | 'WHAT_IS_PROJECT_COLOR'
  | 'NAVIGATE_TO_SNAPSHOTS'
  | 'NAVIGATE_TO_BLUEPRINT'
  | 'NAVIGATE_TO_SECRETS'
  | 'WHERE_CAN_I_EDIT_PROJECT'
  | 'GENERAL_PROGRAMMING'
  | 'UNKNOWN';

export type OctoIntentMatch = {
  intent: OctoIntentType;
  confidence: number;
  entityName?: string | undefined;
  projectId?: string | undefined;
  snapshotId?: string | undefined;
};

export type OctoSummary = {
  greeting: string;
  projectCount: number;
  snapshotCount: number;
  suggestions: string[];
};

export type RecoveryRecommendation = {
  id?: string | undefined;
  projectId?: string | undefined;
  recommendedSnapshotId: string;
  targetSnapshotId?: string | undefined;
  targetSnapshotDate?: string | undefined;
  reason: string;
  rootCause?: string | undefined;
  confidence: number;
  recommendedAction?: string | undefined;
  strategySummary?: string | undefined;
  affectedFiles?: string[] | undefined;
  requiresUserApproval?: boolean | undefined;
  safetyCheck?: {
    hasPreRestorationBackup: boolean;
    uncommittedWarning?: boolean | undefined;
  } | undefined;
  alternatives: string[];
};

export type WorkspaceContext = {
  userId: string;
  projectCount: number;
  snapshotCount: number;
  currentProjectId?: string | null | undefined;
  currentProjectName?: string | null | undefined;
  currentProjectSnapshotCount?: number | undefined;
  currentSnapshotId?: string | null | undefined;
  activeProject?: any;
  projectMode?: string | undefined;
  teamMembers?: any[] | undefined;
  teamActivities?: any[] | undefined;
  snapshots?: any[] | undefined;
  latestBlueprint?: any;
  recentChanges?: any;
  projects: Array<{
    id: string;
    name: string;
    color: string;
    snapshotCount: number;
    mode?: 'INDIVIDUAL' | 'COLLABORATIVE' | undefined;
  }>;
  selectedProject?: {
    id: string;
    name: string;
    description: string;
    color: string;
    createdAt: string;
    mode?: 'INDIVIDUAL' | 'COLLABORATIVE' | undefined;
    memberCount?: number | undefined;
    userRole?: string | undefined;
    teamMembers?: Array<{
      id: string;
      username: string;
      email: string;
      role: string;
    }> | undefined;
    teamActivities?: Array<{
      id: string;
      action: string;
      username: string;
      createdAt: string;
      details?: any;
    }> | undefined;
  } | undefined;
  selectedSnapshot?: {
    id: string;
    createdAt: string;
    status: string;
    fileCount: number;
  } | undefined;
  blueprint?: {
    projectType: string;
    frameworks: string[];
    languages: string[];
  } | undefined;
};

export type OctoRequest = {
  question: string;
  pageContext: string;
  projectId?: string | undefined;
  snapshotId?: string | undefined;
  userId: string;
  messages?: ChatMessage[] | undefined;
  images?: string[] | undefined;
  selectedModel?: string | undefined;
};

export type OctoResponse = {
  reply: string;
  intent: OctoIntentType;
  suggestions: string[];
  summary: OctoSummary;
  fileReferences?: string[] | undefined;
  suggestedPatch?: any;
  recoveryRecommendation?: RecoveryRecommendation | undefined;
  isSimulated?: boolean | undefined;
};
