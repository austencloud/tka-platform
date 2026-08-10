#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const manifest = JSON.parse(
  await readFile(resolve("scripts/forest-tree-regeneration.json"), "utf8")
);
const evidence = resolve(manifest.evidenceDirectory);
const panels = [
  ["Neutral front", "forest-tree-regeneration-final-front.png"],
  ["Human-height 3/4", "forest-tree-regeneration-final-human-height-three-quarter.png"],
  ["Trunk and root flare", "forest-tree-regeneration-final-trunk.png"],
];
const panelSize = 720;
const headerHeight = 104;
const footerHeight = 54;
const width = panelSize * panels.length;
const height = headerHeight + panelSize + footerHeight;
const images = await Promise.all(
  panels.map(([, file]) =>
    sharp(resolve(evidence, file)).resize(panelSize, panelSize, { fit: "cover" }).png().toBuffer()
  )
);
const labels = panels
  .map(
    ([label], index) =>
      `<text x="${index * panelSize + panelSize / 2}" y="${height - 19}" text-anchor="middle" fill="#c7d3ca" font-family="system-ui, sans-serif" font-size="23">${label}</text>`
  )
  .join("\n");
const overlay = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#101b1a"/>
    <text x="42" y="48" fill="#f1eadc" font-family="system-ui, sans-serif" font-size="33" font-weight="700">Forest tree regeneration · Meshy 6 R1</text>
    <text x="42" y="79" fill="#8fa99a" font-family="ui-monospace, monospace" font-size="18">16.0 m review height · 62,227 triangles · calibrated nonmetallic PBR</text>
    ${labels}
  </svg>
`);
await sharp({
  create: { width, height, channels: 4, background: "#101b1a" },
})
  .composite([
    { input: overlay, left: 0, top: 0 },
    ...images.map((input, index) => ({ input, left: index * panelSize, top: headerHeight })),
  ])
  .png()
  .toFile(resolve(evidence, "forest-tree-regeneration-contact-sheet.png"));

console.log(resolve(evidence, "forest-tree-regeneration-contact-sheet.png"));
