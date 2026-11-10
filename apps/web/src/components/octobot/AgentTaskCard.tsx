import React, { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Terminal,
  ShieldCheck,
  Play,
} from 'lucide-react';
import type { AgentTaskState } from '@octopus/shared';
import { Badge } from './Badge';

export interface AgentTaskCardProps {
  task: AgentTaskState;
  onApproveStep?: ((taskId: string) => void) | undefined;
}

export const AgentTaskCard: React.FC<AgentTaskCardProps> = ({ task, onApproveStep }) => {
  const [showLogs, setShowLogs] = useState(false);
  const [approving, setApproving] = useState(false);

  const isWaitingApproval = task.status === 'waiting_approval';
  const isCompleted = task.status === 'completed';
  const isFailed = task.status === 'failed';
  const isExecuting = task.status === 'executing';

  const completedSteps = task.steps.filter((s) => s.status === 'completed').length;
  const totalSteps = task.steps.length;

  const handleApprove = async () => {
    if (!onApproveStep || approving) return;
    try {
      setApproving(true);
      await onApproveStep(task.taskId);
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-purple-500/30 bg-[#0d1020] text-slate-100 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="p-3.5 bg-gradient-to-r from-purple-950/40 via-cyan-950/30 to-[#0d1020] border-b border-purple-500/20 flex items-center justify-between">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0">
            <Bot size={15} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-purple-300 uppercase tracking-wide">
                Autonomous Agent Plan
              </span>
              <span className="text-[10px] font-mono text-slate-400">({task.taskId})</span>
            </div>
            <p className="text-xs text-slate-300 truncate font-sans">{task.goal}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <Badge
            variant={
              isCompleted
                ? 'green'
                : isFailed
                ? 'orange'
                : isWaitingApproval
                ? 'orange'
                : 'cyan'
            }
            size="sm"
          >
            {isExecuting && <Loader2 size={10} className="animate-spin inline mr-1" />}
            {task.status.replace('_', ' ').toUpperCase()}
          </Badge>
          <span className="text-[11px] font-mono text-slate-400">
            {completedSteps}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Steps List */}
      <div className="p-3 space-y-2 bg-[#090c18]">
        {task.steps.map((step) => {
          const stepDone = step.status === 'completed';
          const stepRunning = step.status === 'running';
          const stepWait = isWaitingApproval && step.requiresApproval && !step.isApproved;
          const stepFail = step.status === 'failed';

          return (
            <div
              key={step.id || step.stepNumber}
              className={`p-2.5 rounded-lg border text-xs transition flex items-start space-x-2.5 ${
                stepRunning
                  ? 'border-cyan-500/60 bg-cyan-950/20 shadow-sm'
                  : stepWait
                  ? 'border-amber-500/60 bg-amber-950/20'
                  : stepDone
                  ? 'border-green-950/40 bg-green-950/10'
                  : stepFail
                  ? 'border-red-900/40 bg-red-950/20'
                  : 'border-slate-800/60 bg-[#0c101e]'
              }`}
            >
              {/* Status Icon */}
              <div className="mt-0.5 shrink-0">
                {stepDone && <CheckCircle2 size={14} className="text-green-400" />}
                {stepRunning && <Loader2 size={14} className="text-cyan-400 animate-spin" />}
                {stepWait && <AlertTriangle size={14} className="text-amber-400 animate-pulse" />}
                {stepFail && <XCircle size={14} className="text-red-400" />}
                {step.status === 'pending' && !stepWait && <Clock size={14} className="text-slate-500" />}
              </div>

              {/* Step info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[11px] font-bold text-slate-200">
                    {step.stepNumber}. {step.title}
                  </span>
                  {step.tool && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase tracking-wider bg-purple-900/40 border border-purple-600/30 text-purple-300">
                      {step.tool}
                    </span>
                  )}
                  {step.requiresApproval && (
                    <span className="text-[9px] font-mono text-amber-400 flex items-center space-x-0.5">
                      <ShieldCheck size={10} />
                      <span>{step.isApproved ? 'Approved' : 'Approval Gate'}</span>
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 font-sans leading-relaxed">
                  {step.description}
                </p>

                {/* Parameters preview if present */}
                {step.toolParams && Object.keys(step.toolParams).length > 0 && (
                  <div className="mt-1 font-mono text-[10px] text-slate-500 truncate">
                    args: {JSON.stringify(step.toolParams)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Human Approval Checkpoint Gate */}
      {isWaitingApproval && (
        <div className="p-3 bg-amber-950/30 border-t border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-amber-300">
            <AlertTriangle size={14} className="shrink-0 animate-bounce" />
            <span>This step modifies workspace files or executes commands. Proceed?</span>
          </div>
          <button
            type="button"
            onClick={handleApprove}
            disabled={approving}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono transition shadow-md disabled:opacity-50"
          >
            {approving ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            <span>Approve & Execute</span>
          </button>
        </div>
      )}

      {/* Execution Logs Accordion */}
      {task.outputLog && task.outputLog.length > 0 && (
        <div className="border-t border-slate-800 bg-[#080a14]">
          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className="w-full px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400 hover:text-slate-200 transition"
          >
            <span className="flex items-center space-x-1.5">
              <Terminal size={12} />
              <span>Agent Execution Logs ({task.outputLog.length})</span>
            </span>
            {showLogs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showLogs && (
            <div className="p-2.5 max-h-48 overflow-y-auto font-mono text-[10px] text-cyan-300/80 bg-black/60 space-y-1">
              {task.outputLog.map((log, idx) => (
                <div key={idx} className="leading-tight">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
