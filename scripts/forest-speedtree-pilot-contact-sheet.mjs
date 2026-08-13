#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const manifest = JSON.parse(
  await readFile(resolve("scripts/forest-speedtree-pilot.json"), "utf8")
);
const evidence = resolve(manifest.evidenceDirectory);
const panelSize = 620;
const headerHeight = 132;
const labelHeight = 54;
const columns = 2;
const rows = 3;
const width = panelSize * columns;
const height = headerHeight + rows * (panelSize + labelHeight);
const panels = [
  ["Meshy · neutral", "speedtree-pilot-meshy-neutral.png"],
  ["SpeedTree · neutral", "speedtree-pilot-speedtree-neutral.png"],
  ["Meshy · human height", "speedtree-pilot-meshy-human-height.png"],
  ["SpeedTree · human height", "speedtree-pilot-speedtree-human-height.png"],
  ["Meshy · trunk / root", "speedtree-pilot-meshy-trunk.png"],
  ["SpeedTree · trunk / root", "speedtree-pilot-speedtree-trunk.png"],
];
const images = await Promise.all(
  panels.map(([, file]) =>
    sharp(resolve(evidence, file))
      .resize(panelSize, panelSize, { fit: "cover" })
      .png()
      .toBuffer()
  )
);
const labels = panels
  .map(([label], index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * panelSize + panelSize / 2;
    const y = headerHeight + row * (panelSize + labelHeight) + panelSize + 35;
    return `<text x="${x}" y="${y}" text-anchor="middle" fill="#dbe6de" font-family="system-ui, sans-serif" font-size="24">${label}</text>`;
  })
  .join("\n");
const overlay = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#0e1716"/>
    <text x="36" y="50" fill="#f3ead7" font-family="system-ui, sans-serif" font-size="34" font-weight="700">Forest oak authoring proof</text>
    <text x="36" y="88" fill="#9cb4a5" font-family="system-ui, sans-serif" font-size="20">Matched 16 m height · matched cameras · 34,151 vs 36,760 triangles</text>
    <text x="36" y="116" fill="#708b7c" font-family="system-ui, sans-serif" font-size="17">Left: one Meshy material · Right: semantic bark, cut wood, and two foliage surfaces</text>
    ${labels}
  </svg>
`);
await sharp({ create: { width, height, channels: 4, background: "#0e1716" } })
  .composite([
    { input: overlay, left: 0, top: 0 },
    ...images.map((input, index) => ({
      input,
      left: (index % columns) * panelSize,
      top:
        headerHeight + Math.floor(index / columns) * (panelSize + labelHeight),
    })),
  ])
  .png()
  .toFile(resolve(evidence, "speedtree-pilot-contact-sheet.png"));

console.log(resolve(evidence, "speedtree-pilot-contact-sheet.png"));
