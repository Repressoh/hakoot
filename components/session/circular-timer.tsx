"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  stepStartedAt: string;
  timeLimitSeconds: number;
}

const CIRCLE_SIZE = 80;
const STROKE_WIDTH = 6;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CircularTimer({ timeLimitSeconds, stepStartedAt }: Props) {
  const startMs = new Date(stepStartedAt).getTime();

  const getRemaining = useCallback(() => {
    const elapsed = (Date.now() - startMs) / 1000;
    return Math.max(0, timeLimitSeconds - elapsed);
  }, [startMs, timeLimitSeconds]);

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getRemaining();
      setRemaining(r);
      if (r <= 0) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [getRemaining]);

  const fraction = remaining / timeLimitSeconds;
  // When expired, offset equals full circumference → circle appears "cut" (empty)
  const offset = CIRCUMFERENCE * (1 - fraction);
  const isUrgent = remaining <= timeLimitSeconds * 0.25;
  const displaySeconds = Math.ceil(remaining);
  const isExpired = displaySeconds <= 0;

  return (
    <div
      aria-label={isExpired ? "Time up" : `${displaySeconds} seconds remaining`}
      className="flex flex-col items-center gap-1"
      role="timer"
    >
      <svg
        aria-hidden="true"
        className="drop-shadow-sm"
        height={CIRCLE_SIZE}
        viewBox={`0 0 ${CIRCLE_SIZE} ${CIRCLE_SIZE}`}
        width={CIRCLE_SIZE}
      >
        <circle
          className="text-muted/60"
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
        />
        <circle
          className={cn(
            "transition-colors duration-300",
            isExpired && "text-muted/30",
            !isExpired && isUrgent && "text-destructive",
            !(isExpired || isUrgent) && "text-primary"
          )}
          cx={CIRCLE_SIZE / 2}
          cy={CIRCLE_SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke="currentColor"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={STROKE_WIDTH}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "center",
            transition: "stroke-dashoffset 100ms linear",
          }}
        />
        <text
          className={cn(
            "font-bold font-display",
            isExpired && "fill-muted-foreground",
            !isExpired && isUrgent && "fill-destructive",
            !(isExpired || isUrgent) && "fill-foreground"
          )}
          dominantBaseline="central"
          fontSize="22"
          textAnchor="middle"
          x={CIRCLE_SIZE / 2}
          y={CIRCLE_SIZE / 2}
        >
          {isExpired ? "0" : displaySeconds}
        </text>
      </svg>
    </div>
  );
}
