import React, { useState } from 'react';
import { Terminal, ShieldAlert, Play, X, Loader2, CheckCircle2 } from 'lucide-react';
import type { CommandExecutionResult } from '@octopus/shared';

export interface CommandApprovalCardProps {
  command: string;
  projectId: string;
  onExecute: (command: string) => Promise<CommandExecutionResult | null>;
  onDismiss?: () => void;
}

export const CommandApprovalCard: React.FC<CommandApprovalCardProps> = ({
  command,
  onExecute,
  onDismiss,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommandExecutionResult | null>(null);

  const handleRun = async () => {
    if (loading) return;
    try {
      setLoading(true);
      const res = await onExecute(command);
      setResult(res);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-3 rounded-xl border border-cyan-800/50 bg-[#080d1a] text-slate-100 overflow-hidden shadow-lg">
      <div className="p-3 bg-cyan-950/40 border-b border-cyan-800/40 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-cyan-300">
          <Terminal size={14} />
          <span>Sandboxed Terminal Command Proposal</span>
        </div>
        <div className="flex items-center space-x-1 text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60">
          <ShieldAlert size={11} className="mr-1 inline" />
          <span>Workspace Boundary Enforced</span>
        </div>
      </div>

      <div className="p-3 bg-black/50 font-mono text-xs text-green-400 overflow-x-auto">
        <div className="flex items-center space-x-2">
          <span className="text-slate-500 select-none">$</span>
          <span className="text-slate-100 font-semibold">{command}</span>
        </div>
      </div>

      {!result ? (
        <div className="p-2.5 bg-[#0b1224] flex items-center justify-between border-t border-cyan-900/40">
          <span className="text-[11px] text-slate-400 font-sans">
            Requires your explicit authorization before execution.
          </span>
          <div className="flex items-center space-x-2">
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="px-2.5 py-1 text-xs font-mono text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleRun}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-3 py-1 text-xs font-mono font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg transition disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              <span>Execute</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-[#0a0f1d] border-t border-cyan-900/40 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-mono">
            {result.exitCode === 0 ? (
              <span className="text-green-400 flex items-center space-x-1">
                <CheckCircle2 size={13} />
                <span>Exited with code 0 ({result.durationMs}ms)</span>
              </span>
            ) : (
              <span className="text-red-400 flex items-center space-x-1">
                <X size={13} />
                <span>Failed with exit code {result.exitCode}</span>
              </span>
            )}
          </div>
          {result.stdout && (
            <div className="p-2 rounded bg-black/70 font-mono text-[11px] text-slate-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
              {result.stdout}
            </div>
          )}
          {result.stderr && (
            <div className="p-2 rounded bg-red-950/40 border border-red-900/50 font-mono text-[11px] text-red-300 max-h-36 overflow-y-auto whitespace-pre-wrap">
              {result.stderr}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
