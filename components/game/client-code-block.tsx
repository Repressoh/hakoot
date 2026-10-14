"use client";

import { useEffect, useReducer, useRef } from "react";
import { createHighlighter } from "shiki";

const SUPPORTED_LANGS = [
  "typescript",
  "javascript",
  "python",
  "java",
  "rust",
  "go",
  "bash",
  "shell",
  "json",
  "html",
  "css",
  "sql",
  "markdown",
  "plaintext",
] as const;

type SupportedLang = (typeof SUPPORTED_LANGS)[number];

function isSupportedLang(lang: string): lang is SupportedLang {
  return SUPPORTED_LANGS.includes(lang as SupportedLang);
}

interface Props {
  code: string;
  language: string;
}

type HighlightState =
  | { status: "loading"; html: string | null }
  | { status: "ready"; html: string }
  | { status: "error"; html: string | null };

type HighlightAction = { type: "RESOLVE"; html: string } | { type: "REJECT" };

/** Tracks the async syntax-highlighting result: loading, ready or error (keeping the last HTML). */
function highlightReducer(
  state: HighlightState,
  action: HighlightAction
): HighlightState {
  if (action.type === "RESOLVE") {
    return { html: action.html, status: "ready" };
  }
  return { html: state.html, status: "error" };
}

/** Code block highlighted in the browser with Shiki, debounced while the code changes. */
export function ClientCodeBlock({ code, language }: Props) {
  const [state, dispatch] = useReducer(highlightReducer, {
    html: null,
    status: "loading",
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const safeLang: SupportedLang = isSupportedLang(language)
        ? language
        : "plaintext";

      let cancelled = false;

      createHighlighter({
        langs: [safeLang],
        themes: ["github-dark"],
      })
        .then((highlighter) => {
          if (cancelled) {
            return;
          }
          const html = highlighter.codeToHtml(code, {
            lang: safeLang,
            theme: "github-dark",
          });
          dispatch({ html, type: "RESOLVE" });
        })
        .catch(() => {
          if (!cancelled) {
            dispatch({ type: "REJECT" });
          }
        });

      return () => {
        cancelled = true;
      };
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, language]);

  const { status, html } = state;

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
        {status === "loading" && !html ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: Math.max(code.split("\n").length, 3) }).map(
              (_line, i) => {
                const lineNum = i + 1;
                return (
                  <div
                    className="h-4 animate-pulse rounded bg-[oklch(0.22_0.015_260/0.6)]"
                    key={`skeleton-line-${code.length}-${lineNum}`}
                    style={{ width: `${55 + ((i * 17 + 31) % 40)}%` }}
                  />
                );
              }
            )}
          </div>
        ) : (
          <div
            className={`shiki-container transition-opacity duration-200 ${status === "loading" ? "opacity-50" : "opacity-100"}
            `}
            ref={containerRef}
          />
        )}
      </div>

      <style>{`
        .shiki-container pre {
          background: transparent !important;
          margin: 0;
          padding: 1rem;
          font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace;
          font-size: 0.8125rem;
          line-height: 1.6;
          tab-size: 2;
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
