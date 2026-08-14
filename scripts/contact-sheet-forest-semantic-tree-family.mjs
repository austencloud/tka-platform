#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const sourceArgument = process.argv.find((argument) => argument.startsWith("--source="));
const source = sourceArgument?.split("=")[1] ?? "preview";
if (!new Set(["preview", "raw", "semantic"]).has(source)) throw new Error("--source must be preview, raw, or semantic.");
const manifest = JSON.parse(await readFile(resolve("scripts/forest-semantic-tree-family.json"), "utf8"));
const evidence = resolve(manifest.evidenceDirectory);
const views = source === "preview" ? ["front", "three-quarter", "silhouette"] : ["front", "three-quarter", "silhouette", "human-height", "close"];
const labels = { front: "Front", "three-quarter": "Three-quarter", silhouette: "Silhouette", "human-height": "Human height", close: "Bark / root close" };
const panel = source === "preview" ? 560 : 420;
const leftRail = 190;
const header = 96;
const width = leftRail + panel * views.length;
const height = header + panel * manifest.candidates.length;
const composites = [];
for (let row = 0; row < manifest.candidates.length; row += 1) {
  const candidate = manifest.candidates[row];
  for (let column = 0; column < views.length; column += 1) {
    const image = await sharp(resolve(evidence, `${candidate.species}-${source}-${views[column]}.png`))
      .resize(panel, panel, { fit: "cover" })
      .png()
      .toBuffer();
    composites.push({ input: image, left: leftRail + column * panel, top: header + row * panel });
  }
}
const viewLabels = views.map((view, index) => `<text x="${leftRail + index * panel + panel / 2}" y="70" text-anchor="middle" fill="#c9d6cc" font-family="system-ui, sans-serif" font-size="22">${labels[view]}</text>`).join("\n");
const speciesLabels = manifest.candidates.map((candidate, index) => `<text x="${leftRail / 2}" y="${header + index * panel + panel / 2}" text-anchor="middle" fill="#f3eadc" font-family="system-ui, sans-serif" font-size="25" font-weight="700" transform="rotate(-90 ${leftRail / 2} ${header + index * panel + panel / 2})">${candidate.label}</text>`).join("\n");
const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#101817"/><text x="28" y="38" fill="#f3eadc" font-family="system-ui, sans-serif" font-size="30" font-weight="700">Semantic summer tree family · ${source}</text>${viewLabels}${speciesLabels}</svg>`);
await sharp({ create: { width, height, channels: 4, background: "#101817" } })
  .composite([{ input: overlay, left: 0, top: 0 }, ...composites])
  .png()
  .toFile(resolve(evidence, `${source}-contact-sheet.png`));
console.log(resolve(evidence, `${source}-contact-sheet.png`));
