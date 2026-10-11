import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { DiceBearAvatar } from "@/avatar/dicebear/DiceBearAvatar";
import { defaultVoxelAvatar } from "@/avatar/dicebear/dicebearConfig";
vi.mock("@/avatar/dicebear/dicebearRender", () => ({ renderDiceBearSvg: () => { throw new Error("generator unavailable"); }, isolateSvg: (value: string) => value }));
it("keeps a local voxel fallback and accessible label when generation fails", () => {
  const markup = renderToStaticMarkup(createElement(DiceBearAvatar, { config: defaultVoxelAvatar(), decorative: false, label: "Avatar d’Emma" }));
  expect(markup).toContain('data-fallback="true"');
  expect(markup).toContain('/avatars/voxel/default.svg');
  expect(markup).toContain('aria-label="Avatar d’Emma"');
});
