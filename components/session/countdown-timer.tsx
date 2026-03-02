"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  stepStartedAt: string;
  timeLimitSeconds: number;
}

export function CountdownTimer({ timeLimitSeconds, stepStartedAt }: Props) {
  const t = useTranslations("play");
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

  const pct = (remaining / timeLimitSeconds) * 100;
  const isUrgent = remaining <= timeLimitSeconds * 0.25;
  const displaySeconds = Math.ceil(remaining);

  return (
    <div
      aria-label={`${displaySeconds} seconds remaining`}
      className="space-y-1"
      role="timer"
    >
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Time</span>
        <span
          className={cn(
            "font-bold font-mono tabular-nums",
            isUrgent ? "text-red-500" : "text-foreground"
          )}
        >
          {displaySeconds <= 0
            ? t("timeUp")
            : t("timerLeft", { seconds: displaySeconds })}
        </span>
      </div>
      <Progress
        aria-hidden="true"
        className={cn("h-2", isUrgent && "[&>div]:bg-red-500")}
        value={pct}
      />
    </div>
  );
}
