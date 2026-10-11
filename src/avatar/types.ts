export type AvatarType = "adult" | "teen" | "child" | "baby" | "dog" | "cat";
export type AnimationLevel = "reduced" | "normal" | "lively";
export interface AvatarConfig {
  version: 1; type: AvatarType;
  base: { skinTone: string; faceShape: string; bodyType: string };
  face: { cheeks: string; ears: string; eyes: string; eyeColor: string; iris: string; brows: string; nose: string; mouth: string; beard: string };
  hair: { style: string; color: string; length: string; volume: string; texture: string };
  outfit: { base: string; color: string };
  accessories: string[];
  pet: { breed: string; size: string; silhouette: string; ears: string; muzzle: string; fur: string; color: string; markings: string; eyeColor: string; tail: string };
  background: string;
}
export interface AvatarContext {
  theme: string; scene: string; dayPeriod: "morning" | "day" | "evening" | "night";
  season: "spring" | "summer" | "autumn" | "winter"; specialDate: string;
  musicPlaying: boolean; cooking: boolean; departureSoon: boolean; eventSoon: boolean;
}
export interface AvatarPresentation { outfit: string; accessories: string[]; animation: "idle" | "dance" | "attention" | "sleep"; lighting: string }
