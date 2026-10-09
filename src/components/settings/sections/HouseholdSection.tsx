"use client";

import { Copy, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Chip, Field, inputClass, Spinner } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toast";
import { createInvite, setMyProfile, updateHousehold } from "@/lib/data/household";
import { firestore } from "@/lib/firebase/client";
import { Section } from "../shared";

export function HouseholdSection() {
  const { household, householdId, profiles, myProfileId, user } = useApp();
  const db = firestore();
  if (!household || !householdId) return null;
  return (
    <Section title="Foyer">
      <Field label="Nom du foyer">
        <input
          className={inputClass}
          defaultValue={household.name}
          onBlur={(e) => e.target.value.trim() && e.target.value !== household.name && updateHousehold(db, householdId, { name: e.target.value.trim() })}
        />
      </Field>
      <Field label="Je suis" hint="Utilisé pour « moi » dans l'assistant et l'ajout rapide sur cet appareil/compte.">
        <div className="flex flex-wrap gap-2">
          {profiles
            .filter((p) => p.type === "PERSON")
            .map((p) => (
              <Chip key={p.id} active={myProfileId === p.id} color={p.color} onClick={() => user && setMyProfile(db, user.uid, p.id)}>
                <Avatar profile={p} size={22} /> {p.name}
              </Chip>
            ))}
        </div>
      </Field>
      <InviteBlock />
      <p className="text-xs text-muted">
        Identifiant du foyer : <span className="font-mono select-all">{householdId}</span>
      </p>
    </Section>
  );
}

function InviteBlock() {
  const { household, householdId, user } = useApp();
  const db = firestore();
  const [busy, setBusy] = useState(false);
  const code = household!.inviteCode;
  return (
    <Field label="Inviter un membre" hint={`${household!.memberUids.length} compte(s) dans ce foyer. Le code permet à un autre compte de rejoindre le foyer.`}>
      <div className="flex items-center gap-2">
        {code && <span className="rounded-2xl bg-surface-2 px-4 py-2.5 font-mono text-xl tracking-[0.3em]">{code}</span>}
        {code && (
          <Button variant="ghost" size="icon" onClick={() => navigator.clipboard?.writeText(code).then(() => toast({ text: "Code copié" }))}>
            <Copy size={18} />
          </Button>
        )}
        <Button
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await createInvite(db, householdId!, user!.uid);
            } catch (e) {
              toast({ text: (e as Error).message, tone: "error" });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Spinner /> : <RefreshCw size={16} />} {code ? "Nouveau code" : "Générer un code"}
        </Button>
      </div>
    </Field>
  );
}
