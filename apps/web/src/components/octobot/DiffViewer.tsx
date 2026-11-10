import React, { useState } from 'react';
import { PatchProposal, octoApi } from '../../lib/octo/octo-client';
import { Check, X, RotateCcw, AlertTriangle, FileCode, CheckCircle2 } from 'lucide-react';
import { Badge } from './Badge';

export interface DiffViewerProps {
  patch: PatchProposal;
  onApplied?: (() => void) | undefined;
  onRejected?: (() => void) | undefined;
  onRollback?: (() => void) | undefined;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  patch,
  onApplied,
  onRejected,
  onRollback,
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'pending' | 'applied' | 'rejected' | 'conflict'>(patch.status);

  const handleApply = async () => {
    try {
      setIsApplying(true);
      setError(null);
      await octoApi.applyPatch(patch.projectId, patch.patchId, true);
      setStatus('applied');
      setSuccessMessage('Patch safely applied to workspace with automatic rollback backup.');
      if (onApplied) onApplied();
    } catch (err: any) {
      setError(err.message || 'Failed to apply patch');
      if (err.message?.includes('Conflict')) {
        setStatus('conflict');
      }
    } finally {
      setIsApplying(false);
    }
  };

  const handleReject = () => {
    setStatus('rejected');
    if (onRejected) onRejected();
  };

  const handleRollback = async () => {
    try {
      setIsRollingBack(true);
      setError(null);
      await octoApi.rollbackPatch(patch.patchId);
      setStatus('pending');
      setSuccessMessage('File safely restored to pre-patch state from rollback backup.');
      if (onRollback) onRollback();
    } catch (err: any) {
      setError(err.message || 'Rollback failed');
    } finally {
      setIsRollingBack(false);
    }
  };

  const diffLines = patch.diff.split('\n');

  return (
    <div className="flex flex-col rounded-xl border border-gray-200 dark:border-cyan-950/70 bg-white dark:bg-[#080b14] overflow-hidden shadow-xl my-3">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-cyan-950/60 bg-gray-50/80 dark:bg-[#0c101d] flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCode size={18} className="text-cyan-600 dark:text-cyan-400" />
            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{patch.filePath}</span>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="green">+{patch.additions} lines</Badge>
            <Badge variant="red">-{patch.deletions} lines</Badge>
            <Badge
              variant={
                status === 'applied'
                  ? 'green'
                  : status === 'conflict'
                  ? 'orange'
                  : status === 'rejected'
                  ? 'red'
                  : 'cyan'
              }
            >
              {status.toUpperCase()}
            </Badge>
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">{patch.summary}</p>
      </div>

      {/* Conflict / Error Banner */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-800/60 flex items-start space-x-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Banner */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 flex items-start space-x-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Diff Output */}
      <div className="p-3 overflow-x-auto font-mono text-xs max-h-80 overflow-y-auto bg-[#04060c] text-slate-200 divide-y divide-slate-900/40">
        {diffLines.map((line, idx) => {
          let lineBg = 'hover:bg-slate-900/60 text-slate-400';
          let prefixColor = 'text-slate-500';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            lineBg = 'bg-emerald-950/40 text-emerald-300 font-semibold';
            prefixColor = 'text-emerald-400';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            lineBg = 'bg-rose-950/40 text-rose-300 font-semibold';
            prefixColor = 'text-rose-400';
          } else if (line.startsWith('@@')) {
            lineBg = 'bg-cyan-950/40 text-cyan-400 font-bold';
            prefixColor = 'text-cyan-500';
          }

          return (
            <div key={idx} className={`px-2 py-0.5 whitespace-pre flex items-start ${lineBg}`}>
              <span className={`w-5 shrink-0 select-none ${prefixColor}`}>{line[0] || ' '}</span>
              <span className="flex-1 overflow-x-auto">{line.slice(1)}</span>
            </div>
          );
        })}
      </div>

      {/* Actions Toolbar */}
      <div className="p-3 border-t border-gray-200 dark:border-cyan-950/60 bg-gray-50 dark:bg-[#0c101d] flex items-center justify-between">
        <div className="flex items-center space-x-2 text-[11px] text-gray-500 dark:text-slate-400 font-mono">
          <span>Protected Rollback:</span>
          <span className="text-cyan-600 dark:text-cyan-400">.octo-backup/ Enabled</span>
        </div>

        <div className="flex items-center space-x-2">
          {status === 'pending' && (
            <>
              <button
                type="button"
                onClick={handleReject}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-slate-700 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition flex items-center space-x-1"
              >
                <X size={14} />
                <span>Discard</span>
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isApplying ? 'Applying...' : 'Apply Patch'}</span>
              </button>
            </>
          )}

          {status === 'applied' && (
            <button
              type="button"
              onClick={handleRollback}
              disabled={isRollingBack}
              className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-medium transition flex items-center space-x-1"
              title="Rollback to pre-patch state"
            >
              <RotateCcw size={14} />
              <span>{isRollingBack ? 'Reverting...' : 'Rollback Modification'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
