#!/usr/bin/env node

/**
 * First Fire Gate 3 visual target board.
 *
 * Composites the seven locked-camera captures into one document in route
 * order, plus a silhouette pass, so the walk can be judged as a continuous
 * sequence instead of seven frames read one at a time. Reading them
 * separately is what let the molten channel look correct from one court and
 * vanish from another.
 *
 * The board is a diagnostic. It documents what the room currently looks like;
 * it does not assert that the room is finished.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import sharp from "sharp";

const GATE3_DIR = resolve(
  "docs/superpowers/specs/first-fire-cinder-court/gate3"
);
const BOARD_PATH = resolve(GATE3_DIR, "first-fire-gate3-target-board.webp");
const SILHOUETTE_PATH = resolve(GATE3_DIR, "first-fire-gate3-silhouette.webp");
const REPORT_PATH = resolve(GATE3_DIR, "first-fire-gate3-board-report.json");

// The capture viewport is 1549x871 with the review HUD pinned top-left and
// bottom-centre. Cropping to the 3D content keeps the overlay's text out of
// the silhouette threshold, where it would read as a bright foreground shape.
const CROP = { left: 0, top: 168, width: 1399, height: 600 };

/** Route order. This is the order the visitor meets these views, not id order. */
const FRAMES = [
  {
    id: "ember-bridge",
    file: "camera-ember-bridge.webp",
    phase: "approach",
    title: "1 · Ember bridge",
    note: "The water room is behind you. No court is visible yet.",
    vocabulary: "none",
    accent: "#7bc9df",
  },
  {
    id: "dj-threshold",
    file: "camera-dj-threshold.webp",
    phase: "dj-active",
    title: "2 · DJ court mouth",
    note: "First court. Coal only: the props carry charcoal afterimages, no flame.",
    vocabulary: "charcoal",
    accent: "#c8541f",
  },
  {
    id: "dj-cooling",
    file: "camera-dj-cooling.webp",
    phase: "dj-complete",
    title: "3 · DJ exit, looking back",
    note: "The court cooling behind the visitor as they leave through the exit mouth.",
    vocabulary: "charcoal",
    accent: "#8d3a17",
  },
  {
    id: "ek-threshold",
    file: "camera-ek-threshold.webp",
    phase: "ek-active",
    title: "4 · EK court mouth",
    note: "Second court adds open flame on top of coal. The step up must be legible here.",
    vocabulary: "charcoal + fire",
    accent: "#f0821f",
  },
  {
    id: "fl-threshold",
    file: "camera-fl-threshold.webp",
    phase: "fl-active",
    title: "5 · FL court mouth",
    note: "Third court adds the arc. Cold violet-white against the warm room.",
    vocabulary: "charcoal + fire + zap",
    accent: "#b9a6ff",
  },
  {
    id: "blackout",
    file: "camera-blackout.webp",
    phase: "fire-extinguished",
    title: "6 · Blackout",
    note: "Every burning thing is out. Nothing may survive this frame.",
    vocabulary: "none",
    accent: "#5c5148",
  },
  {
    id: "earth-reveal",
    file: "camera-earth-reveal.webp",
    phase: "growth-complete",
    title: "7 · Earth reveal",
    note: "Green rises along the route already walked, and the earth door opens.",
    vocabulary: "none",
    accent: "#72d957",
  },
];

const CARD_WIDTH = 1447;
const CARD_HEIGHT = 712;
const IMAGE_LEFT = 24;
const IMAGE_TOP = 88;
const COLUMNS = 2;
const GAP = 26;
const MARGIN = 36;
const HEADER_HEIGHT = 132;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function loadFrame(frame) {
  const path = resolve(GATE3_DIR, frame.file);
  const source = await readFile(path);
  return {
    sha256: createHash("sha256").update(source).digest("hex"),
    bytes: source.length,
    pipeline: () => sharp(source).extract(CROP),
  };
}

