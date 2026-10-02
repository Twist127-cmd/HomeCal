"use client";

import clsx from "clsx";
import { AlertTriangle, MapPin, Repeat } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { AvatarStack } from "@/components/ui/primitives";
import { fmtTime } from "@/lib/dates";
import { profileColor } from "@/lib/profiles";
import { EVENT_TYPES, type Occurrence } from "@/lib/types";

export function eventColor(o: Occurrence, profiles: ReturnType<typeof useApp>["profiles"]): string {
  return profileColor(o.event.profileIds, profiles);
}

/** Event block inside the time grid. */
export function EventBlock({
  occ,
  top,
  height,
  left,
  width,
  conflict,
  now,
  onClick,
}: {
  occ: Occurrence;
  top: number;
  height: number;
  left: string;
  width: string;
  conflict?: boolean;
  now: Date;
  onClick(): void;
}) {
  const { profiles } = useApp();
  const color = eventColor(occ, profiles);
  const compact = height < 44;
  const past = occ.end < now;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={clsx(
        "absolute overflow-hidden rounded-xl border-l-4 px-2 text-left transition hover:brightness-[0.97] active:scale-[0.98]",
        compact ? "py-0.5" : "py-1.5",
        past && "opacity-55",
      )}
      style={{
        top,
        height: Math.max(height - 2, 18),
        left,
        width,
        borderLeftColor: color,
        backgroundColor: `color-mix(in srgb, ${color} 16%, var(--color-surface))`,
      }}
    >
      <div className={clsx("flex items-center gap-1 font-semibold leading-tight", compact ? "text-[11px]" : "text-[13px]")}>
        {conflict && <AlertTriangle size={12} className="shrink-0 text-warn" />}
        {occ.event.recurrence && <Repeat size={11} className="shrink-0 opacity-60" />}
        <span className="truncate">{occ.event.title}</span>
        {compact && <span className="ml-auto shrink-0 font-normal opacity-70">{fmtTime(occ.start)}</span>}
      </div>
      {!compact && (
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] opacity-75">
          <span className="tabular">
            {fmtTime(occ.start)} – {fmtTime(occ.end)}
          </span>
          {occ.event.location && height > 64 && (
            <span className="flex min-w-0 items-center gap-0.5 truncate">
              <MapPin size={10} />
              {occ.event.location.label}
            </span>
          )}
        </div>
      )}
      {height > 80 && (
        <div className="absolute right-1.5 bottom-1.5">
          <AvatarStack profiles={profiles} ids={occ.event.profileIds} size={18} />
        </div>
      )}
    </button>
  );
}

/** Compact pill used in month view, all-day row and agenda. */
export function EventPill({ occ, onClick, conflict }: { occ: Occurrence; onClick(): void; conflict?: boolean }) {
  const { profiles } = useApp();
  const color = eventColor(occ, profiles);
  const emoji = EVENT_TYPES.find((t) => t.id === occ.event.type)?.emoji;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left text-[12px] leading-tight hover:bg-surface-2"
      style={occ.event.allDay ? { backgroundColor: `color-mix(in srgb, ${color} 18%, var(--color-surface))` } : undefined}
    >
      {!occ.event.allDay && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      {conflict && <AlertTriangle size={11} className="shrink-0 text-warn" />}
      {!occ.event.allDay && <span className="tabular shrink-0 text-muted">{fmtTime(occ.start)}</span>}
      <span className="truncate font-medium">
        {occ.event.allDay && emoji ? `${emoji} ` : ""}
        {occ.event.title}
      </span>
    </button>
  );
}
