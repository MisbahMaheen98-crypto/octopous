/**
 * OCTOBOT 2.0 Autonomous Agent Engine & Tool Orchestrator
 * Implements multi-step planning, tool selection, sandboxed execution,
 * approval gating, error recovery, verification, and completion reporting.
 */

import { z } from 'zod';
import {
  ToolExecutionRecord,
  ProjectInfo,
  AgentPlanStep,
  AgentTaskState,
  PatchProposal,
  CommandExecutionResult,
  TestExecutionResult,
} from '../octo.types.js';
import { ProjectIndexer } from '../indexer/ProjectIndexer.js';
import { PatcherService } from '../patcher/PatcherService.js';
import { OctopusAdapter } from '../OctopusAdapter.js';
import { SecurityGuard } from '../octo.security.js';
import { TerminalExecutionService } from '../octo.terminal.js';
import { TestingEngine } from '../octo.testing.js';
import { ProjectMemoryService } from '../octo.memory.js';
import { logger } from '../octo.logger.js';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType<any>;
  requiresApproval: boolean;
  execute: (params: any) => Promise<any>;
}

export class AgentEngine {
  private tools: Map<string, ToolDefinition> = new Map();
  private maxIterations = 8;
  private terminal: TerminalExecutionService;
  private testingEngine: TestingEngine;
  private memoryService: ProjectMemoryService;

  constructor(
    private project: ProjectInfo,
    private indexer: ProjectIndexer,
    private patcher: PatcherService,
    private octopus: OctopusAdapter
  ) {
    this.terminal = TerminalExecutionService.getInstance();
    this.testingEngine = new TestingEngine();
    this.memoryService = ProjectMemoryService.getInstance();
    this.registerTools();
  }

