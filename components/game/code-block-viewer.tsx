"use client";

import { useCallback, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import type { CodeBlock } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

interface AnnotatedLine {
  explanation: string;
  label: string;
}

interface ParsedLine {
  annotation: AnnotatedLine | null;
  content: string;
  lineNumber: number;
}

function parseCodeLines(codeBlock: CodeBlock): ParsedLine[] {
  const lines = codeBlock.code.split("\n");
  const annotationMap = new Map<number, AnnotatedLine>();

  for (const annotation of codeBlock.annotations) {
    for (const line of annotation.lines) {
      annotationMap.set(line, {
        label: annotation.label,
        explanation: annotation.explanation,
      });
    }
  }

  return lines.map((content, idx) => ({
    lineNumber: idx + 1,
    content,
    annotation: annotationMap.get(idx + 1) ?? null,
  }));
}

interface CodeLineProps {
  htmlLine: string;
  isMobile: boolean;
  line: ParsedLine;
  onAnnotationClick: (annotation: AnnotatedLine) => void;
}

function CodeLine({
  line,
  htmlLine,
  onAnnotationClick,
  isMobile,
}: CodeLineProps) {
  const hasAnnotation = !!line.annotation;

  if (!hasAnnotation) {
    return (
      <div className="group flex min-h-[1.5em]">
        <span
          aria-hidden="true"
          className="w-10 shrink-0 select-none pr-4 text-right text-muted-foreground/50 text-xs leading-[1.5em]"
        >
          {line.lineNumber}
        </span>
        <span
          className="flex-1 font-mono text-sm leading-[1.5em]"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki-sanitized HTML
          dangerouslySetInnerHTML={{ __html: htmlLine || "&nbsp;" }}
        />
      </div>
    );
  }

  const annotation = line.annotation;

  const lineContent = (
    <button
      aria-label={`Line ${line.lineNumber}: ${annotation?.label}. Press Enter or Space to view explanation.`}
      className={cn(
        "group flex min-h-[1.5em] w-full cursor-pointer rounded-sm text-left",
        "bg-amber-50 dark:bg-amber-950/30",
        "hover:bg-amber-100 dark:hover:bg-amber-900/40",
        "transition-colors",
        "border-amber-400 border-l-2 dark:border-amber-500"
      )}
      onClick={() => annotation && onAnnotationClick(annotation)}
      type="button"
    >
      <span
        aria-hidden="true"
        className="w-10 shrink-0 select-none pr-4 text-right text-amber-600/70 text-xs leading-[1.5em] dark:text-amber-400/70"
      >
        {line.lineNumber}
      </span>
      <span
        className="flex-1 font-mono text-sm leading-[1.5em]"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Shiki-sanitized HTML
        dangerouslySetInnerHTML={{ __html: htmlLine || "&nbsp;" }}
      />
      <span className="shrink-0 self-center pr-2 text-amber-500 text-xs opacity-70 group-hover:opacity-100">
        ●
      </span>
    </button>
  );

  if (isMobile) {
    return lineContent;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{lineContent}</PopoverTrigger>
      <PopoverContent
        className="w-72 max-w-xs"
        onOpenAutoFocus={(e) => e.preventDefault()}
        side="right"
      >
        <p className="mb-1 font-semibold text-amber-600 text-xs dark:text-amber-400">
          {line.annotation?.label}
        </p>
        <p className="text-foreground text-sm leading-relaxed">
          {line.annotation?.explanation}
        </p>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  codeBlock: CodeBlock;
  highlightedLines: string[];
}

export function CodeBlockViewer({ codeBlock, highlightedLines }: Props) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [activeAnnotation, setActiveAnnotation] =
    useState<AnnotatedLine | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const parsedLines = parseCodeLines(codeBlock);

  const handleAnnotationClick = useCallback(
    (annotation: AnnotatedLine) => {
      if (isMobile) {
        setActiveAnnotation(annotation);
        setSheetOpen(true);
      }
    },
    [isMobile]
  );

  return (
    <>
      <section
        aria-label={`${codeBlock.language} code block with ${codeBlock.annotations.length} annotations`}
        className="overflow-hidden rounded-lg border border-border bg-muted/30"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-border border-b bg-muted/50 px-4 py-2">
          <span className="font-mono text-muted-foreground text-xs">
            {codeBlock.language}
          </span>
          {codeBlock.annotations.length > 0 && (
            <span className="text-amber-600 text-xs dark:text-amber-400">
              {codeBlock.annotations.length} annotation
              {codeBlock.annotations.length !== 1 ? "s" : ""} — tap highlighted
              lines
            </span>
          )}
        </div>

        {/* Code */}
        <div className="space-y-0.5 overflow-x-auto p-3">
          {parsedLines.map((line, i) => (
            <CodeLine
              htmlLine={highlightedLines[i] ?? line.content}
              isMobile={isMobile}
              key={line.lineNumber}
              line={line}
              onAnnotationClick={handleAnnotationClick}
            />
          ))}
        </div>
      </section>

      {/* Mobile bottom sheet for annotations */}
      <Sheet onOpenChange={setSheetOpen} open={sheetOpen}>
        <SheetContent className="pb-safe" side="bottom">
          <SheetHeader className="text-left">
            <SheetTitle className="text-amber-600 text-base dark:text-amber-400">
              {activeAnnotation?.label}
            </SheetTitle>
          </SheetHeader>
          <p className="mt-3 text-foreground text-sm leading-relaxed">
            {activeAnnotation?.explanation}
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
