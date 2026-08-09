#!/usr/bin/env node

import { mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const evidenceDirectory = resolve(
  tmpdir(),
  "tka-forest-evidence",
  "forest-gate8"
);
const metricsPath = resolve(evidenceDirectory, "forest_gate8_metrics.json");
const output = resolve(evidenceDirectory, "forest_gate8_review_board.png");
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));

const cards = [
  {
    title: "1. Existing tree line",
    note: "Approved outer woodland, but the hero camera still reads a broad open basin.",
    facts: "baseline · no Gate 8 transforms",
    image: metrics.outputs.framingBaseline,
    accent: "#8e9d91",
  },
  {
    title: "2. Revised close frame",
    note: "The southwest trunk now enters the foreground; the southeast elm closes the opposite shoulder.",
    facts: "13.20 m + 17.89 m trunk radii · path checks pass · Coven layer omitted",
    image: metrics.outputs.framingCandidate,
    accent: "#8bc899",
  },
  {
    title: "3. Legacy camping pack",
    note: "Closed flat-panel tent, smooth cylinder log, and stacked polygon rocks.",
    facts: "4 retire candidates · labeled baseline only",
    image: metrics.outputs.legacyProps,
    accent: "#b97861",
  },
  {
    title: "4. Contemporary tent family",
    note: "Distinct two-person dome, three-person tunnel, and one-person trekking-pole silhouettes.",
    facts: "three capacities · technical fabric + poles + guy lines · six sleepers total",
    image: metrics.outputs.modernTentFamily,
    accent: "#c0a46b",
  },
  {
    title: "5. Measured campsite plan",
    note: "The stage stays left; the existing spur arrives through the open south side; sleeping pitches share one quiet arc.",
    facts: "orange 10 ft fuel-clear ring · red 15 ft tent buffer · stage margin 1.84 m",
    image: metrics.outputs.campsitePlan,
    accent: "#e5965c",
  },
  {
    title: "6. Ground-level camp composition",
    note: "One established fire bed, three modern chairs, and all entrances facing the communal center.",
    facts: "new fire geometry · existing flame/smoke/light owners preserved · 0 paid credits",
    image: metrics.outputs.campsiteGround,
    accent: "#e6b66e",
  },
];

const CARD_WIDTH = 1380;
const CARD_HEIGHT = 820;
const IMAGE_WIDTH = 1308;
const IMAGE_HEIGHT = 736;
const COLUMNS = 2;
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

async function buildCard(card) {
  const image = await sharp(card.image)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover" })
    .png()
    .toBuffer();
  const frame = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="20" fill="#091310"/>
      <rect width="7" height="${CARD_HEIGHT}" rx="4" fill="${card.accent}"/>
      <text x="28" y="36" fill="#f4ead8" font-family="system-ui, sans-serif" font-size="25" font-weight="760">${escapeXml(card.title)}</text>
      <text x="28" y="61" fill="#aebfb4" font-family="system-ui, sans-serif" font-size="15">${escapeXml(card.note)}</text>
      <text x="1352" y="61" text-anchor="end" fill="${card.accent}" font-family="ui-monospace, monospace" font-size="13">${escapeXml(card.facts)}</text>
      <rect x="28" y="72" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" rx="12" fill="#06100d" stroke="#1d352c"/>
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
      { input: frame, left: 0, top: 0 },
      { input: image, left: 28, top: 72 },
    ])
    .png()
    .toBuffer();
}

const rows = Math.ceil(cards.length / COLUMNS);
const width = MARGIN * 2 + CARD_WIDTH * COLUMNS + GAP * (COLUMNS - 1);
const height = HEADER_HEIGHT + MARGIN + CARD_HEIGHT * rows + GAP * (rows - 1);
const header = Buffer.from(`
  <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${width}" height="${height}" fill="#050d0b"/>
    <text x="${MARGIN}" y="47" fill="#f4ead8" font-family="system-ui, sans-serif" font-size="34" font-weight="780">Forest Gate 8 · revision 2 · intimate frame + real campsite</text>
    <text x="${MARGIN}" y="81" fill="#98ada0" font-family="ui-monospace, monospace" font-size="16">visible foreground trunks · modern six-person tent family · measured fire separation · no production scene change</text>
  </svg>
`);

const composites = [{ input: header, left: 0, top: 0 }];
for (const [index, card] of cards.entries()) {
  composites.push({
    input: await buildCard(card),
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
      output,
      width,
      height,
      cards: cards.length,
      framingCandidates: metrics.framingCandidateCount,
      recommendedCandidates: metrics.recommendedCandidateCount,
      paidMeshyCredits: metrics.paidMeshyCredits,
    },
    null,
    2
  )
);
