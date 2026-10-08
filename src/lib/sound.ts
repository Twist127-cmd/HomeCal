"use client";

/** Small alarm sound with the Web Audio API (no audio file needed). */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx ??= new C();
  return ctx;
}

/** Browsers only allow sound after a user gesture: call once on the first tap. */
export function unlockAudio() {
  const a = audio();
  if (a && a.state === "suspended") a.resume().catch(() => {});
}

export function beep(times = 3) {
  const a = audio();
  if (!a) return;
  if (a.state === "suspended") a.resume().catch(() => {});
  const t0 = a.currentTime + 0.05;
  for (let i = 0; i < times; i++) {
    for (const [j, freq] of [880, 1175].entries()) {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      const start = t0 + i * 0.9 + j * 0.18;
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      o.connect(g).connect(a.destination);
      o.start(start);
      o.stop(start + 0.18);
    }
  }
}

export function vibrate(pattern: number | number[] = 12) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
}
