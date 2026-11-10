import { describe, it, expect } from 'vitest';
import path from 'path';
import { GraphifyEngine } from './graphify/GraphifyEngine.js';

describe('GraphifyEngine Knowledge Graph & AST Tests', () => {
  it('correctly discovers files, builds AST symbols and calculates metrics', async () => {
    const engine = new GraphifyEngine('test-sample', path.resolve(process.cwd(), 'sample-project'));
    const graph = await engine.generateGraph();

    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.summary).toBeDefined();
    expect(graph.summary?.totalFiles).toBeGreaterThan(0);
    expect(graph.summary?.totalDependencies).toBeGreaterThan(0);
    expect(graph.summary?.architecturalHealthScore).toBeGreaterThanOrEqual(20);

    // Verify node properties for frontend compatibility
    const firstNode = graph.nodes[0]!;
    expect(firstNode.name).toBeDefined();
    expect(firstNode.path).toBeDefined();
    expect(firstNode.inDegree).toBeDefined();
    expect(firstNode.outDegree).toBeDefined();
    expect(firstNode.complexityScore).toBeDefined();

    // Verify architectural report
    const report = await engine.generateReport();
    expect(report.healthScore).toBeGreaterThan(0);
    expect(report.findings).toBeDefined();
    expect(report.findings!.length).toBeGreaterThan(0);
    expect(report.architectureClusters.length).toBeGreaterThan(0);
  });

  it('traces shortest path between AST symbols using Breadth-First Search (BFS)', async () => {
    const engine = new GraphifyEngine('test-sample', path.resolve(process.cwd(), 'sample-project'));
    await engine.generateGraph();

    // Trace from auth.ts or UserProfile.tsx to defined symbol
    const pathResult = engine.findShortestPath('auth.ts', 'PaymentService.ts');
    expect(Array.isArray(pathResult)).toBe(true);
  });

  it('handles empty or missing directory gracefully without throwing', async () => {
    const engine = new GraphifyEngine('non-existent-proj', path.resolve(process.cwd(), 'non-existent-dir-12345'));
    const graph = await engine.generateGraph();

    expect(graph).toBeDefined();
    expect(graph.summary).toBeDefined();
    expect(Array.isArray(graph.nodes)).toBe(true);
    expect(Array.isArray(graph.edges)).toBe(true);
  });
});
