#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";
import { PerspectiveCamera, Vector3 } from "three";

const root = process.cwd();

if (process.argv.includes("--cloudbreak")) {
  const { generateOliveCloudbreakGate1 } = await import(
    "./lib/seraphic-vault-cloudbreak-gate1.mjs"
  );
  await generateOliveCloudbreakGate1({ root });
  process.exit(0);
}

const layoutPath = path.resolve(root, "scripts/seraphic-vault-phase2-layout.json");
const outputDirectory = path.resolve(
  root,
  "docs/superpowers/specs/seraphic-vault"
);
const svgPath = path.join(outputDirectory, "seraphic-vault-gate1-board-r2.svg");
const pngPath = path.join(outputDirectory, "seraphic-vault-gate1-board-r2.png");
const reportPath = path.join(outputDirectory, "seraphic-vault-gate1-report-r2.json");

const layout = JSON.parse(await readFile(layoutPath, "utf8"));
await mkdir(outputDirectory, { recursive: true });

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function wrapWords(value, maximumCharacters, maximumLines) {
  const words = String(value).split(/\s+/);
  const lines = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (!last || `${last} ${word}`.length > maximumCharacters) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${last} ${word}`;
    }
  }
  if (lines.length <= maximumLines) return lines;
  const clipped = lines.slice(0, maximumLines);
  clipped[maximumLines - 1] = `${clipped[maximumLines - 1].replace(/[.,;:]$/, "")}…`;
  return clipped;
}

function svgTextLines(lines, x, y, className, lineHeight) {
  return `<text x="${x}" y="${y}" class="${className}">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("")}</text>`;
}

function createCamera(preset) {
  const camera = new PerspectiveCamera(
    preset.fovDegrees,
    preset.aspect,
    0.1,
    250
  );
  camera.position.fromArray(preset.position);
  camera.lookAt(new Vector3(...preset.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function project(camera, position) {
  return new Vector3(...position).project(camera);
}

function projectedWidth(camera, position, width) {
  const [x, y, z] = position;
  const left = project(camera, [x - width / 2, y, z]);
  const right = project(camera, [x + width / 2, y, z]);
  return right.x - left.x;
}

function platformPosition(platform, presetName) {
  return presetName === "desktop"
    ? platform.position
    : platform.responsivePositions[presetName];
}

const cameraMetrics = Object.fromEntries(
  Object.entries(layout.cameraPresets).map(([presetName, preset]) => {
    const camera = createCamera(preset);
    const mainProjectedWidth = projectedWidth(
      camera,
      [0, layout.mainStage.surfaceY, 0],
      layout.mainStage.visualWidth
    );
    const platforms = layout.distantPlatforms.map((platform) => {
      const position = platformPosition(platform, presetName);
      const projectedCenter = project(camera, position);
      const ndcWidth = projectedWidth(
        camera,
        position,
        layout.mainStage.visualWidth * platform.worldScale
      );
      const ndcHeight = ndcWidth * 0.38;
      return {
        id: platform.id,
        name: platform.name,
        worldPosition: position,
        projectedCenter: {
          x: round(projectedCenter.x),
          y: round(projectedCenter.y),
        },
        ndcBoundsX: [
          round(projectedCenter.x - ndcWidth / 2),
          round(projectedCenter.x + ndcWidth / 2),
        ],
        ndcBoundsY: [
          round(projectedCenter.y - ndcHeight / 2),
          round(projectedCenter.y + ndcHeight / 2),
        ],
        screenWidthRatio: round(ndcWidth / mainProjectedWidth),
        targetScreenWidthRatio: platform.targetScreenWidthRatio,
        targetNdc: platform.targetNdc[presetName],
      };
    });
    return [
      presetName,
      {
        label: preset.label,
        preset,
        mainProjectedWidth: round(mainProjectedWidth),
        sunProjection: project(camera, layout.sun.position)
          .toArray()
          .slice(0, 2)
          .map((value) => round(value)),
        platforms,
      },
    ];
  })
);

const mainProjectedWidth = cameraMetrics.desktop.mainProjectedWidth;
const platformMetrics = cameraMetrics.desktop.platforms;

const protectedBand = layout.protectedHeroBand;
const minimumShellRadius = Math.max(
  Math.abs(layout.mainStage.bounds.min[0]),
  Math.abs(layout.mainStage.bounds.max[0]),
  Math.abs(layout.mainStage.bounds.min[2]),
  Math.abs(layout.mainStage.bounds.max[2])
);

function minimumCenterSeparation(metrics, axis) {
  const values = metrics
    .map((metric) => metric.projectedCenter[axis])
    .sort((a, b) => a - b);
  return Math.min(
    ...values.slice(1).map((value, index) => value - values[index])
  );
}

function rectanglesOverlap(a, b) {
  return !(
    a[1] <= b[0] ||
    a[0] >= b[1] ||
    a[3] <= b[2] ||
    a[2] >= b[3]
  );
}

const checks = [
  {
    name: "walkability",
    passed: layout.mainStage.performanceClearRadius >= 5.5,
    evidence: `${layout.mainStage.performanceClearRadius.toFixed(1)} m central performance radius remains unchanged.`,
  },
  {
    name: "clearance",
    passed: Object.keys(cameraMetrics).every((presetName) =>
      layout.distantPlatforms.every((platform) => {
        const [x, , z] = platformPosition(platform, presetName);
        const distance = Math.hypot(x, z);
        const platformRadius =
          (layout.mainStage.visualWidth * platform.worldScale) / 2;
        return distance > minimumShellRadius + platformRadius + 2;
      })
    ),
    evidence: "Every responsive platform transform clears the main shell by at least 2 m beyond combined visual radii.",
  },
  {
    name: "sightlines",
    passed:
      Object.values(cameraMetrics).every(
        ({ platforms }) =>
          platforms.every(
            (metric) =>
              metric.ndcBoundsX[1] <= protectedBand.ndcMinX ||
              metric.ndcBoundsX[0] >= protectedBand.ndcMaxX
          ) &&
          minimumCenterSeparation(platforms, "x") >= 0.15 &&
          minimumCenterSeparation(platforms, "y") >= 0.15
      ) &&
      platformMetrics.every((metric) =>
        layout.desktopFeatherExclusionZones.every(
          (zone) =>
            !rectanglesOverlap(
              [
                metric.ndcBoundsX[0],
                metric.ndcBoundsX[1],
                metric.ndcBoundsY[0],
                metric.ndcBoundsY[1],
              ],
              zone.ndcBounds
            )
        )
      ),
    evidence: "All registered cameras keep the center clear, separate platform columns and heights by at least 0.15 NDC, and keep desktop platforms outside the outer-feather silhouette masks.",
  },
  {
    name: "final-view",
    passed: Object.values(cameraMetrics).every(({ platforms }) =>
      platforms.every(
        (metric) =>
          metric.ndcBoundsX[0] >= -0.96 &&
          metric.ndcBoundsX[1] <= 0.96 &&
          metric.ndcBoundsY[0] >= -0.76 &&
          metric.ndcBoundsY[1] <= 0.76 &&
          Math.abs(
            metric.screenWidthRatio - metric.targetScreenWidthRatio
          ) <= 0.025 &&
          Math.abs(metric.projectedCenter.x - metric.targetNdc[0]) <= 0.005 &&
          Math.abs(metric.projectedCenter.y - metric.targetNdc[1]) <= 0.005
      )
    ),
    evidence: "All four islands fit the desktop, portrait-phone, and landscape-phone frames at the registered NDC targets and preserve the 30/18/10/6% width progression.",
  },
];

const failedChecks = checks.filter((check) => !check.passed);
if (failedChecks.length > 0) {
  throw new Error(
    `Gate 1 layout failed: ${failedChecks.map((check) => check.name).join(", ")}`
  );
}

const sourcePaths = [
  "docs/superpowers/specs/active/2026-08-09-seraphic-vault-celestial-design.md",
  "scripts/build-celestial-environment.py",
  "src/lib/shared/3d/environments/scenes/CelestialScene.svelte",
  "src/lib/shared/3d/environments/domain/models/scene-configs/celestial-scene-config.ts",
  "static/models/celestial/celestial-environment.glb",
];
const sourceDigests = {};
for (const sourcePath of sourcePaths) {
  const buffer = await readFile(path.resolve(root, sourcePath));
  sourceDigests[sourcePath] = sha256(buffer);
}

const width = 1920;
const height = 1080;
const panelFill = "#102947";
const panelStroke = "#4776a4";
const cream = "#fff4d7";
const gold = "#ffd38a";
const blue = "#8db8e8";
const mist = "#b8d6ef";
const muted = "#87a6c4";

const plan = { x: 48, y: 116, w: 884, h: 422 };
const section = { x: 988, y: 116, w: 884, h: 422 };
const route = { x: 48, y: 590, w: 884, h: 430 };
const sight = { x: 988, y: 590, w: 884, h: 430 };
const worldXMin = -46;
const worldXMax = 46;
const worldZMin = -65;
const worldZMax = 40;
const planX = (x) =>
  plan.x + 38 + ((x - worldXMin) / (worldXMax - worldXMin)) * (plan.w - 76);
const planY = (z) =>
  plan.y + 42 + ((z - worldZMin) / (worldZMax - worldZMin)) * (plan.h - 78);
const sectionX = (z) =>
  section.x + 38 + ((z - worldZMin) / (worldZMax - worldZMin)) * (section.w - 76);
const sectionY = (y) =>
  section.y + 36 + ((16 - y) / 31) * (section.h - 70);

const stagePoints = layout.mainStage.outlineXZ
  .map(([x, z]) => `${round(planX(x), 1)},${round(planY(z), 1)}`)
  .join(" ");
const planPlatforms = layout.distantPlatforms
  .map((platform, index) => {
    const [x, , z] = platform.position;
    const radius = layout.mainStage.visualWidth * platform.worldScale * 0.46;
    const cx = planX(x);
    const cy = planY(z);
    const rx = Math.max(8, (radius / (worldXMax - worldXMin)) * (plan.w - 76));
    const ry = Math.max(5, rx * 0.42);
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${blue}" fill-opacity="${platform.atmosphericOpacity}" stroke="${mist}" stroke-width="2"/><text x="${cx + rx + 7}" y="${cy + 4}" class="small">${index + 1}. ${escapeXml(platform.name)}</text>`;
  })
  .join("");

