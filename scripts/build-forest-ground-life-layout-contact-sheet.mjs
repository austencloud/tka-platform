#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const evidenceDirectory = resolve(tmpdir(), "tka-forest-evidence");
const metricsPath = resolve(
  evidenceDirectory,
  "forest_environment_ground_life_metrics.json"
);
const outputDirectory = resolve(evidenceDirectory, "ground-life-layout");
const output = resolve(outputDirectory, "forest_ground_life_gate7_board.png");

const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
const views = [
  {
    id: "hero",
    label: "Clearing view",
    caption:
      "Performance ground stays open while low habitat masses break the distant edge.",
  },
  {
    id: "reverse",
    label: "Reverse view",
    caption:
      "The opposite edge uses separated colonies instead of a continuous planted border.",
  },
  {
    id: "ecology-edge",
    label: "Sunlit hazel edge",
    caption:
      "Hazel ages occupy the bright back edge; sedges and ferns stop short of the foreground.",
  },
  {
    id: "ecology-hollow",
    label: "Damp willow hollow",
    caption:
      "Sedges follow the low contour, with small fungi held close to protected ground.",
  },
  {
    id: "ecology-root",
    label: "Root crossing",
    caption:
      "A branching root fan crosses the grade. Ferns and fungi stay on the sheltered sides.",
  },
  {
    id: "pathwalk",
    label: "Walking-height path",
    caption:
      "Foot traffic leaves broken shoulders and long bare intervals instead of an even verge.",
  },
];

const CARD_WIDTH = 900;
const CARD_HEIGHT = 650;
const IMAGE_WIDTH = 844;
const IMAGE_HEIGHT = 474;
const COLUMNS = 3;
const GAP = 28;
const MARGIN = 38;
const HEADER_HEIGHT = 126;

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

async function buildCard(view, index) {
  const source = resolve(
    evidenceDirectory,
    `forest_environment_qa_${view.id}.png`
  );
  const image = await sharp(source)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();
  const caption = wrapText(view.caption, 86).slice(0, 2);
  const accent = ["#82c99a", "#9fbd8c", "#c0b36f"][index % 3];
  const overlay = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="20" fill="#091310"/>
      <rect width="7" height="${CARD_HEIGHT}" rx="4" fill="${accent}"/>
      <text x="28" y="39" fill="#f4ead8" font-family="system-ui, sans-serif" font-size="25" font-weight="760">${index + 1}. ${escapeXml(view.label)}</text>
      <rect x="28" y="56" width="844" height="474" rx="12" fill="#06100d" stroke="#20382f"/>
      ${textLines(caption, 28, 563, 21, 'fill="#acbeb1" font-family="system-ui, sans-serif" font-size="15"')}
      <text x="28" y="625" fill="${accent}" font-family="ui-monospace, monospace" font-size="12">${escapeXml(view.id)}</text>
    </svg>
  `);
  return sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
      background: "#091310",
    },
  })
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: image, left: 28, top: 56 },
    ])
    .png()
    .toBuffer();
}

const rows = Math.ceil(views.length / COLUMNS);
const width = MARGIN * 2 + CARD_WIDTH * COLUMNS + GAP * (COLUMNS - 1);
const height = HEADER_HEIGHT + MARGIN + CARD_HEIGHT * rows + GAP * (rows - 1);
const header = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#050d0b"/>
    <text x="${MARGIN}" y="48" fill="#f4ead8" font-family="system-ui, sans-serif" font-size="34" font-weight="780">Forest Gate 7 · ground-life ecology</text>
    <text x="${MARGIN}" y="82" fill="#98ada0" font-family="ui-monospace, monospace" font-size="16">${metrics.patchCount} habitat patches · ${metrics.plantInstanceCount} plant groups · ${metrics.moduleInstanceCount} ground modules · 17 growth variants · no circular root island</text>
  </svg>
`);

const composites = [{ input: header, left: 0, top: 0 }];
for (const [index, view] of views.entries()) {
  composites.push({
    input: await buildCard(view, index),
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
  JSON.stringify({ output, width, height, views: views.length }, null, 2)
);
