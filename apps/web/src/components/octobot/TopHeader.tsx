import React from 'react';
import { ProjectSelector } from './ProjectSelector';
import { ModelSelector } from './ModelSelector';
import { WorkspaceProjectItem } from './WorkspaceDropdownContent';
import { Menu, Network, Sun, Moon, Plus } from 'lucide-react';

export interface TopHeaderProps {
  projects: WorkspaceProjectItem[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  isProjectsLoading?: boolean | undefined;
  projectsError?: string | null | undefined;
  onRetryProjects?: (() => void) | undefined;
  onOpenGraphify?: (() => void) | undefined;
  onNewChat?: (() => void) | undefined;
  providerInfo?: {
    isLiveConfigured: boolean;
    providerName: string;
    configuredModel: string;
  } | undefined;
  onToggleSidebar?: (() => void) | undefined;
  sidebarCollapsed?: boolean | undefined;
  theme?: 'dark' | 'light' | undefined;
  onToggleTheme?: (() => void) | undefined;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  selectedModel,
  onSelectModel,
  isProjectsLoading,
  projectsError,
  onRetryProjects,
  onOpenGraphify,
  onNewChat,
  providerInfo,
  onToggleSidebar,
  theme = 'light',
  onToggleTheme,
}) => {
  return (
    <header className="h-14 border-b border-gray-100 dark:border-octo-border bg-white/95 dark:bg-octo-surface/95 px-4 md:px-6 flex items-center justify-between text-xs shrink-0 z-50 relative gap-3 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      {/* Left: Mobile menu & Brand */}
      <div className="flex items-center space-x-3 shrink-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-octo-panel transition"
            title="Toggle Sidebar"
          >
            <Menu size={18} />
          </button>
        )}

        <div className="flex items-center space-x-2">
          <img
            src="/header-logo.png"
            alt="OCTOBOT"
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <span className="font-sans font-bold text-base tracking-tight text-gray-900 dark:text-white">
            OCTOBOT
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-[#7c3aed] dark:text-purple-300 font-semibold border border-purple-200/60 dark:border-purple-800/60">
          
          </span>
        </div>
      </div>

      {/* Center: Project Selector */}
      <div className="flex-1 flex items-center justify-start md:justify-center min-w-0 px-1 sm:px-2">
        <ProjectSelector
          projects={projects}
          selectedProjectId={selectedProjectId}
          onSelectProject={onSelectProject}
          isLoading={isProjectsLoading}
          error={projectsError}
          onRetry={onRetryProjects}
        />
      </div>

      {/* Right: Knowledge Graph, AI Model Selector & Theme Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Knowledge Graph Button */}
        {onOpenGraphify && (
          <button
            type="button"
            onClick={onOpenGraphify}
            className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-gray-200/90 dark:border-octo-border bg-white dark:bg-octo-panel hover:bg-gray-50 dark:hover:bg-octo-surface text-gray-800 dark:text-gray-200 transition font-sans font-medium text-xs shadow-sm"
            title="Inspect Knowledge Graph & Architecture"
          >
            <Network size={14} className="text-[#6366f1] dark:text-octo-cyan shrink-0" />
            <span className="hidden sm:inline">Knowledge Graph</span>
            <span className="inline sm:hidden">Graph</span>
          </button>
        )}

        {/* AI Model Selector */}
        <ModelSelector
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          isLiveConfigured={providerInfo?.isLiveConfigured}
        />

        {/* Theme Toggle (Light / Dark) */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-octo-panel transition border border-transparent hover:border-gray-200/80"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun size={15} className="text-amber-400" />
            ) : (
              <Moon size={15} className="text-gray-600" />
            )}
          </button>
        )}
      </div>
    </header>
  );
};