const sectionPlatforms = layout.distantPlatforms
  .map((platform, index) => {
    const [, y, z] = platform.position;
    const platformWidth = 26 * platform.worldScale;
    const x1 = sectionX(z - platformWidth / 2);
    const x2 = sectionX(z + platformWidth / 2);
    const py = sectionY(y);
    return `<path d="M ${x1} ${py} Q ${(x1 + x2) / 2} ${py - 8} ${x2} ${py}" fill="none" stroke="${blue}" stroke-opacity="${Math.max(0.36, platform.atmosphericOpacity)}" stroke-width="6" stroke-linecap="round"/><text x="${(x1 + x2) / 2}" y="${py - 13}" text-anchor="middle" class="tiny">${index + 1}</text>`;
  })
  .join("");

const routeCards = layout.attentionRoute
  .map((stop, index) => {
    const cardWidth = 198;
    const x = route.x + 28 + index * 211;
    const y = route.y + 82;
    const cueX = [0, -42, 37, 52][index];
    const cueY = [-5, 28, 34, -16][index];
    const focusLines = wrapWords(stop.focus, 24, 3);
    const understandingLines = wrapWords(stop.understanding, 29, 3);
    return `<g><rect x="${x}" y="${y}" width="${cardWidth}" height="286" rx="16" fill="#0a2038" stroke="#355f87"/><circle cx="${x + 24}" cy="${y + 24}" r="14" fill="${gold}"/><text x="${x + 24}" y="${y + 29}" text-anchor="middle" class="number">${stop.stop}</text><rect x="${x + 18}" y="${y + 48}" width="162" height="92" rx="10" fill="#6f95c5"/><path d="M ${x + 55} ${y + 130} Q ${x + 45} ${y + 68} ${x + 88} ${y + 62}" fill="none" stroke="${cream}" stroke-width="7" stroke-linecap="round"/><path d="M ${x + 143} ${y + 130} Q ${x + 153} ${y + 68} ${x + 110} ${y + 62}" fill="none" stroke="${cream}" stroke-width="7" stroke-linecap="round"/><circle cx="${x + 99 + cueX}" cy="${y + 87 + cueY}" r="9" fill="${gold}"/>${svgTextLines(focusLines, x + 18, y + 168, "cardTitle", 18)}${svgTextLines(understandingLines, x + 18, y + 230, "cardBody", 18)}</g>`;
  })
  .join("");

