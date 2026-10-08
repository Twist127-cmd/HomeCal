/** Feature flags (build-time). A disabled feature keeps its code but is hidden. Default: enabled. */
const flag = (v: string | undefined, fallback = true) => (v === undefined || v === "" ? fallback : v.trim() === "true");

export const features = {
  spotify: flag(process.env.NEXT_PUBLIC_SPOTIFY_ENABLED),
  timers: flag(process.env.NEXT_PUBLIC_TIMERS_ENABLED),
  shopping: flag(process.env.NEXT_PUBLIC_SHOPPING_ENABLED),
  scenes: flag(process.env.NEXT_PUBLIC_SCENES_ENABLED),
};
