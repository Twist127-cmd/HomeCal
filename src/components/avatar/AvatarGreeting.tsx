"use client";

import { AvatarRenderer } from "@/avatar/AvatarRenderer";
import { useAvatarContext } from "@/avatar/AvatarProvider";
import type { Profile } from "@/lib/types";

export function AvatarGreeting({ profiles }: { profiles: Profile[] }) {
  const { intensity } = useAvatarContext();
  const profile = profiles.find((p) => p.type === "PERSON" && p.avatarConfig);
  if (!profile?.avatarConfig) return null;

  return <div className="avatar-greeting" data-intensity={intensity} aria-label={`Avatar de ${profile.name}`} role="img">
    <div className="avatar-greeting-walk"><div className="avatar-greeting-facing">
      <AvatarRenderer config={profile.avatarConfig} size={84} stage />
    </div></div>
  </div>;
}
