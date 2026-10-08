import { startOfDay } from "date-fns";
import { parseQuickAdd } from "@/lib/quickadd";
import { parseDuration } from "@/lib/timers";
import { localIso } from "../executor";
import { call, type DomainModule, type ParsedIntent, type RunEnv } from "../router/types";
import { reminderResponse } from "../responses/reminders";

/**
 * Reminders: reminder.create / cancel / list.
 *  - "Rappelle-moi d'appeler maman à 18h", "Préviens-moi à 17h de sortir le chien"
 *  - "Rappelle-moi demain de prendre le dossier" → asks "À quelle heure ?" (pending)
 *  - relative delays ("dans 20 minutes") are timers, "30 minutes avant" needs an event → LLM.
 */

// trigger words (on u.norm, canonical verbs)
const TRIGGER = String.raw`(?:rappelle[- ]?moi|rappelle[- ]?nous|previens[- ]?moi|previens[- ]?nous|fais[- ]?moi penser|fais[- ]?nous penser|pense a me rappel(?:er|le)|n'oublie pas de me rappel(?:er|le)|faut que tu me rappelles|(?:me|nous) rappel(?:er|le|les)|alerte[- ]?moi|fais[- ]?moi un rappel|mets[- ]?moi un rappel|mets un rappel|cree un rappel|ajoute un rappel|programme un rappel|un rappel)`;
const TRIGGER_RE = new RegExp(String.raw`\b${TRIGGER}\b`, "i");

const CANCEL_RE = /\b(annule|supprime|enleve|efface|retire|oublie|vire)\b.*\brappels?\b|\brappels?\b.*\b(annule|supprime)\b/;
const LIST_RE = /\b(quels? sont mes rappels|quels? rappels|mes rappels|liste (des |de mes |les )?rappels|lis[- ]?moi mes rappels|j'ai (des|quels) rappels|rappels (prevus|en cours|a venir)|montre (mes |les )?rappels|affiche (mes |les )?rappels)\b/;

/** Remove the trigger from the cleaned text (accents kept) and return what follows / precedes it. */
function splitOnTrigger(text: string): string | null {
  const plain = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’]/g, "'");
  const m = TRIGGER_RE.exec(plain);
  if (!m) return null;
  const before = text.slice(0, m.index).trim();
  const after = text.slice(m.index + m[0].length).trim();
  return `${before} ${after}`.trim();
}

function cleanText(s: string): string {
  let t = s.trim().replace(/[?.!,;]+$/, "").trim();
  t = t.replace(/^(?:de |d'|d’|qu'il faut |que je dois |que je |a |à |pour |le |la |de la )/i, "").trim();
  t = t.replace(/^(?:de |d'|d’)/i, "").trim();
  t = t.replace(/\s+(?:stp|svp|merci)$/i, "").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

export function parseReminder(u: { raw: string; text: string; norm: string }, now: Date): ParsedIntent | null {
  const n = u.norm;
  if (CANCEL_RE.test(n)) {
    const m = /\brappels?\s+(?:de |d'|du |des |pour |sur |concernant )?(.+)$/i.exec(u.text);
    const q = m ? cleanText(m[1]) : "";
    const generic = !q || /^(mon|le|ce|dernier|derniere|que je viens de|en cours)$/i.test(q) || /^(mon|le) (dernier|rappel)/i.test(q);
    return { intent: "reminder.cancel", confidence: 0.96, destructive: false, entities: { text: generic ? undefined : q }, raw: u.raw };
  }
  if (LIST_RE.test(n) && !TRIGGER_RE.test(n.replace(/\bun rappel\b/, ""))) return { intent: "reminder.list", confidence: 0.99, entities: {}, raw: u.raw };

  if (!TRIGGER_RE.test(n)) return null;
  // relative delays are timers ("rappelle-moi dans 20 minutes de…")
  if (/\bdans\b/.test(n) && parseDuration(n)) return null;
  // "30 minutes avant", "une heure avant le rendez-vous" needs an event → LLM
  if (/\b(avant|apres)\b/.test(n) && parseDuration(n)) return null;

  const rest = splitOnTrigger(u.text);
  if (rest === null) return null;
  // leading preposition left by the trigger ("à acheter du pain à 19h", "d'appeler maman")
  const body = rest.replace(/^(?:de\s+|d['’]\s*|à\s+|a\s+|pour\s+|qu'il faut\s+|que je\s+)/i, "");
  const q = parseQuickAdd(body, { now });
  const text = cleanText(q.title === "Nouvel événement" ? "" : q.title);
  if (!text) return null;
  const at = q.hasExplicitTime ? q.start : null;
  return {
    intent: "reminder.create",
    confidence: at ? 0.95 : 0.88,
    entities: { text, at: at ? at.toISOString() : null, day: (q.hasExplicitDate ? startOfDay(q.start) : startOfDay(now)).toISOString() },
    raw: u.raw,
  };
}

async function create(env: RunEnv, text: string, at: Date) {
  const a = await call(env, "createReminder", { text, at: localIso(at) }, "Je crée le rappel…");
  return { text: reminderResponse("reminder.create", a.result, { text, at, now: env.ctx.now }), actions: [a], changed: !!a.result.changed };
}

export const reminderModule: DomainModule = {
  domain: "reminders",

  parse(u, ctx) {
    return parseReminder(u, ctx.now);
  },

  async run(p, env) {
    const e = p.entities as { text?: string; at?: string | null; day?: string };
    if (p.intent === "reminder.cancel") {
      const a = await call(env, "cancelReminder", e.text ? { text: e.text } : { latest: true });
      const choices = (a.result.data as { choices?: string[] } | undefined)?.choices;
      return {
        text: reminderResponse(p.intent, a.result),
        actions: [a],
        changed: !!a.result.changed,
        pending: !a.result.ok && choices?.length ? { domain: "reminders", kind: "cancelChoice", data: { choices } } : undefined,
      };
    }
    if (p.intent === "reminder.list") {
      const a = await call(env, "listReminders", {});
      return { text: reminderResponse(p.intent, a.result), actions: [a], changed: false };
    }
    if (!e.at) {
      return {
        text: `À quelle heure pour « ${e.text} » ?`,
        actions: [],
        changed: false,
        pending: { domain: "reminders", kind: "time", data: { text: e.text, day: e.day } },
      };
    }
    return create(env, String(e.text), new Date(e.at));
  },

  async resume(pending, u, env) {
    if (/^(non|annule|laisse tomber|oublie|stop|rien|pas maintenant)\b/.test(u.norm)) return { text: "D'accord, pas de rappel.", actions: [], changed: false };
    if (pending.kind === "cancelChoice") {
      const choices = (pending.data.choices as string[]) ?? [];
      const pick = choices.find((c) => u.norm.includes(c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")));
      if (!pick) return null;
      const a = await call(env, "cancelReminder", { text: pick });
      return { text: reminderResponse("reminder.cancel", a.result), actions: [a], changed: !!a.result.changed };
    }
    if (pending.kind !== "time") return null;
    const q = parseQuickAdd(u.text, { now: env.ctx.now });
    if (!q.hasExplicitTime) return null;
    const day = q.hasExplicitDate ? new Date(q.start) : new Date(String(pending.data.day));
    day.setHours(q.start.getHours(), q.start.getMinutes(), 0, 0);
    // a time already passed today → tomorrow
    if (!q.hasExplicitDate && day <= env.ctx.now) day.setDate(day.getDate() + 1);
    return create(env, String(pending.data.text), day);
  },
};
