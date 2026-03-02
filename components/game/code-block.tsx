import { createHighlighter } from "shiki";
import type { CodeBlock as CodeBlockType } from "@/lib/db/schema";
import { CodeBlockViewer } from "./code-block-viewer";

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

async function highlight(code: string, lang: string): Promise<string[]> {
  const safeLang = SUPPORTED_LANGS.includes(
    lang as (typeof SUPPORTED_LANGS)[number]
  )
    ? lang
    : "plaintext";

  const highlighter = await createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: [safeLang as (typeof SUPPORTED_LANGS)[number]],
  });

  const html = highlighter.codeToHtml(code, {
    lang: safeLang,
    themes: { light: "github-light", dark: "github-dark" },
  });

  // Extract just the line content spans from the generated HTML
  const lines = code.split("\n");
  const lineSpans: string[] = [];

  // Parse line by line spans from shiki output
  const lineRegex = /<span class="line">(.*?)<\/span>/g;
  let match: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard while loop pattern
  while ((match = lineRegex.exec(html)) !== null) {
    lineSpans.push(match[1]);
  }

  // Fallback: if we couldn't parse spans, return escaped plain text
  if (lineSpans.length !== lines.length) {
    return lines.map((l) =>
      l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    );
  }

  return lineSpans;
}

interface Props {
  codeBlock: CodeBlockType;
}

export async function CodeBlock({ codeBlock }: Props) {
  const highlightedLines = await highlight(
    codeBlock.code,
    codeBlock.language
  ).catch(() =>
    codeBlock.code
      .split("\n")
      .map((l) =>
        l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      )
  );

  return (
    <CodeBlockViewer
      codeBlock={codeBlock}
      highlightedLines={highlightedLines}
    />
  );
}
