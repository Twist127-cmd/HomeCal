"use client";
import { AvatarRenderer } from "@/avatar/AvatarRenderer";
import { Avatar } from "@/components/ui/primitives";
import type { Profile } from "@/lib/types";
import { resolvePersons } from "@/lib/profiles";
import { useAvatarContext } from "@/avatar/AvatarProvider";
export function AvatarFamilyScene({ profiles, selected = null, ambient = false, size = 80 }: { profiles: Profile[]; selected?: string | null; ambient?: boolean; size?: number }) {
  const { visible } = useAvatarContext();
  const ids = selected ? resolvePersons([selected], profiles) : null;
  const members = profiles.filter((p) => p.type === "PERSON" && (!ids || ids.has(p.id)));
  if (!visible || !members.length) return null;
  return <section className="avatar-family-scene" data-ambient={ambient} aria-label={selected ? "Avatar du calendrier sélectionné" : "Avatars de la famille"}>{members.map((p, i) => <figure key={p.id} className="avatar-family-member" style={{ "--family-delay": -i * 3.7 + "s" } as React.CSSProperties}>{p.avatarConfig ? <AvatarRenderer config={p.avatarConfig} size={ambient ? 92 : size} stage delay={i * 2.3} /> : <Avatar profile={p} size={ambient ? 64 : Math.min(size, 48)} />}<figcaption>{p.name}</figcaption></figure>)}</section>;
}
