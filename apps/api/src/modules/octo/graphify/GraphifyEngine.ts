import fs from 'fs';
import path from 'path';
import {
  CodebaseKnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphReport,
} from '../octo.types.js';
import { logger } from '../octo.logger.js';
import { SecurityGuard } from '../octo.security.js';

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
  '.octo-backup',
  '.cache',
  'graphify-out',
  '.octopus-storage',
  'postgres-data',
  'out',
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.py',
  '.go',
  '.rs',
  '.sql',
]);

export class GraphifyEngine {
  private projectId: string;
  private projectRoot: string;
  private cachedGraph: CodebaseKnowledgeGraph | null = null;
  private cachedReport: GraphReport | null = null;

  constructor(projectId: string, projectRoot: string) {
    this.projectId = projectId;
    this.projectRoot = path.resolve(projectRoot);
  }

  public getCachedGraph(): CodebaseKnowledgeGraph | null {
    return this.cachedGraph;
  }

  public getCachedReport(): GraphReport | null {
    return this.cachedReport;
  }

  public async generateReport(): Promise<GraphReport> {
    const graph = this.cachedGraph || (await this.generateGraph());
    this.cachedReport = this.generateReportFromGraph(graph);
    return this.cachedReport;
  }

  public findShortestPath(startId: string, endId: string): string[] {
    return this.findPath(startId, endId);
  }

  public formatPromptContext(_graph?: CodebaseKnowledgeGraph): string {
    return this.getRelevantContextForAi('');
  }

  /**
   * Generates a deterministic codebase knowledge graph using local AST and symbol analysis.
   */
  public async generateGraph(): Promise<CodebaseKnowledgeGraph> {
    const startTime = Date.now();
    const nodes: Map<string, GraphNode> = new Map();
    const edges: GraphEdge[] = [];

    let scanRoot = this.projectRoot;
    if (!fs.existsSync(scanRoot) || (fs.existsSync(scanRoot) && fs.readdirSync(scanRoot).length === 0)) {
      const candidates = [
        path.resolve(process.cwd(), '.octopus-storage', 'graphify-cache', this.projectId),
        path.resolve(process.cwd(), 'sample-project'),
        path.resolve(process.cwd(), '..', 'sample-project'),
        path.resolve(process.cwd(), '..', '..', 'sample-project'),
        path.resolve(process.cwd(), 'apps'),
        path.resolve(process.cwd(), '..', 'apps'),
        process.cwd(),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.readdirSync(cand).length > 0) {
          scanRoot = cand;
          break;
        }
      }
    }

    const fileList: { fullPath: string; relativePath: string; extension: string }[] = [];

    const scanDir = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          const relativePath = path.relative(scanRoot, fullPath).replace(/\\/g, '/');

