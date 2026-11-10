import React, { useEffect, useRef, useState } from 'react';

export interface ProjectOption {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
}

interface WorkspaceDropdownProps {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  isLoading?: boolean;
}

export const WorkspaceDropdown: React.FC<WorkspaceDropdownProps> = ({
  projects,
  selectedProjectId,
  onSelectProject,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicked outside or on Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
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
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const filteredProjects = projects.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const handleSelect = (id: string | null) => {
    onSelectProject(id);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="octo-dropdown-wrapper" ref={dropdownRef}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="octo-dropdown-trigger"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Switch project workspace"
      >
        <span className="octo-dropdown-trigger-icon">📁</span>
        <span className="octo-dropdown-trigger-label">
          {selectedProject ? selectedProject.name : 'All Projects (Workspace)'}
        </span>
        <span className={`octo-dropdown-chevron ${isOpen ? 'open' : ''}`}>▼</span>
      </button>

      {/* Floating Dropdown Panel */}
      {isOpen && (
        <div className="octo-dropdown-menu" role="listbox">
          <div className="octo-dropdown-header">
            <span className="octo-dropdown-title">Select Active Workspace</span>
            {isLoading && <span className="octo-dropdown-loading">Loading...</span>}
          </div>

          <div className="octo-dropdown-search-wrap">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="octo-dropdown-search"
            />
            {search && (
              <button
                type="button"
                className="octo-dropdown-search-clear"
                onClick={() => setSearch('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="octo-dropdown-list">
            {/* General Mode */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`octo-dropdown-item ${selectedProjectId === null ? 'selected' : ''}`}
            >
              <span className="octo-dropdown-item-icon">🌐</span>
              <div className="octo-dropdown-item-info">
                <div className="octo-dropdown-item-name">All Projects (Workspace)</div>
                <div className="octo-dropdown-item-desc">
                  General coding, snapshots overview, and full repository analysis.
                </div>
              </div>
              {selectedProjectId === null && (
                <span className="octo-dropdown-check">✓</span>
              )}
            </button>

            <div className="octo-dropdown-divider">
              Projects ({filteredProjects.length})
            </div>

            {filteredProjects.map((project) => {
              const isSelected = project.id === selectedProjectId;
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleSelect(project.id)}
                  className={`octo-dropdown-item ${isSelected ? 'selected' : ''}`}
                >
                  <span
                    className="octo-dropdown-color-dot"
                    style={{ backgroundColor: project.color || 'var(--teal)' }}
                  />
                  <div className="octo-dropdown-item-info">
                    <div className="octo-dropdown-item-name">{project.name}</div>
                    {project.description && (
                      <div className="octo-dropdown-item-desc">{project.description}</div>
                    )}
                  </div>
                  {isSelected && <span className="octo-dropdown-check">✓</span>}
                </button>
              );
            })}

            {!isLoading && filteredProjects.length === 0 && (
              <div className="octo-dropdown-empty">
                {search ? `No projects matching "${search}"` : 'No registered projects.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
