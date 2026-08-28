#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const volcanicRevision = process.argv.includes("--surface-r9")
  ? "r9"
  : process.argv.includes("--terrain-r8")
    ? "r8"
    : process.argv.includes("--meshy-r7")
      ? "r7"
      : process.argv.includes("--volcanic-r6")
        ? "r6"
        : process.argv.includes("--volcanic-r5")
          ? "r5"
          : null;
const volcanic = volcanicRevision !== null;
const evidenceDirectory = resolve(
  volcanic
    ? volcanicRevision === "r9"
      ? "docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-surface-r9"
      : volcanicRevision === "r8"
        ? "docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-terrain-r8"
        : volcanicRevision === "r7"
          ? "docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-meshy-r1"
          : `docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-volcanic-${volcanicRevision}`
    : "docs/superpowers/specs/ember-spatial-directions/evidence/gate-4-columnar-r4"
);
const sourcePrefix = volcanic
  ? `ember-volcanic-world-production-slice-${volcanicRevision}`
  : "ember-columnar-production-slice-r4";

const views = [
  ["hero", "01 · FRONT"],
  ["front-right", "02 · FRONT RIGHT"],
  ["right", "03 · RIGHT"],
  ["rear-right", "04 · REAR RIGHT"],
  ["rear", "05 · REAR"],
  ["rear-left", "06 · REAR LEFT"],
  ["left", "07 · LEFT"],
  ["front-left", "08 · FRONT LEFT"],
];

const palette = {
  background: "#071115",
  panel: "#102126",
  heading: "#f4f6f1",
  body: "#a7c5c5",
  ember: "#ff5c2e",
};

