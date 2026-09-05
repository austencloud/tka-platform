#!/usr/bin/env node

import { resolve } from "node:path";

import sharp from "sharp";

const midflank = process.argv.includes("--midflank-r5");
const evidenceDir = resolve(
  "docs/superpowers/specs/ember-spatial-directions/evidence",
  midflank ? "gate-3-midflank-r5" : "gate-4-atmosphere-r1"
);

const palette = {
  background: "#090708",
  panel: "#1a1111",
  heading: "#fff3ea",
  body: "#d0aaa0",
  ember: "#ff5420",
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
     <text x="14" y="25" fill="#f5ded6" font-family="Segoe UI, sans-serif" font-size="17" font-weight="700">${label}</text>`
  );
}

async function buildBoard({
  title,
  subtitle,
  items,
  columns,
  panelWidth,
  panelHeight,
  fit = "cover",
  output,
}) {
  const gap = 12;
  const headerHeight = 116;
  const captionHeight = 38;
  const rows = Math.ceil(items.length / columns);
  const width = columns * panelWidth + (columns + 1) * gap;
  const height =
    headerHeight + rows * (panelHeight + captionHeight) + (rows + 1) * gap;
  const composites = [
    {
      input: svg(
        width,
        headerHeight,
        `<rect width="${width}" height="${headerHeight}" fill="${palette.background}"/>
         <rect x="12" y="20" width="6" height="76" rx="3" fill="${palette.ember}"/>
         <text x="34" y="49" fill="${palette.heading}" font-family="Segoe UI, sans-serif" font-size="29" font-weight="800">${title}</text>
         <text x="34" y="80" fill="${palette.body}" font-family="Segoe UI, sans-serif" font-size="17">${subtitle}</text>`
      ),
      left: 0,
      top: 0,
    },
  ];

  for (const [index, item] of items.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const image = await sharp(resolve(evidenceDir, item.file))
      .resize(panelWidth, panelHeight, {
        fit,
        position: "centre",
        background: palette.background,
      })
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
        { input: caption(panelWidth, item.label), left: 0, top: 0 },
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

  await sharp({
    create: { width, height, channels: 3, background: palette.background },
  })
    .composite(composites)
    .png()
    .toFile(resolve(evidenceDir, output));
}

if (midflank) {
  await buildBoard({
    title: "EMBER / MID-FLANK FIRE PILGRIMAGE",
    subtitle:
      "Gate 3 / material and lighting review / pale marker: performer / brown: audience",
    columns: 2,
    panelWidth: 800,
    panelHeight: 450,
    fit: "contain",
    output: "ember-r5-material-target-board.png",
    items: [
      {
        file: "paintover-default-audience.png",
        label: "01 / SURFACE FINISH TARGET / AI PAINTOVER",
      },
      {
        file: "target-default-audience.png",
        label: "02 / SAME CAMERA / EXACT BLENDER STUDY",
      },
      {
        file: "target-midflank-oblique.png",
        label: "03 / LOCKED WIDE VIEW / BLENDER",
      },
      {
        file: "target-orbit-180.png",
        label: "04 / LOCKED DOWNHILL VIEW / BLENDER",
      },
    ],
  });
  await buildBoard({
    title: "EMBER / REGISTERED R5 ORBIT",
    subtitle:
      "Eight approved cameras / unchanged terrain and figure positions / material-only Blender study",
    columns: 4,
    panelWidth: 480,
    panelHeight: 270,
    fit: "contain",
    output: "ember-r5-orbit-board.png",
    items: Array.from({ length: 8 }, (_, index) => {
      const angle = String(index * 45).padStart(3, "0");
      return {
        file: `target-orbit-${angle}.png`,
        label: `ORBIT ${angle} DEGREES`,
      };
    }),
  });
  await buildBoard({
    title: "COOLED BENCH / PERIPHERAL HEAT STUDY",
    subtitle:
      "Same camera and fractures / right: authored ember invention at a static peak / no pulse timing claim",
    columns: 2,
    panelWidth: 800,
    panelHeight: 450,
    fit: "contain",
    output: "ember-r5-ember-comparison.png",
    items: [
      {
        file: "target-default-audience.png",
        label: "01 / COLD BENCH / RECOMMENDED",
      },
      {
        file: "alternative-peripheral-ember-peak.png",
        label: "02 / OPTIONAL PERIPHERAL EMBER PEAK",
      },
    ],
  });
} else {
  await buildBoard({
    title: "EMBER GATE 4 · ATMOSPHERE AUDITION",
    subtitle:
      "Same R7 geometry and hero camera · Blackglass selected for contrast, identity, and performer readability",
    columns: 3,
    panelWidth: 640,
    panelHeight: 360,
    output: "ember-atmosphere-look-board.png",
    items: [
      {
        file: "look-blackglass-inferno-hero-1920x1080.png",
        label: "01 · BLACKGLASS INFERNO · SELECTED",
      },
      {
        file: "look-furnace-storm-hero-1920x1080.png",
        label: "02 · FURNACE STORM",
      },
      {
        file: "look-sulfur-caldera-hero-1920x1080.png",
        label: "03 · SULFUR CALDERA",
      },
    ],
  });

  const orbitNames = [
    "front",
    "front-right",
    "right",
    "rear-right",
    "rear",
    "rear-left",
    "left",
    "front-left",
  ];
  await buildBoard({
    title: "EMBER BLACKGLASS · COMPLETE ORBIT",
    subtitle:
      "One selected lighting/material rig · stage readability, continuous terrain, and volcanic identity checked through 360°",
    columns: 4,
    panelWidth: 480,
    panelHeight: 270,
    output: "ember-blackglass-orbit-board.png",
    items: orbitNames.map((name, index) => ({
      file: `orbit-${name}-1920x1080.png`,
      label: `${String(index + 1).padStart(2, "0")} · ${name.toUpperCase().replace("-", " ")}`,
    })),
  });

  await buildBoard({
    title: "EMBER BLACKGLASS · VIEWPORT PROOF",
    subtitle:
      "Production viewer from 4K TV through iPhone SE · no alternate composition or reduced scene",
    columns: 4,
    panelWidth: 400,
    panelHeight: 250,
    fit: "contain",
    output: "ember-blackglass-viewport-board.png",
    items: [
      ["viewport-4k-200-1920x1080.png", "4K @ 200% · 1920×1080"],
      ["viewport-4k-150-2560x1440.png", "4K @ 150% · 2560×1440"],
      ["viewport-4k-100-3840x2160.png", "4K @ 100% · 3840×2160"],
      ["viewport-laptop-1440x900.png", "LAPTOP · 1440×900"],
      ["viewport-tablet-820x1180.png", "TABLET · 820×1180"],
      ["viewport-fold-landscape-960x412.png", "FOLD · 960×412"],
      ["viewport-iphone-se-375x667.png", "IPHONE SE · 375×667"],
    ].map(([file, label]) => ({ file, label })),
  });
}

console.log(`Ember contact sheets: ${evidenceDir}`);
