import React from 'react';

interface MarkdownRendererProps {
  content: string;
  isUser?: boolean;
}

function renderInline(text: string, isUser: boolean, keyPrefix: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Matches: `code`, **bold**, __bold__, *italic*, [label](url)
  const regex = /(`[^`]+`|\*\*[^*]+?\*\*|__[^_]+?__|(?<!\w)\*[^*\n]+?\*(?!\w)|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    const key = `${keyPrefix}-${idx++}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={key}
          className={`px-1 py-0.5 rounded font-mono text-[11px] ${
            isUser
              ? 'bg-white/20 text-white'
              : 'bg-teal-500/10 text-teal-800 dark:text-teal-200 border border-teal-500/20'
          }`}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      (token.startsWith('**') && token.endsWith('**')) ||
      (token.startsWith('__') && token.endsWith('__'))
    ) {
      tokens.push(
        <strong key={key} className="font-extrabold">
          {renderInline(token.slice(2, -2), isUser, key)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={key} className="italic">
          {renderInline(token.slice(1, -1), isUser, key)}
        </em>
      );
    } else if (token.startsWith('[')) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        tokens.push(
          <a
            key={key}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline font-bold ${isUser ? 'text-teal-100' : 'text-teal-600 dark:text-teal-400 hover:opacity-80'}`}
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        tokens.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }

  return tokens;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUser = false }) => {
  if (!content) return null;

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      i++;
      continue;
    }

    // Fenced code block ```
    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        <pre
          key={`code-${blocks.length}`}
          className={`p-2.5 rounded-xl overflow-x-auto font-mono text-[11px] leading-snug my-1.5 ${
            isUser
              ? 'bg-black/20 text-white'
              : 'bg-black/5 dark:bg-black/30 border border-teal-500/15'
          }`}
        >
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(
        <hr
          key={`hr-${blocks.length}`}
          className="my-2 border-t"
          style={{ borderColor: isUser ? 'rgba(255,255,255,0.25)' : 'var(--border)' }}
        />
      );
      i++;
      continue;
    }

    // Heading (#, ##, ###, ####)
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizeClass =
        level === 1
          ? 'text-sm font-black mt-2 mb-1'
          : level === 2
          ? 'text-[13px] font-black mt-2 mb-1'
          : 'text-xs font-extrabold mt-2 mb-0.5';

      blocks.push(
        <div
          key={`h-${blocks.length}`}
          className={`${sizeClass} leading-snug`}
          style={!isUser && level <= 3 ? { color: 'var(--terra)' } : undefined}
        >
          {renderInline(text, isUser, `h-${blocks.length}`)}
        </div>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`q-${blocks.length}`}
          className={`pl-2.5 border-l-2 italic my-1.5 opacity-90 ${
            isUser ? 'border-white/50' : 'border-teal-500/50'
          }`}
        >
          {renderInline(quoteLines.join(' '), isUser, `q-${blocks.length}`)}
        </blockquote>
      );
      continue;
    }

    // Unordered list (*, -, •)
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: { indent: number; text: string }[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)[-*•]\s+(.+)$/);
        if (m) {
          items.push({ indent: m[1].length, text: m[2] });
        }
        i++;
      }
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="space-y-1 my-1 pl-1">
          {items.map((item, idx) => (
            <li
              key={`li-${idx}`}
              className="flex items-start gap-2 leading-relaxed"
              style={item.indent >= 2 ? { paddingLeft: '0.85rem' } : undefined}
            >
              <span
                className="mt-[6px] w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: isUser ? '#FFFFFF' : 'var(--terra)' }}
              />
              <span className="min-w-0 flex-1">
                {renderInline(item.text, isUser, `ul-${blocks.length}-${idx}`)}
              </span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list (1., 2., ...)
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: { num: string; text: string }[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s*(\d+)[.)]\s+(.+)$/);
        if (m) {
          items.push({ num: m[1], text: m[2] });
        }
        i++;
      }
      blocks.push(
        <ol key={`ol-${blocks.length}`} className="space-y-1 my-1 pl-1">
          {items.map((item, idx) => (
            <li key={`oli-${idx}`} className="flex items-start gap-1.5 leading-relaxed">
              <span
                className="font-extrabold shrink-0"
                style={!isUser ? { color: 'var(--terra)' } : undefined}
              >
                {item.num}.
              </span>
              <span className="min-w-0 flex-1">
                {renderInline(item.text, isUser, `ol-${blocks.length}-${idx}`)}
              </span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph (collect consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }

    blocks.push(
      <p key={`p-${blocks.length}`} className="leading-relaxed">
        {paraLines.map((pLine, pIdx) => (
          <React.Fragment key={pIdx}>
            {pIdx > 0 && <br />}
            {renderInline(pLine, isUser, `p-${blocks.length}-${pIdx}`)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  return <div className="space-y-1.5 text-xs">{blocks}</div>;
};
