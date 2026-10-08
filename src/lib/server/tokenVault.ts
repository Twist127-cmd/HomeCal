import "server-only";
import { base64url, CompactEncrypt, compactDecrypt, jwtVerify, SignJWT } from "jose";

/**
 * Server-side encryption of third-party refresh tokens (Spotify…).
 * The browser only ever stores the encrypted blob (in the user's own Firestore doc);
 * only the server, holding HOMECAL_TOKEN_KEY, can read it. The blob is bound to the
 * Firebase uid so it cannot be replayed by another account.
 */

const clean = (v?: string) => (v ?? "").replace(/^﻿/, "").trim();

function key(): Uint8Array {
  const raw = clean(process.env.HOMECAL_TOKEN_KEY);
  if (!raw) throw new Error("NOT_CONFIGURED: HOMECAL_TOKEN_KEY manquant");
  const bytes = base64url.decode(raw.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  if (bytes.length !== 32) throw new Error("HOMECAL_TOKEN_KEY doit faire 32 octets (base64)");
  return bytes;
}

export function vaultConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export interface SealedPayload {
  uid: string;
  provider: string;
  refreshToken: string;
}

export async function seal(payload: SealedPayload): Promise<string> {
  return new CompactEncrypt(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(key());
}

export async function unseal(cipher: string, expected: { uid: string; provider: string }): Promise<SealedPayload> {
  const { plaintext } = await compactDecrypt(cipher, key());
  const p = JSON.parse(new TextDecoder().decode(plaintext)) as SealedPayload;
  if (p.uid !== expected.uid || p.provider !== expected.provider) throw new Error("token owner mismatch");
  return p;
}

/** Short-lived signed OAuth `state` (CSRF protection + carries the uid through the redirect). */
export async function signState(uid: string, provider: string): Promise<string> {
  return new SignJWT({ provider })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(uid)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key());
}

export async function verifyState(state: string, provider: string): Promise<string> {
  const { payload } = await jwtVerify(state, key(), { algorithms: ["HS256"] });
  if (payload.provider !== provider || !payload.sub) throw new Error("invalid state");
  return payload.sub;
}
