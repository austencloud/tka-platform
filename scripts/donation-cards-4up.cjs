// 4-up duplex print of the TKA Donation QR cards as cut-out cards. Front page =
// donation-front ×4, back page = donation-back ×4 (columns mirrored for
// long-edge duplex). Cards tile edge-to-edge (shared cut lines) and each gets a
// vertical rainbow border frame matching the Choreo Cards / Codex cards
// (content on white, inset inside the border).
//
// Mirrors scripts/codex-6up.cjs exactly; only the page grid (2×2 portrait) and
// the artwork sources differ.
const fs = require("fs");
const sharp = require("sharp");
const { PDFDocument, rgb } = require("pdf-lib");

const FRONT = "E:/tka-platform/static/donation/front.png";
const BACK = "E:/tka-platform/static/donation/back.png";
const OUT = "C:/Users/Austen/Desktop/donation-cards-4up-duplex.pdf";

const PAGE_W = 612, PAGE_H = 792; // US Letter portrait, points
const MARGIN = 18;                // printer safe area
const COLS = 2, ROWS = 2;         // 4 per page
const BORDER = 12;                // rainbow frame thickness (pt)

// Choreo Cards rainbow, bottom→top (identical stops to codex-6up.cjs).
const RAINBOW =
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="640">' +
  '<defs><linearGradient id="g" x1="0" y1="1" x2="0" y2="0">' +
  '<stop offset="0" stop-color="#cc0000"/><stop offset="0.14" stop-color="#cc6600"/>' +
  '<stop offset="0.28" stop-color="#cccc00"/><stop offset="0.42" stop-color="#00cc00"/>' +
  '<stop offset="0.56" stop-color="#00cc66"/><stop offset="0.70" stop-color="#0066cc"/>' +
  '<stop offset="0.82" stop-color="#0033cc"/><stop offset="1" stop-color="#6600cc"/>' +
  '</linearGradient></defs><rect width="48" height="640" fill="url(#g)"/></svg>';

(async () => {
  // Render artwork at a generous raster width; the inner area is ~264pt wide.
  const frontPng = await sharp(FRONT).resize({ width: 1100 }).png().toBuffer();
  const backPng = await sharp(BACK).resize({ width: 1100 }).png().toBuffer();
  const rainbowPng = await sharp(Buffer.from(RAINBOW)).png().toBuffer();

  const pdf = await PDFDocument.create();
  const frontImg = await pdf.embedPng(frontPng);
  const backImg = await pdf.embedPng(backPng);
  const rainbow = await pdf.embedPng(rainbowPng);

  const slotW = (PAGE_W - 2 * MARGIN) / COLS; // gutter 0: cards touch
  const slotH = (PAGE_H - 2 * MARGIN) / ROWS;
  const innerW = slotW - 2 * BORDER;
  const innerH = slotH - 2 * BORDER;

  const slotX = (col) => MARGIN + col * slotW;
  const slotY = (row) => PAGE_H - MARGIN - (row + 1) * slotH;

  // Fit the artwork inside the white inner area, preserving aspect, centered.
  function fit(img) {
    const a = img.width / img.height;
    let w = innerW, h = innerW / a;
    if (h > innerH) { h = innerH; w = innerH * a; }
    return { w, h, ox: (innerW - w) / 2, oy: (innerH - h) / 2 };
  }

  function drawPage(img, mirror) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const f = fit(img);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const placeCol = mirror ? COLS - 1 - col : col;
        const sx = slotX(placeCol), sy = slotY(row);
        // rainbow frame fills the whole slot
        page.drawImage(rainbow, { x: sx, y: sy, width: slotW, height: slotH });
        // white content area inset by the border
        page.drawRectangle({ x: sx + BORDER, y: sy + BORDER, width: innerW, height: innerH, color: rgb(1, 1, 1) });
        // artwork centered in the white area
        page.drawImage(img, { x: sx + BORDER + f.ox, y: sy + BORDER + f.oy, width: f.w, height: f.h });
      }
    }
  }

  drawPage(frontImg, false); // front: donation
  drawPage(backImg, true);   // back: directions, columns mirrored for duplex

  fs.writeFileSync(OUT, await pdf.save());
  console.log("wrote", OUT);
  console.log("card:", (slotW / 72).toFixed(2) + "in x " + (slotH / 72).toFixed(2) + "in, border " + BORDER + "pt");
})();
