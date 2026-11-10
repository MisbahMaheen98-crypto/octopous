/**
 * OCTOBOT Project Memory & Context Retention Service
 * Provides secure, project-specific memory storage for architectural decisions,
 * technical conventions, known issues, and task outcomes.
 * Enforces zero-secret storage with automatic redaction.
 */

import { SecurityGuard } from './octo.security.js';
import { logger } from './octo.logger.js';
import type { ProjectMemoryEntry } from './octo.types.js';

export class ProjectMemoryService {
  private static instance: ProjectMemoryService;
  private memories: Map<string, ProjectMemoryEntry[]> = new Map();

  private constructor() {}

  public static getInstance(): ProjectMemoryService {
    if (!ProjectMemoryService.instance) {
      ProjectMemoryService.instance = new ProjectMemoryService();
    }
    return ProjectMemoryService.instance;
  }

  public getMemories(projectId: string): ProjectMemoryEntry[] {
    return this.memories.get(projectId) || [];
  }

  public getMemoriesByCategory(
    projectId: string,
    category: ProjectMemoryEntry['category']
  ): ProjectMemoryEntry[] {
    const list = this.getMemories(projectId);
    return list.filter((m) => m.category === category);
  }

  public addMemory(
    projectId: string,
    category: ProjectMemoryEntry['category'],
    key: string,
    content: string
  ): ProjectMemoryEntry {
    const safeContent = SecurityGuard.redactSecrets(content.trim());
    const safeKey = SecurityGuard.redactSecrets(key.trim());

    const entry: ProjectMemoryEntry = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      projectId,
      category,
      key: safeKey,
      content: safeContent,
      updatedAt: new Date().toISOString(),
    };

    const existing = this.getMemories(projectId);
    const existingIndex = existing.findIndex((m) => m.category === category && m.key.toLowerCase() === safeKey.toLowerCase());

    if (existingIndex >= 0) {
      existing[existingIndex] = entry;
    } else {
      existing.push(entry);
    }

    this.memories.set(projectId, existing);
    logger.info('ProjectMemoryService', `Saved memory for project ${projectId} [${category}]: ${safeKey}`);
    return entry;
  }

  public removeMemory(projectId: string, memoryId: string): boolean {
    const existing = this.getMemories(projectId);
    const updated = existing.filter((m) => m.id !== memoryId);
    if (updated.length !== existing.length) {
      this.memories.set(projectId, updated);
      return true;
    }
    return false;
  }

  public clearProjectMemory(projectId: string): void {
    this.memories.delete(projectId);
  }

  /**
   * Formats relevant memory as a markdown block for AI system prompts
   */
  public formatPromptContext(projectId: string): string {
    const memories = this.getMemories(projectId);
    if (memories.length === 0) return '';

    const lines: string[] = ['[PROJECT MEMORY & KNOWN DECISIONS]'];
    for (const mem of memories) {
      lines.push(`- **[${mem.category.toUpperCase()}] ${mem.key}**: ${mem.content}`);
    }
    return lines.join('\n');
  }
}
