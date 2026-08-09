#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const contractPath = resolve("scripts/forest-ground-life-ecology.json");
const evidenceDirectory = resolve(
  tmpdir(),
  "tka-forest-evidence",
  "ground-life-ecology"
);
const metricsPath = resolve(
  evidenceDirectory,
  "forest_ground_life_ecology_metrics.json"
);
const output = resolve(
  evidenceDirectory,
  "forest_ground_life_ecology_board.png"
);

const [contract, metrics] = await Promise.all([
  readFile(contractPath, "utf8").then(JSON.parse),
  readFile(metricsPath, "utf8").then(JSON.parse),
]);

const CARD_WIDTH = 900;
const CARD_HEIGHT = 690;
const IMAGE_WIDTH = 844;
const IMAGE_HEIGHT = 500;
const COLUMNS = 3;
const GAP = 28;
const MARGIN = 38;
const HEADER_HEIGHT = 124;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value, width) {
  const words = String(value).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function textLines(lines, x, y, lineHeight, attributes) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" ${attributes}>${escapeXml(line)}</text>`
    )
    .join("\n");
}

function variantLabel(metric) {
  return Object.keys(metric.variantCounts)
    .map((value) => value.replaceAll("-", " "))
    .join(" · ");
}

function moduleLabel(metric) {
  return Object.entries(metric.groundModules)
    .filter(([, count]) => count > 0)
    .map(([name]) => name.replaceAll("-", " "))
    .join(" · ");
}

async function buildCard(habitat, metric, index) {
  const image = await sharp(metric.render)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();
  const premise = wrapText(habitat.premise, 84);
  const variants = wrapText(variantLabel(metric), 112).slice(0, 2);
  const modules = wrapText(moduleLabel(metric), 112).slice(0, 2);
  const accent = [
    "#82c99a",
    "#8db69d",
    "#b29a6b",
    "#b8c778",
    "#9eb789",
    "#c6b27d",
  ][index % 6];
  const textSvg = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="20" fill="#0a1512"/>
      <rect width="7" height="${CARD_HEIGHT}" rx="4" fill="${accent}"/>
      <text x="28" y="39" fill="#f4ead8" font-family="system-ui, sans-serif" font-size="25" font-weight="760">${index + 1}. ${escapeXml(habitat.label)}</text>
      ${textLines(premise, 28, 69, 20, 'fill="#aebfb4" font-family="system-ui, sans-serif" font-size="15"')}
      <rect x="28" y="112" width="844" height="500" rx="12" fill="#07100e" stroke="#1e352d"/>
      <rect x="28" y="620" width="844" height="1" fill="#1c3029"/>
      ${textLines(variants, 28, 646, 17, 'fill="#d4e1d8" font-family="ui-monospace, monospace" font-size="12"')}
      ${textLines(modules, 28, 674, 17, 'fill="#80988a" font-family="ui-monospace, monospace" font-size="12"')}
      <text x="872" y="674" text-anchor="end" fill="${accent}" font-family="ui-monospace, monospace" font-size="12">${Math.round(habitat.negativeSpaceFraction * 100)}% open ground</text>
    </svg>
  `);
  return sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
      background: "#0a1512",
    },
  })
    .composite([
      { input: textSvg, left: 0, top: 0 },
      { input: image, left: 28, top: 112 },
    ])
    .png()
    .toBuffer();
}

const rows = Math.ceil(contract.habitats.length / COLUMNS);
const width = MARGIN * 2 + CARD_WIDTH * COLUMNS + GAP * (COLUMNS - 1);
const height = HEADER_HEIGHT + MARGIN + CARD_HEIGHT * rows + GAP * (rows - 1);
const header = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#050d0b"/>
    <text x="${MARGIN}" y="48" fill="#f4ead8" font-family="system-ui, sans-serif" font-size="34" font-weight="780">Forest Gate 6 · ecology vignettes</text>
    <text x="${MARGIN}" y="82" fill="#98ada0" font-family="ui-monospace, monospace" font-size="16">habitat cause → patch grammar → family variants · six 8 × 8 m studies · no full root island · no whole-forest placement</text>
  </svg>
`);

const composites = [{ input: header, left: 0, top: 0 }];
for (const [index, habitat] of contract.habitats.entries()) {
  const metric = metrics.habitats.find((entry) => entry.id === habitat.id);
  if (!metric) throw new Error(`Ecology metrics missing for ${habitat.id}`);
  const card = await buildCard(habitat, metric, index);
  composites.push({
    input: card,
    left: MARGIN + (index % COLUMNS) * (CARD_WIDTH + GAP),
    top: HEADER_HEIGHT + Math.floor(index / COLUMNS) * (CARD_HEIGHT + GAP),
  });
}

await mkdir(dirname(output), { recursive: true });
await sharp({
  create: { width, height, channels: 4, background: "#050d0b" },
})
  .composite(composites)
  .png()
  .toFile(output);

console.log(
  JSON.stringify(
    {
      contractVersion: contract.version,
      output,
      width,
      height,
      habitats: contract.habitats.length,
    },
    null,
    2
  )
);
