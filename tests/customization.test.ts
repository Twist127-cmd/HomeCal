import { describe, expect, it } from "vitest";
import { DESIGN_PRESETS } from "@/theme/presets";
import { contrast, presetTokens, rgb } from "@/theme/tokens";
import { extractPalette, FALLBACK_PALETTE, musicalTokens } from "@/theme/albumPalette";
import { LAYOUT_PRESETS, layoutPreset } from "@/layout/presets";
import { DEFAULT_HOME_LAYOUT, parseHomeLayout, WIDGET_REGISTRY } from "@/layout/widgetRegistry";
describe("independent styles and layouts", () => {
  it("provides all 19 unique visual presets and 5 complete layouts", () => {
    expect(DESIGN_PRESETS).toHaveLength(19); expect(new Set(DESIGN_PRESETS.map((p) => p.id)).size).toBe(19);
    expect(LAYOUT_PRESETS).toHaveLength(5);
    for (const p of LAYOUT_PRESETS) {
      const widgets = layoutPreset(p.id);
      expect(widgets).toHaveLength(12); expect(new Set(widgets.map((w) => w.id)).size).toBe(12);
      expect(parseHomeLayout(JSON.stringify({ version: 2, preset: p.id, widgets }))).toEqual(widgets);
      expect(widgets.some((w) => w.visible)).toBe(true);
      for (const w of widgets) expect(WIDGET_REGISTRY[w.id].sizes).toContain(w.size);
    }
  });
  it("migrates legacy layouts and repairs invalid widths and unsupported sizes", () => {
    const migrated = parseHomeLayout('[{"id":"music","visible":false,"size":"large"},{"id":"departure","width":99,"size":"large"}]');
    expect(migrated[0]).toMatchObject({ id: "music", visible: false, size: "large", width: 1 });
    expect(migrated[1]).toMatchObject({ width: 1, size: "standard" });
    expect(parseHomeLayout("null")).toEqual(DEFAULT_HOME_LAYOUT);
  });
  it("keeps normal and secondary text readable in every preset, dark mode and night mode", () => {
    for (const p of DESIGN_PRESETS) for (const dark of [false, true]) for (const night of [false, true]) {
      const t = presetTokens(p, dark, night);
      for (const foreground of ["--color-text", "--color-muted", "--color-accent"]) {
        expect(contrast(t[foreground], t["--color-surface"]), p.id + foreground).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrast(t["--color-text"], t["--color-bg"]), p.id).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["--color-on-accent"], t["--color-accent"]), p.id).toBeGreaterThanOrEqual(4.5);
    }
  });
});
describe("artwork palette and contrast", () => {
  const covers = ["#ffffff", "#000000", "#808080", "#ff0000", "#00ff00", "#0000ff", "#ff00ff"];
  it.each(covers)("extracts %s without compromising music text", (cover) => {
    const pixels = new Uint8ClampedArray(32 * 32 * 4);
    for (let i = 0; i < pixels.length; i += 4) pixels.set([...rgb(cover), 255], i);
    const palette = extractPalette(pixels); expect(palette.dominant).toBe(cover);
    for (const p of DESIGN_PRESETS) for (const strength of ["off", "subtle", "normal", "immersive"] as const) for (const immersive of [false, true]) {
      const t = musicalTokens(palette, p, strength, immersive);
      for (const foreground of ["--music-text", "--music-muted", "--music-accent"] as const) expect(contrast(t[foreground], t["--music-surface"]), p.id + cover).toBeGreaterThanOrEqual(4.5);
      expect(contrast(t["--color-on-accent"], t["--music-accent"])).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("falls back safely for empty or transparent artwork", () => {
    expect(extractPalette([])).toEqual(FALLBACK_PALETTE);
    expect(extractPalette(new Uint8ClampedArray(4096))).toEqual(FALLBACK_PALETTE);
  });
});
