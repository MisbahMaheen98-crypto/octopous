import React, { useCallback, useEffect, useState } from 'react';
import {
  getOctoStatus,
  getOctoConversations,
  createOctoConversation,
  deleteOctoConversation,
  type ConversationSession,
  type AiProviderStatus,
  type PatchProposal,
  type ContextMode,
} from '../lib/octo/octo-client';
import { listProjects } from '../lib/projects/projects-client';
import { listSnapshots } from '../lib/snapshots/snapshots-client';
import { OctoLogo } from '../components/octobot/OctoLogo';
import { GraphifyModal } from '../components/octobot/GraphifyModal';
import { WorkspaceDropdown, type ProjectOption } from '../components/octobot/WorkspaceDropdown';
import { ProjectContextSelector, type SnapshotOption } from '../components/octobot/ProjectContextSelector';
import { ChatWorkspace } from '../components/octobot/ChatWorkspace';
import { Layers, Plus, Trash2, MessageSquare } from 'lucide-react';

export function OctoPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectsLoading, setIsProjectsLoading] = useState(false);

  // Context mode & Snapshots
  const [contextMode, setContextMode] = useState<ContextMode>('workspace');
  const [snapshots, setSnapshots] = useState<SnapshotOption[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState<string | null>(null);
  const [baseSnapshotId, setBaseSnapshotId] = useState<string | null>(null);
  const [targetSnapshotId, setTargetSnapshotId] = useState<string | null>(null);

  // Conversations & Sessions
  const [conversations, setConversations] = useState<ConversationSession[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-default');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');

  // Initial prompt bridge (e.g. from Graphify modal)
  const [initialPrompt, setInitialPrompt] = useState<string | null>(null);

  // Status & Provider info
  const [providerStatus, setProviderStatus] = useState<AiProviderStatus | null>(null);

  // UI state
  const [graphifyOpen, setGraphifyOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('octobot_theme') as 'dark' | 'light' | null;
      if (saved) return saved;
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });

  // Synchronize theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
      root.setAttribute('data-theme', 'light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
    }
    try {
      localStorage.setItem('octobot_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // 1. Load Projects from OCTOPUS
  const loadProjects = useCallback(async () => {
    setIsProjectsLoading(true);
    try {
      const response = await listProjects();
      if (response.success && response.data?.projects) {
        setProjects(
          response.data.projects.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            color: p.color,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to load projects for OCTOBOT', err);
    } finally {
      setIsProjectsLoading(false);
    }
  }, []);

  // 2. Load Provider Status
  useEffect(() => {
    void loadProjects();
    void (async () => {
      const status = await getOctoStatus();
      setProviderStatus(status);
    })();
  }, [loadProjects]);

  // 3. Load Conversations for Selected Project
  const loadConversations = useCallback(async (projId: string | null) => {
    try {
      const list = await getOctoConversations(projId);
      setConversations(list);
      if (list.length > 0) {
        const target = list[0];
        if (target) {
          setActiveConversationId(target.id);
        }
      } else {
        // Create initial session
        const initial = await createOctoConversation(
          projId,
          projId ? 'Project Workspace Session' : 'General Assistant'
        );
        const sessionToUse: ConversationSession = initial ?? {
          id: `conv-${Date.now()}`,
          userId: 'user',
          projectId: projId,
          title: projId ? 'Project Workspace Session' : 'General Assistant',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: [],
        };
        setConversations([sessionToUse]);
        setActiveConversationId(sessionToUse.id);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  }, []);

  useEffect(() => {
    void loadConversations(selectedProjectId);
  }, [selectedProjectId, loadConversations]);

  // Load snapshots when project changes
  useEffect(() => {
    let isCurrent = true;
    async function fetchSnapshots() {
      if (!selectedProjectId) {
        setSnapshots([]);
        setSelectedSnapshotId(null);
        setBaseSnapshotId(null);
        setTargetSnapshotId(null);
        return;
      }
      try {
        const res = await listSnapshots(selectedProjectId);
        if (res.success && res.data?.snapshots && isCurrent) {
          const mapped: SnapshotOption[] = res.data.snapshots.map((s) => {
            const meta = (s.captureMetadata || {}) as Record<string, any>;
            const branch = (meta.gitBranch || meta.branch || meta.git?.branch || '') as string;
            const commitMsg = (meta.commitMessage || meta.message || meta.commit?.message || '') as string;
            const wsRoot = Array.isArray(meta.workspaceRoots) && meta.workspaceRoots[0]
              ? String(meta.workspaceRoots[0])
              : '';
            const label = commitMsg || s.clientName || wsRoot || `Snapshot ${s.id.slice(0, 8)}`;

            return {
              id: s.id,
              shortId: s.id.slice(0, 8),
              name: label,
              createdAt: s.createdAt,
              fileCount: s.fileCount || 0,
              branch: branch || undefined,
              commitMessage: commitMsg || undefined,
            };
          });
          setSnapshots(mapped);
          if (mapped.length > 0) {
            setSelectedSnapshotId(mapped[0]?.id || null);
            setBaseSnapshotId(mapped[1]?.id || mapped[0]?.id || null);
            setTargetSnapshotId(mapped[0]?.id || null);
          }
        }
      } catch (err) {
        console.error('Failed to load project snapshots', err);
      }
    }
    void fetchSnapshots();
    return () => {
      isCurrent = false;
    };
  }, [selectedProjectId]);

  // Handle New Conversation
  const handleNewConversation = async () => {
    try {
      const activeProj = projects.find((p) => p.id === selectedProjectId);
      const title = activeProj
        ? `${activeProj.name} (${conversations.length + 1})`
        : `Session ${conversations.length + 1}`;
      const newSession = await createOctoConversation(selectedProjectId, title);
      const sessionToUse: ConversationSession = newSession ?? {
        id: `conv-${Date.now()}`,
        userId: 'user',
        projectId: selectedProjectId,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      setConversations((prev) => [sessionToUse, ...prev]);
      setActiveConversationId(sessionToUse.id);
    } catch (err) {
      console.error('Failed to create new conversation', err);
    }
  };

  // Handle Delete Conversation
  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteOctoConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConversationId === id) {
        if (remaining.length > 0) {
          const first = remaining[0];
          if (first) {
            setActiveConversationId(first.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation', err);
    }
  };

  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="octo-page-container flex flex-col h-screen w-full overflow-hidden bg-white dark:bg-[#070a13] text-gray-900 dark:text-slate-100">
      {/* 1. TOP HEADER */}
      <header className="octo-topbar shrink-0 h-14 border-b border-gray-200 dark:border-cyan-950/60 bg-white dark:bg-[#080b15] px-4 flex items-center justify-between z-30">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            className="octo-sidebar-toggle-btn p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-cyan-950/40 transition"
            onClick={() => setSidebarOpen((prev) => !prev)}
            title={sidebarOpen ? 'Hide conversations sidebar' : 'Show conversations sidebar'}
          >
            ☰
          </button>

          <div className="flex items-center space-x-2">
            <OctoLogo size={28} showText={false} />
            <span className="font-mono text-base font-bold text-gray-900 dark:text-white tracking-tight">
              OCTOBOT
            </span>
           
            <span className="text-xs text-gray-400 dark:text-slate-500 font-mono hidden md:inline ml-1">
              AI Assistant &amp; Intelligence
            </span>
          </div>

          <div className="h-5 w-px bg-gray-200 dark:bg-cyan-950/60 mx-1" />

          {/* Workspace / Project Dropdown */}
          <WorkspaceDropdown
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={(id) => setSelectedProjectId(id)}
            isLoading={isProjectsLoading}
          />

          <div className="h-5 w-px bg-gray-200 dark:bg-cyan-950/60 mx-1 hidden sm:block" />

          {/* Project Context Mode Selector */}
          <div className="hidden sm:block">
            <ProjectContextSelector
              contextMode={contextMode}
              onChangeContextMode={setContextMode}
              snapshots={snapshots}
              selectedSnapshotId={selectedSnapshotId}
              onChangeSelectedSnapshot={setSelectedSnapshotId}
              baseSnapshotId={baseSnapshotId}
              targetSnapshotId={targetSnapshotId}
              onChangeComparisonSnapshots={(b, t) => {
                setBaseSnapshotId(b);
                setTargetSnapshotId(t);
              }}
              hasProject={Boolean(selectedProjectId)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Knowledge Graph Button */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 text-xs font-mono font-medium transition flex items-center space-x-1.5 shadow-sm"
            onClick={() => setGraphifyOpen(true)}
            title="Open Codebase Knowledge Graph (AST Coupling & Architecture)"
          >
            <Layers size={14} />
            <span>Knowledge Graph</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            className="p-1.5 rounded-xl border border-gray-200 dark:border-cyan-950/60 text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-cyan-950/40 transition text-sm"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* 2. BODY CONTAINER (SIDEBAR + CHAT WORKSPACE) */}
      <div className="flex-1 min-h-0 flex w-full overflow-hidden relative">
        {/* SIDEBAR: Recent Conversations & Active Workspace */}
        {sidebarOpen && (
          <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-cyan-950/60 bg-gray-50/70 dark:bg-[#080b15] flex flex-col justify-between overflow-hidden z-20">
            <div className="p-3 border-b border-gray-200 dark:border-cyan-950/60">
              <button
                type="button"
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#6366f1] via-[#7c3aed] to-[#9333ea] hover:opacity-95 text-white text-xs font-semibold font-mono transition flex items-center justify-center space-x-2 shadow-sm"
                onClick={() => void handleNewConversation()}
                title="New Chat"
              >
                <Plus size={14} />
                <span>New Chat</span>
                <span className="sr-only">New Conversation</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
              <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-slate-500 font-semibold">
                Recent Conversations
              </div>
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500 font-mono">
                  No conversations yet.
                </div>
              ) : (
                conversations.map((c) => {
                  const isActive = c.id === activeConversationId;
                  return (
                    <div
                      key={c.id}
                      className={`w-full group rounded-xl px-2.5 py-2 text-left text-xs font-mono transition flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-900/60 font-semibold'
                          : 'text-gray-700 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-cyan-950/20 hover:text-gray-900 dark:hover:text-white border border-transparent'
                      }`}
                      onClick={() => setActiveConversationId(c.id)}
                    >
                      <div className="flex items-center space-x-2 truncate pr-2">
                        <MessageSquare size={14} className="shrink-0 text-cyan-500" />
                        <span className="truncate" title={c.title}>
                          {c.title}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 rounded transition"
                        onClick={(e) => void handleDeleteConversation(c.id, e)}
                        title="Delete conversation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Active Workspace Footer in Sidebar */}
            <div className="p-3 border-t border-gray-200 dark:border-cyan-950/60 bg-white/50 dark:bg-[#070a13]">
              <div className="text-[10px] font-mono text-gray-400 dark:text-slate-500 uppercase tracking-wider font-semibold mb-1">
                ACTIVE WORKSPACE
              </div>
              <div className="flex items-center space-x-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeProject?.color || '#00e5ff' }}
                />
                <span className="text-xs font-medium font-mono text-gray-900 dark:text-white truncate">
                  {activeProject ? activeProject.name : 'All Projects (Workspace)'}
                </span>
              </div>
            </div>
          </aside>
        )}

        {/* 3. MAIN CHAT WORKSPACE */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
          <ChatWorkspace
            projectId={selectedProjectId}
            projectName={activeProject ? activeProject.name : 'Workspace'}
            conversationId={activeConversationId}
            selectedModel={selectedModel}
            onSelectModel={(model) => setSelectedModel(model)}
            initialPrompt={initialPrompt}
            onClearInitialPrompt={() => setInitialPrompt(null)}
            onOpenGraphify={() => setGraphifyOpen(true)}
            onConversationUpdated={() => {
              void loadConversations(selectedProjectId);
            }}
            contextMode={contextMode}
            snapshotId={selectedSnapshotId}
            baseSnapshotId={baseSnapshotId}
            targetSnapshotId={targetSnapshotId}
            providerInfo={{
              isLiveConfigured: providerStatus?.isLiveConfigured ?? false,
              providerName: providerStatus?.providerName ?? 'OCTOBOT Engine',
              configuredModel: providerStatus?.configuredModel ?? selectedModel,
            }}
          />
        </main>
      </div>

      {/* 4. KNOWLEDGE GRAPH (GRAPHIFY) MODAL */}
      <GraphifyModal
        isOpen={graphifyOpen}
        onClose={() => setGraphifyOpen(false)}
        projectId={selectedProjectId}
        projectName={activeProject ? activeProject.name : 'Workspace'}
        onAskAi={(prompt) => {
          setGraphifyOpen(false);
          setInitialPrompt(prompt);
        }}
      />
    </div>
  );
}
