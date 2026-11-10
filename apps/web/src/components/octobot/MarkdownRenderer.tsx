import React from 'react';
import { CodeBlock } from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split on fenced code blocks: ```lang ... ```
  const parts: React.ReactNode[] = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockKey = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.substring(lastIndex, match.index);
      parts.push(
        <div key={`text-${blockKey++}`} className="octo-md-prose">
          {renderMarkdownText(textBefore)}
        </div>
      );
    }

    const language = match[1] || 'typescript';
    const code = match[2] || '';
    parts.push(
      <CodeBlock
        key={`code-${blockKey++}`}
        code={code}
        language={language}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remainingText = content.substring(lastIndex);
    parts.push(
      <div key={`text-${blockKey++}`} className="octo-md-prose">
        {renderMarkdownText(remainingText)}
      </div>
    );
  }

  return <div className="octo-markdown-content">{parts}</div>;
};

function renderMarkdownText(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="octo-md-list">
          {currentList.map((item, idx) => (
            <li key={idx}>{renderInline(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const rows = tableRows.slice(1);
      elements.push(
        <div key={`table-wrap-${elements.length}`} className="octo-table-container">
          <table className="octo-md-table">
            {header && (
              <thead>
                <tr>
                  {header.map((col, idx) => (
                    <th key={idx}>{renderInline(col.trim())}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInline(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();

    // Table detection: line starts and ends with |
    if (line.startsWith('|') && line.endsWith('|')) {
      flushList();
      // Skip separator rows like |---|---|
      if (/^\|[-|\s]+\|$/.test(line)) {
        continue;
      }
      const cols = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      tableRows.push(cols);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    // List item detection
    if (line.startsWith('- ') || line.startsWith('* ')) {
      currentList.push(line.slice(2));
      continue;
    } else {
      flushList();
    }

    if (!line) {
      // Empty line
      continue;
    }

    // Headers
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="octo-md-h3">
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="octo-md-h2">
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="octo-md-h1">
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={`bq-${i}`} className="octo-md-blockquote">
          {renderInline(line.slice(2))}
        </blockquote>
      );
    } else {
      elements.push(
        <p key={`p-${i}`} className="octo-md-p">
          {renderInline(line)}
        </p>
      );
    }
  }

  flushList();
  flushTable();
  return elements;
}

function renderInline(text: string): React.ReactNode {
  // Process inline code, bold, italic
  const parts: React.ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let k = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.substring(lastIdx, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={`code-${k++}`} className="octo-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={`b-${k++}`} className="octo-bold">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={`i-${k++}`} className="octo-italic">
          {token.slice(1, -1)}
        </em>
      );
    }

    lastIdx = match.index + token.length;
  }

  if (lastIdx < text.length) {
    parts.push(text.substring(lastIdx));
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}
