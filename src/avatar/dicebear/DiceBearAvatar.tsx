"use client";
import { memo, useId, useMemo, type CSSProperties } from "react";
import { useAvatarContext } from "../AvatarProvider";
import { normalizeVoxelAvatar } from "./dicebearConfig";
import { renderDiceBearSvg, isolateSvg } from "./dicebearRender";
import { composeVoxelAvatar } from "../VoxelContextEngine";
import { VoxelAccessories } from "../voxel/VoxelAccessories";
import { renderVoxelPet } from "../voxel/voxelPets";
import { isPet } from "../catalog";
import type { StoredAvatarConfig, AvatarContext, AnimationLevel } from "../types";

export const DiceBearAvatar = memo(function DiceBearAvatar({ config, profileId = "preview", avatarSeed, size = 100, context: override, intensity: level, decorative = true, label = "Avatar", stage = false, delay = 0, reaction }: { config?: StoredAvatarConfig; profileId?: string; avatarSeed?: string; size?: number; context?: AvatarContext; intensity?: AnimationLevel; decorative?: boolean; label?: string; stage?: boolean; delay?: number; view?: "front" | "profile"; reaction?: number }) {
  const shared = useAvatarContext(), context = override ?? shared.context;
  const identity = useMemo(() => normalizeVoxelAvatar(config, profileId, avatarSeed), [config, profileId, avatarSeed]);
  const presentation = useMemo(() => composeVoxelAvatar(identity, context, level ?? shared.intensity), [identity, context, level, shared.intensity]);
  const uid = useId().replace(/[^a-z\d_-]/gi, "");
  const pet = isPet(identity.type);
  const drawing = useMemo(() => {
    try { return { markup: isolateSvg(pet ? renderVoxelPet(identity) : renderDiceBearSvg(identity, !!presentation.headwear), uid), fallback: false }; }
    catch { return { markup: "", fallback: true }; }
  }, [identity, pet, presentation.headwear, uid]);
  const background = String(identity.options.backgroundColor ?? "#00000000");
  return <span className="avatar-renderer voxel-avatar" data-type={identity.type} data-engine={pet ? "homecal-voxel-pet" : "dicebear"} data-breed={pet ? identity.pet.breed : undefined} data-motion={presentation.animation} data-intensity={presentation.intensity} data-lighting={presentation.lighting} data-stage={stage} data-icon={size < 48} data-fallback={drawing.fallback || undefined} style={{ width: size, height: size, "--avatar-delay": -delay + "s", "--avatar-background": background, "--voxel-scale": identity.type === "baby" ? .82 : identity.type === "child" || pet ? .9 : 1 } as CSSProperties}>
    {drawing.fallback ? <svg viewBox="0 0 128 128" width="100%" height="100%" role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : label}><image href="/avatars/voxel/default.svg" width="128" height="128" /></svg> : <svg viewBox={stage ? "0 0 128 128" : "20 8 88 96"} width="100%" height="100%" role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : label} focusable="false">
      <g key={reaction ?? shared.celebration} className={(reaction ?? shared.celebration) && presentation.intensity !== "reduced" ? "voxel-jump" : undefined}><g className="voxel-age"><g className="avatar-body">
        <g className="voxel-identity" dangerouslySetInnerHTML={{ __html: drawing.markup }} />
        <VoxelAccessories presentation={presentation} color={String(identity.options.hatColor ?? "#5ba8a0")} pet={pet} />
      </g></g></g>
    </svg>}
  </span>;
});
