"use client";

import { AvatarRenderer } from "@/avatar/AvatarRenderer";
import { useAvatarContext } from "@/avatar/AvatarProvider";
import { defaultAvatar } from "@/avatar/config";
import { composeAvatar } from "@/avatar/AvatarContextEngine";
import type { Profile } from "@/lib/types";

const fallbackAvatar = defaultAvatar("adult");

export function AvatarGreeting({ profiles, profileId }: { profiles: Profile[]; profileId?: string }) {
  const { context, intensity, visible, walking } = useAvatarContext();
  const members = profiles.filter((p) => p.type === "PERSON");
  const profile = members.find((p) => p.id === profileId)
    ?? members.find((p) => p.avatarConfig)
    ?? members[0];
  if (!visible) return null;
  const config = profile?.avatarConfig ?? fallbackAvatar;
  const strolling = walking && intensity !== "reduced" && composeAvatar(config, context, intensity).animation === "idle";

  return <div className="avatar-greeting" data-intensity={intensity} data-walking={strolling} aria-label={profile ? `Avatar de ${profile.name}` : "Avatar HomeCal"} role="img">
    <div className="avatar-greeting-walk"><div className="avatar-greeting-facing">
      <div className="avatar-greeting-front"><AvatarRenderer config={config} size={84} stage /></div>
      <div className="avatar-greeting-profile"><AvatarRenderer config={config} size={84} stage view="profile" /></div>
    </div></div>
  </div>;
}
