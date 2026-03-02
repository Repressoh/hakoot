"use client";

import { animate, useMotionValue } from "motion/react";
import { useEffect, useState } from "react";

interface Props {
  className?: string;
  duration?: number;
  value: number;
}

export function AnimatedCounter({ value, className, duration = 0.6 }: Props) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const unsubscribe = motionValue.on("change", (v) => {
      setDisplay(Math.round(v).toLocaleString());
    });
    return unsubscribe;
  }, [motionValue]);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.25, 0.1, 0.25, 1],
    });
    return controls.stop;
  }, [motionValue, value, duration]);

  return <span className={className}>{display}</span>;
}
