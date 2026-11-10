import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Modal } from './Modal';
import { Badge } from './Badge';
import {
  octoApi,
  CodebaseKnowledgeGraph,
  GraphNode,
  GraphReport,
  GraphEdge,
} from '../../lib/octo/octo-client';
import {
  Network,
  Cpu,
  Layers,
  FileCode,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Search,
  Sparkles,
  ShieldAlert,
  Compass,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Code2,
  Boxes,
  Globe,
  CheckCircle2,
  List,
  LayoutGrid,
  Filter,
  Eye,
  CornerDownRight,
  X,
} from 'lucide-react';

export interface GraphifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string | null;
  projectName: string;
  onAskAi?: (prompt: string) => void;
}

export const GraphifyModal: React.FC<GraphifyModalProps> = ({
  isOpen,
  onClose,
  projectId,
  projectName,
  onAskAi,
}) => {
  const effectiveProjectId = projectId || 'sample-project';

  const [activeTab, setActiveTab] = useState<'graph' | 'report' | 'path'>('graph');
  const [viewMode, setViewMode] = useState<'split' | 'canvas' | 'list'>('split');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [graph, setGraph] = useState<CodebaseKnowledgeGraph | null>(null);
  const [report, setReport] = useState<GraphReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rescanNotification, setRescanNotification] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Path finder states
  const [pathStart, setPathStart] = useState<string>('');
  const [pathEnd, setPathEnd] = useState<string>('');
  const [tracedPath, setTracedPath] = useState<string[]>([]);
  const [highlightedPath, setHighlightedPath] = useState<string[]>([]);
  const [pathLoading, setPathLoading] = useState(false);

  // Interactive Graph Canvas States
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      void loadGraphData();
    }
  }, [isOpen, projectId]);

  // Compute layout positions for nodes
  const calculateNodePositions = useCallback((nodes: GraphNode[]) => {
    const posMap: Record<string, { x: number; y: number }> = {};
    if (!nodes || nodes.length === 0) return posMap;

    // Categorize nodes by tier/cluster
    const presentationNodes = nodes.filter(
      (n) => n.type === 'endpoint' || n.path.includes('routes') || n.path.includes('components')
    );
    const logicNodes = nodes.filter(
      (n) =>
        (n.type === 'class' || n.type === 'function') &&
        !n.path.includes('routes') &&
        !n.path.includes('components')
    );
    const dataNodes = nodes.filter(
      (n) =>
        n.type === 'interface' ||
        n.path.includes('database') ||
        n.path.includes('models') ||
        n.path.includes('schema')
    );
    const otherNodes = nodes.filter(
      (n) =>
        !presentationNodes.includes(n) &&
        !logicNodes.includes(n) &&
        !dataNodes.includes(n)
    );

    const columns = [
      { nodes: presentationNodes, colX: 130 },
      { nodes: logicNodes, colX: 420 },
      { nodes: dataNodes, colX: 710 },
      { nodes: otherNodes, colX: 990 },
    ];

    columns.forEach(({ nodes: colNodes, colX }) => {
      colNodes.forEach((node, idx) => {
        posMap[node.id] = {
          x: colX + (idx % 2 === 1 ? 30 : -20),
          y: 80 + idx * 75,
        };
      });
    });

    // Fallback for any unplaced nodes
    nodes.forEach((n, idx) => {
      if (!posMap[n.id]) {
        posMap[n.id] = {
          x: 200 + (idx % 4) * 260,
          y: 90 + Math.floor(idx / 4) * 85,
        };
      }
    });

    return posMap;
  }, []);

  const loadGraphData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [graphRes, reportRes] = await Promise.all([
        octoApi.getProjectGraph(effectiveProjectId),
        octoApi.getProjectGraphReport(effectiveProjectId),
      ]);
      setGraph(graphRes.graph);
      setReport(reportRes.report);

      if (graphRes.graph && graphRes.graph.nodes && graphRes.graph.nodes.length > 0) {
        setNodePositions(calculateNodePositions(graphRes.graph.nodes));
        setSelectedNode(graphRes.graph.godNodes?.[0] ?? graphRes.graph.nodes[0] ?? null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load Graphify codebase graph');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setRescanNotification(null);
    try {
      const res = await octoApi.refreshProjectGraph(effectiveProjectId);
      setGraph(res.graph);
      const rep = await octoApi.getProjectGraphReport(effectiveProjectId);
      setReport(rep.report);

      if (res.graph && res.graph.nodes && res.graph.nodes.length > 0) {
        setNodePositions(calculateNodePositions(res.graph.nodes));
        setSelectedNode(res.graph.godNodes?.[0] ?? res.graph.nodes[0] ?? null);
      }
      setRescanNotification(
        `AST Rescan completed: ${res.graph?.nodes?.length || 0} entities & ${res.graph?.edges?.length || 0} relational edges indexed.`
      );
      setTimeout(() => setRescanNotification(null), 4500);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh graph');
    } finally {
      setRefreshing(false);
    }
  };

  const handleTracePath = async () => {
    if (!pathStart || !pathEnd) return;
    setPathLoading(true);
    try {
      const res = await octoApi.findProjectGraphPath(effectiveProjectId, pathStart, pathEnd);
      const discovered = res.path || [];
      setTracedPath(discovered);
    } catch {
      setTracedPath([]);
    } finally {
      setPathLoading(false);
    }
  };

  const handleHighlightPathOnCanvas = () => {
    if (tracedPath.length === 0) return;
    setHighlightedPath(tracedPath);
    setActiveTab('graph');
    setViewMode('canvas');

    // Pan to first node in path if available
    const firstNodeId = tracedPath[0];
    if (firstNodeId && nodePositions[firstNodeId]) {
      const pos = nodePositions[firstNodeId];
      setPan({ x: 250 - pos.x, y: 180 - pos.y });
    }
  };

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    if (!graph || !graph.nodes) return [];
    return graph.nodes.filter((n) => {
      const name = (n.name || n.label || '').toLowerCase();
      const pathStr = (n.path || n.filePath || '').toLowerCase();
      const query = searchTerm.toLowerCase().trim();

      const matchesSearch = !query || name.includes(query) || pathStr.includes(query);
      if (!matchesSearch) return false;

      if (typeFilter === 'all') return true;
      if (typeFilter === 'god') return Boolean(n.isGodNode);
      return n.type === typeFilter;
    });
  }, [graph, searchTerm, typeFilter]);

  // Edges associated with selected node or highlighted path
  const relevantEdges = useMemo(() => {
    if (!graph || !graph.edges) return [];
    return graph.edges;
  }, [graph]);

  // Canvas Mouse Navigation
  const handleCanvasMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingNodeId) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (draggingNodeId) {
      const currentPos = nodePositions[draggingNodeId] || { x: 0, y: 0 };
      const newX = (e.clientX - dragOffset.x - pan.x) / zoom;
      const newY = (e.clientY - dragOffset.y - pan.y) / zoom;
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: { x: Math.round(newX), y: Math.round(newY) },
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDraggingNodeId(nodeId);
    const pos = nodePositions[nodeId] || { x: 0, y: 0 };
    setDragOffset({
      x: e.clientX - (pos.x * zoom + pan.x),
      y: e.clientY - (pos.y * zoom + pan.y),
    });
  };

  const handleZoomIn = () => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))));
  const handleZoomOut = () => setZoom((z) => Math.max(0.4, Number((z - 0.15).toFixed(2))));
  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHighlightedPath([]);
  };

  const getNodeColor = (node: GraphNode) => {
    if (node.isGodNode) {
      return {
        border: 'border-orange-500',
        stroke: '#f97316',
        bg: 'bg-orange-500/10 dark:bg-orange-950/40',
        text: 'text-orange-600 dark:text-orange-400',
        fill: '#ea580c',
      };
    }
    switch (node.type) {
      case 'file':
        return {
          border: 'border-cyan-500',
          stroke: '#06b6d4',
          bg: 'bg-cyan-500/10 dark:bg-cyan-950/40',
          text: 'text-cyan-600 dark:text-cyan-400',
          fill: '#0891b2',
        };
      case 'class':
        return {
          border: 'border-violet-500',
          stroke: '#8b5cf6',
          bg: 'bg-violet-500/10 dark:bg-violet-950/40',
          text: 'text-violet-600 dark:text-violet-400',
          fill: '#7c3aed',
        };
      case 'function':
        return {
          border: 'border-emerald-500',
          stroke: '#10b981',
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
          text: 'text-emerald-600 dark:text-emerald-400',
          fill: '#059669',
        };
      case 'interface':
        return {
          border: 'border-sky-500',
          stroke: '#0ea5e9',
          bg: 'bg-sky-500/10 dark:bg-sky-950/40',
          text: 'text-sky-600 dark:text-sky-400',
          fill: '#0284c7',
        };
      case 'endpoint':
        return {
          border: 'border-amber-500',
          stroke: '#f59e0b',
          bg: 'bg-amber-500/10 dark:bg-amber-950/40',
          text: 'text-amber-600 dark:text-amber-400',
          fill: '#d97706',
        };
      default:
        return {
          border: 'border-slate-500',
          stroke: '#64748b',
          bg: 'bg-slate-500/10 dark:bg-slate-900/40',
          text: 'text-slate-600 dark:text-slate-400',
          fill: '#475569',
        };
    }
  };

  const getNodeIcon = (type: string, isGodNode?: boolean) => {
    if (isGodNode) return <AlertTriangle size={13} className="text-orange-500" />;
    switch (type) {
      case 'file':
        return <FileCode size={13} className="text-cyan-500" />;
      case 'class':
        return <Boxes size={13} className="text-violet-500" />;
      case 'function':
        return <Code2 size={13} className="text-emerald-500" />;
      case 'interface':
        return <Layers size={13} className="text-sky-500" />;
      case 'endpoint':
        return <Globe size={13} className="text-amber-500" />;
      default:
        return <Cpu size={13} className="text-slate-500" />;
    }
  };

  // Node Inspector Callers & Callee Relationships
  const connectedDependencies = useMemo(() => {
    if (!selectedNode || !graph) return { incoming: [], outgoing: [] };
    const incoming = graph.edges
      .filter((e) => e.target === selectedNode.id)
      .map((e) => ({
        source: e.source,
        type: e.type,
        node: graph.nodes.find((n) => n.id === e.source),
      }));
    const outgoing = graph.edges
      .filter((e) => e.source === selectedNode.id)
      .map((e) => ({
        target: e.target,
        type: e.type,
        node: graph.nodes.find((n) => n.id === e.target),
      }));
    return { incoming, outgoing };
  }, [selectedNode, graph]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
            <Network size={18} />
          </div>
          <div>
            <span className="font-mono text-base font-bold text-gray-900 dark:text-white">
              Graphify Knowledge Graph
            </span>
            <span className="ml-2.5 text-xs text-gray-500 dark:text-slate-400 font-mono">
              AST Architecture &amp; Dependency Topology
            </span>
          </div>
        </div>
      }
      subtitle={
        <div className="flex items-center space-x-3 mt-1 flex-wrap gap-y-1">
          <span className="text-xs text-gray-600 dark:text-slate-400">
            Project: <strong className="text-cyan-600 dark:text-cyan-300">{projectName}</strong>
          </span>
          {graph?.summary && (
            <span className="text-[11px] font-mono text-gray-400 dark:text-slate-500">
              • {graph.summary.totalFiles} nodes • {graph.summary.totalDependencies} relational edges • Health Score: {graph.summary.architecturalHealthScore}/100
            </span>
          )}
        </div>
      }
      maxWidth="max-w-6xl"
    >
      <div className="flex flex-col h-full space-y-3">
        {/* Top Notification */}
        {rescanNotification && (
          <div className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs font-mono text-emerald-700 dark:text-emerald-300 flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
            <span>{rescanNotification}</span>
          </div>
        )}

        {/* Navigation Tabs & Header Actions */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-cyan-950/60 pb-3 flex-wrap gap-2">
          {/* Main Tabs */}
          <div className="flex space-x-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('graph')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition flex items-center space-x-1.5 ${
                activeTab === 'graph'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-cyan-950/40'
              }`}
            >
              <Network size={14} />
              <span>Node Explorer</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition flex items-center space-x-1.5 ${
                activeTab === 'report'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-cyan-950/40'
              }`}
            >
              <ShieldAlert size={14} />
              <span>Architectural Report</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('path')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium font-mono transition flex items-center space-x-1.5 ${
                activeTab === 'path'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-cyan-950/40'
              }`}
            >
              <Compass size={14} />
              <span>Path Tracer (BFS)</span>
              {highlightedPath.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Right Action: Rescan AST */}
          <div className="flex items-center space-x-2">
            {activeTab === 'graph' && (
              <div className="flex items-center space-x-1 bg-gray-100 dark:bg-[#090d18] p-0.5 rounded-lg border border-gray-200 dark:border-cyan-950/60">
                <button
                  type="button"
                  onClick={() => setViewMode('split')}
                  title="Split View (Canvas + Inspector)"
                  className={`px-2 py-1 rounded text-[11px] font-mono flex items-center space-x-1 ${
                    viewMode === 'split'
                      ? 'bg-white dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-300 shadow-sm font-semibold'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                >
                  <LayoutGrid size={12} />
                  <span>Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('canvas')}
                  title="Canvas Topology View"
                  className={`px-2 py-1 rounded text-[11px] font-mono flex items-center space-x-1 ${
                    viewMode === 'canvas'
                      ? 'bg-white dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-300 shadow-sm font-semibold'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Network size={12} />
                  <span>Canvas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="Symbol Table List View"
                  className={`px-2 py-1 rounded text-[11px] font-mono flex items-center space-x-1 ${
                    viewMode === 'list'
                      ? 'bg-white dark:bg-cyan-950/80 text-cyan-600 dark:text-cyan-300 shadow-sm font-semibold'
                      : 'text-gray-500 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                >
                  <List size={12} />
                  <span>List</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-cyan-900/50 hover:bg-gray-100 dark:hover:bg-cyan-950/40 text-xs font-mono text-cyan-600 dark:text-cyan-400 transition flex items-center space-x-1.5 disabled:opacity-50"
              title="Rescan workspace AST & refresh graph"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? 'Scanning AST...' : 'Rescan AST'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 size={36} className="animate-spin text-cyan-500" />
            <p className="text-xs font-mono text-gray-500 dark:text-slate-400">
              Parsing AST and building Graphify topological index...
            </p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-600 dark:text-red-300">
            {error}
          </div>
        ) : !graph || graph.nodes.length === 0 ? (
          <div className="p-8 rounded-2xl bg-gray-50/60 dark:bg-[#070b16] border border-dashed border-gray-300 dark:border-cyan-950/80 text-center space-y-3 py-16">
            <Network size={36} className="mx-auto text-gray-400 dark:text-slate-600" />
            <h4 className="text-sm font-bold text-gray-800 dark:text-slate-200 font-mono">
              No AST Entities Detected in Project
            </h4>
            <p className="text-xs text-gray-500 dark:text-slate-400 max-w-md mx-auto">
              No source files found or project snapshot archive is not yet populated.
              Save a snapshot from the VS Code extension or click Rescan AST.
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold font-mono"
            >
              Rescan AST
            </button>
          </div>
        ) : (
          <>
            {/* TAB 1: NODE EXPLORER */}
            {activeTab === 'graph' && (
              <div className="flex flex-col space-y-3">
                {/* Search & Filter Bar */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search
                      size={14}
                      className="absolute left-3 top-2.5 text-gray-400 dark:text-slate-500"
                    />
                    <input
                      type="text"
                      placeholder="Search symbols, files, classes, methods..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-cyan-900/50 bg-gray-50 dark:bg-[#070a13] text-gray-900 dark:text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Filter chips */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px] font-mono">
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'file', label: 'Files' },
                      { key: 'class', label: 'Classes' },
                      { key: 'function', label: 'Functions' },
                      { key: 'interface', label: 'Interfaces' },
                      { key: 'endpoint', label: 'Endpoints' },
                      { key: 'god', label: 'God Nodes' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setTypeFilter(item.key)}
                        className={`px-2 py-1 rounded-lg border transition ${
                          typeFilter === item.key
                            ? 'bg-cyan-500/15 border-cyan-500 text-cyan-600 dark:text-cyan-300 font-semibold'
                            : 'border-gray-200 dark:border-cyan-950/60 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-cyan-950/30'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Viewport: Interactive Topology Canvas & Inspector */}
                {viewMode === 'list' ? (
                  /* LIST VIEW */
                  <div className="border border-gray-200 dark:border-cyan-950/60 rounded-2xl overflow-hidden bg-white dark:bg-[#080c16]">
                    <div className="overflow-x-auto max-h-[480px]">
                      <table className="w-full text-left text-xs font-mono">
                        <thead className="bg-gray-50 dark:bg-[#0e1322] border-b border-gray-200 dark:border-cyan-950/60 text-gray-500 dark:text-slate-400">
                          <tr>
                            <th className="p-3">Symbol / Entity</th>
                            <th className="p-3">Type</th>
                            <th className="p-3">File Path</th>
                            <th className="p-3">In-Degree</th>
                            <th className="p-3">Out-Degree</th>
                            <th className="p-3">Complexity</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-cyan-950/40">
                          {filteredNodes.map((node) => (
                            <tr
                              key={node.id}
                              onClick={() => {
                                setSelectedNode(node);
                                setViewMode('split');
                              }}
                              className="hover:bg-cyan-50/50 dark:hover:bg-cyan-950/30 cursor-pointer transition"
                            >
                              <td className="p-3 font-semibold text-gray-900 dark:text-slate-200 flex items-center space-x-1.5">
                                {getNodeIcon(node.type, node.isGodNode)}
                                <span>{node.name || node.label}</span>
                              </td>
                              <td className="p-3">
                                <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300">
                                  {node.type}
                                </span>
                              </td>
                              <td className="p-3 text-gray-500 dark:text-slate-400 truncate max-w-xs">
                                {node.path || node.filePath}
                              </td>
                              <td className="p-3 text-cyan-600 dark:text-cyan-400 font-bold">
                                {node.inDegree}
                              </td>
                              <td className="p-3 text-sky-600 dark:text-sky-400 font-bold">
                                {node.outDegree}
                              </td>
                              <td className="p-3 text-amber-600 dark:text-amber-400 font-bold">
                                {node.complexityScore}
                              </td>
                              <td className="p-3">
                                {node.isGodNode ? (
                                  <Badge variant="orange" size="sm">
                                    God Node
                                  </Badge>
                                ) : (
                                  <Badge variant="cyan" size="sm">
                                    Healthy
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* CANVAS OR SPLIT VIEW */
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 min-h-[490px]">
                    {/* SVG GRAPH TOPOLOGY CANVAS */}
                    <div
                      className={`relative rounded-2xl border border-gray-200 dark:border-cyan-950/60 bg-[#060913] overflow-hidden select-none ${
                        viewMode === 'split' ? 'md:col-span-8' : 'md:col-span-12'
                      } h-[490px]`}
                    >
                      {/* Canvas Zoom & Navigation Overlay Controls */}
                      <div className="absolute top-3 left-3 z-10 flex items-center space-x-1 bg-[#0b1021]/80 backdrop-blur-md p-1 rounded-xl border border-cyan-950/80 shadow-lg">
                        <button
                          type="button"
                          onClick={handleZoomIn}
                          className="p-1.5 rounded-lg hover:bg-cyan-900/40 text-cyan-400 transition"
                          title="Zoom In"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={handleZoomOut}
                          className="p-1.5 rounded-lg hover:bg-cyan-900/40 text-cyan-400 transition"
                          title="Zoom Out"
                        >
                          <ZoomOut size={14} />
                        </button>
                        <div className="h-4 w-px bg-cyan-950" />
                        <button
                          type="button"
                          onClick={handleResetView}
                          className="px-2 py-1 rounded-lg hover:bg-cyan-900/40 text-xs font-mono text-cyan-400 transition"
                          title="Reset View"
                        >
                          {Math.round(zoom * 100)}%
                        </button>
                      </div>

                      {/* Canvas Legend Overlay */}
                      <div className="absolute bottom-3 left-3 z-10 flex items-center space-x-2 bg-[#0b1021]/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-cyan-950/80 text-[10px] font-mono text-slate-400">
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-cyan-500" />
                          <span>File</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-violet-500" />
                          <span>Class</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Function</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <span>Endpoint</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-2 h-2 rounded-full bg-orange-500 ring-2 ring-orange-500/40" />
                          <span className="text-orange-400">God Node</span>
                        </div>
                      </div>

                      {/* Path Trace Badge Indicator */}
                      {highlightedPath.length > 0 && (
                        <div className="absolute top-3 right-3 z-10 flex items-center space-x-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs font-mono text-amber-300">
                          <Compass size={13} className="text-amber-400 animate-spin" />
                          <span>Path Trace Active ({highlightedPath.length} hops)</span>
                          <button
                            type="button"
                            onClick={() => setHighlightedPath([])}
                            className="hover:text-white"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}

                      {/* Interactive SVG Canvas */}
                      <svg
                        ref={canvasRef}
                        className="w-full h-full cursor-grab active:cursor-grabbing"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                      >
                        <defs>
                          <marker
                            id="arrow-default"
                            markerWidth="8"
                            markerHeight="8"
                            refX="7"
                            refY="4"
                            orient="auto"
                          >
                            <polygon points="0 1, 8 4, 0 7" fill="#334155" />
                          </marker>
                          <marker
                            id="arrow-active"
                            markerWidth="8"
                            markerHeight="8"
                            refX="7"
                            refY="4"
                            orient="auto"
                          >
                            <polygon points="0 1, 8 4, 0 7" fill="#06b6d4" />
                          </marker>
                          <marker
                            id="arrow-path"
                            markerWidth="9"
                            markerHeight="9"
                            refX="8"
                            refY="4.5"
                            orient="auto"
                          >
                            <polygon points="0 1, 9 4.5, 0 8" fill="#f59e0b" />
                          </marker>
                        </defs>

                        {/* Graph Canvas Transformed Group */}
                        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                          {/* Directed Edges */}
                          {relevantEdges.map((edge, idx) => {
                            const p1 = nodePositions[edge.source];
                            const p2 = nodePositions[edge.target];
                            if (!p1 || !p2) return null;

                            const isSelectedEdge =
                              selectedNode &&
                              (edge.source === selectedNode.id || edge.target === selectedNode.id);

                            const isPathEdge =
                              highlightedPath.length > 1 &&
                              highlightedPath.includes(edge.source) &&
                              highlightedPath.includes(edge.target);

                            const dx = p2.x - p1.x;
                            const dy = p2.y - p1.y;
                            const cx1 = p1.x + dx * 0.45;
                            const cy1 = p1.y;
                            const cx2 = p1.x + dx * 0.55;
                            const cy2 = p2.y;
                            const d = `M ${p1.x} ${p1.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p2.x} ${p2.y}`;

                            return (
                              <g key={`edge-${idx}`}>
                                <path
                                  d={d}
                                  fill="none"
                                  stroke={
                                    isPathEdge
                                      ? '#f59e0b'
                                      : isSelectedEdge
                                      ? '#06b6d4'
                                      : '#1e293b'
                                  }
                                  strokeWidth={isPathEdge ? 2.5 : isSelectedEdge ? 2 : 1.2}
                                  strokeDasharray={isPathEdge ? '4 2' : undefined}
                                  markerEnd={
                                    isPathEdge
                                      ? 'url(#arrow-path)'
                                      : isSelectedEdge
                                      ? 'url(#arrow-active)'
                                      : 'url(#arrow-default)'
                                  }
                                  opacity={
                                    searchTerm &&
                                    !filteredNodes.some((n) => n.id === edge.source || n.id === edge.target)
                                      ? 0.15
                                      : 0.85
                                  }
                                  className="transition-all duration-200"
                                />
                                {edge.label && isSelectedEdge && (
                                  <text
                                    x={(p1.x + p2.x) / 2}
                                    y={(p1.y + p2.y) / 2 - 4}
                                    fill="#94a3b8"
                                    fontSize="9"
                                    fontFamily="monospace"
                                    textAnchor="middle"
                                  >
                                    {edge.type}
                                  </text>
                                )}
                              </g>
                            );
                          })}

                          {/* Nodes */}
                          {graph.nodes.map((node) => {
                            const pos = nodePositions[node.id] || { x: 0, y: 0 };
                            const isSelected = selectedNode?.id === node.id;
                            const isMatchingSearch = filteredNodes.some((n) => n.id === node.id);
                            const isOnPath = highlightedPath.includes(node.id);
                            const styling = getNodeColor(node);

                            const nodeWidth = 170;
                            const nodeHeight = 52;

                            return (
                              <g
                                key={node.id}
                                transform={`translate(${pos.x - nodeWidth / 2}, ${pos.y - nodeHeight / 2})`}
                                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                onClick={() => setSelectedNode(node)}
                                className="cursor-pointer group"
                                opacity={searchTerm && !isMatchingSearch ? 0.2 : 1}
                              >
                                {/* Node background card */}
                                <rect
                                  width={nodeWidth}
                                  height={nodeHeight}
                                  rx="10"
                                  ry="10"
                                  fill="#0a0f1d"
                                  stroke={
                                    isOnPath
                                      ? '#f59e0b'
                                      : isSelected
                                      ? '#38bdf8'
                                      : node.isGodNode
                                      ? '#f97316'
                                      : styling.stroke
                                  }
                                  strokeWidth={isOnPath ? 2.5 : isSelected ? 2.2 : 1}
                                  className="transition-colors duration-150 shadow-md group-hover:stroke-cyan-400"
                                />

                                {/* God Node pulsing indicator ring */}
                                {node.isGodNode && (
                                  <circle
                                    cx="15"
                                    cy="15"
                                    r="4"
                                    fill="#f97316"
                                    className="animate-ping opacity-75"
                                  />
                                )}

                                {/* Node Label text */}
                                <text
                                  x="12"
                                  y="22"
                                  fill={node.isGodNode ? '#fdba74' : '#e2e8f0'}
                                  fontSize="11"
                                  fontWeight="600"
                                  fontFamily="monospace"
                                >
                                  {node.name && node.name.length > 18
                                    ? node.name.slice(0, 17) + '…'
                                    : node.name || node.label}
                                </text>

                                {/* Node Subtitle / Path */}
                                <text
                                  x="12"
                                  y="36"
                                  fill="#64748b"
                                  fontSize="9"
                                  fontFamily="monospace"
                                >
                                  {node.path && node.path.length > 24
                                    ? '…' + node.path.slice(-22)
                                    : node.path || node.filePath}
                                </text>

                                {/* Badges in top-right */}
                                <text
                                  x={nodeWidth - 10}
                                  y="20"
                                  fill={styling.stroke}
                                  fontSize="8"
                                  fontWeight="bold"
                                  fontFamily="monospace"
                                  textAnchor="end"
                                >
                                  {node.type.toUpperCase()}
                                </text>

                                <text
                                  x={nodeWidth - 10}
                                  y="38"
                                  fill="#475569"
                                  fontSize="8"
                                  fontFamily="monospace"
                                  textAnchor="end"
                                >
                                  in:{node.inDegree} out:{node.outDegree}
                                </text>
                              </g>
                            );
                          })}
                        </g>
                      </svg>
                    </div>

                    {/* NODE INSPECTOR DRAWER / SIDEBAR (in Split View) */}
                    {viewMode === 'split' && (
                      <div className="md:col-span-4 flex flex-col space-y-3 h-[490px] overflow-y-auto pr-1">
                        {selectedNode ? (
                          <div className="space-y-3">
                            {/* Selected Node Card */}
                            <div className="p-3.5 rounded-2xl bg-gray-50/80 dark:bg-[#080b15] border border-gray-200 dark:border-cyan-950/60 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-1.5 min-w-0 pr-1">
                                  {getNodeIcon(selectedNode.type, selectedNode.isGodNode)}
                                  <span className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-300 truncate">
                                    {selectedNode.name || selectedNode.label}
                                  </span>
                                </div>
                                <Badge variant={selectedNode.isGodNode ? 'orange' : 'cyan'} size="sm">
                                  {selectedNode.type.toUpperCase()}
                                </Badge>
                              </div>

                              <div className="text-[11px] font-mono text-gray-500 dark:text-slate-400 break-all bg-white dark:bg-[#0c101f] p-2 rounded-xl border border-gray-200/60 dark:border-cyan-950/40">
                                {selectedNode.path || selectedNode.filePath}
                              </div>

                              {/* Metrics Triplet */}
                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                <div className="p-2 rounded-xl bg-white dark:bg-[#0c101f] border border-gray-200 dark:border-cyan-950/60 text-center">
                                  <span className="text-[9px] text-gray-400 font-mono block">In-Degree</span>
                                  <span className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400">
                                    {selectedNode.inDegree}
                                  </span>
                                </div>
                                <div className="p-2 rounded-xl bg-white dark:bg-[#0c101f] border border-gray-200 dark:border-cyan-950/60 text-center">
                                  <span className="text-[9px] text-gray-400 font-mono block">Out-Degree</span>
                                  <span className="text-xs font-bold font-mono text-sky-600 dark:text-sky-400">
                                    {selectedNode.outDegree}
                                  </span>
                                </div>
                                <div className="p-2 rounded-xl bg-white dark:bg-[#0c101f] border border-gray-200 dark:border-cyan-950/60 text-center">
                                  <span className="text-[9px] text-gray-400 font-mono block">Complexity</span>
                                  <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                                    {selectedNode.complexityScore}
                                  </span>
                                </div>
                              </div>

                              {/* God Node Warning Banner */}
                              {selectedNode.isGodNode && (
                                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-start space-x-2 text-[11px] text-amber-800 dark:text-amber-300">
                                  <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-500" />
                                  <span>
                                    <strong>God Node Warning:</strong> High coupling (centrality: {selectedNode.complexityScore}). Modifying this component has a high blast radius.
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Connected Relationships Accordion */}
                            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0a0e1c] border border-gray-200 dark:border-cyan-950/60 space-y-2.5">
                              <h5 className="text-[11px] font-bold font-mono text-gray-700 dark:text-slate-300 uppercase tracking-wider">
                                Direct AST Relations
                              </h5>

                              {/* Incoming Callers */}
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono text-gray-400 block">
                                  Referenced By ({connectedDependencies.incoming.length}):
                                </span>
                                {connectedDependencies.incoming.length > 0 ? (
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {connectedDependencies.incoming.map((item, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          if (item.node) setSelectedNode(item.node);
                                        }}
                                        className="w-full text-left p-1.5 rounded-lg bg-gray-50 dark:bg-[#0f1424] hover:bg-cyan-50 dark:hover:bg-cyan-950/40 border border-gray-100 dark:border-cyan-950/40 text-[11px] font-mono flex items-center justify-between text-gray-700 dark:text-slate-300"
                                      >
                                        <span className="truncate pr-1">
                                          {item.node ? item.node.name : item.source}
                                        </span>
                                        <span className="text-[9px] text-cyan-600 dark:text-cyan-400 shrink-0">
                                          {item.type}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] font-mono text-gray-400 italic">No incoming dependencies</p>
                                )}
                              </div>

                              {/* Outgoing Dependencies */}
                              <div className="space-y-1 pt-1 border-t border-gray-100 dark:border-cyan-950/40">
                                <span className="text-[10px] font-mono text-gray-400 block">
                                  Depends On ({connectedDependencies.outgoing.length}):
                                </span>
                                {connectedDependencies.outgoing.length > 0 ? (
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {connectedDependencies.outgoing.map((item, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => {
                                          if (item.node) setSelectedNode(item.node);
                                        }}
                                        className="w-full text-left p-1.5 rounded-lg bg-gray-50 dark:bg-[#0f1424] hover:bg-cyan-50 dark:hover:bg-cyan-950/40 border border-gray-100 dark:border-cyan-950/40 text-[11px] font-mono flex items-center justify-between text-gray-700 dark:text-slate-300"
                                      >
                                        <span className="truncate pr-1">
                                          {item.node ? item.node.name : item.target}
                                        </span>
                                        <span className="text-[9px] text-sky-600 dark:text-sky-400 shrink-0">
                                          {item.type}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] font-mono text-gray-400 italic">No outgoing dependencies</p>
                                )}
                              </div>
                            </div>

                            {/* Ask AI Action Button */}
                            <button
                              type="button"
                              onClick={() => {
                                if (onAskAi) {
                                  onAskAi(
                                    `Explain the architectural purpose and dependencies of ${selectedNode.name} (${selectedNode.path || selectedNode.filePath}) and suggest decoupling improvements.`
                                  );
                                  onClose();
                                }
                              }}
                              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white text-xs font-semibold flex items-center justify-center space-x-2 shadow-md transition"
                            >
                              <Sparkles size={14} />
                              <span>Ask OCTOBOT to Analyze {selectedNode.name}</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-xs text-gray-400 font-mono space-y-2 p-6 text-center border border-dashed border-gray-200 dark:border-cyan-950/60 rounded-2xl">
                            <Eye size={20} className="text-gray-400" />
                            <span>Click any node in the topology canvas to inspect details and connections</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ARCHITECTURAL REPORT */}
            {activeTab === 'report' && (
              <div className="space-y-4 max-h-[490px] overflow-y-auto pr-1">
                {report ? (
                  <>
                    {/* Overall Health Score Card */}
                    <div className="p-4 rounded-2xl bg-cyan-50/50 dark:bg-[#090d18] border border-cyan-200 dark:border-cyan-950/60 flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                          Architectural Health Assessment
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          Evaluated from coupling centrality, God Node density, and architectural layer isolation.
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
                          {report.healthScore}/100
                        </span>
                      </div>
                    </div>

                    {/* God Nodes Summary */}
                    {graph && graph.godNodes && graph.godNodes.length > 0 && (
                      <div className="p-4 rounded-2xl bg-white dark:bg-[#0a0e1c] border border-gray-200 dark:border-cyan-950/60 space-y-2.5">
                        <h5 className="text-xs font-bold font-mono text-orange-600 dark:text-orange-400 uppercase tracking-wider flex items-center space-x-1.5">
                          <AlertTriangle size={14} />
                          <span>Identified God Nodes ({graph.godNodes.length})</span>
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {graph.godNodes.map((gn) => (
                            <div
                              key={gn.id}
                              className="p-2.5 rounded-xl border border-orange-200/60 dark:border-orange-900/40 bg-orange-50/30 dark:bg-orange-950/20 text-xs font-mono"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-gray-900 dark:text-slate-200">
                                  {gn.name || gn.label}
                                </span>
                                <span className="text-orange-600 dark:text-orange-400 font-semibold">
                                  Score: {gn.complexityScore}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate mt-1">
                                {gn.path || gn.filePath}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Architectural Findings */}
                    <div className="space-y-2.5">
                      <h5 className="text-xs font-bold font-mono text-gray-900 dark:text-slate-200 uppercase tracking-wider">
                        Risk Analysis &amp; Findings ({report.findings?.length || 0})
                      </h5>
                      {report.findings && report.findings.map((finding, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-gray-200 dark:border-cyan-950/60 bg-white dark:bg-[#0a0e1c] space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-900 dark:text-slate-200 font-mono">
                              {finding.title}
                            </span>
                            <Badge
                              variant={
                                finding.severity === 'error'
                                  ? 'red'
                                  : finding.severity === 'warning'
                                  ? 'orange'
                                  : 'cyan'
                              }
                            >
                              {finding.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-slate-400 leading-relaxed">
                            {finding.description}
                          </p>
                          <div className="text-[11px] font-mono text-cyan-700 dark:text-cyan-300 bg-gray-50 dark:bg-[#101524] p-2 rounded-lg">
                            💡 Recommendation: {finding.recommendation}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-12 text-center text-xs text-gray-400 font-mono">
                    No architectural report generated yet.
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: PATH TRACER (BFS) */}
            {activeTab === 'path' && (
              <div className="space-y-4 max-h-[490px] overflow-y-auto">
                <div className="p-4 rounded-2xl bg-gray-50/80 dark:bg-[#080b15] border border-gray-200 dark:border-cyan-950/60 space-y-3">
                  <h4 className="text-xs font-bold font-mono text-gray-900 dark:text-white uppercase tracking-wider">
                    Trace Shortest Dependency Path via BFS
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Find the shortest directional dependency path between two source files or AST symbols.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono text-gray-500 dark:text-slate-400 block mb-1">
                        Start Symbol / File:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. PaymentService or src/routes/auth.ts"
                        value={pathStart}
                        onChange={(e) => setPathStart(e.target.value)}
                        list="graphify-symbols"
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-cyan-900/50 bg-white dark:bg-[#0c101f] text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono text-gray-500 dark:text-slate-400 block mb-1">
                        Target Symbol / File:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. prisma.ts or UserProfile.tsx"
                        value={pathEnd}
                        onChange={(e) => setPathEnd(e.target.value)}
                        list="graphify-symbols"
                        className="w-full px-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-cyan-900/50 bg-white dark:bg-[#0c101f] text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                  </div>

                  <datalist id="graphify-symbols">
                    {graph?.nodes.slice(0, 50).map((n) => (
                      <option key={n.id} value={n.name || n.label} />
                    ))}
                  </datalist>

                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={handleTracePath}
                      disabled={pathLoading || !pathStart || !pathEnd}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold font-mono transition flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {pathLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ArrowRight size={14} />
                      )}
                      <span>Trace Shortest AST Dependency Path</span>
                    </button>
                  </div>
                </div>

                {tracedPath.length > 0 ? (
                  <div className="p-4 rounded-2xl bg-white dark:bg-[#0a0e1c] border border-gray-200 dark:border-cyan-950/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400">
                        Discovered Path: {tracedPath.length} hops
                      </span>
                      <button
                        type="button"
                        onClick={handleHighlightPathOnCanvas}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-500/25 text-xs font-mono transition flex items-center space-x-1.5 font-semibold"
                      >
                        <Network size={13} />
                        <span>Highlight on Topology Graph</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {tracedPath.map((step, idx) => (
                        <div key={idx} className="flex items-center space-x-2.5 text-xs font-mono">
                          <span className="w-5 h-5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-gray-800 dark:text-slate-200 font-semibold">{step}</span>
                          {idx < tracedPath.length - 1 && (
                            <CornerDownRight size={12} className="text-gray-400 shrink-0 ml-1" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : pathStart && pathEnd && !pathLoading ? (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#0c101f] text-center text-xs text-gray-500 font-mono">
                    No direct or indirect directional dependency path found between '{pathStart}' and '{pathEnd}'.
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};
