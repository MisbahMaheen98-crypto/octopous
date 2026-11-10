/**
 * OCTOBOT Automated Testing & Verification Engine
 * Analyzes workspace test frameworks, finds matching test files,
 * executes targeted tests, parses assertion failures, and reports verification status.
 */

import path from 'path';
import fs from 'fs';
import { TerminalExecutionService } from './octo.terminal.js';
import { logger } from './octo.logger.js';
import type { TestExecutionResult } from './octo.types.js';

export class TestingEngine {
  private terminal: TerminalExecutionService;

  constructor() {
    this.terminal = TerminalExecutionService.getInstance();
  }

  /**
   * Detects the test framework in use in the project
   */
  public detectFramework(projectRoot: string): string {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        if (deps['vitest']) return 'Vitest';
        if (deps['jest']) return 'Jest';
        if (deps['mocha']) return 'Mocha';
        if (deps['playwright']) return 'Playwright';
      } catch {}
    }
    return 'Vitest';
  }

  /**
   * Finds matching test file for a given source file
   */
  public findMatchingTestFile(projectRoot: string, sourceRelativePath: string): string | null {
    const parsed = path.parse(sourceRelativePath);
    const candidateNames = [
      `${parsed.name}.test${parsed.ext}`,
      `${parsed.name}.spec${parsed.ext}`,
      `${parsed.name}.test.ts`,
      `${parsed.name}.spec.ts`,
      `${parsed.name}.test.js`,
    ];

    // Check same directory
    for (const cand of candidateNames) {
      const candRel = path.join(parsed.dir, cand).replace(/\\/g, '/');
      if (fs.existsSync(path.join(projectRoot, candRel))) {
        return candRel;
      }
    }

    // Check __tests__ or test/ directory
    for (const cand of candidateNames) {
      const candRel = path.join('test', cand).replace(/\\/g, '/');
      if (fs.existsSync(path.join(projectRoot, candRel))) {
        return candRel;
      }
      const candRel2 = path.join('tests', cand).replace(/\\/g, '/');
      if (fs.existsSync(path.join(projectRoot, candRel2))) {
        return candRel2;
      }
    }

    return null;
  }

  /**
   * Runs the test suite for the project or a targeted test file
   */
  public async runTests(
    projectRoot: string,
    targetFile?: string,
    userApproved: boolean = true
  ): Promise<TestExecutionResult> {
    const framework = this.detectFramework(projectRoot);
    let command = 'npm test';

    if (framework === 'Vitest') {
      command = targetFile ? `npx vitest run ${targetFile}` : 'npx vitest run';
    } else if (framework === 'Jest') {
      command = targetFile ? `npm test -- ${targetFile}` : 'npm test';
    }

    logger.info('TestingEngine', `Running tests: ${command} in ${projectRoot}`);
    const cmdResult = await this.terminal.executeCommand(projectRoot, command, userApproved, 45_000);

    const combinedOutput = `${cmdResult.stdout}\n${cmdResult.stderr}`;
    const parsed = this.parseTestOutput(framework, combinedOutput);

    return {
      framework,
      totalTests: parsed.totalTests,
      passed: parsed.passed,
      failed: parsed.failed,
      skipped: parsed.skipped,
      durationMs: cmdResult.durationMs,
      failures: parsed.failures,
      buildStatus: cmdResult.exitCode === 0 ? 'success' : 'failed',
    };
  }

  private parseTestOutput(framework: string, output: string): {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    failures: Array<{ testName: string; file?: string; error: string }>;
  } {
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    const failures: Array<{ testName: string; file?: string; error: string }> = [];

    // Vitest pattern: Tests  1 failed | 2 passed (3)
    const vitestMatch = output.match(/Tests\s+(?:(\d+)\s+failed)?(?:[|\s,]+)?(?:(\d+)\s+passed)?(?:[|\s,]+)?(?:(\d+)\s+skipped)?\s*\((\d+)\)/i);
    if (vitestMatch) {
      failed = parseInt(vitestMatch[1] || '0', 10);
      passed = parseInt(vitestMatch[2] || '0', 10);
      skipped = parseInt(vitestMatch[3] || '0', 10);
      totalTests = parseInt(vitestMatch[4] || '0', 10);
    } else {
      // Fallback simple line scanning
      const passMatches = output.match(/✓|\bPASS\b|passed/gi);
      const failMatches = output.match(/×|\bFAIL\b|failed/gi);
      if (passMatches) passed = passMatches.length;
      if (failMatches) failed = failMatches.length;
      totalTests = passed + failed;
    }

    // Extract failure items
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.includes('FAIL') || line.includes('×')) {
        const testName = line.replace(/^[×\sFAIL]+/, '').trim();
        const snippet = lines.slice(i, Math.min(lines.length, i + 5)).join('\n');
        failures.push({
          testName: testName || 'Unnamed Test Failure',
          error: snippet.trim(),
        });
      }
    }

    return { totalTests, passed, failed, skipped, failures: failures.slice(0, 10) };
  }
}
