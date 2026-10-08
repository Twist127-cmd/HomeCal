import "server-only";
import { AuthError, householdOf, requireUser } from "./firebaseAuth";

/**
 * Access control for the LLM proxy when it forwards to the remote Ollama tunnel.
 *
 *  1. The browser sends its Firebase ID token (Authorization: Bearer …), verified server-side.
 *  2. The user must be allowed: e-mail in HOMECAL_ALLOWED_EMAILS, or member of a household
 *     listed in HOMECAL_ALLOWED_HOUSEHOLDS. When neither list is set, any signed-in user who
 *     belongs to a household is accepted.
 */

const clean = (v?: string) => (v ?? "").replace(/^﻿/, "").trim();
const list = (v?: string) =>
  clean(v)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const tunnel = {
  url: () => clean(process.env.OLLAMA_TUNNEL_URL).replace(/\/$/, ""),
  token: () => clean(process.env.OLLAMA_TUNNEL_TOKEN),
  enabled: () => !!clean(process.env.OLLAMA_TUNNEL_URL) && !!clean(process.env.OLLAMA_TUNNEL_TOKEN),
};

/** Ollama target: the tunnel in production, the local server in development. */
export function ollamaTarget(): { base: string; headers: Record<string, string>; remote: boolean } {
  if (tunnel.enabled()) return { base: tunnel.url(), headers: { Authorization: `Bearer ${tunnel.token()}` }, remote: true };
  return { base: clean(process.env.OLLAMA_BASE_URL) || "http://localhost:11434", headers: {}, remote: false };
}

export { AuthError as AccessError };

export async function assertLLMAccess(authorization: string | null): Promise<void> {
  const user = await requireUser(authorization);
  const emails = list(process.env.HOMECAL_ALLOWED_EMAILS);
  if (user.email && emails.includes(user.email.toLowerCase())) return;

  const households = list(process.env.HOMECAL_ALLOWED_HOUSEHOLDS);
  const hid = await householdOf(user);
  if (!hid) throw new AuthError(403, "Aucun foyer associé à ce compte");
  if (households.length && !households.includes(hid.toLowerCase())) throw new AuthError(403, "Ce foyer n'est pas autorisé à utiliser l'assistant");
  if (!households.length && emails.length) throw new AuthError(403, "Compte non autorisé à utiliser l'assistant");
}
