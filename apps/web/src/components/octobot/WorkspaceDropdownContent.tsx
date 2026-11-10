import React from 'react';
import {
  Layers,
  Search,
  X,
  RefreshCw,
  Sparkles,
  Check,
  Loader2,
  AlertCircle,
  FolderGit2,
} from 'lucide-react';

export interface WorkspaceProjectItem {
  id: string;
  name: string;
  description?: string | null | undefined;
  color?: string | null | undefined;
  language?: string | undefined;
  framework?: string | undefined;
}

export interface WorkspaceDropdownContentProps {
  projects: WorkspaceProjectItem[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  isLoading?: boolean | undefined;
  error?: string | null | undefined;
  onRetry?: (() => void) | undefined;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export const WorkspaceDropdownContent: React.FC<WorkspaceDropdownContentProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  isLoading = false,
  error = null,
  onRetry,
  onClose,
  searchQuery,
  setSearchQuery,
  searchInputRef,
}) => {
  const filteredProjects = projects.filter((project) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = project.name.toLowerCase().includes(q);
    const descMatch = (project.description || '').toLowerCase().includes(q);
    const langMatch = (project.language || '').toLowerCase().includes(q);
    return nameMatch || descMatch || langMatch;
  });

  const handleSelect = (id: string | null) => {
    onSelectProject(id);
    onClose();
    setSearchQuery('');
  };

  return (
    <>
      {/* 1. Header & Refresh */}
      <div className="p-3 border-b border-gray-100 dark:border-octo-border/80 bg-gray-50/80 dark:bg-octo-panel/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200 font-sans">
            <Layers size={14} className="text-[#6366f1] shrink-0" />
            <span>Select Workspace Project</span>
          </div>

          <div className="flex items-center space-x-1">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={isLoading}
                className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-octo-surface transition"
                title="Refresh project list"
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200/60 dark:hover:bg-octo-surface transition"
              title="Close dropdown (Esc)"
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="relative mt-2">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
          <input
            ref={searchInputRef as any}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-octo-surface border border-gray-200/90 dark:border-octo-border rounded-xl text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 transition font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Scrollable Body List */}
      <div className="overflow-y-auto p-2 space-y-1 flex-1 min-h-[160px] max-h-[320px]">
        {/* Option A: General Assistant */}
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className={`w-full text-left p-2.5 rounded-xl transition flex items-start justify-between group font-sans ${
            selectedProjectId === null
              ? 'bg-[#ede9fe]/80 dark:bg-octo-panel border border-[#ddd6fe] dark:border-purple-500/40 text-gray-900 dark:text-white shadow-sm'
              : 'hover:bg-gray-50 dark:hover:bg-octo-panel/60 border border-transparent'
          }`}
        >
          <div className="flex items-start space-x-2.5 min-w-0 pr-2">
            <div className="p-1.5 rounded-lg bg-purple-100/80 dark:bg-octo-surface text-[#7c3aed] mt-0.5 shrink-0">
              <Sparkles size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-xs text-gray-900 dark:text-white">
                  General Assistant
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-50 dark:bg-octo-surface text-purple-700 dark:text-purple-300 border border-purple-200/60 dark:border-purple-900/40 font-medium">
                  Workspace
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-octo-muted leading-relaxed line-clamp-1 mt-0.5">
                Full-scope assistant for all projects and coding concepts.
              </p>
            </div>
          </div>
          {selectedProjectId === null && (
            <Check size={15} className="text-[#7c3aed] shrink-0 mt-1" />
          )}
        </button>

        {/* Separator */}
        <div className="px-2 pt-2 pb-1 text-[10px] font-bold tracking-wider text-gray-400 dark:text-octo-muted uppercase font-sans">
          Workspace Projects
        </div>

        {/* Loading Spinner */}
        {isLoading && projects.length === 0 && (
          <div className="p-6 flex flex-col items-center justify-center space-y-2 text-gray-400 font-sans">
            <Loader2 size={18} className="animate-spin text-[#7c3aed]" />
            <span className="text-xs">Loading projects...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/40 flex items-start space-x-2 text-xs text-red-700 dark:text-red-300 my-1 font-sans">
            <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" />
            <div className="flex-1">
              <p className="font-medium">Failed to load projects</p>
              <p className="text-[11px] text-red-500 mt-0.5">{error}</p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-1 text-[11px] font-semibold text-red-700 dark:text-red-300 underline hover:no-underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredProjects.length === 0 && (
          <div className="p-6 text-center text-xs text-gray-400 dark:text-octo-muted font-sans">
            {searchQuery ? `No projects matching "${searchQuery}"` : 'No projects available.'}
          </div>
        )}

        {/* Project Options */}
        {filteredProjects.map((project) => {
          const isSelected = selectedProjectId === project.id;
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => handleSelect(project.id)}
              className={`w-full text-left p-2.5 rounded-xl transition flex items-start justify-between group font-sans ${
                isSelected
                  ? 'bg-[#ede9fe]/80 dark:bg-octo-panel border border-[#ddd6fe] dark:border-purple-500/40 text-gray-900 dark:text-white shadow-sm'
                  : 'hover:bg-gray-50 dark:hover:bg-octo-panel/60 border border-transparent'
              }`}
            >
              <div className="flex items-start space-x-2.5 min-w-0 pr-2 flex-1">
                <div
                  className="p-1.5 rounded-lg mt-0.5 shrink-0"
                  style={{
                    backgroundColor: project.color ? `${project.color}20` : '#f3f4f6',
                    color: project.color || '#4b5563',
                  }}
                >
                  <FolderGit2 size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                      {project.name}
                    </span>
                    {project.language && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-gray-100 dark:bg-octo-surface text-gray-600 dark:text-gray-300 border border-gray-200/60 dark:border-octo-border shrink-0">
                        {project.language}
                      </span>
                    )}
                  </div>
                  {project.description && (
                    <p className="text-[11px] text-gray-500 dark:text-octo-muted leading-relaxed line-clamp-1 mt-0.5">
                      {project.description}
                    </p>
                  )}
                </div>
              </div>

              {isSelected && (
                <Check size={15} className="text-[#7c3aed] shrink-0 mt-1" />
              )}
            </button>
          );
        })}
      </div>

      {/* 3. Footer */}
      <div className="p-2.5 border-t border-gray-100 dark:border-octo-border/80 bg-gray-50/60 dark:bg-octo-panel/30 flex items-center justify-between text-[11px] text-gray-500 dark:text-octo-muted font-sans shrink-0">
        <span>{projects.length} workspace projects available</span>
        <span className="text-[10px] font-mono text-gray-400">Esc to close</span>
      </div>
    </>
  );
};
