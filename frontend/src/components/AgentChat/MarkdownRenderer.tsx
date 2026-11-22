import React from 'react';

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // Simple, safe, dependency-free Markdown renderer for headings, tables, lists, bold, and code
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];

  let inTable = false;
  let tableHeader: string[] = [];
  let tableRows: string[][] = [];

  const flushTable = (key: number) => {
    if (tableHeader.length > 0) {
      renderedElements.push(
        <div key={`table-wrapper-${key}`} className="my-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                {tableHeader.map((h, i) => (
                  <th key={i} className="px-3 py-2">{renderInlineText(h.trim())}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {tableRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-1.5 tabular-nums">{renderInlineText(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    inTable = false;
    tableHeader = [];
    tableRows = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Table Row
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const parts = line.split('|').slice(1, -1);
      // Skip markdown divider row |---|---|
      if (parts.every((p) => p.trim().match(/^:?-+:?$/))) {
        continue;
      }
      if (!inTable) {
        inTable = true;
        tableHeader = parts;
      } else {
        tableRows.push(parts);
      }
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    // Heading 3
    if (line.startsWith('### ')) {
      renderedElements.push(
        <h3 key={i} className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-3 mb-1.5 text-balance">
          {renderInlineText(line.slice(4))}
        </h3>
      );
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      renderedElements.push(
        <h2 key={i} className="text-base font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2 text-balance">
          {renderInlineText(line.slice(3))}
        </h2>
      );
      continue;
    }

    // Heading 1
    if (line.startsWith('# ')) {
      renderedElements.push(
        <h1 key={i} className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 mt-4 mb-2 text-balance">
          {renderInlineText(line.slice(2))}
        </h1>
      );
      continue;
    }

    // Bullet points
    if (line.trim().startsWith('• ') || line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const text = line.trim().replace(/^[•\-\*]\s+/, '');
      renderedElements.push(
        <div key={i} className="flex items-start gap-2 my-1 text-xs text-pretty text-zinc-800 dark:text-zinc-200">
          <span className="text-orange-500 font-bold leading-relaxed shrink-0">•</span>
          <span className="leading-relaxed">{renderInlineText(text)}</span>
        </div>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      renderedElements.push(<div key={i} className="h-1.5" />);
      continue;
    }

    // Regular paragraph
    renderedElements.push(
      <p key={i} className="text-xs text-pretty text-zinc-800 dark:text-zinc-200 leading-relaxed my-1">
        {renderInlineText(line)}
      </p>
    );
  }

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{renderedElements}</div>;
};

function renderInlineText(text: string): React.ReactNode {
  // Tokenize for bold (**text**), code (`code`), and italics (*text*)
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|`.*?`|\*.*?\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={match.index} className="font-semibold text-zinc-900 dark:text-zinc-100">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded-md text-[11px] font-mono bg-zinc-200/70 dark:bg-zinc-800 text-orange-600 dark:text-orange-400"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={match.index} className="italic text-zinc-700 dark:text-zinc-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.substring(lastIndex));
  }

  return tokens.length > 0 ? tokens : text;
}
