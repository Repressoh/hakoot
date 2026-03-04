"use client";

import { useEffect, useRef, useState } from "react";
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

export function ClientCodeBlock({ code, language }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const safeLang: SupportedLang = isSupportedLang(language)
        ? language
        : "plaintext";

      let cancelled = false;
      setLoading(true);

      createHighlighter({
        themes: ["github-dark"],
        langs: [safeLang],
      })
        .then((highlighter) => {
          if (cancelled) {
            return;
          }
          const result = highlighter.codeToHtml(code, {
            lang: safeLang,
            theme: "github-dark",
          });
          setHtml(result);
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) {
            setLoading(false);
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

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-[#0d1117]">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-border border-b bg-[#161b22] px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.62_0.24_18/0.6)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.78_0.17_70/0.6)]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[oklch(0.68_0.2_150/0.6)]" />
        </div>
        <span className="ml-auto font-mono text-[oklch(0.58_0.02_260)] text-xs tracking-wider">
          {language}
        </span>
      </div>

      {/* Code area */}
      <div className="relative min-h-[3rem] overflow-x-auto">
        {loading && !html ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: Math.max(code.split("\n").length, 3) }).map(
              (_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton
                  className="h-4 animate-pulse rounded bg-[oklch(0.22_0.015_260/0.6)]"
                  key={i}
                  style={{ width: `${55 + ((i * 17 + 31) % 40)}%` }}
                />
              )
            )}
          </div>
        ) : (
          <div
            className={`shiki-container transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}
            `}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki-sanitized HTML
            dangerouslySetInnerHTML={{ __html: html ?? "" }}
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
