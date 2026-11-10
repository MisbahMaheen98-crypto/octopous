import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '../../lib/octo/octo-client';
import { CodeBlock } from './CodeBlock';
import { DiffViewer } from './DiffViewer';
import { OctoLogo } from './OctoLogo';
import { Badge } from './Badge';
import { AgentTaskCard } from './AgentTaskCard';
import { User, FileText } from 'lucide-react';

export interface MessageItemProps {
  message: ChatMessage;
  onSelectFile?: ((file: string) => void) | undefined;
  onPatchApplied?: (() => void) | undefined;
  onApproveAgentStep?: ((taskId: string) => void) | undefined;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  onSelectFile,
  onPatchApplied,
  onApproveAgentStep,
}) => {
  const isUser = message.role === 'user';

  return (
    <div
      className={`p-4 md:p-5 rounded-2xl border transition-all duration-150 flex gap-3.5 md:gap-4 shadow-sm ${
        isUser
          ? 'bg-gray-50/90 dark:bg-[#0e1322] border-gray-200 dark:border-cyan-950/60 text-gray-900 dark:text-slate-100'
          : 'bg-white dark:bg-[#090d18] border-gray-200/90 dark:border-cyan-900/40 border-l-4 border-l-cyan-500 text-gray-900 dark:text-slate-100'
      }`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-[#151c30] border border-gray-300 dark:border-cyan-950/80 flex items-center justify-center text-gray-600 dark:text-slate-400 shadow-sm">
            <User size={16} />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-xl bg-[#060810] border border-cyan-500/50 flex items-center justify-center shadow-sm">
            <OctoLogo size={20} showText={false} />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 space-y-2 min-w-0 max-w-full overflow-hidden">
        {/* Header line */}
        <div className="flex items-center space-x-2.5">
          <span className={`text-xs font-bold font-mono ${isUser ? 'text-gray-900 dark:text-slate-200' : 'text-cyan-600 dark:text-cyan-400'}`}>
            {isUser ? 'You' : 'OCTOBOT'}
          </span>
          <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">
            {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
          {message.isSimulated && (
            <Badge variant="orange" size="sm">
              Demo Simulation
            </Badge>
          )}
        </div>

        {/* File references tags */}
        {message.fileReferences && message.fileReferences.length > 0 && (
          <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 pt-0.5">
            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-mono uppercase tracking-wider font-semibold">
              Referenced:
            </span>
            {message.fileReferences.map((ref) => (
              <button
                key={ref}
                type="button"
                onClick={() => onSelectFile && onSelectFile(ref)}
                className="inline-flex items-center space-x-1 text-[11px] font-mono px-2 py-0.5 bg-gray-100 dark:bg-[#151c30] hover:bg-cyan-50 dark:hover:bg-[#1d2742] text-cyan-600 dark:text-cyan-300 border border-gray-200 dark:border-cyan-900/40 rounded transition shadow-sm"
              >
                <FileText size={11} />
                <span>{ref}</span>
              </button>
            ))}
          </div>
        )}

        {/* Attached Screenshots / Visual Inputs */}
        {message.images && message.images.length > 0 && (
          <div className="flex flex-wrap gap-2 my-2.5">
            {message.images.map((img, idx) => (
              <div
                key={idx}
                className="relative rounded-lg overflow-hidden border border-gray-300 dark:border-cyan-900/50 bg-[#060810] max-w-sm max-h-60 shadow-md group"
              >
                <img
                  src={img}
                  alt={`Uploaded screenshot ${idx + 1}`}
                  className="object-contain max-h-60 w-auto rounded hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
                  onClick={() => window.open(img, '_blank')}
                  title="Click to view full image in new tab"
                />
                <span className="absolute bottom-1.5 right-1.5 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/80 text-cyan-300 border border-cyan-800">
                  Gemma 4 Vision Input
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Markdown Content */}
        <div className="text-sm text-gray-800 dark:text-slate-200 leading-relaxed font-sans space-y-2.5 max-w-none break-words [overflow-wrap:anywhere]">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                if (!inline) {
                  return (
                    <CodeBlock
                      code={codeString}
                      language={match ? match[1] : 'typescript'}
                    />
                  );
                }
                return (
                  <code
                    className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#121829] text-cyan-700 dark:text-cyan-300 font-mono text-xs border border-gray-200 dark:border-cyan-900/40 break-all"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              p({ children }: any) {
                return <p className="mb-2 leading-relaxed text-gray-800 dark:text-slate-200 break-words">{children}</p>;
              },
              ul({ children }: any) {
                return <ul className="list-disc list-inside space-y-1 my-2 text-gray-700 dark:text-slate-300 break-words">{children}</ul>;
              },
              ol({ children }: any) {
                return <ol className="list-decimal list-inside space-y-1 my-2 text-gray-700 dark:text-slate-300 break-words">{children}</ol>;
              },
              h1({ children }: any) {
                return <h1 className="text-base font-bold text-gray-900 dark:text-white mt-3 mb-1.5 break-words">{children}</h1>;
              },
              h2({ children }: any) {
                return <h2 className="text-sm font-bold text-gray-900 dark:text-white mt-3 mb-1.5 break-words">{children}</h2>;
              },
              h3({ children }: any) {
                return <h3 className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 mt-2.5 mb-1 break-words">{children}</h3>;
              },
              blockquote({ children }: any) {
                return (
                  <blockquote className="p-3 bg-gray-100 dark:bg-[#101524] border-l-2 border-cyan-500 text-xs text-gray-600 dark:text-slate-400 italic my-2 rounded-r break-words">
                    {children}
                  </blockquote>
                );
              },
              table({ children }: any) {
                return (
                  <div className="w-full max-w-full overflow-x-auto my-3 border border-gray-200 dark:border-cyan-900/50 rounded-xl shadow-sm bg-white dark:bg-[#0a0e1a]">
                    <table className="w-full min-w-full divide-y divide-gray-200 dark:divide-cyan-900/40 text-xs font-sans">
                      {children}
                    </table>
                  </div>
                );
              },
              thead({ children }: any) {
                return <thead className="bg-gray-50 dark:bg-[#0e1322] text-gray-900 dark:text-white font-semibold">{children}</thead>;
              },
              tbody({ children }: any) {
                return <tbody className="divide-y divide-gray-100 dark:divide-cyan-950/40 bg-white/50 dark:bg-transparent">{children}</tbody>;
              },
              tr({ children }: any) {
                return <tr className="hover:bg-gray-50 dark:hover:bg-[#12182b] transition-colors">{children}</tr>;
              },
              th({ children }: any) {
                return <th className="px-3.5 py-2 text-left font-mono font-medium text-cyan-600 dark:text-cyan-400 uppercase tracking-wider text-[11px]">{children}</th>;
              },
              td({ children }: any) {
                return <td className="px-3.5 py-2 text-gray-800 dark:text-slate-200 text-xs leading-relaxed">{children}</td>;
              },
              hr() {
                return <hr className="border-gray-200 dark:border-cyan-950/60 my-3" />;
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Autonomous Agent Plan & State */}
        {message.agentState && (
          <div className="mt-3">
            <AgentTaskCard task={message.agentState} onApproveStep={onApproveAgentStep} />
          </div>
        )}

        {/* Embedded Suggested Patch Proposal */}
        {message.suggestedPatch && (
          <div className="mt-4 pt-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-semibold block mb-2">
              Proposed Code Modification Ready for Review
            </span>
            <DiffViewer patch={message.suggestedPatch} onApplied={onPatchApplied} />
          </div>
        )}
      </div>
    </div>
  );
};
