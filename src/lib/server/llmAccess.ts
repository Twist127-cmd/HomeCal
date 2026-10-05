import "server-only";
import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Access control for the LLM proxy when it forwards to the remote Ollama tunnel.
 *
 *  1. The browser sends its Firebase ID token (Authorization: Bearer …).
 *  2. We verify the token signature (firebase-admin, no service account needed).
 *  3. The user must be allowed: e-mail in HOMECAL_ALLOWED_EMAILS, or member of a household
 *     listed in HOMECAL_ALLOWED_HOUSEHOLDS (read from Firestore with the user's own token,
 *     so the security rules apply). When neither list is set, any signed-in user who
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

function projectId() {
  return clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || clean(process.env.FIREBASE_ADMIN_PROJECT_ID);
}

function verifierApp(): App {
  return getApps().find((a) => a.name === "homecal-verify") ?? initializeApp({ projectId: projectId() }, "homecal-verify");
}

async function householdOf(uid: string, idToken: string): Promise<string | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/users/${encodeURIComponent(uid)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const doc = (await res.json()) as { fields?: { householdId?: { stringValue?: string } } };
  return doc.fields?.householdId?.stringValue ?? null;
}

export class AccessError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function assertLLMAccess(authorization: string | null): Promise<void> {
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) throw new AccessError(401, "Connexion requise");
  let decoded;
  try {
    decoded = await getAuth(verifierApp()).verifyIdToken(idToken);
  } catch {
    throw new AccessError(401, "Session invalide, reconnectez-vous");
  }
  const emails = list(process.env.HOMECAL_ALLOWED_EMAILS);
  if (decoded.email && emails.includes(decoded.email.toLowerCase())) return;

  const households = list(process.env.HOMECAL_ALLOWED_HOUSEHOLDS);
  const hid = await householdOf(decoded.uid, idToken);
  if (!hid) throw new AccessError(403, "Aucun foyer associé à ce compte");
  if (households.length && !households.includes(hid.toLowerCase())) throw new AccessError(403, "Ce foyer n'est pas autorisé à utiliser l'assistant");
  if (!households.length && emails.length) throw new AccessError(403, "Compte non autorisé à utiliser l'assistant");
}
