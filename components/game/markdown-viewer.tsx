import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  content: string;
}

/**
 * Renders user-authored markdown. Raw HTML is allowed but sanitized (GitHub schema) to block
 * scripts and other injected markup.
 */
export function MarkdownViewer({ content, className }: Props) {
  return (
    <div
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none",
        "prose-headings:font-semibold prose-code:before:content-none prose-code:after:content-none",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-sm",
        "prose-pre:border prose-pre:border-border prose-pre:bg-muted",
        className
      )}
    >
      {/* Step content is user-authored: allow raw HTML, then strip anything unsafe
          (scripts, iframes, styles, event handlers) with GitHub's schema. */}
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
