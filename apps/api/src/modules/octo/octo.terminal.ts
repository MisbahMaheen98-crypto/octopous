/**
 * OCTOBOT Safe Terminal & Command Execution Engine
 * Provides controlled execution of development commands, test suites, and build checks.
 * Enforces strict command allowlists, workspace boundaries, execution timeouts,
 * buffer limits, and security audit logs.
 */

import { spawn } from 'child_process';
import path from 'path';
import { SecurityGuard } from './octo.security.js';
import { logger } from './octo.logger.js';
import type { CommandExecutionResult } from './octo.types.js';

// Approved safe development commands
const SAFE_EXACT_COMMANDS = new Set([
  'npm test',
  'npm run test',
  'npm run build',
  'npm run typecheck',
  'npm run lint',
  'npm run check',
  'npx vitest run',
  'npx tsc --noEmit',
  'git status',
  'git diff',
  'git log -n 5',
]);

// Patterns allowed with inspection
const SAFE_COMMAND_PATTERNS = [
  /^npm run (test|build|typecheck|lint|check)(:[a-zA-Z0-9_-]+)?$/,
  /^npm test( -- [a-zA-Z0-9_\-./]+)?$/,
  /^npx vitest run( [a-zA-Z0-9_\-./]+)?$/,
  /^npx tsc -p [a-zA-Z0-9_\-./]+ --noEmit$/,
];

// Explicitly blocked dangerous patterns
const DANGEROUS_PATTERNS = [
  /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f?|-f)\b/i,
  /\bdel\s+\/[sfq]/i,
  /\bformat\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
  /\bpowershell\b.*\b(downloadstring|iex|invoke-webrequest)\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bshutdown\b/i,
  /\breboot\b/i,
  /\bnetsh\b/i,
  /\bcat\s+\/etc\/(passwd|shadow)/i,
];

export class TerminalExecutionService {
  private static instance: TerminalExecutionService;

  private constructor() {}

  public static getInstance(): TerminalExecutionService {
    if (!TerminalExecutionService.instance) {
      TerminalExecutionService.instance = new TerminalExecutionService();
    }
    return TerminalExecutionService.instance;
  }

  /**
   * Validates whether a command is permitted by policy.
   */
  public evaluateCommand(command: string): { isAllowed: boolean; reason?: string; requiresApproval: boolean } {
    const trimmed = command.trim();

    // Check dangerous patterns
    for (const pat of DANGEROUS_PATTERNS) {
      if (pat.test(trimmed)) {
        return {
          isAllowed: false,
          reason: 'Command blocked by security policy (dangerous system operation detected).',
          requiresApproval: true,
        };
      }
    }

    // Check exact safe commands
    if (SAFE_EXACT_COMMANDS.has(trimmed)) {
      return { isAllowed: true, requiresApproval: false };
    }

    // Check safe patterns
    for (const pat of SAFE_COMMAND_PATTERNS) {
      if (pat.test(trimmed)) {
        return { isAllowed: true, requiresApproval: false };
      }
    }

    // Dependency installations or other package manager commands require explicit approval
    if (/^npm (install|i|add)\s+/i.test(trimmed)) {
      return {
        isAllowed: true,
        reason: 'Dependency installation alters package dependencies and requires explicit user approval.',
        requiresApproval: true,
      };
    }

    return {
      isAllowed: false,
      reason: `Command '${trimmed}' is not on the approved development execution allowlist.`,
      requiresApproval: true,
    };
  }

  /**
   * Executes an approved command inside the workspace directory.
   */
  public async executeCommand(
    projectRoot: string,
    command: string,
    userApproved: boolean = false,
    timeoutMs: number = 30_000
  ): Promise<CommandExecutionResult> {
    const start = Date.now();
    const evaluation = this.evaluateCommand(command);

    if (!evaluation.isAllowed) {
      SecurityGuard.logAudit('COMMAND_BLOCKED', { command, reason: evaluation.reason });
      return {
        command,
        exitCode: 126,
        stdout: '',
        stderr: evaluation.reason || 'Command not permitted.',
        durationMs: Date.now() - start,
        isAllowed: false,
        blockedReason: evaluation.reason,
      };
    }

    if (evaluation.requiresApproval && !userApproved) {
      return {
        command,
        exitCode: 1,
        stdout: '',
        stderr: evaluation.reason || 'Command requires explicit user approval before execution.',
        durationMs: Date.now() - start,
        isAllowed: true,
        blockedReason: 'Awaiting user approval',
      };
    }

    const resolvedRoot = path.resolve(projectRoot);
    logger.info('TerminalExecutionService', `Executing command: '${command}' in ${resolvedRoot}`);

    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      const shell = isWin ? 'cmd.exe' : '/bin/sh';
      const args = isWin ? ['/d', '/s', '/c', command] : ['-c', command];

      let stdout = '';
      let stderr = '';
      const MAX_OUTPUT_BYTES = 64 * 1024; // 64 KB limit

      let timer: NodeJS.Timeout | null = null;
      let killedDueToTimeout = false;

      const child = spawn(shell, args, {
        cwd: resolvedRoot,
        env: {
          ...process.env,
          CI: 'true',
          NODE_ENV: 'test',
        },
      });

      timer = setTimeout(() => {
        killedDueToTimeout = true;
        child.kill();
      }, timeoutMs);

      child.stdout.on('data', (chunk: Buffer) => {
        if (stdout.length < MAX_OUTPUT_BYTES) {
          stdout += chunk.toString('utf-8');
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length < MAX_OUTPUT_BYTES) {
          stderr += chunk.toString('utf-8');
        }
      });

      child.on('error', (err) => {
        if (timer) clearTimeout(timer);
        resolve({
          command,
          exitCode: 1,
          stdout: SecurityGuard.redactSecrets(stdout),
          stderr: SecurityGuard.redactSecrets(`Process spawn error: ${err.message}`),
          durationMs: Date.now() - start,
          isAllowed: true,
        });
      });

      child.on('close', (code) => {
        if (timer) clearTimeout(timer);

        const durationMs = Date.now() - start;
        const finalExit = killedDueToTimeout ? 124 : (code ?? 0);
        const finalStderr = killedDueToTimeout
          ? `${stderr}\nExecution timed out after ${timeoutMs}ms`
          : stderr;

        SecurityGuard.logAudit('COMMAND_EXECUTED', {
          command,
          exitCode: finalExit,
          durationMs,
        });

        resolve({
          command,
          exitCode: finalExit,
          stdout: SecurityGuard.redactSecrets(stdout),
          stderr: SecurityGuard.redactSecrets(finalStderr),
          durationMs,
          isAllowed: true,
        });
      });
    });
  }
}
