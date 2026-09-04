import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// MathText component
// Renders text content with:
// 1. LaTeX math expressions using KaTeX ($...$, $$...$$, \(...\), \[...\])
// 2. Markdown image references (![](url)) as <img> elements
// 3. Plain text
// Falls back to plain text when no special content detected.

interface MathTextProps {
  text?: string | null;
  className?: string;
}

// Parse text into segments: text, math expressions, and images
type Segment =
  | { type: 'text'; content: string }
  | { type: 'math'; content: string; block?: boolean }
  | { type: 'image'; src: string; alt: string };

function parseContent(text: string): Segment[] {
  const segments: Segment[] = [];
  // Combined regex for math ($$...$$, \[...\], $...$, \(...\)) and images (![alt](url))
  const regex = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([^\\]+?\\\)|!\[([^\]]*)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Plain text before the match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];

    // Check if it's an image reference ![alt](url)
    if (raw.startsWith('![')) {
      const alt = match[2] || '';
      const src = match[3] || '';
      segments.push({ type: 'image', src, alt });
    } else {
      // Math expression
      let content: string;
      let block = false;
      if (raw.startsWith('$$') && raw.endsWith('$$')) {
        content = raw.slice(2, -2).trim();
        block = true;
      } else if (raw.startsWith('\\[') && raw.endsWith('\\]')) {
        content = raw.slice(2, -2).trim();
        block = true;
      } else if (raw.startsWith('\\(') && raw.endsWith('\\)')) {
        content = raw.slice(2, -2).trim();
      } else {
        content = raw.slice(1, -1).trim();
      }
      segments.push({ type: 'math', content, block });
    }
    lastIndex = match.index + raw.length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

// Convert a URL to absolute (prepend backend URL for relative paths like /uploads/...)
function normalizeImageUrl(src: string): string {
  // Already absolute or data URL
  if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
    return src;
  }
  // Relative path starting with /uploads/ -> served by backend
  if (src.startsWith('/uploads')) {
    return `http://localhost:3000${src}`;
  }
  // Other relative paths
  return `http://localhost:3000/${src}`;
}

// Render a single math expression safely with KaTeX
function MathExpression({ content, block }: { content: string; block?: boolean }) {
  let html: string;
  try {
    html = katex.renderToString(content, {
      throwOnError: false,
      displayMode: !!block,
      strict: false,
    });
  } catch (e) {
    // If KaTeX fails, show raw content
    return <span className="math-error">${content}$</span>;
  }
  return (
    <span
      className={block ? 'math-block' : 'math-inline'}
      style={block ? { display: 'block', textAlign: 'left' } : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Render an image element
function ImageElement({ src, alt }: { src: string; alt: string }) {
  const url = normalizeImageUrl(src);
  return (
    <img
      src={url}
      alt={alt || '题目图片'}
      className="math-text-image"
      style={{
        maxWidth: '100%',
        height: 'auto',
        display: 'block',
        margin: '8px 0',
        borderRadius: '4px',
        border: '1px solid #e0e0e0',
      }}
    />
  );
}

export default function MathText({ text, className }: MathTextProps) {
  if (!text || text.trim().length === 0) {
    return <div className={className}>{text || ''}</div>;
  }

  const segments = parseContent(text);
  const hasSpecial = segments.some((s) => s.type !== 'text');

  // No math or images - render plain text
  if (!hasSpecial) {
    return <div className={className}>{text}</div>;
  }

  return (
    <div className={`math-text ${className || ''}`} style={{ textAlign: 'left' }}>
      {segments.map((seg, i) => {
        if (seg.type === 'math') {
          return <MathExpression key={i} content={seg.content} block={seg.block} />;
        }
        if (seg.type === 'image') {
          return <ImageElement key={i} src={seg.src} alt={seg.alt} />;
        }
        return <React.Fragment key={i}>{seg.content}</React.Fragment>;
      })}
    </div>
  );
}
