import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export interface CodeBlockProps {
  code: string;
  language?: string | undefined;
  fileName?: string | undefined;
  showLineNumbers?: boolean | undefined;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'typescript',
  fileName,
  showLineNumbers = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const lines = code.trim().split('\n');

  return (
    <div className="my-3 w-full max-w-full rounded-xl border border-gray-200 dark:border-cyan-950/70 bg-[#060810] overflow-hidden shadow-md group">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0c101d] border-b border-gray-200 dark:border-cyan-950/60 text-xs text-slate-300 font-mono">
        <span className="flex items-center space-x-2 truncate">
          {fileName ? (
            <span className="text-cyan-400 font-semibold truncate">{fileName}</span>
          ) : (
            <span className="uppercase text-[10px] tracking-wider text-slate-400 font-semibold">{language}</span>
          )}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-cyan-900/30 transition text-xs shrink-0"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span className="text-[11px] text-emerald-400 font-medium">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span className="text-[11px]">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3.5 overflow-x-auto text-xs font-mono leading-relaxed text-slate-200 max-w-full">
        <pre className="flex min-w-0">
          {showLineNumbers && (
            <div className="select-none text-slate-600 text-right pr-3.5 border-r border-slate-800/80 mr-3.5 font-mono shrink-0">
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          )}
          <code className="flex-1 whitespace-pre min-w-0 overflow-x-auto font-mono">{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
};
