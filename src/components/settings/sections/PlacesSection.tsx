"use client";

import { Home, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app/AppProvider";
import { PlaceSearch } from "@/components/places/PlaceSearch";
import { Button, Chip, Field, inputClass, Sheet } from "@/components/ui/primitives";
import { deletePlace, newId, savePlace, updateHousehold } from "@/lib/data/household";
import { firestore } from "@/lib/firebase/client";
import type { FavoritePlace } from "@/lib/types";
import { Section } from "../shared";

const PLACE_SUGGESTIONS = ["Maison", "Travail", "CrossFit", "Parents", "Gare", "École", "Supermarché"];
const PLACE_ICONS = ["🏠", "💼", "🏋️", "👪", "🚉", "🏫", "🛒", "🏥", "☕", "⭐"];

export function PlacesSection() {
  const { household, householdId, places } = useApp();
  const db = firestore();
  const [editPlace, setEditPlace] = useState<FavoritePlace | null>(null);
  if (!household || !householdId) return null;
  return (
    <>
      <Section
        title="Lieux favoris"
        action={
          <Button size="sm" onClick={() => setEditPlace({ id: newId(db, householdId, "places"), name: "", address: "", lat: NaN, lng: NaN, icon: "⭐", profileIds: [], order: places.length })}>
            <Plus size={16} /> Ajouter
          </Button>
        }
      >
        {places.length === 0 && <p className="text-sm text-muted">Ajoutez au moins « Maison » pour la météo et les trajets.</p>}
        <div className="divide-y divide-border">
          {places.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-3">
              <span className="text-2xl">{p.icon}</span>
              <button className="min-w-0 flex-1 text-left" onClick={() => setEditPlace(p)}>
                <span className="flex items-center gap-2 font-medium">
                  {p.name}
                  {household.homePlaceId === p.id && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Domicile</span>}
                </span>
                <span className="block truncate text-sm text-muted">{p.address}</span>
              </button>
              {household.homePlaceId !== p.id && (
                <Button variant="ghost" size="icon" title="Définir comme domicile" onClick={() => updateHousehold(db, householdId, { homePlaceId: p.id })}>
                  <Home size={18} />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {PLACE_SUGGESTIONS.filter((n) => !places.some((p) => p.name.toLowerCase().startsWith(n.toLowerCase()))).map((n, i) => (
            <Chip
              key={n}
              onClick={() =>
                setEditPlace({ id: newId(db, householdId, "places"), name: n, address: "", lat: NaN, lng: NaN, icon: PLACE_ICONS[i] ?? "⭐", profileIds: [], order: places.length })
              }
            >
              <Plus size={14} /> {n}
            </Chip>
          ))}
        </div>
      </Section>
      {editPlace && <PlaceEditor place={editPlace} onClose={() => setEditPlace(null)} />}
    </>
  );
}

function PlaceEditor({ place, onClose }: { place: FavoritePlace; onClose(): void }) {
  const { householdId, places, household } = useApp();
  const db = firestore();
  const [p, setP] = useState(place);
  const isNew = !places.some((x) => x.id === place.id);
  const valid = p.name.trim() && Number.isFinite(p.lat) && Number.isFinite(p.lng);

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? "Nouveau lieu favori" : "Modifier le lieu"}
      footer={
        <>
          {!isNew && (
            <Button
              variant="danger"
              onClick={async () => {
                await deletePlace(db, householdId!, p.id);
                if (household?.homePlaceId === p.id) await updateHousehold(db, householdId!, { homePlaceId: undefined });
                onClose();
              }}
            >
              <Trash2 size={18} /> Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Button
            variant="primary"
            disabled={!valid}
            onClick={async () => {
              await savePlace(db, householdId!, { ...p, name: p.name.trim() });
              if (!household?.homePlaceId && /maison|domicile|home/i.test(p.name)) await updateHousehold(db, householdId!, { homePlaceId: p.id });
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4 pb-2">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Nom">
            <input className={inputClass} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="ex. Travail Clément" />
          </Field>
          <Field label="Icône">
            <select className={`${inputClass} w-20 text-center text-xl`} value={p.icon} onChange={(e) => setP({ ...p, icon: e.target.value })}>
              {PLACE_ICONS.map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Adresse">
          <PlaceSearch initial={p.address} autoFocus={isNew && !!p.name} onPick={(r) => setP({ ...p, address: r.address, lat: r.lat, lng: r.lng })} />
        </Field>
        {Number.isFinite(p.lat) ? (
          <p className="text-xs text-muted">
            📍 {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
          </p>
        ) : (
          <p className="text-xs text-warn">Choisissez une adresse dans la liste.</p>
        )}
      </div>
    </Sheet>
  );
}