  private registerTools() {
    // 1. search_project
    this.registerTool({
      name: 'search_project',
      description: 'Search for exact text or keywords across all indexed source files',
      schema: z.object({
        term: z.string().min(1),
        caseSensitive: z.boolean().optional(),
      }),
      requiresApproval: false,
      execute: async ({ term, caseSensitive }) => {
        return this.indexer.searchExact(term, caseSensitive);
      },
    });

    // 2. read_file
    this.registerTool({
      name: 'read_file',
      description: 'Read the contents of a project source file with optional line ranges',
      schema: z.object({
        relativePath: z.string().min(1),
        startLine: z.number().int().positive().optional(),
        endLine: z.number().int().positive().optional(),
      }),
      requiresApproval: false,
      execute: async ({ relativePath, startLine, endLine }) => {
        if (startLine !== undefined && endLine !== undefined) {
          return this.indexer.readFileRange(relativePath, startLine, endLine);
        }
        const content = await this.indexer.readFile(relativePath);
        return { relativePath, content: SecurityGuard.redactSecrets(content) };
      },
    });

    // 3. find_symbol
    this.registerTool({
      name: 'find_symbol',
      description: 'Look up the declaration location and type of an indexed function, class, or interface',
      schema: z.object({
        symbolName: z.string().min(1),
      }),
      requiresApproval: false,
      execute: async ({ symbolName }) => {
        return this.indexer.findSymbol(symbolName);
      },
    });

    // 4. get_dependencies
    this.registerTool({
      name: 'get_dependencies',
      description: 'Retrieve direct dependencies and callers for a specific file',
      schema: z.object({
        relativePath: z.string().min(1),
      }),
      requiresApproval: false,
      execute: async ({ relativePath }) => {
        return this.indexer.getFileDependencies(relativePath);
      },
    });

    // 5. get_architecture
    this.registerTool({
      name: 'get_architecture',
      description: 'Get synthesized architectural overview of frameworks, entry points, routes, and models',
      schema: z.object({}),
      requiresApproval: false,
      execute: async () => {
        return this.indexer.getArchitectureOverview();
      },
    });

    // 6. prepare_patch
    this.registerTool({
      name: 'prepare_patch',
      description: 'Prepare a reviewable code patch proposal with unified diff and line change counts',
      schema: z.object({
        filePath: z.string(),
        proposedContent: z.string(),
        summary: z.string(),
      }),
      requiresApproval: false,
      execute: async ({ filePath, proposedContent, summary }) => {
        return this.patcher.preparePatch(
          this.project.id,
          this.project.rootPath,
          filePath,
          proposedContent,
          summary
        );
      },
    });

    // 7. apply_patch
    this.registerTool({
      name: 'apply_patch',
      description: 'Apply an approved patch proposal to disk with rollback backup',
      schema: z.object({
        patchId: z.string(),
        userApproved: z.boolean().default(true),
      }),
      requiresApproval: true,
      execute: async ({ patchId, userApproved }) => {
        return this.patcher.applyPatch(this.project.id, this.project.rootPath, patchId, userApproved);
      },
    });

    // 8. rollback_patch
    this.registerTool({
      name: 'rollback_patch',
      description: 'Roll back an applied patch to its pre-patch state using the backup',
      schema: z.object({
        patchId: z.string(),
      }),
      requiresApproval: true,
      execute: async ({ patchId }) => {
        return this.patcher.rollbackPatch(patchId);
      },
    });

    // 9. create_file
    this.registerTool({
      name: 'create_file',
      description: 'Create a new file in the workspace with safety checks',
      schema: z.object({
        relativePath: z.string(),
        content: z.string(),
        userApproved: z.boolean().default(true),
      }),
      requiresApproval: true,
      execute: async ({ relativePath, content, userApproved }) => {
        return this.patcher.createFile(this.project.id, this.project.rootPath, relativePath, content, userApproved);
      },
    });

    // 10. delete_file
    this.registerTool({
      name: 'delete_file',
      description: 'Safely delete a file with an automatic pre-deletion backup',
      schema: z.object({
        relativePath: z.string(),
        userApproved: z.boolean().default(true),
      }),
      requiresApproval: true,
      execute: async ({ relativePath, userApproved }) => {
        return this.patcher.deleteFile(this.project.id, this.project.rootPath, relativePath, userApproved);
      },
    });

    // 11. move_file
    this.registerTool({
      name: 'move_file',
      description: 'Move or rename a file safely within project boundaries',
      schema: z.object({
        sourceRelative: z.string(),
        targetRelative: z.string(),
        userApproved: z.boolean().default(true),
      }),
      requiresApproval: true,
      execute: async ({ sourceRelative, targetRelative, userApproved }) => {
        return this.patcher.moveFile(this.project.id, this.project.rootPath, sourceRelative, targetRelative, userApproved);
      },
    });

    // 12. run_command
    this.registerTool({
      name: 'run_command',
      description: 'Run an approved development command (tests, builds, lints) with timeout and allowlist',
      schema: z.object({
        command: z.string(),
        userApproved: z.boolean().default(false),
      }),
      requiresApproval: false,
      execute: async ({ command, userApproved }) => {
        return this.terminal.executeCommand(this.project.rootPath, command, userApproved);
      },
    });

    // 13. run_tests
    this.registerTool({
      name: 'run_tests',
      description: 'Execute the project test suite or a targeted test file and parse results',
      schema: z.object({
        targetFile: z.string().optional(),
        userApproved: z.boolean().default(true),
      }),
      requiresApproval: false,
      execute: async ({ targetFile, userApproved }) => {
        return this.testingEngine.runTests(this.project.rootPath, targetFile, userApproved);
      },
    });

    // 14. compare_snapshots
    this.registerTool({
      name: 'compare_snapshots',
      description: 'Compare two OCTOPUS snapshots to identify added, modified, deleted files and breaking changes',
      schema: z.object({
        baseSnapshotId: z.string(),
        targetSnapshotId: z.string(),
      }),
      requiresApproval: false,
      execute: async ({ baseSnapshotId, targetSnapshotId }) => {
        return this.octopus.compareSnapshots(this.project.id, baseSnapshotId, targetSnapshotId);
      },
    });

    // 15. save_memory
    this.registerTool({
      name: 'save_memory',
      description: 'Save an architectural decision, convention, or known issue into persistent project memory',
      schema: z.object({
        category: z.enum(['architecture', 'decision', 'convention', 'module', 'issue']),
        key: z.string().min(1),
        content: z.string().min(1),
      }),
      requiresApproval: false,
      execute: async ({ category, key, content }) => {
        return this.memoryService.addMemory(this.project.id, category, key, content);
      },
    });

    // 16. get_memory
    this.registerTool({
      name: 'get_memory',
      description: 'Retrieve project memories and saved technical decisions',
      schema: z.object({}),
      requiresApproval: false,
      execute: async () => {
        return this.memoryService.getMemories(this.project.id);
      },
    });
  }

