import { parseQuickAdd } from "@/lib/quickadd";
import { call, type DomainModule } from "../router/types";
import { reminderResponse } from "../responses/reminders";

/** Reminders: reminder.create / cancel / list */
export const reminderModule: DomainModule = {
  domain: "reminders",

  parse(u, ctx) {
    const n = u.norm;
    if (/\b(annule|supprime|enleve|efface)\b.*\brappels?\b/.test(n)) return { intent: "reminder.cancel", confidence: 0.92, entities: {}, raw: u.raw };
    if (/\b(quels? sont mes|mes|liste des?|lis mes|j'ai des?)\s+rappels?\b/.test(n)) return { intent: "reminder.list", confidence: 0.92, entities: {}, raw: u.raw };

    // "rappelle-moi d'appeler maman à 18h", "rappelle-moi demain à 9h de prendre le dossier"
    const m = /\b(?:rappelle[- ]moi|fais[- ]moi penser|pense a me rappeler)\s+(.+)$/i.exec(u.text.replace(/rappelle[- ]?moi/i, "rappelle-moi"));
    if (!m || /\bdans\s+\d/.test(n)) return null; // "dans 20 minutes" = timer
    const rest = m[1];
    const q = parseQuickAdd(rest, { now: ctx.now });
    if (!q.hasExplicitTime && !q.hasExplicitDate) return null;
    const text = q.title.replace(/^(de |d'|d’)/i, "").trim();
    if (!text) return null;
    return {
      intent: "reminder.create",
      confidence: q.hasExplicitTime ? 0.93 : 0.8,
      entities: { text: text.charAt(0).toUpperCase() + text.slice(1), at: q.hasExplicitTime ? q.start.toISOString() : null, dateOnly: !q.hasExplicitTime, day: q.start.toISOString() },
      raw: u.raw,
    };
  },

  async run(p, env) {
    const e = p.entities as { text?: string; at?: string | null; day?: string };
    if (p.intent === "reminder.cancel") {
      const a = await call(env, "cancelReminder", { latest: true });
      return { text: reminderResponse(p.intent, a.result), actions: [a], changed: !!a.result.changed };
    }
    if (p.intent === "reminder.list") {
      const a = await call(env, "listReminders", {});
      return { text: reminderResponse(p.intent, a.result), actions: [a], changed: false };
    }
    if (!e.at) {
      return { text: `À quelle heure pour « ${e.text} » ?`, actions: [], changed: false, pending: { domain: "reminders", kind: "time", data: { text: e.text, day: e.day } } };
    }
    const local = new Date(e.at);
    const iso = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}T${String(local.getHours()).padStart(2, "0")}:${String(local.getMinutes()).padStart(2, "0")}`;
    const a = await call(env, "createReminder", { text: e.text, at: iso }, "Je crée le rappel…");
    return { text: reminderResponse(p.intent, a.result), actions: [a], changed: !!a.result.changed };
  },

  async resume(pending, u, env) {
    if (pending.kind !== "time") return null;
    const q = parseQuickAdd(u.text, { now: env.ctx.now });
    if (!q.hasExplicitTime) return null;
    const day = new Date(String(pending.data.day));
    day.setHours(q.start.getHours(), q.start.getMinutes(), 0, 0);
    return this.run({ intent: "reminder.create", confidence: 1, entities: { text: pending.data.text, at: day.toISOString() }, raw: u.raw }, env);
  },
};
