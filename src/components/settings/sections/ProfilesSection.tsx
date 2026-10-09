"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Chip, Field, inputClass, Sheet } from "@/components/ui/primitives";
import { deleteProfile, newId, saveProfile } from "@/lib/data/household";
import { firestore } from "@/lib/firebase/client";
import { PROFILE_COLORS, type Profile, type ProfileType } from "@/lib/types";
import { Section } from "../shared";

const TYPE_LABEL: Record<ProfileType, string> = { PERSON: "Personne", COUPLE: "Couple", GROUP: "Groupe", HOUSEHOLD: "Foyer" };

export function ProfilesSection() {
  const { householdId, profiles } = useApp();
  const db = firestore();
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  if (!householdId) return null;
  return (
    <>
      <Section
        title="Profils"
        action={
          <Button
            size="sm"
            onClick={() =>
              setEditProfile({
                id: newId(db, householdId, "profiles"),
                name: "",
                color: PROFILE_COLORS[profiles.length % PROFILE_COLORS.length],
                avatar: "",
                type: "PERSON",
                memberIds: [],
                order: profiles.length,
              })
            }
          >
            <Plus size={16} /> Ajouter
          </Button>
        }
      >
        <div className="divide-y divide-border">
          {profiles.map((p) => (
            <button key={p.id} onClick={() => setEditProfile(p)} className="flex w-full items-center gap-3 py-3 text-left">
              <Avatar profile={p} size={36} />
              <span className="flex-1">
                <span className="block font-medium">{p.name}</span>
                <span className="text-sm text-muted">
                  {TYPE_LABEL[p.type]}
                  {p.memberIds.length > 0 && ` · ${p.memberIds.map((id) => profiles.find((x) => x.id === id)?.name).filter(Boolean).join(" + ")}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Section>
      {editProfile && <ProfileEditor profile={editProfile} onClose={() => setEditProfile(null)} />}
    </>
  );
}

function ProfileEditor({ profile, onClose }: { profile: Profile; onClose(): void }) {
  const { householdId, profiles, events } = useApp();
  const db = firestore();
  const [p, setP] = useState(profile);
  const isNew = !profiles.some((x) => x.id === profile.id);
  const persons = profiles.filter((x) => x.type === "PERSON" && x.id !== p.id);
  const used = events.some((e) => e.profileIds.includes(p.id));

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Nouveau profil" : "Modifier le profil"}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              onClick={async () => {
                if (used && !confirm("Ce profil est utilisé par des événements. Supprimer quand même ?")) return;
                await deleteProfile(db, householdId!, p.id);
                onClose();
              }}
            >
              <Trash2 size={18} /> Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="primary"
            disabled={!p.name.trim()}
            onClick={async () => {
              await saveProfile(db, householdId!, { ...p, name: p.name.trim(), avatar: p.avatar.trim() || p.name.trim().slice(0, 2).toUpperCase() });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="flex justify-center">
          <Avatar profile={{ ...p, avatar: p.avatar || p.name.slice(0, 2).toUpperCase() }} size={72} />
        </div>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <Field label="Nom">
            <input className={inputClass} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} autoFocus={isNew} />
          </Field>
          <Field label="Avatar">
            <input className={`${inputClass} text-center`} value={p.avatar} maxLength={4} placeholder="CL / 😀" onChange={(e) => setP({ ...p, avatar: e.target.value })} />
          </Field>
        </div>
        <Field label="Couleur">
          <div className="flex flex-wrap gap-2">
            {PROFILE_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setP({ ...p, color: c })}
                className={`h-10 w-10 rounded-full transition ${p.color === c ? "scale-110 ring-2 ring-text ring-offset-2 ring-offset-surface" : ""}`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
        <Field label="Type">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TYPE_LABEL) as ProfileType[]).map((t) => (
              <Chip key={t} active={p.type === t} onClick={() => setP({ ...p, type: t, memberIds: t === "COUPLE" || t === "GROUP" ? p.memberIds : [] })}>
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
        </Field>
        {(p.type === "COUPLE" || p.type === "GROUP") && (
          <Field label="Membres">
            <div className="flex flex-wrap gap-2">
              {persons.map((x) => (
                <Chip
                  key={x.id}
                  active={p.memberIds.includes(x.id)}
                  color={x.color}
                  onClick={() => setP({ ...p, memberIds: p.memberIds.includes(x.id) ? p.memberIds.filter((m) => m !== x.id) : [...p.memberIds, x.id] })}
                >
                  <Avatar profile={x} size={22} /> {x.name}
                </Chip>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Sheet>
  );
}
