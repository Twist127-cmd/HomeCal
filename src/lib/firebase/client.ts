"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

/** Strip BOM / whitespace that some shells add when setting env vars. */
const clean = (v: string | undefined) => v?.replace(/^﻿/, "").trim() || undefined;

// NEXT_PUBLIC_* must be referenced literally to be inlined at build time
const config = {
  apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
};

export const firebaseConfigured = !!(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export function firebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error("Firebase n'est pas configuré (variables NEXT_PUBLIC_FIREBASE_*)");
  if (!app) app = getApps().length ? getApp() : initializeApp(config);
  return app;
}

export function auth(): Auth {
  return getAuth(firebaseApp());
}

/** Firestore with offline persistence (IndexedDB) so the kiosk keeps working without network. */
export function firestore(): Firestore {
  if (db) return db;
  const a = firebaseApp();
  try {
    db = initializeFirestore(a, {
      ignoreUndefinedProperties: true,
      localCache:
        typeof window !== "undefined" && "indexedDB" in window
          ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
          : memoryLocalCache(),
    });
  } catch {
    // already initialised (hot reload)
    db = getFirestore(a);
  }
  return db;
}
