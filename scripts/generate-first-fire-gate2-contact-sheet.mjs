/**
 * Compose the First Fire Gate 2 review contact sheet.
 *
 * The gate contract asks for one sheet a reviewer can scan in a single look:
 * the seven authored states of the first-person walk on top, the nine
 * registered Blender review cameras below. Both rows are captures, never
 * re-renders, so the sheet cannot drift from the artifacts it indexes.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";

const GATE2_DIR = resolve(
  "docs/superpowers/specs/first-fire-cinder-court/gate2"
);
const BLENDER_DIR = join(tmpdir(), "tka-first-fire-cinder-court-evidence");
const OUTPUT_PATH = join(GATE2_DIR, "first-fire-gate2-contact-sheet.webp");

const WALK_FRAMES = [
  ["walk-01-ember-bridge.webp", "1 · ember bridge"],
  ["walk-02-dj-mouth.webp", "2 · DJ mouth"],
  ["walk-03-dj-cooling.webp", "3 · DJ cooling"],
  ["walk-04-ek-mouth.webp", "4 · EK mouth"],
  ["walk-05-fl-mouth.webp", "5 · FL mouth"],
  ["walk-06-blackout.webp", "6 · blackout"],
  ["walk-07-earth-growth.webp", "7 · Earth growth"],
];

const CAMERA_ORDER = [
  "water-entry",
  "ember-bridge",
  "dj-threshold",
  "ek-threshold",
  "fl-threshold",
  "blackout",
  "earth-reveal",
  "overview",
  "plan",
];

const CELL_WIDTH = 640;
const CELL_HEIGHT = 360;
const GAP = 12;
const LABEL_HEIGHT = 26;
const HEADER_HEIGHT = 84;
const COLUMNS = 5;

function escapeXml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function cell(path, label) {
  const image = await sharp(path)
    .resize(CELL_WIDTH, CELL_HEIGHT, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const caption = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CELL_WIDTH}" height="${LABEL_HEIGHT}">
      <rect width="${CELL_WIDTH}" height="${LABEL_HEIGHT}" fill="#16100d"/>
      <text x="10" y="18" font-family="Segoe UI, sans-serif" font-size="15"
        font-weight="600" fill="#f4cdb0">${escapeXml(label)}</text>
    </svg>`
  );
  return sharp({
    create: {
      width: CELL_WIDTH,
      height: CELL_HEIGHT + LABEL_HEIGHT,
      channels: 3,
      background: "#16100d",
    },
  })
    .composite([
      { input: caption, top: 0, left: 0 },
      { input: image, top: LABEL_HEIGHT, left: 0 },
    ])
    .png()
    .toBuffer();
}

const entries = [
  ...WALK_FRAMES.map(([file, label]) => ({
    path: join(GATE2_DIR, file),
    label: `WALK ${label}`,
  })),
  ...CAMERA_ORDER.map((id) => ({
    path: join(BLENDER_DIR, `first-fire-cinder-court-${id}.png`),
    label: `CAMERA · ${id}`,
  })),
];

const rows = Math.ceil(entries.length / COLUMNS);
const cellHeight = CELL_HEIGHT + LABEL_HEIGHT;
const width = COLUMNS * CELL_WIDTH + (COLUMNS + 1) * GAP;
const height = HEADER_HEIGHT + rows * cellHeight + (rows + 1) * GAP;

const header = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEADER_HEIGHT}">
    <rect width="${width}" height="${HEADER_HEIGHT}" fill="#0d0907"/>
    <text x="${GAP}" y="36" font-family="Segoe UI, sans-serif" font-size="27"
      font-weight="800" fill="#ffb066">FIRST FIRE · THE CINDER COURT · GATE 2 REVIEW SHEET</text>
    <text x="${GAP}" y="66" font-family="Segoe UI, sans-serif" font-size="16"
      fill="#c8a189">Seven authored states of the first-person walk, then the nine registered review cameras. One continuous S: Water to DJ to EK to FL to blackout to Earth.</text>
  </svg>`
);

const composites = [{ input: header, top: 0, left: 0 }];
for (const [index, entry] of entries.entries()) {
  const column = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  composites.push({
    input: await cell(entry.path, entry.label),
    left: GAP + column * (CELL_WIDTH + GAP),
    top: HEADER_HEIGHT + GAP + row * (cellHeight + GAP),
  });
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
await sharp({
  create: { width, height, channels: 3, background: "#0d0907" },
})
  .composite(composites)
  .webp({ quality: 82 })
  .toFile(OUTPUT_PATH);

const digest = createHash("sha256")
  .update(readFileSync(OUTPUT_PATH))
  .digest("hex");
console.log(`Wrote ${OUTPUT_PATH}`);
console.log(`Cells: ${entries.length} (${rows} x ${COLUMNS})`);
console.log(`sha256: ${digest}`);
