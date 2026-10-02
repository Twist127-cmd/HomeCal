import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Firebase Admin SDK (server only). Optional in V1: the app talks to Firestore
 * from the browser, protected by security rules. Admin is reserved for future
 * server jobs (Google Calendar sync, scheduled reminders…).
 */
export function adminConfigured(): boolean {
  return !!(
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );
}

let app: App | undefined;

export function adminApp(): App {
  if (!adminConfigured()) throw new Error("NOT_CONFIGURED: Firebase Admin credentials missing");
  if (app) return app;
  app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
    });
  return app;
}

export function adminDb() {
  return getFirestore(adminApp());
}
