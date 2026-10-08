import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";

/**
 * Firebase ID token verification without firebase-admin (which fails to load on Vercel):
 * signature checked against Google's public keys, plus issuer / audience / expiry.
 */

const clean = (v?: string) => (v ?? "").replace(/^﻿/, "").trim();

export function firebaseProjectId(): string {
  return clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || clean(process.env.FIREBASE_ADMIN_PROJECT_ID);
}

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

export interface VerifiedUser {
  uid: string;
  email?: string;
  idToken: string;
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function verifyIdToken(idToken: string): Promise<VerifiedUser> {
  const pid = firebaseProjectId();
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${pid}`,
    audience: pid,
    algorithms: ["RS256"],
  });
  if (!payload.sub) throw new Error("no subject");
  return { uid: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined, idToken };
}

/** Read `Authorization: Bearer <Firebase ID token>` and verify it. */
export async function requireUser(authorization: string | null): Promise<VerifiedUser> {
  const idToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!idToken) throw new AuthError(401, "Connexion requise");
  try {
    return await verifyIdToken(idToken);
  } catch {
    throw new AuthError(401, "Session invalide, reconnectez-vous");
  }
}

/** Household id of a user, read from Firestore with the user's own token (security rules apply). */
export async function householdOf(user: VerifiedUser): Promise<string | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId()}/databases/(default)/documents/users/${encodeURIComponent(user.uid)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${user.idToken}` }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;
  const doc = (await res.json()) as { fields?: { householdId?: { stringValue?: string } } };
  return doc.fields?.householdId?.stringValue ?? null;
}
