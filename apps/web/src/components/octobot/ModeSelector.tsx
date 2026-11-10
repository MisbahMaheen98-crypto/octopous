import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Bug,
  BookOpen,
  Code2,
  Cpu,
  Layers,
  Bot,
  TestTube,
  History,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import type { OctobotMode } from '@octopus/shared';

export interface ModeSelectorProps {
  currentMode: OctobotMode;
  onSelectMode: (mode: OctobotMode) => void;
}

interface ModeConfig {
  id: OctobotMode;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  badgeColor: string;
}

const MODES: ModeConfig[] = [
  {
    id: 'agent',
    name: 'Autonomous Agent',
    tagline: '9-step Plan → Inspect → Edit → Test → Verify execution loop',
    icon: <Bot size={14} className="text-purple-400" />,
    badgeColor: 'border-purple-500/40 text-purple-400 bg-purple-500/10',
  },
  {
    id: 'debug',
    name: 'Debug & Trace',
    tagline: 'Root cause analysis, stack traces, and verification testing',
    icon: <Bug size={14} className="text-red-400" />,
    badgeColor: 'border-red-500/40 text-red-400 bg-red-500/10',
  },
  {
    id: 'architecture',
    name: 'Architecture & Graph',
    tagline: 'Framework discovery, routes, schemas, and god node analysis',
    icon: <Layers size={14} className="text-amber-400" />,
    badgeColor: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
  },
  {
    id: 'testing',
    name: 'Test & Verify',
    tagline: 'Targeted test discovery, assertion diagnostics, and regression checks',
    icon: <TestTube size={14} className="text-green-400" />,
    badgeColor: 'border-green-500/40 text-green-400 bg-green-500/10',
  },
  {
    id: 'code-review',
    name: 'Code Review',
    tagline: 'Categorized findings (Critical to Informational) with diffs',
    icon: <Code2 size={14} className="text-cyan-400" />,
    badgeColor: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
  },
  {
    id: 'learn',
    name: 'Learn & Explain',
    tagline: 'Interactive programming tutor with concept breakdowns',
    icon: <BookOpen size={14} className="text-blue-400" />,
    badgeColor: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
  },
  {
    id: 'project-assistant',
    name: 'Project Assistant',
    tagline: 'Natural language repository exploration and navigation',
    icon: <Sparkles size={14} className="text-emerald-400" />,
    badgeColor: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
  },
  {
    id: 'recovery',
    name: 'Recovery & Rollback',
    tagline: 'OCTOPUS snapshot restoration, safety checks, and rollbacks',
    icon: <History size={14} className="text-indigo-400" />,
    badgeColor: 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10',
  },
  {
    id: 'dsa',
    name: 'DSA & Algorithms',
    tagline: 'Time/space complexities, optimal algorithms, and data structures',
    icon: <Cpu size={14} className="text-pink-400" />,
    badgeColor: 'border-pink-500/40 text-pink-400 bg-pink-500/10',
  },
  {
    id: 'interview',
    name: 'Mock Interview',
    tagline: 'Technical interview practice and system design questions',
    icon: <Sparkles size={14} className="text-yellow-400" />,
    badgeColor: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onSelectMode }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeMode = MODES.find((m) => m.id === currentMode) || MODES[0]!;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-300 dark:border-cyan-900/60 bg-white dark:bg-[#0b101d] text-gray-700 dark:text-slate-200 hover:border-cyan-500/60 dark:hover:border-cyan-500/60 transition shadow-sm"
      >
        <span className="shrink-0">{activeMode.icon}</span>
        <span className="font-mono text-[11px] font-semibold">{activeMode.name}</span>
        <ChevronDown size={12} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 mt-1.5 w-72 max-h-96 overflow-y-auto rounded-xl border border-gray-200 dark:border-cyan-900/60 bg-white dark:bg-[#0c1222] shadow-2xl z-50 p-1.5 space-y-1">
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-400 dark:text-slate-400">
            Select OCTOBOT 2.0 Mode
          </div>
          {MODES.map((mode) => {
            const isSelected = mode.id === currentMode;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => {
                  onSelectMode(mode.id);
                  setOpen(false);
                }}
                className={`w-full text-left p-2 rounded-lg flex items-start space-x-2.5 transition ${
                  isSelected
                    ? 'bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-400/50 dark:border-cyan-700/50'
                    : 'hover:bg-gray-50 dark:hover:bg-[#12192d] border border-transparent'
                }`}
              >
                <div className="mt-0.5 shrink-0">{mode.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">{mode.name}</span>
                    {isSelected && <CheckCircle2 size={12} className="text-cyan-500 shrink-0 ml-1" />}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate mt-0.5">{mode.tagline}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
