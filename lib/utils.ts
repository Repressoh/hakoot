import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse a line range string like "5, 10-12" into an array of line numbers */
export function parseLineRange(input: string): number[] {
  const lines: number[] = [];
  const parts = input.split(",").map((s) => s.trim());
  for (const part of parts) {
    if (part.includes("-")) {
      const [start, end] = part.split("-").map(Number);
      if (!(Number.isNaN(start) || Number.isNaN(end))) {
        for (let i = start; i <= end; i++) {
          lines.push(i);
        }
      }
    } else {
      const n = Number(part);
      if (!Number.isNaN(n)) {
        lines.push(n);
      }
    }
  }
  return [...new Set(lines)].sort((a, b) => a - b);
}

/** Format line numbers array back to a display string */
export function formatLineNumbers(lines: number[]): string {
  if (lines.length === 0) {
    return "";
  }
  const sorted = [...lines].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    if (i === sorted.length || sorted[i] !== prev + 1) {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      if (i < sorted.length) {
        start = sorted[i];
        prev = sorted[i];
      }
    } else {
      prev = sorted[i];
    }
  }
  return ranges.join(", ");
}
