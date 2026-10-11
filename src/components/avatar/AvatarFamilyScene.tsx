"use client";
import { AvatarRenderer } from "@/avatar/AvatarRenderer";
import type { Profile } from "@/lib/types";
import { resolvePersons } from "@/lib/profiles";
import { useAvatarContext } from "@/avatar/AvatarProvider";
import { AvatarGreeting } from "./AvatarGreeting";
export function AvatarFamilyScene({ profiles, selected = null, ambient = false, size = 80 }: { profiles: Profile[]; selected?: string | null; ambient?: boolean; size?: number }) {
  const { visible, walking } = useAvatarContext();
  const ids = selected ? resolvePersons([selected], profiles) : null;
  const members = profiles.filter((p) => p.type === "PERSON" && (!ids || ids.has(p.id)));
  if (!visible || !members.length) return null;
  if (selected && members.length === 1) return <section aria-label="Avatar du calendrier sélectionné"><AvatarGreeting profiles={members} profileId={members[0].id} /><p className="text-center text-xs text-muted">{members[0].name}</p></section>;
  return <section className="avatar-family-scene" data-ambient={ambient} data-walking={walking && !ambient && size > 48} aria-label={selected ? "Avatar du calendrier sélectionné" : "Avatars de la famille"}>{members.map((p, i) => <figure key={p.id} className="avatar-family-member" style={{ "--family-delay": -i * 3.7 + "s" } as React.CSSProperties}><AvatarRenderer config={p.avatarConfig} profileId={p.id} avatarSeed={p.avatarSeed} size={ambient ? 92 : size} stage delay={i * 2.3} /><figcaption>{p.name}</figcaption></figure>)}</section>;
}
