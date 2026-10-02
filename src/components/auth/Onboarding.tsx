"use client";

import { signOut } from "firebase/auth";
import { Check, Home, Users } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { Button, Field, inputClass, Spinner } from "@/components/ui/primitives";
import { createHousehold, joinHousehold } from "@/lib/data/household";
import { auth, firestore } from "@/lib/firebase/client";

export function Onboarding() {
  const { user } = useApp();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [householdName, setHouseholdName] = useState("Maison");
  const [myName, setMyName] = useState(user?.displayName?.split(" ")[0] ?? "");
  const [partnerName, setPartnerName] = useState("");
  const [home, setHome] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-full items-center justify-center p-6">
      <div className="w-full max-w-lg animate-slide-up">
        <h1 className="text-center text-3xl font-semibold tracking-tight">Bienvenue{myName ? `, ${myName}` : ""} 👋</h1>
        <p className="mt-2 mb-8 text-center text-muted">Créez votre foyer ou rejoignez celui de votre famille.</p>

        <div className="mb-5 grid grid-cols-2 gap-3">
          {(
            [
              ["create", Home, "Créer un foyer"],
              ["join", Users, "Rejoindre"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-sm font-medium transition ${
                tab === id ? "border-accent bg-accent-soft text-accent" : "border-border bg-surface"
              }`}
            >
              <Icon size={22} />
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-border bg-surface p-6 shadow-card">
          {tab === "create" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(() =>
                  createHousehold(firestore(), user.uid, user.email, {
                    householdName,
                    myName,
                    partnerName,
                    home: home ?? undefined,
                  }),
                );
              }}
            >
              <Field label="Nom du foyer">
                <input className={inputClass} value={householdName} onChange={(e) => setHouseholdName(e.target.value)} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Votre prénom">
                  <input className={inputClass} value={myName} onChange={(e) => setMyName(e.target.value)} required />
                </Field>
                <Field label="Prénom du/de la partenaire">
                  <input className={inputClass} value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="facultatif" />
                </Field>
              </div>
              <Field label="Adresse de la maison" hint="Pour la météo et les trajets. Modifiable plus tard.">
                <PlaceSearch onPick={(r) => setHome({ address: r.address, lat: r.lat, lng: r.lng })} />
              </Field>
              {home && (
                <p className="flex items-center gap-2 text-sm text-ok">
                  <Check size={16} /> {home.address}
                </p>
              )}
              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !myName.trim()}>
                {busy && <Spinner />} Créer le foyer
              </Button>
              <p className="text-center text-xs text-muted">
                Profils créés : {myName || "vous"}
                {partnerName ? `, ${partnerName}, Couple` : ""}, {householdName || "Maison"}.
              </p>
            </form>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(() => joinHousehold(firestore(), user.uid, user.email, code));
              }}
            >
              <Field label="Code d'invitation" hint="Le code se trouve dans Réglages → Foyer sur l'appareil de votre famille.">
                <input
                  className={`${inputClass} text-center font-mono text-2xl tracking-[0.4em] uppercase`}
                  value={code}
                  maxLength={6}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                />
              </Field>
              {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || code.length < 6}>
                {busy && <Spinner />} Rejoindre le foyer
              </Button>
            </form>
          )}
        </div>
        <button className="mt-6 w-full text-center text-sm text-muted hover:text-text" onClick={() => signOut(auth())}>
          Se déconnecter ({user.email})
        </button>
      </div>
    </main>
  );
}
