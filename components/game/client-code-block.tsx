"use client";

import { useEffect, useRef, useState } from "react";
import { highlight } from "./highlight-client";

interface Props {
  code: string;
  language: string;
}

/**
 * Code block highlighted in the browser with Shiki. The first render highlights at once; later
 * edits are debounced while the code changes.
 */
export function ClientCodeBlock({ code, language }: Props) {
  // Highlighted HTML; null until the first highlight (the plain code shows
  // meanwhile). A failed highlight keeps whatever was shown before.
  const [html, setHtml] = useState<string | null>(null);
  const hasHighlighted = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      highlight(code, language)
        .then((highlighted) => {
          if (!cancelled) {
            hasHighlighted.current = true;
            setHtml(highlighted);
          }
        })
        .catch(() => {
          // Keep showing the plain or previously highlighted code.
        });
    };

    if (!hasHighlighted.current) {
      run();
      return () => {
        cancelled = true;
      };
    }
    const debounce = setTimeout(run, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [code, language]);

  // Set innerHTML via ref to avoid dangerouslySetInnerHTML
  useEffect(() => {
    if (containerRef.current && html !== null) {
      containerRef.current.innerHTML = html;
    }
  }, [html]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#0d1117]">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-border border-b bg-[#161b22] px-4 py-2">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[oklch(0.62_0.24_18/0.6)]" />
          <span className="size-2.5 rounded-full bg-[oklch(0.78_0.17_70/0.6)]" />
          <span className="size-2.5 rounded-full bg-[oklch(0.68_0.2_150/0.6)]" />
        </div>
        <span className="ml-auto font-mono text-[oklch(0.58_0.02_260)] text-xs tracking-wider">
          {language}
        </span>
      </div>

      {/* Code area */}
      <div className="relative min-h-[3rem] overflow-x-auto">
        {html === null ? (
          // Readable before the highlighter has loaded; the left padding
          // leaves room for the line numbers the highlighted version adds.
          <pre className="shiki-fallback">{code}</pre>
        ) : (
          <div className="shiki-container" ref={containerRef} />
        )}
      </div>

      <style>{`
        .shiki-fallback,
        .shiki-container pre {
          background: transparent !important;
          margin: 0;
          padding: 1rem;
          font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          tab-size: 2;
        }
        .shiki-fallback {
          color: #e1e4e8;
          padding-left: 4.25rem;
        }
        .shiki-container code {
          counter-reset: line;
        }
        .shiki-container code .line::before {
          counter-increment: line;
          content: counter(line);
          display: inline-block;
          width: 2rem;
          margin-right: 1.25rem;
          text-align: right;
          color: oklch(0.42 0.015 260);
          font-size: 0.75rem;
          user-select: none;
        }
        .shiki-container code .line:last-child:empty::before {
          display: none;
        }
      `}</style>
    </div>
  );
}
