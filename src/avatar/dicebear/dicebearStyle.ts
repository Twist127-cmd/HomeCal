import { Style, type StyleDefinition } from "@dicebear/core";
import definition from "@dicebear/styles/voxel-art.json";

// Keep every official path. Only group the two existing legs for HomeCal's gait.
const base = definition as unknown as StyleDefinition;
const elements = base.canvas.elements;
const adapted: StyleDefinition = { ...base, canvas: { ...base.canvas, elements: [
  elements[0],
  { type: "element", name: "g", attributes: { class: "avatar-leg avatar-leg-left" }, children: [...elements.slice(1, 7), ...elements.slice(13, 16)] },
  { type: "element", name: "g", attributes: { class: "avatar-leg avatar-leg-right" }, children: [...elements.slice(7, 13), ...elements.slice(16, 19)] },
  { ...elements[19], attributes: { class: "va-upper avatar-head" } },
] } };
export const VOXEL_STYLE = new Style(adapted);