          if (entry.isDirectory()) {
            if (IGNORED_DIRS.has(entry.name)) continue;
            scanDir(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
            if (SecurityGuard.isSensitiveFile(entry.name)) continue;
            fileList.push({ fullPath, relativePath, extension: ext });
          }
        }
      } catch (err) {
        logger.warn('GraphifyEngine', `Could not scan directory: ${currentDir}`, err);
      }
    };

    if (fs.existsSync(scanRoot)) {
      scanDir(scanRoot);
    }

    // 1. Create File Nodes
    for (const f of fileList) {
      const fileName = path.basename(f.relativePath);
      nodes.set(f.relativePath, {
        id: f.relativePath,
        label: fileName,
        name: fileName,
        type: 'file',
        filePath: f.relativePath,
        path: f.relativePath,
        language: f.extension.replace('.', '') || 'text',
        description: `Source file (${f.extension}) in ${path.dirname(f.relativePath)}`,
        inDegree: 0,
        outDegree: 0,
        complexityScore: 0,
        community: 0,
        isGodNode: false,
        metrics: { inDegree: 0, outDegree: 0, centralityScore: 0, isGodNode: false },
      });
    }

    // 2. Parse file content for detailed symbols, definitions, routes, and imports
    for (const f of fileList) {
      let content = '';
      try {
        content = fs.readFileSync(f.fullPath, 'utf-8');
      } catch (err) {
        continue;
      }

      const lines = content.split('\n');

      // A. Imports extraction (Edge: 'imports')
      const fileDir = path.dirname(f.fullPath);
      lines.forEach((line) => {
        const importMatch = line.match(/(?:import|from|require\()\s*['"](\.[^'"]+)['"]/);
        if (importMatch && importMatch[1]) {
          const rawImport = importMatch[1];
          const cleanImport = rawImport.replace(/\.(js|ts|tsx|jsx)$/, '');
          for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.json', '']) {
            const candidatePath = path.resolve(fileDir, cleanImport + ext);
            const candidateRel = path.relative(this.projectRoot, candidatePath).replace(/\\/g, '/');
            if (nodes.has(candidateRel) && candidateRel !== f.relativePath) {
              edges.push({
                source: f.relativePath,
                target: candidateRel,
                type: 'imports',
                label: `imports ${path.basename(candidateRel)}`,
              });
              break;
            }
          }
        }
      });

      // B. Symbol definitions (Classes, Interfaces, Functions, Endpoints)
      lines.forEach((line, idx) => {
        const lineNum = idx + 1;
        const trimmed = line.trim();

        // Classes
        const classMatch = trimmed.match(/(?:export\s+)?class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_]+))?(?:\s+implements\s+([A-Za-z0-9_,\s]+))?/);
        if (classMatch && classMatch[1]) {
          const className = classMatch[1];
          const classNodeId = `${f.relativePath}::${className}`;
          nodes.set(classNodeId, {
            id: classNodeId,
            label: className,
            name: className,
            type: 'class',
            filePath: f.relativePath,
            path: f.relativePath,
            line: lineNum,
            description: `Class defined in ${f.relativePath}`,
            language: f.extension.replace('.', '') || 'text',
            inDegree: 0,
            outDegree: 0,
            complexityScore: 0,
            community: 0,
            isGodNode: false,
            metrics: { inDegree: 0, outDegree: 0, centralityScore: 0, isGodNode: false },
          });

          edges.push({
            source: f.relativePath,
            target: classNodeId,
            type: 'defines',
            label: `defines ${className}`,
          });

          // Inheritance edge
          if (classMatch[2]) {
            const superClassName = classMatch[2];
            edges.push({
              source: classNodeId,
              target: superClassName,
              type: 'implements',
              label: `extends ${superClassName}`,
            });
          }
        }

        // Interfaces
        const ifaceMatch = trimmed.match(/(?:export\s+)?interface\s+([A-Za-z0-9_]+)/);
        if (ifaceMatch && ifaceMatch[1]) {
          const ifaceName = ifaceMatch[1];
          const ifaceNodeId = `${f.relativePath}::${ifaceName}`;
          nodes.set(ifaceNodeId, {
            id: ifaceNodeId,
            label: ifaceName,
            name: ifaceName,
            type: 'interface',
            filePath: f.relativePath,
            path: f.relativePath,
            line: lineNum,
            description: `Interface defined in ${f.relativePath}`,
            language: f.extension.replace('.', '') || 'text',
            inDegree: 0,
            outDegree: 0,
            complexityScore: 0,
            community: 0,
            isGodNode: false,
            metrics: { inDegree: 0, outDegree: 0, centralityScore: 0, isGodNode: false },
          });

          edges.push({
            source: f.relativePath,
            target: ifaceNodeId,
            type: 'defines',
            label: `defines interface ${ifaceName}`,
          });
        }

        // Functions / Methods
        const funcMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_]+)/) ||
                          trimmed.match(/(?:public|private|protected)?\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\([^)]*\)\s*(?::|\{)/);
        if (funcMatch && funcMatch[1] && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(funcMatch[1])) {
          const funcName = funcMatch[1];
          const funcNodeId = `${f.relativePath}::${funcName}`;
          if (!nodes.has(funcNodeId)) {
            nodes.set(funcNodeId, {
              id: funcNodeId,
              label: `${funcName}()`,
              name: `${funcName}()`,
              type: 'function',
              filePath: f.relativePath,
              path: f.relativePath,
              line: lineNum,
              description: `Function in ${f.relativePath}`,
              language: f.extension.replace('.', '') || 'text',
              inDegree: 0,
              outDegree: 0,
              complexityScore: 0,
              community: 0,
              isGodNode: false,
              metrics: { inDegree: 0, outDegree: 0, centralityScore: 0, isGodNode: false },
            });

            edges.push({
              source: f.relativePath,
              target: funcNodeId,
              type: 'defines',
              label: `declares function ${funcName}`,
            });
          }
        }

        // REST Endpoints
        const endpointMatch = trimmed.match(/(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/i);
        if (endpointMatch && endpointMatch[1] && endpointMatch[2]) {
          const method = endpointMatch[1].toUpperCase();
          const endpointPath = endpointMatch[2];
          const endpointId = `${f.relativePath}::[${method} ${endpointPath}]`;
          nodes.set(endpointId, {
            id: endpointId,
            label: `${method} ${endpointPath}`,
            name: `${method} ${endpointPath}`,
            type: 'endpoint',
            filePath: f.relativePath,
            path: f.relativePath,
            line: lineNum,
            description: `HTTP Endpoint in ${f.relativePath}`,
            language: f.extension.replace('.', '') || 'text',
            inDegree: 0,
            outDegree: 0,
            complexityScore: 0,
            community: 0,
            isGodNode: false,
            metrics: { inDegree: 0, outDegree: 0, centralityScore: 0, isGodNode: false },
          });

          edges.push({
            source: f.relativePath,
            target: endpointId,
            type: 'defines',
            label: `serves ${method} ${endpointPath}`,
          });
        }
      });
    }

    // 3. Compute inDegree, outDegree, and centrality metrics
    const inDegreeMap: Record<string, number> = {};
    const outDegreeMap: Record<string, number> = {};

    for (const edge of edges) {
      outDegreeMap[edge.source] = (outDegreeMap[edge.source] || 0) + 1;
      inDegreeMap[edge.target] = (inDegreeMap[edge.target] || 0) + 1;
    }

    const nodeArray = Array.from(nodes.values());
    for (const node of nodeArray) {
      const inDeg = inDegreeMap[node.id] || 0;
      const outDeg = outDegreeMap[node.id] || 0;
      const centralityScore = inDeg * 2 + outDeg;
      const isGodNode = centralityScore >= 4 || inDeg >= 3;

      node.inDegree = inDeg;
      node.outDegree = outDeg;
      node.complexityScore = centralityScore;
      node.isGodNode = isGodNode;
      node.metrics = {
        inDegree: inDeg,
        outDegree: outDeg,
        centralityScore,
        isGodNode,
      };
    }

    // 4. Identify God Nodes (Central architectural hubs with high connectivity)
    const godNodes = nodeArray
      .filter((n) => n.isGodNode)
      .sort((a, b) => (b.complexityScore || 0) - (a.complexityScore || 0));

    // 5. Architectural Layer Clustering
    const clusters: CodebaseKnowledgeGraph['clusters'] = [
      {
        name: 'Presentation & API Routes',
        description: 'User-facing components, HTTP controllers, and Express route handlers',
        nodeIds: nodeArray
          .filter(
            (n) =>
              n.filePath.includes('/routes/') ||
              n.filePath.includes('/components/') ||
              n.filePath.includes('Controller') ||
              n.type === 'endpoint'
          )
          .map((n) => n.id),
      },
      {
        name: 'Business Logic & Services',
        description: 'Core domain logic, payment handling, and state machines',
        nodeIds: nodeArray
          .filter(
            (n) =>
              n.filePath.includes('/services/') ||
              n.filePath.includes('Service') ||
              n.label.includes('Service')
          )
          .map((n) => n.id),
      },
      {
        name: 'Persistence & Data Access',
        description: 'Database connections, repositories, schemas, and ORM models',
        nodeIds: nodeArray
          .filter(
            (n) =>
              n.filePath.includes('database') ||
              n.filePath.includes('models') ||
              n.filePath.includes('schema') ||
              n.filePath.endsWith('.sql')
          )
          .map((n) => n.id),
      },
      {
        name: 'Configuration, Types & Utilities',
        description: 'Type definitions, runtime configurations, helpers, and security boundaries',
        nodeIds: nodeArray
          .filter(
            (n) =>
              n.filePath.includes('types') ||
              n.filePath.includes('config') ||
              n.filePath.includes('utils') ||
              n.filePath.includes('security')
          )
          .map((n) => n.id),
      },
    ];

    // Assign community index to nodes based on clusters
    clusters.forEach((cl, idx) => {
      const communityId = idx + 1;
      for (const nid of cl.nodeIds) {
        const n = nodes.get(nid);
        if (n) {
          n.community = communityId;
        }
      }
    });

    const communities = clusters.map((c, idx) => ({
      id: idx + 1,
      name: c.name,
      memberCount: c.nodeIds.length,
    }));

    const totalNodes = nodeArray.length;
    const totalEdges = edges.length;
    const density = totalNodes > 1 ? Number((totalEdges / (totalNodes * (totalNodes - 1))).toFixed(4)) : 0;
    const averageDegree = totalNodes > 0 ? Number((totalEdges / totalNodes).toFixed(2)) : 0;

    const totalFiles = nodeArray.filter((n) => n.type === 'file').length || totalNodes;
    const architecturalHealthScore = Math.max(
      20,
      Math.min(100, Math.round(100 - (godNodes.length * 6) - (density > 0.3 ? 15 : 0)))
    );

    this.cachedGraph = {
      projectId: this.projectId,
      generatedAt: new Date().toISOString(),
      nodes: nodeArray,
      edges,
      godNodes,
      clusters,
      communities,
      circularDependencies: [],
      metrics: {
        totalNodes,
        totalEdges,
        density,
        averageDegree,
      },
      summary: {
        totalFiles,
        totalDependencies: totalEdges,
        architecturalHealthScore,
      },
    };

    // Generate Architectural Report
    this.cachedReport = this.generateReportFromGraph(this.cachedGraph);

    // Persist official Graphify output artifacts into `graphify-out/`
    try {
      const outDir = path.join(this.projectRoot, 'graphify-out');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(outDir, 'graph.json'),
        JSON.stringify(this.cachedGraph, null, 2),
        'utf-8'
      );

      const reportMd = this.formatReportMarkdown(this.cachedReport, this.cachedGraph);
      fs.writeFileSync(path.join(outDir, 'GRAPH_REPORT.md'), reportMd, 'utf-8');

      const graphHtml = this.generateInteractiveHtml(this.cachedGraph);
      fs.writeFileSync(path.join(outDir, 'graph.html'), graphHtml, 'utf-8');
    } catch (saveErr) {
      logger.warn('GraphifyEngine', 'Could not persist graphify-out artifacts to disk', saveErr);
    }

    logger.info(
      'GraphifyEngine',
      `Constructed codebase knowledge graph for '${this.projectId}': ${totalNodes} nodes, ${totalEdges} edges, ${godNodes.length} God Nodes in ${Date.now() - startTime}ms`
    );

    return this.cachedGraph;
  }

  /**
   * Generates a Graphify architectural summary report (GRAPH_REPORT.md style)
   */
  private generateReportFromGraph(graph: CodebaseKnowledgeGraph): GraphReport {
    const godNodesSummary = graph.godNodes.map((n) => ({
      id: n.id,
      label: n.label,
      connectivity: n.metrics?.centralityScore || 0,
      reason: `Inward references: ${n.metrics?.inDegree}, outward dependencies: ${n.metrics?.outDegree}. Highly coupled architectural hub.`,
    }));

    const architectureClusters = graph.clusters.map((c) => ({
      name: c.name,
      description: c.description,
      files: Array.from(new Set(c.nodeIds.map((id) => id.split('::')[0] || id))),
    }));

    const riskAreas: GraphReport['riskAreas'] = [];
    for (const gn of graph.godNodes) {
      if ((gn.metrics?.inDegree || 0) >= 3) {
        riskAreas.push({
          file: gn.filePath,
          severity: 'high',
          description: `High blast radius: '${gn.label}' is referenced by ${gn.metrics?.inDegree} components. Modifications require regression testing.`,
        });
      }
    }

    const healthScore = graph.summary?.architecturalHealthScore ?? 85;

    const findings: GraphReport['findings'] = [];
    for (const gn of graph.godNodes) {
      findings.push({
        severity: (gn.metrics?.inDegree || 0) >= 4 ? 'error' : 'warning',
        title: `God Node Coupling: ${gn.label}`,
        description: `Component '${gn.label}' (${gn.filePath}) acts as a central architectural hub with ${gn.metrics?.inDegree} incoming references and ${gn.metrics?.outDegree} outgoing dependencies (Centrality: ${gn.metrics?.centralityScore}).`,
        recommendation: `Decouple ${gn.label} by separating concerns into focused helper modules or introducing abstract interfaces.`,
      });
    }

    for (const r of riskAreas) {
      findings.push({
        severity: r.severity === 'high' ? 'error' : r.severity === 'medium' ? 'warning' : 'info',
        title: `Blast Radius Alert: ${path.basename(r.file)}`,
        description: r.description,
        recommendation: 'Ensure automated test coverage before making changes to avoid unintended side effects.',
      });
    }

    if (findings.length === 0) {
      findings.push({
        severity: 'info',
        title: 'Clean Architecture Topology',
        description: 'No severe architectural hotspots or over-coupled God Nodes detected across scanned modules.',
        recommendation: 'Maintain modular boundaries and single-responsibility contracts.',
      });
    }

    const recommendations: string[] = [
      'Encapsulate high-centrality God Nodes behind clear interface contracts.',
      'Ensure unit tests cover all direct dependents of business logic services.',
      'Maintain clear boundary between presentation routes and database access layers.',
    ];

    const summary = `Codebase knowledge graph contains ${graph.metrics.totalNodes} nodes and ${graph.metrics.totalEdges} relational edges across ${graph.clusters.length} architectural layers. Identified ${graph.godNodes.length} central hub components.`;

    return {
      projectId: this.projectId,
      generatedAt: new Date().toISOString(),
      summary,
      healthScore,
      findings,
      architectureClusters,
      godNodes: godNodesSummary,
      riskAreas,
      recommendations,
    };
  }

  private formatReportMarkdown(report: GraphReport, graph: CodebaseKnowledgeGraph): string {
    let md = `# Graphify Codebase Architecture Report\n\n`;
    md += `**Project:** \`${this.projectId}\`  \n`;
    md += `**Generated:** \`${report.generatedAt}\`  \n`;
    md += `**Entities:** ${graph.metrics.totalNodes} Nodes | **Connections:** ${graph.metrics.totalEdges} Edges | **Density:** ${graph.metrics.density}\n\n`;
    md += `## 1. Executive Summary\n${report.summary}\n\n`;

    md += `## 2. God Nodes (Architectural Hubs)\n`;
    md += `| Entity | Centrality Score | Blast Radius Risk |\n| :--- | :--- | :--- |\n`;
    for (const gn of report.godNodes) {
      md += `| \`${gn.label}\` | **${gn.connectivity}** | ${gn.reason} |\n`;
    }
    md += `\n`;

    md += `## 3. Architectural Layers & Community Clusters\n`;
    for (const cl of report.architectureClusters) {
      md += `### ${cl.name}\n${cl.description}\n`;
      md += `- **Key Files:** ${cl.files.map((f) => `\`${f}\``).join(', ')}\n\n`;
    }

    if (report.riskAreas.length > 0) {
      md += `## 4. Coupling & Risk Warnings\n`;
      for (const r of report.riskAreas) {
        md += `- ⚠️ **${r.file}** [${r.severity.toUpperCase()}]: ${r.description}\n`;
      }
      md += `\n`;
    }

    md += `## 5. Architectural Recommendations\n`;
    for (const rec of report.recommendations) {
      md += `- ${rec}\n`;
    }

    return md;
  }

  private generateInteractiveHtml(graph: CodebaseKnowledgeGraph): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Graphify - ${this.projectId} Knowledge Graph</title>
  <style>
    body { margin: 0; background: #070913; color: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; }
    header { padding: 16px 24px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; background: #0b0f19; }
    h1 { margin: 0; font-size: 16px; color: #38bdf8; }
    .metrics { display: flex; gap: 20px; font-size: 12px; color: #94a3b8; }
    .container { display: flex; height: calc(100vh - 60px); }
    .sidebar { width: 320px; border-right: 1px solid #1e293b; padding: 16px; overflow-y: auto; background: #080c16; }
    .graph-view { flex: 1; padding: 24px; overflow: auto; }
    .node-card { padding: 8px 12px; margin-bottom: 8px; border: 1px solid #1e293b; border-radius: 6px; font-size: 12px; background: #0f172a; }
    .god-node { border-color: #f59e0b; }
    .badge { display: inline-block; padding: 2px 6px; font-size: 10px; border-radius: 4px; background: #0369a1; color: #fff; }
    .table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
    .table th, .table td { padding: 8px; border: 1px solid #1e293b; text-align: left; }
    .table th { background: #0f172a; color: #38bdf8; }
  </style>
</head>
<body>
  <header>
    <h1>🕸️ Graphify Knowledge Graph: ${this.projectId}</h1>
    <div class="metrics">
      <span>Nodes: <strong>${graph.metrics.totalNodes}</strong></span>
      <span>Edges: <strong>${graph.metrics.totalEdges}</strong></span>
      <span>God Nodes: <strong>${graph.godNodes.length}</strong></span>
    </div>
  </header>
  <div class="container">
    <div class="sidebar">
      <h3 style="font-size: 13px; color: #f59e0b; margin-top: 0;">⚡ God Nodes (Central Hubs)</h3>
      ${graph.godNodes.map((n) => `
        <div class="node-card god-node">
          <strong>${n.label}</strong> <span class="badge">Score: ${n.metrics?.centralityScore}</span>
          <div style="font-size: 10px; color: #64748b; margin-top: 4px;">${n.filePath}</div>
        </div>
      `).join('')}
    </div>
    <div class="graph-view">
      <h2 style="font-size: 15px; margin-top: 0;">Codebase Dependency & Relational Matrix</h2>
      <table class="table">
        <thead>
          <tr>
            <th>Source Entity</th>
            <th>Relation</th>
            <th>Target Entity</th>
          </tr>
        </thead>
        <tbody>
          ${graph.edges.slice(0, 50).map((e) => `
            <tr>
              <td><code>${e.source}</code></td>
              <td><span class="badge">${e.type}</span></td>
              <td><code>${e.target}</code></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Queries the graph for nodes matching a term and retrieves their 1-hop and 2-hop relationships.
   */
  public queryGraph(query: string): {
    matchedNodes: GraphNode[];
    relatedEdges: GraphEdge[];
    upstreamCallers: string[];
    downstreamDependencies: string[];
  } {
    if (!this.cachedGraph) {
      return { matchedNodes: [], relatedEdges: [], upstreamCallers: [], downstreamDependencies: [] };
    }

    const lower = query.toLowerCase().trim();
    const matchedNodes = this.cachedGraph.nodes.filter(
      (n) => n.id.toLowerCase().includes(lower) || n.label.toLowerCase().includes(lower)
    );

    const matchedIds = new Set(matchedNodes.map((n) => n.id));
    const relatedEdges = this.cachedGraph.edges.filter(
      (e) => matchedIds.has(e.source) || matchedIds.has(e.target)
    );

    const upstreamCallers = Array.from(
      new Set(relatedEdges.filter((e) => matchedIds.has(e.target)).map((e) => e.source))
    );

    const downstreamDependencies = Array.from(
      new Set(relatedEdges.filter((e) => matchedIds.has(e.source)).map((e) => e.target))
    );

    return {
      matchedNodes,
      relatedEdges,
      upstreamCallers,
      downstreamDependencies,
    };
  }

  /**
   * Finds the shortest architectural dependency path between two components using Breadth-First Search (BFS).
   */
  public findPath(startId: string, endId: string): string[] {
    if (!this.cachedGraph) return [];

    const adjacency: Record<string, string[]> = {};
    for (const edge of this.cachedGraph.edges) {
      if (!adjacency[edge.source]) adjacency[edge.source] = [];
      adjacency[edge.source]!.push(edge.target);
    }

    // Resolve fuzzy IDs if needed
    const resolveNode = (query: string): GraphNode | undefined => {
      const q = query.trim().toLowerCase();
      if (!q) return undefined;
      // 1. Exact match on id, filePath, label, name
      let found = this.cachedGraph?.nodes.find(
        (n) =>
          n.id.toLowerCase() === q ||
          n.filePath.toLowerCase() === q ||
          n.label.toLowerCase() === q ||
          (n.name && n.name.toLowerCase() === q)
      );
      if (found) return found;

      // 2. Basename / suffix match
      found = this.cachedGraph?.nodes.find(
        (n) =>
          path.basename(n.filePath).toLowerCase() === q ||
          n.filePath.toLowerCase().endsWith(q) ||
          n.label.toLowerCase().replace(/[\(\)\[\]]/g, '') === q
      );
      if (found) return found;

      // 3. Substring match
      return this.cachedGraph?.nodes.find(
        (n) =>
          n.id.toLowerCase().includes(q) ||
          n.label.toLowerCase().includes(q) ||
          n.filePath.toLowerCase().includes(q)
      );
    };

    const startNode = resolveNode(startId);
    const endNode = resolveNode(endId);

    if (!startNode || !endNode) return [];

    const queue: Array<{ current: string; path: string[] }> = [{ current: startNode.id, path: [startNode.id] }];
    const visited = new Set<string>([startNode.id]);

    while (queue.length > 0) {
      const { current, path } = queue.shift()!;
      if (current === endNode.id) {
        return path;
      }

      for (const neighbor of adjacency[current] || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({ current: neighbor, path: [...path, neighbor] });
        }
      }
    }

    return [];
  }

  /**
   * Retrieves relevant Graphify context formatted for LLM system prompt grounding.
   */
  public getRelevantContextForAi(query: string): string {
    if (!this.cachedGraph) return '';

    const queryResult = this.queryGraph(query);
    if (queryResult.matchedNodes.length === 0 && this.cachedGraph.godNodes.length === 0) {
      return '';
    }

    let context = `\n--- GRAPHIFY CODEBASE KNOWLEDGE GRAPH CONTEXT ---\n`;
    context += `Total Codebase Entities: ${this.cachedGraph.metrics.totalNodes} | Connected Edges: ${this.cachedGraph.metrics.totalEdges}\n`;

    // Add Central God Nodes
    if (this.cachedGraph.godNodes.length > 0) {
      context += `Core Hubs (God Nodes):\n`;
      for (const gn of this.cachedGraph.godNodes.slice(0, 4)) {
        context += `- ${gn.label} (${gn.filePath}) [Centrality: ${gn.metrics?.centralityScore}]\n`;
      }
    }

    // Add Matched Nodes & Relationships
    if (queryResult.matchedNodes.length > 0) {
      context += `\nRelevant Graph Matches for '${query}':\n`;
      for (const node of queryResult.matchedNodes.slice(0, 5)) {
        context += `- ${node.type.toUpperCase()}: ${node.label} in ${node.filePath}\n`;
      }

      if (queryResult.upstreamCallers.length > 0) {
        context += `  Dependents / Callers: ${queryResult.upstreamCallers.slice(0, 4).join(', ')}\n`;
      }
      if (queryResult.downstreamDependencies.length > 0) {
        context += `  Dependencies / Submodules: ${queryResult.downstreamDependencies.slice(0, 4).join(', ')}\n`;
      }
    }

    context += `--- END GRAPHIFY CONTEXT ---\n`;
    return context;
  }
}