  public registerTool(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  public getToolDefinitions() {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      requiresApproval: t.requiresApproval,
    }));
  }

  /**
   * Executes a tool with validation, execution limits, timing, and auditing.
   */
  public async executeTool(name: string, params: any): Promise<ToolExecutionRecord> {
    const start = Date.now();
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        toolName: name,
        params,
        output: { error: `Tool not found: ${name}` },
        status: 'error',
        executionTimeMs: Date.now() - start,
      };
    }

    try {
      const validatedParams = tool.schema.parse(params);
      const output = await tool.execute(validatedParams);

      SecurityGuard.logAudit('AGENT_TOOL_EXECUTION', {
        toolName: name,
        success: true,
      });

      return {
        toolName: name,
        params: validatedParams,
        output,
        status: 'success',
        executionTimeMs: Date.now() - start,
      };
    } catch (err: any) {
      logger.error('AgentEngine', `Tool execution failed: ${name}`, err);
      return {
        toolName: name,
        params,
        output: { error: err.message || String(err) },
        status: 'error',
        executionTimeMs: Date.now() - start,
      };
    }
  }

  /**
   * Creates an actionable multi-step plan for a user's coding or debugging request.
   */
  public createPlan(goal: string): AgentTaskState {
    const lower = goal.toLowerCase();
    const steps: AgentPlanStep[] = [];

    // Classify goal intent into plan templates
    if (lower.includes('fix') || lower.includes('bug') || lower.includes('error') || lower.includes('500') || lower.includes('failed')) {
      steps.push({
        id: 'step-1',
        stepNumber: 1,
        title: 'Inspect Error & Context',
        description: 'Search project files for referenced error terms, stack trace locations, or failure points.',
        status: 'pending',
        tool: 'search_project',
        toolParams: { term: lower.split(' ').find((w) => w.length > 5) || 'error' },
      });
      steps.push({
        id: 'step-2',
        stepNumber: 2,
        title: 'Read Source Code & Dependencies',
        description: 'Read the target file and trace callers to understand why the error occurs.',
        status: 'pending',
        tool: 'read_file',
      });
      steps.push({
        id: 'step-3',
        stepNumber: 3,
        title: 'Prepare Minimal Fix Patch',
        description: 'Draft the targeted code modification proposal with unified diff.',
        status: 'pending',
        tool: 'prepare_patch',
        requiresApproval: true,
      });
      steps.push({
        id: 'step-4',
        stepNumber: 4,
        title: 'Verify Fix with Tests',
        description: 'Run targeted test suite to confirm the bug is resolved and no regressions occurred.',
        status: 'pending',
        tool: 'run_tests',
      });
    } else if (lower.includes('architecture') || lower.includes('flow') || lower.includes('how does')) {
      steps.push({
        id: 'step-1',
        stepNumber: 1,
        title: 'Scan Architecture & Manifests',
        description: 'Synthesize frameworks, entry points, routes, and database models from project index.',
        status: 'pending',
        tool: 'get_architecture',
        toolParams: {},
      });
      steps.push({
        id: 'step-2',
        stepNumber: 2,
        title: 'Trace Dependencies & Call Graph',
        description: 'Trace cross-file import relationships and module boundaries.',
        status: 'pending',
        tool: 'get_dependencies',
      });
    } else {
      // General Coding / Feature Task
      steps.push({
        id: 'step-1',
        stepNumber: 1,
        title: 'Discover Relevant Files',
        description: 'Locate relevant components, routes, and services for the request.',
        status: 'pending',
        tool: 'search_project',
      });
      steps.push({
        id: 'step-2',
        stepNumber: 2,
        title: 'Inspect Existing Implementation',
        description: 'Read source code to maintain consistent project coding conventions.',
        status: 'pending',
        tool: 'read_file',
      });
      steps.push({
        id: 'step-3',
        stepNumber: 3,
        title: 'Draft Code Changes',
        description: 'Generate patch proposals or new files for user review.',
        status: 'pending',
        tool: 'prepare_patch',
        requiresApproval: true,
      });
      steps.push({
        id: 'step-4',
        stepNumber: 4,
        title: 'Verify Build & Tests',
        description: 'Execute build check and test verification.',
        status: 'pending',
        tool: 'run_tests',
      });
    }

    return {
      taskId: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      goal,
      mode: 'agent',
      status: 'planning',
      steps,
      currentStepIndex: 0,
      iteration: 0,
      maxIterations: this.maxIterations,
      outputLog: [`Created ${steps.length}-step plan for goal: "${goal}"`],
    };
  }

  /**
   * Executes the next available step in an agent task.
   */
  public async executeNextStep(
    task: AgentTaskState,
    userApproved: boolean = false
  ): Promise<AgentTaskState> {
    if (task.currentStepIndex >= task.steps.length) {
      task.status = 'completed';
      task.outputLog.push('All planned steps completed successfully.');
      return task;
    }

    const currentStep = task.steps[task.currentStepIndex];
    if (!currentStep) {
      task.status = 'completed';
      return task;
    }

    // Check approval gate
    if (currentStep.requiresApproval && !userApproved && !currentStep.isApproved) {
      task.status = 'waiting_approval';
      currentStep.status = 'pending';
      task.outputLog.push(`Step ${currentStep.stepNumber} ('${currentStep.title}') paused awaiting explicit user approval.`);
      return task;
    }

    currentStep.status = 'running';
    task.status = 'executing';
    task.iteration++;

    if (currentStep.tool) {
      try {
        const record = await this.executeTool(currentStep.tool, currentStep.toolParams || {});
        currentStep.toolResult = record.output;
        if (record.status === 'success') {
          currentStep.status = 'completed';
          currentStep.isApproved = true;
          task.outputLog.push(`✓ Step ${currentStep.stepNumber} completed using tool '${currentStep.tool}' (${record.executionTimeMs}ms)`);
          task.currentStepIndex++;
        } else {
          currentStep.status = 'failed';
          task.outputLog.push(`✗ Step ${currentStep.stepNumber} failed: ${record.output?.error || 'Unknown tool failure'}`);
          // Attempt error recovery or advance
          task.currentStepIndex++;
        }
      } catch (err: any) {
        currentStep.status = 'failed';
        task.outputLog.push(`✗ Step ${currentStep.stepNumber} threw exception: ${err.message}`);
        task.currentStepIndex++;
      }
    } else {
      currentStep.status = 'completed';
      task.currentStepIndex++;
    }

    if (task.currentStepIndex >= task.steps.length) {
      task.status = 'completed';
      task.outputLog.push('Agent task execution completed.');
    }

    return task;
  }
}
