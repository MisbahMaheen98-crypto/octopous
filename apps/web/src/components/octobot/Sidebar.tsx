import React, { useState, useRef, useEffect } from 'react';
import { ConversationSession } from '../../lib/octo/octo-client';
import { WorkspaceProjectItem, WorkspaceDropdownContent } from './WorkspaceDropdownContent';
import {
  Plus,
  MessageSquare,
  Trash2,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Layers,
  MoreVertical,
  X,
  ChevronDown,
} from 'lucide-react';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  conversations?: ConversationSession[] | undefined;
  activeConversationId?: string | undefined;
  onSelectConversation?: ((id: string) => void) | undefined;
  onDeleteConversation?: ((id: string) => void) | undefined;
  projectName?: string | undefined;
  projects?: WorkspaceProjectItem[] | undefined;
  selectedProjectId?: string | null | undefined;
  onSelectProject?: ((projectId: string | null) => void) | undefined;
  isProjectsLoading?: boolean | undefined;
  projectsError?: string | null | undefined;
  onRetryProjects?: (() => void) | undefined;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  onNewChat,
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  projectName = 'OctoCommerce Service',
  projects = [],
  selectedProjectId = null,
  onSelectProject,
  isProjectsLoading = false,
  projectsError = null,
  onRetryProjects,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Active Workspace popup state in sidebar
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState('');
  const workspaceDropdownRef = useRef<HTMLDivElement>(null);
  const workspaceSearchInputRef = useRef<HTMLInputElement>(null);

  // Global Ctrl+K / Cmd+K shortcut to focus conversation search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (collapsed) {
          onToggleCollapse();
        }
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [collapsed, onToggleCollapse]);

  // Close workspace dropdown on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (workspaceDropdownRef.current && !workspaceDropdownRef.current.contains(event.target as Node)) {
        setIsWorkspaceOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsWorkspaceOpen(false);
      }
    };

    if (isWorkspaceOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => workspaceSearchInputRef.current?.focus(), 60);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isWorkspaceOpen]);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((c) =>
    !searchQuery.trim() ||
    (c.title || 'Untitled Chat').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (timestamp?: string, index?: number) => {
    if (timestamp) {
      try {
        const date = new Date(timestamp);
        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
          return `Today, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        }
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
          return `Yesterday, ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } catch {
        // Fallback
      }
    }

    const fallbackList = ['Today, 10:24 AM', 'Yesterday, 8:17 PM', 'Oct 30, 4:06 PM', 'Oct 29, 11:32 AM'];
    return fallbackList[(index || 0) % fallbackList.length];
  };

  return (
    <aside
      className={`h-full border-r border-gray-200/80 dark:border-octo-border bg-[#f8f9fe] dark:bg-octo-surface flex flex-col justify-between transition-all duration-300 shrink-0 z-30 ${
        collapsed ? 'w-16' : 'w-64 md:w-72'
      }`}
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Brand Header */}
        <div className="px-4 py-3.5 border-b border-gray-100 dark:border-octo-border flex items-center justify-between shrink-0">
          {!collapsed ? (
            <div className="flex items-center space-x-2.5">
              <img
                src="/sidebar-logo.png"
                alt="OCTOBOT"
                className="w-7 h-7 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="flex flex-col">
                <span className="font-sans font-bold text-sm tracking-tight text-gray-900 dark:text-white">
                  OCTOBOT
                </span>
                <span className="text-[10px] text-gray-400 font-medium -mt-0.5">
                  AI Assistant &amp; Intelligence
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto">
              <img src="/sidebar-logo.png" alt="OCTOBOT" className="w-6 h-6 object-contain" />
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-octo-panel transition"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        {/* New Chat & Search Box */}
        <div className="p-3 shrink-0 space-y-2.5">
          {/* Purple Gradient New Chat Button */}
          <button
            type="button"
            onClick={onNewChat}
            className={`w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#6366f1] via-[#7c3aed] to-[#9333ea] hover:opacity-95 text-white font-sans text-xs font-semibold flex items-center transition shadow-md shadow-purple-500/15 ${
              collapsed ? 'justify-center' : 'justify-center space-x-1.5'
            }`}
            title="New Conversation"
          >
            <Plus size={15} className="stroke-[2.5]" />
            {!collapsed && <span>New Chat</span>}
            <span className="sr-only">New Conversation</span>
          </button>

          {/* Search Conversations Input */}
          {!collapsed && (
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-12 py-2 text-xs bg-white dark:bg-octo-panel border border-gray-200/90 dark:border-octo-border rounded-xl text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200 transition shadow-sm font-sans"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-700"
                >
                  <X size={12} />
                </button>
              ) : (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-gray-400 px-1.5 py-0.5 rounded bg-gray-50 border border-gray-200/80 dark:bg-octo-surface dark:border-octo-border pointer-events-none">
                  Ctrl K
                </span>
              )}
            </div>
          )}
        </div>

        {/* Recent Conversations List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1">
          {!collapsed && (
            <div className="px-1.5 py-1 text-[11px] font-bold tracking-wider text-gray-400 uppercase font-sans">
              Recent Conversations
            </div>
          )}

          {filteredConversations.length === 0 ? (
            !collapsed && (
              <div className="p-4 text-center text-xs text-gray-400 font-sans">
                {searchQuery ? 'No matching chats found.' : 'No past chats yet.'}
              </div>
            )
          ) : (
            filteredConversations.map((session, index) => {
              const isActive = session.id === activeConversationId;
              const isMenuOpen = menuOpenId === session.id;
              const timestampLabel = formatTimestamp(session.updatedAt || session.createdAt, index);

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectConversation && onSelectConversation(session.id)}
                  className={`group relative flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition text-xs font-sans ${
                    isActive
                      ? 'bg-[#ede9fe]/70 dark:bg-octo-panel border border-[#ddd6fe] dark:border-purple-500/40 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-octo-panel/60 border border-transparent'
                  }`}
                  title={session.title}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                    <MessageSquare
                      size={15}
                      className={isActive ? 'text-[#7c3aed] shrink-0' : 'text-gray-500 shrink-0'}
                    />
                    {!collapsed && (
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate text-xs ${
                            isActive ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {session.title || 'Untitled Chat'}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate mt-0.5">
                          {timestampLabel}
                        </div>
                      </div>
                    )}
                  </div>

                  {!collapsed && (
                    <div className="relative shrink-0 ml-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpenId(isMenuOpen ? null : session.id);
                        }}
                        className={`p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-octo-panel transition ${
                          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                        title="Options"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {isMenuOpen && onDeleteConversation && (
                        <div
                          className="absolute right-0 top-full mt-1 w-28 rounded-lg bg-white dark:bg-octo-surface border border-gray-200 dark:border-octo-border shadow-lg py-1 z-30"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteConversation(session.id);
                              setMenuOpenId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 flex items-center space-x-1.5 transition font-medium"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Footer: Active Workspace Section */}
      <div
        ref={workspaceDropdownRef}
        className="p-3 border-t border-gray-200/80 dark:border-octo-border bg-[#f8f9fe] dark:bg-octo-surface shrink-0 relative"
      >
        {!collapsed ? (
          <div
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            className={`p-2.5 rounded-xl transition cursor-pointer flex items-center justify-between text-xs border ${
              isWorkspaceOpen
                ? 'bg-white dark:bg-octo-panel border-purple-300 dark:border-octo-cyan/50 shadow-sm'
                : 'bg-transparent hover:bg-white dark:hover:bg-octo-panel/60 border-transparent hover:border-gray-200/80'
            }`}
            title="Click to switch workspace"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setIsWorkspaceOpen(!isWorkspaceOpen);
              }
            }}
          >
            <div className="flex items-center space-x-2.5 min-w-0 flex-1">
              <Layers size={18} className="text-gray-700 dark:text-gray-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-bold tracking-wider text-gray-400 uppercase font-sans">
                  ACTIVE WORKSPACE
                </div>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      selectedProjectId ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span className="text-gray-900 dark:text-white font-semibold text-xs truncate">
                    {projectName || 'General Assistant'}
                  </span>
                </div>
              </div>
            </div>
            <ChevronDown
              size={14}
              className={`text-gray-400 shrink-0 ml-1 transition-transform duration-200 ${
                isWorkspaceOpen ? 'rotate-180 text-purple-600 dark:text-octo-cyan' : ''
              }`}
            />
          </div>
        ) : (
          <div
            onClick={() => setIsWorkspaceOpen(!isWorkspaceOpen)}
            className="flex justify-center py-1.5 text-gray-600 dark:text-octo-cyan hover:text-purple-600 cursor-pointer rounded-lg hover:bg-white dark:hover:bg-octo-panel transition"
            title={`Active Workspace: ${projectName || 'General Assistant'} (Click to switch)`}
            role="button"
            tabIndex={0}
          >
            <Layers size={18} />
          </div>
        )}

        {/* Upward Workspace Dropdown */}
        {isWorkspaceOpen && onSelectProject && (
          <div
            role="listbox"
            className="absolute bottom-full mb-2 left-2 w-[min(calc(100vw-2rem),24rem)] sm:w-80 md:w-96 rounded-2xl bg-white dark:bg-octo-card border border-gray-200 dark:border-octo-border shadow-2xl z-50 overflow-hidden flex flex-col max-h-[460px] animate-in fade-in duration-150"
          >
            <WorkspaceDropdownContent
              projects={projects || []}
              selectedProjectId={selectedProjectId ?? null}
              onSelectProject={onSelectProject}
              isLoading={isProjectsLoading}
              error={projectsError}
              onRetry={onRetryProjects}
              onClose={() => setIsWorkspaceOpen(false)}
              searchQuery={workspaceSearchQuery}
              setSearchQuery={setWorkspaceSearchQuery}
              searchInputRef={workspaceSearchInputRef}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
