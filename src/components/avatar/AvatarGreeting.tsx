"use client";

import { AvatarRenderer } from "@/avatar/AvatarRenderer";
import { useAvatarContext } from "@/avatar/AvatarProvider";
import { normalizeVoxelAvatar } from "@/avatar/dicebear/dicebearConfig";
import { composeVoxelAvatar } from "@/avatar/VoxelContextEngine";
import type { CSSProperties } from "react";
import type { Profile } from "@/lib/types";

export function AvatarGreeting({ profiles, profileId }: { profiles: Profile[]; profileId?: string }) {
  const { context, intensity, visible, walking } = useAvatarContext();
  const members = profiles.filter((p) => p.type === "PERSON");
  const profile = members.find((p) => p.id === profileId)
    ?? members.find((p) => p.avatarConfig)
    ?? members[0];
  if (!visible) return null;
  const config = normalizeVoxelAvatar(profile?.avatarConfig, profile?.id ?? "homecal", profile?.avatarSeed);
  const presentation = composeVoxelAvatar(config, context, intensity);

  return <div className="avatar-greeting" data-intensity={presentation.intensity} data-state={presentation.animation} data-walking={walking} style={{ "--walk-duration": presentation.intensity === "lively" ? "36s" : "54s" } as CSSProperties} aria-label={profile ? `Avatar de ${profile.name}` : "Avatar HomeCal"} role="img">
    <div className="avatar-greeting-walk"><div className="avatar-greeting-facing">
      <AvatarRenderer config={profile?.avatarConfig} profileId={profile?.id ?? "homecal"} avatarSeed={profile?.avatarSeed} size={84} stage />
    </div></div>
  </div>;
}
