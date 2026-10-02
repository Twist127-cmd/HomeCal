// Generates PWA PNG icons from public/icons/icon.svg (run: npm run icons)
import { readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

await sharp(svg).resize(192, 192).png().toFile(out("icon-192.png"));
await sharp(svg).resize(512, 512).png().toFile(out("icon-512.png"));
await sharp(svg).resize(180, 180).png().toFile(out("apple-touch-icon.png"));
// maskable: icon at 80% on a full-bleed background (safe zone)
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#6366f1" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("icon-maskable-512.png"));
console.log("icons generated");
