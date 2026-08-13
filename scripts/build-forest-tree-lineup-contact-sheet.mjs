#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const args = process.argv.slice(2);
const manifestIndex = args.indexOf("--manifest");
const manifestPath = resolve(
  manifestIndex >= 0
    ? args[manifestIndex + 1]
    : "scripts/forest-tree-lineup.json"
);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const evidenceDirectory = manifest.evidenceDirectory
  ? resolve(manifest.evidenceDirectory)
  : resolve(tmpdir(), "tka-forest-evidence", "tree-lineup");
const metricsPath = resolve(
  evidenceDirectory,
  "forest_tree_lineup_metrics.json"
);

const metrics = JSON.parse(await readFile(metricsPath, "utf8"));

const CARD_WIDTH = 1000;
const CARD_HEIGHT = 440;
const HEADER_HEIGHT = 116;
const IMAGE_SIZE = 270;
const IMAGE_GAP = 22;
const IMAGE_START_X = 36;
const IMAGE_Y = 103;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

function formatCount(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

async function buildCard(candidate, metric) {
  const accent =
    candidate.family === "Current Forest"
      ? "#8fc896"
      : candidate.family === "Fresh Forest"
        ? "#71d38b"
        : "#d8ad72";
  const imageLabels = ["front", "45°", "silhouette"];
  const viewNames = ["front", "three-quarter", "silhouette"];
  const viewImages = await Promise.all(
    viewNames.map((view) =>
      sharp(metric.renders[view])
        .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "cover" })
        .png()
        .toBuffer()
    )
  );
  const textSvg = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="22" fill="#0b1714"/>
      <rect width="8" height="${CARD_HEIGHT}" rx="4" fill="${accent}"/>
      <text x="34" y="43" fill="#f6ead3" font-family="system-ui, sans-serif" font-size="27" font-weight="700">${escapeXml(candidate.id)}  ${escapeXml(candidate.label)}</text>
      <text x="34" y="73" fill="${accent}" font-family="system-ui, sans-serif" font-size="17" font-weight="650">${escapeXml(candidate.family)}</text>
      <text x="965" y="43" fill="#c2d2c7" text-anchor="end" font-family="ui-monospace, monospace" font-size="15">${escapeXml(formatCount(metric.triangles))} tris · ${escapeXml(formatBytes(metric.runtimeBytes ?? metric.sourceBytes))}</text>
      <text x="965" y="72" fill="#8fa89a" text-anchor="end" font-family="ui-monospace, monospace" font-size="14">${escapeXml(metric.reviewHeightMetres.toFixed(1))} m tree · person 1.75 m</text>
      ${imageLabels
        .map((label, index) => {
          const x = IMAGE_START_X + index * (IMAGE_SIZE + IMAGE_GAP);
          return `<text x="${x + IMAGE_SIZE / 2}" y="395" fill="#a9bbb0" text-anchor="middle" font-family="ui-monospace, monospace" font-size="14">${label}</text>`;
        })
        .join("\n")}
      <text x="965" y="430" fill="#d8e2db" text-anchor="end" font-family="system-ui, sans-serif" font-size="15">${escapeXml(candidate.roles.join(" · "))}</text>
    </svg>
  `);

  const composites = [
    { input: textSvg, left: 0, top: 0 },
    ...viewImages.map((input, index) => ({
      input,
      left: IMAGE_START_X + index * (IMAGE_SIZE + IMAGE_GAP),
      top: IMAGE_Y,
    })),
  ];

  return sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
      background: "#0b1714",
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function buildSheet({ candidates, columns, title, subtitle, output }) {
  const rows = Math.ceil(candidates.length / columns);
  const width = CARD_WIDTH * columns + 48 * (columns + 1);
  const height = HEADER_HEIGHT + CARD_HEIGHT * rows + 34 * rows + 48;
  const headerSvg = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#06100e"/>
      <text x="48" y="50" fill="#f6ead3" font-family="system-ui, sans-serif" font-size="34" font-weight="750">${escapeXml(title)}</text>
      <text x="48" y="82" fill="#9db1a5" font-family="ui-monospace, monospace" font-size="16">${escapeXml(subtitle)}</text>
    </svg>
  `);

  const composites = [{ input: headerSvg, left: 0, top: 0 }];
  for (const [index, candidate] of candidates.entries()) {
    const metric = metrics.candidates.find(
      (entry) => entry.id === candidate.id
    );
    if (!metric) throw new Error(`Metrics missing for ${candidate.id}`);
    const card = await buildCard(candidate, metric);
    const column = index % columns;
    const row = Math.floor(index / columns);
    composites.push({
      input: card,
      left: 48 + column * (CARD_WIDTH + 48),
      top: HEADER_HEIGHT + row * (CARD_HEIGHT + 34),
    });
  }

  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: "#06100e" },
  })
    .composite(composites)
    .png()
    .toFile(output);

  return { output, width, height, candidates: candidates.length };
}

const legacySheets = [
  {
    id: "current",
    family: "Current Forest",
    columns: 1,
    title: "Forest Gate 4 · current KayKit trees",
    subtitle: "Source materials shown honestly. Every tree is normalized to 12 m.",
    output: "forest_tree_lineup_current.png",
  },
  {
    id: "autumn",
    family: "Autumn Reuse",
    columns: 2,
    title: "Forest Gate 4 · reusable Autumn trees",
    subtitle: "Source materials shown honestly. Forest recoloring belongs to a later approved pass.",
    output: "forest_tree_lineup_autumn.png",
  },
  {
    id: "fresh",
    family: "Fresh Forest",
    columns: 1,
    title: "Forest Gate 4 · fresh lush-green family",
    subtitle: "ImageGen concepts reconstructed with Meshy 6. Every tree is normalized to 12 m.",
    output: "forest_tree_lineup_fresh.png",
  },
];

const sheetContracts = manifest.contactSheets ?? legacySheets;
const outputs = await Promise.all(
  sheetContracts.map((sheet) => {
    const candidateIds = new Set(sheet.candidateIds ?? []);
    const candidates = manifest.candidates.filter((candidate) =>
      candidateIds.size > 0
        ? candidateIds.has(candidate.id)
        : sheet.family
          ? candidate.family === sheet.family
          : true
    );
    if (candidates.length === 0) {
      throw new Error(`Contact sheet ${sheet.id} has no candidates`);
    }
    return buildSheet({
      candidates,
      columns: sheet.columns ?? 1,
      title: sheet.title,
      subtitle: sheet.subtitle,
      output: resolve(evidenceDirectory, sheet.output),
    });
  })
);

console.log(
  JSON.stringify({ contractVersion: manifest.version, outputs }, null, 2)
);
