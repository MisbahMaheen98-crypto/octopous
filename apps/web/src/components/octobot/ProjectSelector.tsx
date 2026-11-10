import React, { useState, useRef, useEffect } from 'react';
import { FolderGit2, ChevronDown } from 'lucide-react';
import { WorkspaceDropdownContent, WorkspaceProjectItem } from './WorkspaceDropdownContent';

export interface ProjectSelectorProps {
  projects: WorkspaceProjectItem[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  isLoading?: boolean | undefined;
  error?: string | null | undefined;
  onRetry?: (() => void) | undefined;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  isLoading = false,
  error = null,
  onRetry,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border border-gray-200/90 dark:border-octo-border bg-white dark:bg-octo-panel hover:bg-gray-50 dark:hover:bg-octo-surface text-xs font-sans font-medium transition shadow-sm text-gray-800 dark:text-gray-200"
        title="Switch project workspace or general mode"
      >
        <FolderGit2 size={14} className="text-gray-600 dark:text-octo-cyan shrink-0" />

        <div className="flex items-center space-x-1.5 max-w-[160px] sm:max-w-[240px] md:max-w-[300px] truncate">
          <span className="font-semibold text-gray-900 dark:text-white truncate">
            {selectedProject ? selectedProject.name : 'All Projects (Workspace)'}
          </span>
        </div>

        <ChevronDown
          size={13}
          className={`text-gray-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-gray-700 dark:text-gray-200' : ''
          }`}
        />
      </button>

      {/* Floating Workspace Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute top-full mt-2.5 left-0 sm:left-1/2 sm:-translate-x-1/2 w-[calc(100vw-2rem)] max-w-sm sm:max-w-md rounded-2xl bg-white dark:bg-[#141d2f] border border-gray-200 dark:border-octo-border shadow-2xl z-[100] overflow-hidden flex flex-col max-h-[460px] animate-in fade-in duration-150"
        >
          <WorkspaceDropdownContent
            projects={projects}
            selectedProjectId={selectedProjectId}
            onSelectProject={onSelectProject}
            isLoading={isLoading}
            error={error}
            onRetry={onRetry}
            onClose={() => setIsOpen(false)}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchInputRef={searchInputRef}
          />
        </div>
      )}
    </div>
  );
};
