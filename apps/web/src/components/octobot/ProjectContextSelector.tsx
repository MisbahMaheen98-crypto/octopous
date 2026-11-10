import React, { useState } from 'react';
import type { ContextMode } from '../../lib/octo/octo-client';
import { Layers, History, GitCompare, Globe, ChevronDown, Check } from 'lucide-react';

export interface SnapshotOption {
  id: string;
  name: string;
  createdAt: string;
  fileCount?: number | undefined;
  shortId?: string | undefined;
  branch?: string | undefined;
  commitMessage?: string | undefined;
}

interface ProjectContextSelectorProps {
  contextMode: ContextMode;
  onChangeContextMode: (mode: ContextMode) => void;
  snapshots: SnapshotOption[];
  selectedSnapshotId: string | null;
  onChangeSelectedSnapshot: (snapshotId: string) => void;
  baseSnapshotId: string | null;
  targetSnapshotId: string | null;
  onChangeComparisonSnapshots: (baseId: string, targetId: string) => void;
  hasProject: boolean;
}

export const ProjectContextSelector: React.FC<ProjectContextSelectorProps> = ({
  contextMode,
  onChangeContextMode,
  snapshots,
  selectedSnapshotId,
  onChangeSelectedSnapshot,
  baseSnapshotId,
  targetSnapshotId,
  onChangeComparisonSnapshots,
  hasProject,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const modes: Array<{
    id: ContextMode;
    label: string;
    icon: React.ReactNode;
    description: string;
    requiresProject: boolean;
  }> = [
    {
      id: 'workspace',
      label: 'Current Workspace',
      icon: <Layers size={14} className="text-cyan-500" />,
      description: 'Active project code, files, dependencies & AST graph',
      requiresProject: true,
    },
    {
      id: 'snapshot',
      label: 'OCTOPUS Snapshot',
      icon: <History size={14} className="text-purple-500" />,
      description: 'Historical snapshot state, files & architecture',
      requiresProject: true,
    },
    {
      id: 'compare',
      label: 'Compare Snapshots',
      icon: <GitCompare size={14} className="text-emerald-500" />,
      description: 'Code-level diffs, breaking changes & 10-point report',
      requiresProject: true,
    },
    {
      id: 'none',
      label: 'No Project Context',
      icon: <Globe size={14} className="text-amber-500" />,
      description: 'General programming, algorithms, DSA & concepts',
      requiresProject: false,
    },
  ];

  const currentModeInfo = modes.find((m) => m.id === contextMode) || modes[0]!;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Mode Trigger Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className="h-8 px-2.5 rounded-xl border border-gray-200 dark:border-cyan-950/70 bg-white dark:bg-[#0b0f1d] hover:bg-gray-50 dark:hover:bg-cyan-950/30 text-xs font-mono text-gray-800 dark:text-slate-200 transition flex items-center space-x-1.5 shadow-sm"
          title="Switch Project Context Mode"
        >
          {currentModeInfo.icon}
          <span className="font-semibold">{currentModeInfo.label}</span>
          <ChevronDown size={12} className={`text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
            <div className="absolute top-full left-0 mt-1.5 w-72 rounded-2xl bg-white dark:bg-[#0c1122] border border-gray-200 dark:border-cyan-950/70 shadow-xl z-40 p-1.5 space-y-1 animate-in fade-in">
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-slate-500 font-semibold">
                Project Context Mode
              </div>
              {modes.map((m) => {
                const isSelected = contextMode === m.id;
                const isDisabled = m.requiresProject && !hasProject;
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      onChangeContextMode(m.id);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs font-mono transition flex items-start space-x-2 ${
                      isSelected
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 font-semibold'
                        : 'hover:bg-gray-100 dark:hover:bg-cyan-950/40 text-gray-700 dark:text-slate-300'
                    } ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <div className="shrink-0 mt-0.5">{m.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span>{m.label}</span>
                        {isSelected && <Check size={13} className="text-cyan-500 shrink-0 ml-1" />}
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 font-sans mt-0.5 leading-snug">
                        {m.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Mode-Specific Selectors */}
      {contextMode === 'snapshot' && (
        <div className="flex items-center space-x-1.5 animate-in fade-in">
          <span className="text-xs font-mono font-semibold text-gray-700 dark:text-slate-300">
            Snapshot:
          </span>
          {snapshots.length === 0 ? (
            <span className="text-xs text-amber-500 font-mono">No snapshots yet</span>
          ) : (
            <div className="relative">
              <select
                value={selectedSnapshotId || snapshots[0]?.id || ''}
                onChange={(e) => onChangeSelectedSnapshot(e.target.value)}
                className="h-8 pl-2.5 pr-8 rounded-xl border border-purple-500/30 bg-purple-500/10 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 appearance-none cursor-pointer max-w-[280px] sm:max-w-[340px] truncate"
              >
                {snapshots.map((s) => {
                  const dateStr = new Date(s.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const branchStr = s.branch ? ` [${s.branch}]` : '';
                  const shortId = s.shortId || s.id.slice(0, 8);
                  return (
                    <option
                      key={s.id}
                      value={s.id}
                      className="bg-white dark:bg-[#0c1120] text-gray-900 dark:text-white"
                    >
                      {s.name} (#{shortId}){branchStr} • {dateStr}
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-purple-600 dark:text-purple-400"
              />
            </div>
          )}
        </div>
      )}

      {contextMode === 'compare' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 animate-in fade-in flex-wrap">
          {/* Base Selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-mono font-semibold text-gray-700 dark:text-slate-300">
              Base:
            </span>
            <div className="relative">
              <select
                value={baseSnapshotId || snapshots[1]?.id || snapshots[0]?.id || ''}
                onChange={(e) =>
                  onChangeComparisonSnapshots(e.target.value, targetSnapshotId || snapshots[0]?.id || '')
                }
                className="h-8 pl-2.5 pr-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer max-w-[240px] sm:max-w-[290px] truncate"
                title="Select Base Snapshot for comparison"
              >
                {snapshots.map((s) => {
                  const dateStr = new Date(s.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const branchStr = s.branch ? ` [${s.branch}]` : '';
                  const shortId = s.shortId || s.id.slice(0, 8);
                  return (
                    <option
                      key={s.id}
                      value={s.id}
                      className="bg-white dark:bg-[#0c1120] text-gray-900 dark:text-white"
                    >
                      {s.name} (#{shortId}){branchStr} • {dateStr}
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>

          {/* Target Selector */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-mono font-semibold text-gray-700 dark:text-slate-300">
              Target:
            </span>
            <div className="relative">
              <select
                value={targetSnapshotId || snapshots[0]?.id || ''}
                onChange={(e) =>
                  onChangeComparisonSnapshots(baseSnapshotId || snapshots[1]?.id || snapshots[0]?.id || '', e.target.value)
                }
                className="h-8 pl-2.5 pr-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer max-w-[240px] sm:max-w-[290px] truncate"
                title="Select Target Snapshot for comparison"
              >
                {snapshots.map((s) => {
                  const dateStr = new Date(s.createdAt).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const branchStr = s.branch ? ` [${s.branch}]` : '';
                  const shortId = s.shortId || s.id.slice(0, 8);
                  return (
                    <option
                      key={s.id}
                      value={s.id}
                      className="bg-white dark:bg-[#0c1120] text-gray-900 dark:text-white"
                    >
                      {s.name} (#{shortId}){branchStr} • {dateStr}
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-400"
              />
            </div>
          </div>

          {/* Identical Snapshots Warning */}
          {baseSnapshotId && targetSnapshotId && baseSnapshotId === targetSnapshotId && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Identical snapshots selected (no diff)
            </span>
          )}
        </div>
      )}
    </div>
  );
};