const registeredFrames = [
  { presetName: "desktop", x: sight.x + 28, y: sight.y + 104, w: 268, h: 151 },
  { presetName: "portrait", x: sight.x + 368, y: sight.y + 88, w: 136, h: 242 },
  { presetName: "landscapePhone", x: sight.x + 568, y: sight.y + 116, w: 278, h: 119 },
];

function renderRegisteredFrame(frame) {
  const metrics = cameraMetrics[frame.presetName];
  const frameX = (ndcX) => frame.x + ((ndcX + 1) / 2) * frame.w;
  const frameY = (ndcY) => frame.y + ((1 - ndcY) / 2) * frame.h;
  const platforms = metrics.platforms
    .map((metric, index) => {
      const platform = layout.distantPlatforms[index];
      const x = frameX(metric.projectedCenter.x);
      const y = frameY(metric.projectedCenter.y);
      const platformWidth =
        (metric.ndcBoundsX[1] - metric.ndcBoundsX[0]) * (frame.w / 2);
      return `<ellipse cx="${x}" cy="${y}" rx="${platformWidth / 2}" ry="${Math.max(3, platformWidth * 0.18)}" fill="${blue}" fill-opacity="${platform.atmosphericOpacity}" stroke="${mist}" stroke-opacity="0.72"/><text x="${x}" y="${y - Math.max(7, platformWidth * 0.24)}" text-anchor="middle" class="tiny">${index + 1}</text>`;
    })
    .join("");
  const [sunX, sunY] = metrics.sunProjection;
  return `<g><text x="${frame.x + frame.w / 2}" y="${frame.y - 12}" text-anchor="middle" class="label">${escapeXml(metrics.label)} · ${metrics.preset.fovDegrees}°</text><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="9" fill="url(#sky)" stroke="#78a4cf"/><rect x="${frameX(-0.2)}" y="${frame.y}" width="${frameX(0.2) - frameX(-0.2)}" height="${frame.h}" fill="none" stroke="${gold}" stroke-dasharray="5 5"/><path d="M ${frameX(-0.46)} ${frameY(-0.42)} Q ${frameX(-0.58)} ${frameY(0.5)} ${frameX(-0.26)} ${frameY(0.63)}" fill="none" stroke="${cream}" stroke-width="${Math.max(5, frame.w * 0.018)}" stroke-linecap="round"/><path d="M ${frameX(0.46)} ${frameY(-0.42)} Q ${frameX(0.58)} ${frameY(0.5)} ${frameX(0.26)} ${frameY(0.63)}" fill="none" stroke="${cream}" stroke-width="${Math.max(5, frame.w * 0.018)}" stroke-linecap="round"/><ellipse cx="${frameX(0)}" cy="${frameY(-0.46)}" rx="${frame.w * 0.22}" ry="${Math.max(6, frame.h * 0.055)}" fill="${cream}" fill-opacity="0.9"/><circle cx="${frameX(sunX)}" cy="${frameY(sunY)}" r="${Math.max(7, frame.w * 0.025)}" fill="${gold}" filter="url(#glow)"/>${platforms}</g>`;
}

