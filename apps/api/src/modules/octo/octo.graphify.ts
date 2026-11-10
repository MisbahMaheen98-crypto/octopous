import { GraphifyEngine } from './graphify/GraphifyEngine.js';
import type { CodebaseKnowledgeGraph, GraphReport } from './octo.types.js';

export class OctoGraphifyService {
  private engines = new Map<string, GraphifyEngine>();

  private getEngine(projectId: string): GraphifyEngine {
    if (!this.engines.has(projectId)) {
      this.engines.set(projectId, new GraphifyEngine(projectId, process.cwd()));
    }
    return this.engines.get(projectId)!;
  }

  public async getGraphForProject(
    projectId: string,
    _projectName?: string,
    _blueprint?: any
  ): Promise<CodebaseKnowledgeGraph> {
    const engine = this.getEngine(projectId);
    const cached = engine.getCachedGraph();
    if (cached) return cached;
    return engine.generateGraph();
  }

  public async getReportForProject(projectId: string): Promise<GraphReport> {
    const engine = this.getEngine(projectId);
    const cached = engine.getCachedReport();
    if (cached) return cached;
    return engine.generateReport();
  }
}
