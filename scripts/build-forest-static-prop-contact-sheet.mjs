#!/usr/bin/env node

import { access, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const evidenceDirectory = resolve(tmpdir(), "tka-forest-evidence");
const runtimeDirectory = resolve(evidenceDirectory, "runtime");
const gate8Directory = resolve(evidenceDirectory, "forest-gate8");
const metricsPath = resolve(
  evidenceDirectory,
  "forest_near_frame_metrics.json"
);
const output = resolve(
  "docs/superpowers/specs/moonlit-firefly-forest/forest-gate9-review-board.png"
);
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));

const cards = [
  {
    title: "1. Approved frame target",
    note: "Gate 8 placed one mature beech near the west edge and one forked elm near the east edge.",
    facts: "13.20 m + 17.89 m trunk radii",
    image: resolve(gate8Directory, "forest_gate8_framing_candidate.png"),
    accent: "#8bc899",
  },
  {
    title: "2. Visible in-app Forest route",
    note: "Both trees now mount around the authored woodland while the stage and fire pocket stay open.",
    facts: "Codex app preview · loading overlay cleared",
    image: resolve(runtimeDirectory, "forest-gate9-in-app.png"),
    accent: "#e6b66e",
  },
  {
    title: "3. West root shelf",
    note: "One decomposing windfall is caught against the beech roots with two displaced stones.",
    facts: "one deadwood source · three linked props",
    image: resolve(
      evidenceDirectory,
      "forest_environment_qa_frame-southwest.png"
    ),
    accent: "#9fc28e",
  },
  {
    title: "4. East runoff shoulder",
    note: "A buried boulder and two smaller stones mark runoff around the elm. No second hero log appears here.",
    facts: "one boulder · two stones · separate cause",
    image: resolve(
      evidenceDirectory,
      "forest_environment_qa_frame-southeast.png"
    ),
    accent: "#a6b9a7",
  },
  {
    title: "5. Full in-app preview",
    note: "The app's portrait preview keeps the west trunk in the foreground and the complete clearing visible.",
    facts: "native in-app browser viewport",
    image: resolve(runtimeDirectory, "forest-gate9-in-app.png"),
    fit: "contain",
    accent: "#7db2a2",
  },
  {
    title: "6. Widened clearing",
    note: "The Coven-safe export has no close-frame trees or edge props. The runtime route never requests that asset.",
    facts: "clearingRadius 28 · near-frame request absent",
    image: resolve(
      evidenceDirectory,
      "forest_environment_qa_coven-frame-omitted.png"
    ),
    accent: "#9b93bc",
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
  await access(card.image);
  const image = await sharp(card.image)
    .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
      fit: card.fit ?? "cover",
      background: "#06100d",
    })
    .png()
    .toBuffer();
  const frame = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="20" fill="#091310"/>
      <rect width="7" height="${CARD_HEIGHT}" rx="4" fill="${card.accent}"/>
      <text x="28" y="36" fill="#f4ead8" font-family="system-ui, sans-serif" font-size="25" font-weight="760">${escapeXml(card.title)}</text>
      <text x="1352" y="36" text-anchor="end" fill="${card.accent}" font-family="ui-monospace, monospace" font-size="11.5">${escapeXml(card.facts)}</text>
      <text x="28" y="61" fill="#aebfb4" font-family="system-ui, sans-serif" font-size="15">${escapeXml(card.note)}</text>
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
    <text x="${MARGIN}" y="47" fill="#f4ead8" font-family="system-ui, sans-serif" font-size="34" font-weight="780">Forest Gate 9 · close frame + anchored edge habitats</text>
    <text x="${MARGIN}" y="81" fill="#98ada0" font-family="ui-monospace, monospace" font-size="16">two framing trees · two different site causes · six props · protected paths and performance core · Coven layer omitted</text>
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

const outputMetadata = await sharp(output).metadata();
if (
  outputMetadata.width !== width ||
  outputMetadata.height !== height ||
  cards.length !== 6
) {
  throw new Error("Forest Gate 9 review board did not match its contract");
}

console.log(
  JSON.stringify(
    {
      output,
      width,
      height,
      cards: cards.length,
      frameTrees: metrics.frameTreeCount,
      vignettes: metrics.vignetteCount,
      props: metrics.propCount,
      minimumPathShoulderMarginMetres: metrics.minimumPathShoulderMarginMetres,
      minimumCampfireCenterDistanceMetres:
        metrics.minimumCampfireCenterDistanceMetres,
    },
    null,
    2
  )
);