async function buildCard(frame, loaded, { silhouette }) {
  let image = loaded.pipeline();
  if (silhouette) {
    // Luminance threshold: does the performer read as a shape against the
    // court, with no light source of its own to help it?
    image = image.grayscale().normalise().threshold(112);
  }
  const body = await image.png().toBuffer();

  const label = silhouette
    ? `${frame.id} · silhouette`
    : `${frame.id} · ${frame.phase}`;
  const frameSvg = Buffer.from(`
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="18" fill="#150a07"/>
      <rect width="7" height="${CARD_HEIGHT}" rx="4" fill="${frame.accent}"/>
      <text x="26" y="38" fill="#fff3dc" font-family="system-ui, sans-serif" font-size="25" font-weight="760">${escapeXml(frame.title)}</text>
      <text x="${CARD_WIDTH - 26}" y="38" text-anchor="end" fill="${frame.accent}" font-family="ui-monospace, monospace" font-size="12">${escapeXml(label)}</text>
      <text x="26" y="63" fill="#c9ad99" font-family="system-ui, sans-serif" font-size="15">${escapeXml(frame.note)}</text>
      <text x="${CARD_WIDTH - 26}" y="63" text-anchor="end" fill="#c9ad99" font-family="ui-monospace, monospace" font-size="12">fire: ${escapeXml(frame.vocabulary)}</text>
      <rect x="${IMAGE_LEFT}" y="${IMAGE_TOP}" width="${CROP.width}" height="${CROP.height}" rx="10" fill="#0a0504" stroke="#3a221a"/>
    </svg>
  `);

  return sharp({
    create: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      channels: 4,
      background: "#150a07",
    },
  })
    .composite([
      { input: frameSvg, left: 0, top: 0 },
      { input: body, left: IMAGE_LEFT, top: IMAGE_TOP },
    ])
    .png()
    .toBuffer();
}

async function buildSheet({ frames, loaded, silhouette, title, subtitle, output }) {
  const rows = Math.ceil(frames.length / COLUMNS);
  const width = MARGIN * 2 + CARD_WIDTH * COLUMNS + GAP * (COLUMNS - 1);
  const height =
    HEADER_HEIGHT + MARGIN + CARD_HEIGHT * rows + GAP * (rows - 1);

  const header = Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#0b0503"/>
      <text x="${MARGIN}" y="50" fill="#fff3dc" font-family="system-ui, sans-serif" font-size="34" font-weight="780">${escapeXml(title)}</text>
      <text x="${MARGIN}" y="86" fill="#c9ad99" font-family="ui-monospace, monospace" font-size="15">${escapeXml(subtitle)}</text>
    </svg>
  `);

  const composites = [{ input: header, left: 0, top: 0 }];
  for (const [index, frame] of frames.entries()) {
    composites.push({
      input: await buildCard(frame, loaded.get(frame.id), { silhouette }),
      left: MARGIN + (index % COLUMNS) * (CARD_WIDTH + GAP),
      top: HEADER_HEIGHT + Math.floor(index / COLUMNS) * (CARD_HEIGHT + GAP),
    });
  }

  await mkdir(dirname(output), { recursive: true });
  await sharp({
    create: { width, height, channels: 4, background: "#0b0503" },
  })
    .composite(composites)
    .webp({ quality: 82 })
    .toFile(output);

  return { output, width, height };
}

const loaded = new Map();
for (const frame of FRAMES) {
  loaded.set(frame.id, await loadFrame(frame));
}

const board = await buildSheet({
  frames: FRAMES,
  loaded,
  silhouette: false,
  title: "First Fire: The Cinder Court · Gate 3 visual target",
  subtitle:
    "seven locked cameras in route order, each captured in its own procession phase · cumulative fire vocabulary: coal, then flame, then arc",
  output: BOARD_PATH,
});

const silhouette = await buildSheet({
  frames: FRAMES,
  loaded,
  silhouette: true,
  title: "First Fire: The Cinder Court · Gate 3 silhouette read",
  subtitle:
    "same seven frames, luminance-thresholded · does the performer read as a shape against its court",
  output: SILHOUETTE_PATH,
});

const report = {
  generatedFrom: "docs/superpowers/specs/first-fire-cinder-court/gate3",
  crop: CROP,
  board,
  silhouette,
  frames: FRAMES.map((frame) => ({
    id: frame.id,
    file: frame.file,
    phase: frame.phase,
    vocabulary: frame.vocabulary,
    sha256: loaded.get(frame.id).sha256,
    bytes: loaded.get(frame.id).bytes,
  })),
};

await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
