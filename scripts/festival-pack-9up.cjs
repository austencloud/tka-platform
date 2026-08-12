// 9-up duplex print of a festival sample pack: 1 signup card + 8 choreo cards
// on one US Letter sheet, front page + back page (columns mirrored for
// long-edge duplex). Cards tile edge-to-edge with shared cut lines.
//
// Follows scripts/donation-cards-4up.cjs; the differences are the 3×3 poker
// grid and that each cell carries its own artwork (a manifest of 9 card
// front/back PNG pairs) instead of one artwork repeated.
//
// Card PNGs are the print canvases from PrintCardRenderer (822×1122 at
// 300 DPI, 36 px bleed per edge). The bleed is cropped here: a home-printed
// sheet is cut on the cell lines, so the cell must hold the trimmed
// 750×1050 px = 2.5in × 3.5in card exactly.
//
// Usage: node scripts/festival-pack-9up.cjs [manifest.json] [out.pdf]
// Manifest: { "cards": [ { "front": "path.png", "back": "path.png" }, ×9 ] }
// listed in grid order, left-to-right then top-to-bottom.
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");

const MANIFEST =
  process.argv[2] || "E:/tka-platform/scripts/festival-pack-manifest.json";
const OUT =
  process.argv[3] || "C:/Users/Austen/Desktop/festival-pack-9up-duplex.pdf";

const PAGE_W = 612,
  PAGE_H = 792; // US Letter portrait, points
const COLS = 3,
  ROWS = 3;
const CARD_W = 180,
  CARD_H = 252; // poker: 2.5in × 3.5in
const MARGIN_X = (PAGE_W - COLS * CARD_W) / 2; // 36pt
const MARGIN_Y = (PAGE_H - ROWS * CARD_H) / 2; // 18pt

const BASE_WIDTH_PX = 822;
const BASE_HEIGHT_PX = 1122;
const BASE_BLEED_PX = 36;

/**
 * Front cards are 822×1122, while the production back renderer rasterizes at
 * 2× (1644×2244). Crop the same physical bleed from either resolution. A
 * fixed 36px crop on a 2× back leaves half the bleed in place and stretches
 * the artwork when it is fitted into the poker-size cell.
 */
function computeTrimGeometry(width, height) {
  const scaleX = width / BASE_WIDTH_PX;
  const scaleY = height / BASE_HEIGHT_PX;
  if (
    !Number.isFinite(scaleX) ||
    !Number.isFinite(scaleY) ||
    scaleX <= 0 ||
    Math.abs(scaleX - scaleY) > 1e-6
  ) {
    throw new Error(
      `card image must be a uniform scale of ${BASE_WIDTH_PX}×${BASE_HEIGHT_PX}; got ${width}×${height}`
    );
  }
  const bleedPx = Math.round(BASE_BLEED_PX * scaleX);
  return {
    left: bleedPx,
    top: bleedPx,
    width: width - bleedPx * 2,
    height: height - bleedPx * 2,
  };
}

async function buildSheet() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  if (!Array.isArray(manifest.cards) || manifest.cards.length !== COLS * ROWS) {
    throw new Error(
      `manifest must list exactly ${COLS * ROWS} cards; got ${manifest.cards?.length ?? 0}`
    );
  }
  const baseDir = path.dirname(MANIFEST);
  const resolve = (p) => (path.isAbsolute(p) ? p : path.join(baseDir, p));

  const pdf = await PDFDocument.create();

  // Crop the bleed and embed. Card PNGs may repeat in the manifest, so cache
  // embeds by path — pdf-lib deduplicates the image stream per embed object.
  const embeds = new Map();
  async function embed(file) {
    const key = resolve(file);
    if (embeds.has(key)) return embeds.get(key);
    const meta = await sharp(key).metadata();
    const png = await sharp(key)
      .extract(computeTrimGeometry(meta.width, meta.height))
      .png()
      .toBuffer();
    const img = await pdf.embedPng(png);
    embeds.set(key, img);
    return img;
  }

  const cellX = (col) => MARGIN_X + col * CARD_W;
  const cellY = (row) => PAGE_H - MARGIN_Y - (row + 1) * CARD_H;

  async function drawPage(face, mirror) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    for (let i = 0; i < manifest.cards.length; i++) {
      const row = Math.floor(i / COLS);
      const col = i % COLS;
      const placeCol = mirror ? COLS - 1 - col : col;
      const img = await embed(manifest.cards[i][face]);
      page.drawImage(img, {
        x: cellX(placeCol),
        y: cellY(row),
        width: CARD_W,
        height: CARD_H,
      });
    }
  }

  await drawPage("front", false);
  await drawPage("back", true); // columns mirrored for long-edge duplex

  fs.writeFileSync(OUT, await pdf.save());
  console.log("wrote", OUT);
  console.log(
    `grid: ${COLS}×${ROWS} poker (${CARD_W / 72}in × ${CARD_H / 72}in), ` +
      `margins ${MARGIN_X}pt / ${MARGIN_Y}pt, scale-aware bleed crop`
  );
}

if (require.main === module) {
  buildSheet().catch((error) => {
    console.error("FAILED:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { computeTrimGeometry };
