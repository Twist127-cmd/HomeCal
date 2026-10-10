"use client";

import clsx from "clsx";
import { Mic } from "lucide-react";
import { useVoice } from "./VoiceContext";

/**
 * Discreet hands-free feedback, above every screen (calendar, scenes, ambient mode):
 *  - "Écoute locale active" chip while waiting for the wake word
 *  - halo + "Je t'écoute…" + live transcript after "HomeCal"
 *  - the answer for a few seconds
 */
export function VoiceOverlay() {
  const v = useVoice();
  if (!v.enabled) return null;
  const active = v.state === "wakeword-detected" || v.state === "command-listening" || v.state === "processing" || v.state === "speaking";

  return (
    <>
      {/* privacy indicator */}
      {!active && (
        <div className="pointer-events-none fixed bottom-24 left-3 z-[90] md:bottom-28">
          <span
            className={clsx(
              "flex items-center gap-1.5 rounded-full bg-surface/85 px-2.5 py-1 text-[11px] font-medium shadow-card backdrop-blur",
              v.state === "error" ? "text-danger" : "text-muted",
            )}
            title="Le mot de réveil est détecté localement, aucun son n'est enregistré"
          >
            <span className={clsx("h-1.5 w-1.5 rounded-full", v.state === "wakeword-listening" ? "bg-ok" : v.state === "error" ? "bg-danger" : "bg-muted")} />
            {v.state === "error" ? "Micro indisponible" : v.engineStatus === "loading" ? "Chargement du mot de réveil…" : "Écoute locale active"}
          </span>
        </div>
      )}

      {/* listening / answer */}
      {(active || v.lastResult || v.notice) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[90] flex justify-center px-4">
          <div className="flex max-w-lg animate-slide-up items-center gap-3 glass-panel rounded-[1.5rem] py-3 pr-5 pl-3">
            <span
              className={clsx(
                "assistant-orb !h-12 !w-12",
                (v.state === "command-listening" || v.state === "wakeword-detected") && "animate-pulse-ring",
              )}
              data-state={v.state === "processing" ? "processing" : v.state === "speaking" ? "speaking" : active ? "listening" : "idle"}
            >
              <Mic size={20} />
            </span>
            <span className="min-w-0 text-[15px]">
              {v.state === "command-listening" || v.state === "wakeword-detected" ? (
                <span className="block truncate">{v.partial ? `« ${v.partial} »` : "Je t'écoute…"}</span>
              ) : v.state === "processing" ? (
                <span className="block truncate opacity-80">{v.partial ? `« ${v.partial} »` : "Un instant…"}</span>
              ) : (
                <span className="line-clamp-2">{v.lastResult ?? v.notice}</span>
              )}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