const registeredSightlines = registeredFrames
  .map((frame) => renderRegisteredFrame(frame))
  .join("");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07182c"/><stop offset="1" stop-color="#0b2440"/></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6184b6"/><stop offset="1" stop-color="#b7c9db"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      text { font-family: Arial, sans-serif; fill: #eef6ff; }
      .title { font-size: 34px; font-weight: 700; letter-spacing: 1.5px; }
      .subtitle { font-size: 17px; fill: #9fc1df; }
      .panelTitle { font-size: 21px; font-weight: 700; fill: #fff4d7; }
      .small { font-size: 14px; fill: #d7e7f6; }
      .tiny { font-size: 12px; font-weight: 700; fill: #e4f0fb; }
      .label { font-size: 15px; font-weight: 700; fill: #ffd38a; }
      .number { font-size: 13px; font-weight: 800; fill: #102947; }
      .cardTitle { font-size: 14px; font-weight: 700; fill: #fff4d7; }
      .cardBody { font-size: 12px; fill: #a9c7e1; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <text x="48" y="52" class="title">SERAPHIC VAULT · PHASE 2 · GATE 1</text>
  <text x="48" y="82" class="subtitle">Measured composition candidate · four distant sanctuaries · central hero band protected</text>
  <text x="1872" y="55" text-anchor="end" class="label">WORLD METRES / HERO CAMERA 48°</text>

  <rect x="${plan.x}" y="${plan.y}" width="${plan.w}" height="${plan.h}" rx="18" fill="${panelFill}" stroke="${panelStroke}" stroke-width="2"/>
  <text x="${plan.x + 24}" y="${plan.y + 31}" class="panelTitle">1. Top-down composition plan</text>
  <line x1="${planX(-46)}" y1="${planY(0)}" x2="${planX(46)}" y2="${planY(0)}" stroke="#315778" stroke-dasharray="5 7"/>
  <line x1="${planX(0)}" y1="${planY(-65)}" x2="${planX(0)}" y2="${planY(40)}" stroke="#315778" stroke-dasharray="5 7"/>
  <path d="M ${planX(0)} ${planY(34)} L ${planX(-45)} ${planY(-65)} M ${planX(0)} ${planY(34)} L ${planX(45)} ${planY(-65)}" stroke="#4776a4" stroke-opacity="0.45" fill="none"/>
  <polygon points="${stagePoints}" fill="${cream}" fill-opacity="0.84" stroke="${gold}" stroke-width="2"/>
  <circle cx="${planX(0)}" cy="${planY(0)}" r="${(5.5 / (worldXMax - worldXMin)) * (plan.w - 76)}" fill="none" stroke="#fff" stroke-dasharray="7 6" stroke-width="2"/>
  <text x="${planX(0) + 10}" y="${planY(0) - 12}" class="small">5.5 m clear performance radius</text>
  ${planPlatforms}
  <circle cx="${planX(0)}" cy="${planY(-27)}" r="10" fill="${gold}" filter="url(#glow)"/>
  <text x="${planX(0) + 15}" y="${planY(-27) + 5}" class="small">Sun</text>
  <path d="M ${planX(0) - 9} ${planY(34) + 12} L ${planX(0)} ${planY(34) - 8} L ${planX(0) + 9} ${planY(34) + 12} Z" fill="${gold}"/>
  <text x="${planX(0) + 16}" y="${planY(34) + 8}" class="small">Hero camera</text>
  <text x="${plan.x + 22}" y="${plan.y + plan.h - 18}" class="small">FRONT / CAMERA</text><text x="${plan.x + plan.w - 22}" y="${plan.y + plan.h - 18}" text-anchor="end" class="small">DEEP SKY ↑</text>

  <rect x="${section.x}" y="${section.y}" width="${section.w}" height="${section.h}" rx="18" fill="${panelFill}" stroke="${panelStroke}" stroke-width="2"/>
  <text x="${section.x + 24}" y="${section.y + 31}" class="panelTitle">2. Vertical section · camera to deep sky</text>
  <line x1="${sectionX(-65)}" y1="${sectionY(0)}" x2="${sectionX(40)}" y2="${sectionY(0)}" stroke="#54789a" stroke-dasharray="6 6"/>
  <rect x="${sectionX(-11.4)}" y="${sectionY(0.01) - 4}" width="${sectionX(7.6) - sectionX(-11.4)}" height="8" rx="4" fill="${cream}"/>
  <circle cx="${sectionX(0)}" cy="${sectionY(7.8)}" r="7" fill="${gold}"/><text x="${sectionX(0) + 12}" y="${sectionY(7.8) + 4}" class="small">Hero camera · 7.8 m</text>
  <circle cx="${sectionX(-27)}" cy="${sectionY(6.2)}" r="13" fill="${gold}" filter="url(#glow)"/><text x="${sectionX(-27) + 18}" y="${sectionY(6.2) + 5}" class="small">Sun · 6.2 m</text>
  ${sectionPlatforms}
  <path d="M ${sectionX(34)} ${sectionY(7.8)} L ${sectionX(-27)} ${sectionY(6.2)}" stroke="${gold}" stroke-opacity="0.35" stroke-dasharray="6 6"/>
  <path d="M ${sectionX(-65)} ${sectionY(-1.2)} C ${sectionX(-30)} ${sectionY(-0.2)}, ${sectionX(5)} ${sectionY(-2.1)}, ${sectionX(40)} ${sectionY(-1.0)}" fill="none" stroke="${mist}" stroke-opacity="0.62" stroke-width="11"/>
  <text x="${section.x + 24}" y="${section.y + section.h - 18}" class="small">Platforms 1–3 descend below the main deck. Platform 4 is the only high distant accent.</text>

  <rect x="${route.x}" y="${route.y}" width="${route.w}" height="${route.h}" rx="18" fill="${panelFill}" stroke="${panelStroke}" stroke-width="2"/>
  <text x="${route.x + 24}" y="${route.y + 31}" class="panelTitle">3. Numbered attention route</text>
  <text x="${route.x + 24}" y="${route.y + 56}" class="small">This fixed-camera environment has no walking route. The gate tracks the intended visual read instead.</text>
  ${routeCards}

  <rect x="${sight.x}" y="${sight.y}" width="${sight.w}" height="${sight.h}" rx="18" fill="${panelFill}" stroke="${panelStroke}" stroke-width="2"/>
  <text x="${sight.x + 24}" y="${sight.y + 31}" class="panelTitle">4. Registered camera sightlines</text>
  <text x="${sight.x + 24}" y="${sight.y + 56}" class="small">Responsive transforms preserve four distinct beats. Dashed center remains clear in every registered frame.</text>
  ${registeredSightlines}
  <text x="${sight.x + 24}" y="${sight.y + sight.h - 56}" class="small">Minimum horizontal and vertical center separation: 0.15 NDC. Desktop outer-feather masks also stay clear.</text>
  <text x="${sight.x + 24}" y="${sight.y + sight.h - 30}" class="small">Width hierarchy remains approximately 30% → 18% → 10% → 6% on desktop and both phone presets.</text>
</svg>`;

await writeFile(svgPath, svg, "utf8");
await sharp(Buffer.from(svg)).png().toFile(pngPath);

const report = {
  generatedAt: new Date().toISOString(),
  layoutPath: path.relative(root, layoutPath).replaceAll("\\", "/"),
  artifacts: {
    svg: path.relative(root, svgPath).replaceAll("\\", "/"),
    png: path.relative(root, pngPath).replaceAll("\\", "/"),
  },
  sourceDigests,
  protectedHeroBand: layout.protectedHeroBand,
  desktopFeatherExclusionZones: layout.desktopFeatherExclusionZones,
  mainProjectedWidth: round(mainProjectedWidth),
  platformMetrics,
  cameraMetrics,
  checks,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify({ board: pngPath, report: reportPath, checks }, null, 2)}\n`
);