function svg(width, height, content) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${content}</svg>`
  );
}

function caption(width, label) {
  return svg(
    width,
    38,
    `<rect width="${width}" height="38" fill="${palette.panel}"/>
     <text x="14" y="25" fill="#dcebea" font-family="Segoe UI, sans-serif" font-size="17" font-weight="700">${label}</text>`
  );
}

const columns = 4;
const panelWidth = 480;
const panelHeight = 270;
const captionHeight = 38;
const gap = 12;
const headerHeight = 126;
const rows = 2;
const width = columns * panelWidth + (columns + 1) * gap;
const height =
  headerHeight + rows * (panelHeight + captionHeight) + (rows + 1) * gap;
const composites = [
  {
    input: svg(
      width,
      headerHeight,
      `<rect width="${width}" height="${headerHeight}" fill="${palette.background}"/>
       <rect x="12" y="22" width="6" height="80" rx="3" fill="${palette.ember}"/>
       <text x="34" y="50" fill="${palette.heading}" font-family="Segoe UI, sans-serif" font-size="30" font-weight="800">${volcanic ? "EMBER GATE 4 · VOLCANIC WORLD" : "EMBER GATE 4 · COLUMNAR FURNACE"}</text>
       <text x="34" y="80" fill="${palette.body}" font-family="Segoe UI, sans-serif" font-size="17">${volcanicRevision === "r9" ? "Fresh Rift · young lava · fractured scarps · sheltered ash · iron contact crust" : volcanicRevision === "r8" ? "Breached Caldera Terraces · embedded stage crust · continuous world · complete orbit" : volcanicRevision === "r7" ? "Production slice r7 · selected Meshy geology · continuous terrain · complete orbit" : volcanicRevision === "r6" ? "Production slice r6 · surrounding volcanic country · through-frame lava river · complete orbit" : volcanic ? "Production slice r5 · continuous caldera basin · open lava channel · complete orbit" : "Production slice r4 · buried massif · fractured heat cavity · composed complete orbit"}</text>
       <text x="34" y="104" fill="#708f91" font-family="Segoe UI, sans-serif" font-size="14">${volcanicRevision === "r9" ? "380 × 335 m causality mask · 12 KTX2 maps · 17-point animated lava route · 4 retained Meshy landmarks" : volcanicRevision === "r8" ? "380 × 335 m country · 8 crust transition plates · 17-point lava route · 4 retained Meshy landmarks" : volcanicRevision === "r7" ? "48k hero · 28k lava bank · 32k fumarole talus · 36k breached caldera · registered multiview PBR references" : volcanicRevision === "r6" ? "380 × 335 m terrain field · three travel saddles · distant active vent · no imported hero model" : volcanic ? "230 m exterior field · distant active vent · rafted crust · no imported hero model" : "Non-repeating PBR basalt · collapsed secondary outcrops · clustered talus · no imported hero model"}</text>`
    ),
    left: 0,
    top: 0,
  },
];

for (const [index, [camera, label]] of views.entries()) {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const source = resolve(evidenceDirectory, `${sourcePrefix}-${camera}.png`);
  const image = await sharp(source)
    .resize(panelWidth, panelHeight, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
  const panel = await sharp({
    create: {
      width: panelWidth,
      height: panelHeight + captionHeight,
      channels: 3,
      background: palette.panel,
    },
  })
    .composite([
      { input: caption(panelWidth, label), left: 0, top: 0 },
      { input: image, left: 0, top: captionHeight },
    ])
    .png()
    .toBuffer();
  composites.push({
    input: panel,
    left: gap + column * (panelWidth + gap),
    top: headerHeight + gap + row * (panelHeight + captionHeight + gap),
  });
}

const output = resolve(
  evidenceDirectory,
  volcanic
    ? `ember-volcanic-world-production-slice-${volcanicRevision}-orbit-board.png`
    : "ember-columnar-production-slice-r4-orbit-board.png"
);
await sharp({
  create: { width, height, channels: 3, background: palette.background },
})
  .composite(composites)
  .png()
  .toFile(output);

const sha256 = createHash("sha256")
  .update(await readFile(output))
  .digest("hex");
process.stdout.write(`${output}\nsha256: ${sha256}\n`);

if (volcanic) process.exit(0);

const viewportProofs = [
  ["1920x1080", "4K @ 200% · 1920×1080"],
  ["2560x1440", "4K @ 150% · 2560×1440"],
  ["3840x2160", "4K @ 100% · 3840×2160"],
  ["1440x900", "LAPTOP · 1440×900"],
  ["820x1180", "TABLET · 820×1180"],
  ["960x412", "FOLD LANDSCAPE · 960×412"],
  ["375x667", "IPHONE SE · 375×667"],
];

const viewportColumns = 4;
const viewportPanelWidth = 400;
const viewportPanelHeight = 250;
const viewportCaptionHeight = 38;
const viewportRows = 2;
const viewportHeaderHeight = 116;
const viewportWidth =
  viewportColumns * viewportPanelWidth + (viewportColumns + 1) * gap;
const viewportHeight =
  viewportHeaderHeight +
  viewportRows * (viewportPanelHeight + viewportCaptionHeight) +
  (viewportRows + 1) * gap;
const viewportComposites = [
  {
    input: svg(
      viewportWidth,
      viewportHeaderHeight,
      `<rect width="${viewportWidth}" height="${viewportHeaderHeight}" fill="${palette.background}"/>
       <rect x="12" y="20" width="6" height="76" rx="3" fill="${palette.ember}"/>
       <text x="34" y="49" fill="${palette.heading}" font-family="Segoe UI, sans-serif" font-size="29" font-weight="800">EMBER · FRONT-STAGE FACING PROOF</text>
       <text x="34" y="78" fill="${palette.body}" font-family="Segoe UI, sans-serif" font-size="17">Visible chest and props face the negative-Z audience camera · Columnar Furnace remains the backdrop</text>
       <text x="34" y="100" fill="#708f91" font-family="Segoe UI, sans-serif" font-size="14">Shared Viewer3D formation adapter · same-direction layouts preserve the heading after cast changes</text>`
    ),
    left: 0,
    top: 0,
  },
];

for (const [index, [viewport, label]] of viewportProofs.entries()) {
  const column = index % viewportColumns;
  const row = Math.floor(index / viewportColumns);
  const source = resolve(
    evidenceDirectory,
    `ember-columnar-runtime-front-stage-${viewport}.webp`
  );
  const image = await sharp(source)
    .resize(viewportPanelWidth, viewportPanelHeight, {
      fit: "contain",
      background: palette.background,
    })
    .webp({ quality: 84 })
    .toBuffer();
  const panel = await sharp({
    create: {
      width: viewportPanelWidth,
      height: viewportPanelHeight + viewportCaptionHeight,
      channels: 3,
      background: palette.panel,
    },
  })
    .composite([
      { input: caption(viewportPanelWidth, label), left: 0, top: 0 },
      { input: image, left: 0, top: viewportCaptionHeight },
    ])
    .webp({ quality: 84 })
    .toBuffer();
  viewportComposites.push({
    input: panel,
    left: gap + column * (viewportPanelWidth + gap),
    top:
      viewportHeaderHeight +
      gap +
      row * (viewportPanelHeight + viewportCaptionHeight + gap),
  });
}

const viewportOutput = resolve(
  evidenceDirectory,
  "ember-columnar-runtime-front-stage-viewport-sweep.webp"
);
await sharp({
  create: {
    width: viewportWidth,
    height: viewportHeight,
    channels: 3,
    background: palette.background,
  },
})
  .composite(viewportComposites)
  .webp({ quality: 88 })
  .toFile(viewportOutput);

const viewportSha256 = createHash("sha256")
  .update(await readFile(viewportOutput))
  .digest("hex");
process.stdout.write(`${viewportOutput}\nsha256: ${viewportSha256}\n`);
