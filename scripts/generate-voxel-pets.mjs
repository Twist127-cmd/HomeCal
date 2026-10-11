/** HomeCal's own isometric SVG sprites. No CSS character construction or network assets. */
import { DOG_BREEDS, CAT_BREEDS } from "../src/avatar/catalog.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { Avatar, Style } from "@dicebear/core";
import definition from "@dicebear/styles/voxel-art.json" with { type: "json" };
const front = "#d9b576", eye = "#76804c";
const block = (x, y, w, h, d = 6, color = front) => `<g><path d="M${x} ${y}h${w}v${h}h-${w}Z" fill="${color}"/><path d="M${x} ${y}l${d} -${d * .8}h${w}l-${d} ${d * .8}Z" fill="${color}"/><path d="M${x} ${y}l${d} -${d * .8}h${w}l-${d} ${d * .8}Z" fill="#ffffff" fill-opacity=".3"/><path d="M${x + w} ${y}l${d} -${d * .8}v${h}l-${d} ${d * .8}Z" fill="${color}"/><path d="M${x + w} ${y}l${d} -${d * .8}v${h}l-${d} ${d * .8}Z" fill="#000000" fill-opacity=".24"/></g>`;
function sprite(b, cat) {
  const broad = b.silhouette === "broad", long = b.silhouette === "long";
  const hx = broad ? 24 : 30, hw = broad ? 64 : 56;
  const dark = "#433b36", pale = "#eee6d7";
  let tail = block(85, 98, b.tail === "fluffy" ? 12 : 7, 22, 6);
  if (b.tail === "curled") tail += block(90, 91, 14, 7, 5) + block(100, 88, 6, 14, 4);
  if (b.tail === "short") tail = block(85, 100, 9, 10, 4);
  const body = block(long ? 34 : 44, 96, long ? 55 : broad ? 41 : 32, 21, 10);
  let ears = "";
  for (const x of [hx, hx + hw - 12]) {
    if (["floppy", "long", "folded"].includes(b.ears)) ears += block(x - (x === hx ? 7 : -7), 40, 13, b.ears === "long" ? 45 : b.ears === "folded" ? 22 : 31, 6, b.markings === "points" ? dark : front);
    else ears += block(x, 30, 13, 18, 7, b.markings === "points" ? dark : front) + block(x + 3, b.ears === "large" ? 17 : 23, 7, 10, 5) + block(x + 3, 33, 6, 8, 2, "#c38e87");
    if (b.ears === "tufted") ears += block(x + 4, 17, 4, 8, 2);
  }
  let markings = "";
  if (["mask", "patches", "points"].includes(b.markings)) markings += block(hx, 43, hw * .35, 31, 0, b.markings === "patches" ? pale : dark) + block(hx + hw * .62, 43, hw * .35, 31, 0, dark);
  if (b.markings === "mask") markings += block(53, 41, 12, 35, 1, pale);
  if (["tabby", "saddle"].includes(b.markings)) for (const x of [42, 55, 68]) markings += block(x, 39, 5, 12, 0, dark);
  if (b.markings === "spots") for (const [x, y] of [[36, 45], [74, 47], [34, 66], [76, 68]]) markings += block(x, y, 5, 6, 0, dark);
  let texture = "";
  if (b.fur === "long" || b.fur === "curly") for (const x of [hx - 4, hx + hw - 4]) texture += block(x, 69, 8, 9, 4) + block(x + 2, 78, 8, 9, 3);
  const muzzle = block(cat ? 46 : b.muzzle === "wide" ? 43 : 48, 73, cat ? 30 : b.muzzle === "wide" ? 34 : 26, b.muzzle === "flat" ? 9 : b.muzzle === "long" ? 17 : 13, b.muzzle === "long" ? 11 : 5, b.markings === "mask" || b.markings === "points" ? pale : front);
  const eyes = [41, 69].map(x => block(x, 57, 10, 10, 0, "#f5f0e6") + block(x + 3, 59, 6, 8, 0, eye) + block(x + 5, 61, 3, 5, 0, "#191b1d") + block(x + 3, 59, 2, 2, 0, "#ffffff")).join("");
  const whiskers = cat ? '<path d="M40 79H25m15 4H26m51-4h17m-17 4h16" stroke="#f4eee4" stroke-width="1.6"/>' : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" fill="none"><path d="M30 125h60l12-9H42Z" fill="#000000" fill-opacity=".08"/><g class="avatar-tail">${tail}</g>${body}<g class="avatar-leg avatar-leg-left">${block(long ? 39 : 46, 115, 13, 10, 7)}</g><g class="avatar-leg avatar-leg-right">${block(long ? 72 : 66, 115, 13, 10, 7)}</g><g class="avatar-head">${block(hx, 38, hw, cat ? 49 : 53, 12)}${markings}${ears}${texture}${eyes}${muzzle}${block(56, 74, 11, 6, 3, cat ? "#bc7d81" : "#302f31")}<path d="M61 83v4m0 0h-5m5 0h5" stroke="#4b3b34" stroke-width="2"/>${whiskers}</g></svg>`;
}
await mkdir("public/avatars/voxel", { recursive: true });
const assets = {};
for (const [type, breeds] of [["dog", DOG_BREEDS], ["cat", CAT_BREEDS]]) for (const breed of breeds) {
  const svg = sprite(breed, type === "cat");
  assets[type + ":" + breed.id] = svg;
  await writeFile(`public/avatars/voxel/${type}-${breed.id}.svg`, svg.replaceAll(front, breed.color));
}
await mkdir("src/avatar/voxel", { recursive: true });
await writeFile("src/avatar/voxel/petAssets.json", JSON.stringify(assets));
await writeFile("public/avatars/voxel/default.svg", new Avatar(new Style(definition), { seed: "homecal-voxel-default", animationVariant: "none", topVariant: "short", outfitVariant: "plain", eyesVariant: "open", beardProbability: 0, glassesProbability: 0, backgroundColor: "#00000000" }).toString());
console.log(`Generated ${Object.keys(assets).length} HomeCal voxel pet sprites and fallback.`);
