#!/usr/bin/env node
/** Assemble Olive Cloudbreak Gate 4 runtime captures into review boards. */

import { resolve } from "node:path";
import sharp from "sharp";

const SPEC_DIR = resolve("docs/superpowers/specs/seraphic-vault");
const PREFIX = "seraphic-vault-gate4-cloudbreak-r1";

function labelSvg(width, height, text, fontSize = 28) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#172131"/>
      <text x="${width / 2}" y="${height / 2 + fontSize * 0.34}"
        text-anchor="middle" fill="#edf2f7" font-family="Arial, sans-serif"
        font-size="${fontSize}" font-weight="700" letter-spacing="2">${text}</text>
    </svg>`);
}

async function resized(path, width, height) {
  return sharp(path).resize(width, height, { fit: "cover" }).toBuffer();
}

async function buildViewportBoard() {
  const canvasWidth = 2400;
  const canvasHeight = 1740;
  const composites = [
    {
      input: labelSvg(
        canvasWidth,
        110,
        "OLIVE CLOUDBREAK · REGISTERED VIEWPORTS",
        34
      ),
      left: 0,
      top: 0,
    },
  ];
  const tiles = [
    ["DESKTOP · 1920 × 1080", "desktop", 60, 170, 1120, 630],
    ["PORTRAIT · 1080 × 1920", "portrait", 1240, 170, 354, 630],
    ["PHONE · 375 × 812", "phone", 1654, 170, 354, 630],
    ["4K · 3840 × 2160", "4k", 60, 920, 920, 518],
    ["TABLET · 1024 × 768", "tablet", 1040, 920, 690, 518],
    ["LANDSCAPE PHONE · 960 × 412", "landscape-phone", 1790, 920, 550, 236],
    ["2560 × 1440", "2560", 1790, 1276, 550, 309],
  ];

  for (const [label, stem, left, top, width, height] of tiles) {
    composites.push({
      input: labelSvg(width, 54, label, 20),
      left,
      top: top - 54,
    });
    composites.push({
      input: await resized(
        resolve(SPEC_DIR, `${PREFIX}-${stem}.webp`),
        width,
        height
      ),
      left,
      top,
    });
  }

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: "#0f1723",
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(resolve(SPEC_DIR, `${PREFIX}-viewport-board.png`));
}

async function buildInteractionBoard() {
  const frameWidth = 1120;
  const frameHeight = 630;
  const gap = 40;
  const canvasWidth = frameWidth * 2 + gap + 120;
  const canvasHeight = 850;
  const idle = await resized(
    resolve(SPEC_DIR, `${PREFIX}-interaction-idle.webp`),
    frameWidth,
    frameHeight
  );
  const activated = await resized(
    resolve(SPEC_DIR, `${PREFIX}-interaction-activated.webp`),
    frameWidth,
    frameHeight
  );

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: "#0f1723",
    },
  })
    .composite([
      {
        input: labelSvg(
          canvasWidth,
          100,
          "OLIVE CLOUDBREAK · INTERACTION RESPONSE",
          32
        ),
        left: 0,
        top: 0,
      },
      { input: labelSvg(frameWidth, 56, "IDLE", 22), left: 40, top: 126 },
      {
        input: labelSvg(frameWidth, 56, "ACTIVATED · LAGOON + SUN PULSE", 22),
        left: 40 + frameWidth + gap,
        top: 126,
      },
      { input: idle, left: 40, top: 182 },
      { input: activated, left: 40 + frameWidth + gap, top: 182 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(resolve(SPEC_DIR, `${PREFIX}-interaction-capture.png`));
}

await Promise.all([buildViewportBoard(), buildInteractionBoard()]);
console.log(
  JSON.stringify(
    {
      viewportBoard: resolve(SPEC_DIR, `${PREFIX}-viewport-board.png`),
      interactionCapture: resolve(
        SPEC_DIR,
        `${PREFIX}-interaction-capture.png`
      ),
    },
    null,
    2
  )
);
