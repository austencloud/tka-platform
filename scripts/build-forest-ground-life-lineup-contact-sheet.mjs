#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const manifestPath = resolve("scripts/forest-ground-life-lineup.json");
const evidenceDirectory = resolve(
  tmpdir(),
  "tka-forest-evidence",
  "ground-life-lineup"
);
const metricsPath = resolve(
  evidenceDirectory,
  "forest_ground_life_lineup_metrics.json"
);
const output = resolve(evidenceDirectory, "forest_ground_life_lineup.png");

const [manifest, metrics] = await Promise.all([
  readFile(manifestPath, "utf8").then(JSON.parse),
  readFile(metricsPath, "utf8").then(JSON.parse),
]);

const CARD_WIDTH = 720;
const CARD_HEIGHT = 520;
const IMAGE_SIZE = 150;
const IMAGE_GAP = 16;
const IMAGE_START_X = 28;
const IMAGE_Y = 128;
const COLUMNS = 3;
const GAP = 30;
const MARGIN = 38;
const HEADER_HEIGHT = 122;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatBytes(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KiB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function familyColor(family) {
  if (family === "Fresh Forest") return "#71d38b";
  if (family === "Autumn Reuse") return "#d8ad72";
  return "#8fc896";
}

async function buildCard(candidate, metric) {
  const views = ["front", "three-quarter", "overhead", "silhouette"];
  const images = await Promise.all(
    views.map((view) =>
      sharp(metric.renders[view])
        .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover" })
        .png()
        .toBuffer()
    )
  );
  const accent = familyColor(candidate.family);
  const labels = ["front", "45°", "overhead", "silhouette"];
  const textSvg = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="20" fill="#0b1714"/>
      <rect width="7" height="${CARD_HEIGHT}" rx="4" fill="${accent}"/>
      <text x="28" y="40" fill="#f6ead3" font-family="system-ui, sans-serif" font-size="25" font-weight="750">${escapeXml(candidate.id)}  ${escapeXml(candidate.label)}</text>
      <text x="28" y="70" fill="${accent}" font-family="system-ui, sans-serif" font-size="16" font-weight="650">${escapeXml(candidate.family)}</text>
      <text x="692" y="40" fill="#c2d2c7" text-anchor="end" font-family="ui-monospace, monospace" font-size="14">${escapeXml(formatCount(metric.triangles))} tris · ${escapeXml(formatBytes(metric.sourceBytes))}</text>
      <text x="692" y="68" fill="#8fa89a" text-anchor="end" font-family="ui-monospace, monospace" font-size="14">${candidate.targetHeightMetres} m shipping height · post 1 m</text>
      ${labels
        .map((label, index) => {
          const x = IMAGE_START_X + index * (IMAGE_SIZE + IMAGE_GAP);
          return `<text x="${x + IMAGE_SIZE / 2}" y="300" fill="#a9bbb0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="13">${label}</text>`;
        })
        .join("\n")}
      <text x="28" y="340" fill="#d8e2db" font-family="system-ui, sans-serif" font-size="16">${escapeXml(candidate.roles.join(" · "))}</text>
      <text x="28" y="376" fill="#9db1a5" font-family="system-ui, sans-serif" font-size="14">${escapeXml(candidate.source.provenance)}</text>
      <text x="28" y="403" fill="#758a7e" font-family="ui-monospace, monospace" font-size="13">${escapeXml(candidate.source.license)}</text>
      <line x1="28" y1="430" x2="692" y2="430" stroke="#1d332c" stroke-width="1"/>
      <text x="28" y="463" fill="#70877b" font-family="system-ui, sans-serif" font-size="14">Review: stem integrity · alpha edges · ground contact · texture lighting</text>
      <text x="28" y="492" fill="#52695e" font-family="system-ui, sans-serif" font-size="13">Candidate only. Gate 7 owns placement.</text>
    </svg>
  `);
  return sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
      background: "#0b1714",
    },
  })
    .composite([
      { input: textSvg, left: 0, top: 0 },
      ...images.map((input, index) => ({
        input,
        left: IMAGE_START_X + index * (IMAGE_SIZE + IMAGE_GAP),
        top: IMAGE_Y,
      })),
    ])
    .png()
    .toBuffer();
}

const rows = Math.ceil(manifest.candidates.length / COLUMNS);
const width = MARGIN * 2 + CARD_WIDTH * COLUMNS + GAP * (COLUMNS - 1);
const height = HEADER_HEIGHT + MARGIN + CARD_HEIGHT * rows + GAP * (rows - 1);
const header = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#06100e"/>
    <text x="${MARGIN}" y="48" fill="#f6ead3" font-family="system-ui, sans-serif" font-size="34" font-weight="780">Forest Gate 6 · ground-life asset lineup</text>
    <text x="${MARGIN}" y="82" fill="#9db1a5" font-family="ui-monospace, monospace" font-size="16">Fixed lighting · authored shipping height · one-metre quartered post · no scene placement</text>
  </svg>
`);

const composites = [{ input: header, left: 0, top: 0 }];
for (const [index, candidate] of manifest.candidates.entries()) {
  const metric = metrics.candidates.find((entry) => entry.id === candidate.id);
  if (!metric) throw new Error(`Metrics missing for ${candidate.id}`);
  const card = await buildCard(candidate, metric);
  composites.push({
    input: card,
    left: MARGIN + (index % COLUMNS) * (CARD_WIDTH + GAP),
    top: HEADER_HEIGHT + Math.floor(index / COLUMNS) * (CARD_HEIGHT + GAP),
  });
}

await mkdir(dirname(output), { recursive: true });
await sharp({
  create: { width, height, channels: 4, background: "#06100e" },
})
  .composite(composites)
  .png()
  .toFile(output);

console.log(
  JSON.stringify(
    {
      contractVersion: manifest.version,
      output,
      width,
      height,
      candidates: manifest.candidates.length,
    },
    null,
    2
  )
);
