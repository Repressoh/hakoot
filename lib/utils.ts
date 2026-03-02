import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Generate a random alphanumeric invite code of given length */
export function generateInviteCode(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
}

/** Generate a cryptographically random token */
export function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compute Kahoot-style score: basePoints * (timeRemaining / timeLimit), min 0 */
export function computeScore(
  isCorrect: boolean,
  timeLimitSeconds: number | null,
  answeredAtMs: number,
  stepStartedAtMs: number,
  basePoints = 1000
): number {
  if (!isCorrect) {
    return 0;
  }
  if (!timeLimitSeconds) {
    return basePoints;
  }

  const elapsed = (answeredAtMs - stepStartedAtMs) / 1000;
  const timeRemaining = Math.max(0, timeLimitSeconds - elapsed);
  const ratio = timeRemaining / timeLimitSeconds;
  // Minimum 50% of base points for a correct answer
  return Math.round(basePoints * (0.5 + 0.5 * ratio));
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
