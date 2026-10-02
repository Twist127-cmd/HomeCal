"use client";

import { useEffect, useState } from "react";

/** true after `timeoutSec` without pointer/keyboard activity. 0 disables. */
export function useIdle(timeoutSec: number): [boolean, () => void] {
  const [idle, setIdle] = useState(false);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    if (!timeoutSec) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), timeoutSec * 1000);
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [timeoutSec, bump]);

  return [idle, () => setBump((b) => b + 1)];
}
