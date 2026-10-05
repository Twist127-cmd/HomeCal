"use client";

import clsx from "clsx";
import { CornerDownLeft, Mic, Plus, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { AvatarStack, Button } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { fmtRelativeDay, fmtTime } from "@/lib/dates";
import { parseQuickAdd } from "@/lib/quickadd";
import { describeRecurrence } from "@/lib/recurrence";
import type { NewEvent } from "@/lib/types";

export function QuickAdd({
  now,
  onOpenEditor,
  onAskAssistant,
  onMic,
  compact,
}: {
  now: Date;
  onOpenEditor(draft: Partial<NewEvent>): void;
  onAskAssistant(text: string): void;
  onMic(): void;
  compact?: boolean;
}) {
  const { profiles, places, myProfileId, calendar, user } = useApp();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  const parsed = useMemo(
    () => (text.trim().length > 1 ? parseQuickAdd(text, { now, profiles, places, currentProfileId: myProfileId }) : null),
    [text, now, profiles, places, myProfileId],
  );
  const understood = !!parsed && (parsed.hasExplicitDate || parsed.hasExplicitTime);
  // questions or long sentences go to the assistant
  const looksLikeQuestion = /\?\s*$|^(quand|qu'est|quel|quelle|est-ce|ai-je|avons|combien|où|ou est|déplace|supprime|annule|décale|trouve)/i.test(text.trim());

  const toDraft = (): Partial<NewEvent> | null =>
    parsed
      ? {
          title: parsed.title,
          start: parsed.start.toISOString(),
          end: parsed.end.toISOString(),
          allDay: parsed.allDay,
          profileIds: parsed.profileIds,
          type: parsed.type,
          location: parsed.location,
          recurrence: parsed.recurrence,
          reminders: parsed.allDay ? [] : [30],
          source: "quickadd",
        }
      : null;

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    if (looksLikeQuestion || !understood) {
      onAskAssistant(t);
      setText("");
      return;
    }
    // no time given: let the assistant ask "À quelle heure ?" (unless "toute la journée")
    if (parsed!.allDay && !/journ[ée]e/i.test(t)) {
      onAskAssistant(`Ajoute ${t}`);
      setText("");
      return;
    }
    const draft = toDraft()!;
    if (!calendar) return;
    setText("");
    try {
      const created = await calendar.createEvent({ ...(draft as NewEvent), createdBy: user?.uid });
      toast({
        text: `« ${created.title} » ajouté ${fmtRelativeDay(parsed!.start, now).toLowerCase()}${parsed!.allDay ? "" : ` à ${fmtTime(parsed!.start)}`}`,
        tone: "success",
        action: { label: "Annuler", run: () => calendar.deleteEvent(created.id) },
      });
    } catch (e) {
      toast({ text: (e as Error).message, tone: "error" });
    }
  };

  return (
    <div className="relative w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={clsx(
          "flex items-center gap-1 rounded-full border bg-surface pr-1.5 pl-4 shadow-card transition",
          focused ? "border-accent" : "border-border",
          compact ? "h-12" : "h-14",
        )}
      >
        <Plus size={20} className="shrink-0 text-muted" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Ajouter quelque chose…"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-[16px] outline-none placeholder:text-muted"
          enterKeyHint="done"
          aria-label="Ajouter quelque chose"
        />
        {text && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            title="Plus d'options"
            onClick={() => {
              onOpenEditor(toDraft() ?? { title: text });
              setText("");
            }}
          >
            <SlidersHorizontal size={18} />
          </Button>
        )}
        {text ? (
          <Button type="submit" variant="primary" size="icon" title={understood && !looksLikeQuestion ? "Ajouter" : "Demander à l'assistant"}>
            {understood && !looksLikeQuestion ? <CornerDownLeft size={18} /> : <Sparkles size={18} />}
          </Button>
        ) : (
          <Button type="button" variant="soft" size="icon" onClick={onMic} title="Parler à l'assistant" aria-label="Parler à l'assistant">
            <Mic size={20} />
          </Button>
        )}
      </form>

      {focused && parsed && text.trim().length > 2 && (
        <div className="absolute inset-x-2 top-full z-30 mt-2 animate-fade-in rounded-2xl border border-border bg-surface p-3 text-sm shadow-pop">
          {understood && !looksLikeQuestion ? (
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{parsed.title}</div>
                <div className="text-muted">
                  {fmtRelativeDay(parsed.start, now)}
                  {parsed.allDay ? " · toute la journée" : ` · ${fmtTime(parsed.start)} – ${fmtTime(parsed.end)}`}
                  {parsed.location && ` · ${parsed.location.label}`}
                  {parsed.recurrence && ` · ${describeRecurrence(parsed.recurrence).toLowerCase()}`}
                </div>
              </div>
              <AvatarStack profiles={profiles} ids={parsed.profileIds} />
              <span className="hidden text-xs text-muted sm:inline">Entrée ↵</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted">
              <Sparkles size={16} className="text-accent" /> Entrée pour demander à l&apos;assistant
            </div>
          )}
        </div>
      )}
    </div>
  );
}
