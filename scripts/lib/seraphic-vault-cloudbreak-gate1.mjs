import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PerspectiveCamera, Vector3 } from "three";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapWords(value, maximumCharacters, maximumLines) {
  const words = String(value).split(/\s+/);
  const lines = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || `${current} ${word}`.length > maximumCharacters) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  if (lines.length <= maximumLines) return lines;
  const clipped = lines.slice(0, maximumLines);
  clipped[maximumLines - 1] = `${clipped[maximumLines - 1]}…`;
  return clipped;
}

function svgLines(lines, x, y, className, lineHeight, anchor = "start") {
  return `<text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">${lines
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
    300
  );
  camera.position.fromArray(preset.position);
  camera.lookAt(new Vector3(...preset.target));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function projectedWidth(camera, position, width) {
  const left = new Vector3(
    position[0] - width / 2,
    position[1],
    position[2]
  ).project(camera);
  const right = new Vector3(
    position[0] + width / 2,
    position[1],
    position[2]
  ).project(camera);
  return Math.abs(right.x - left.x);
}

function centroidXZ(points) {
  const total = points.reduce(
    (sum, point) => [sum[0] + point[0], sum[1] + point[1]],
    [0, 0]
  );
  return [total[0] / points.length, total[1] / points.length];
}

function minimumDistanceFrom(center, points) {
  return Math.min(
    ...points.map(([x, z]) => Math.hypot(x - center[0], z - center[1]))
  );
}

export async function generateOliveCloudbreakGate1({ root }) {
  const layoutPath = path.resolve(
    root,
    "scripts/seraphic-vault-cloudbreak-layout.json"
  );
  const outputDirectory = path.resolve(
    root,
    "docs/superpowers/specs/seraphic-vault"
  );
  const svgPath = path.join(
    outputDirectory,
    "seraphic-vault-gate1-cloudbreak-r2.svg"
  );
  const pngPath = path.join(
    outputDirectory,
    "seraphic-vault-gate1-cloudbreak-r2.png"
  );
  const reportPath = path.join(
    outputDirectory,
    "seraphic-vault-gate1-cloudbreak-r2-report.json"
  );
  const designPath = path.resolve(
    root,
    "docs/superpowers/specs/active/2026-08-09-olive-cloudbreak-celestial-pivot.md"
  );

  const layout = JSON.parse(await readFile(layoutPath, "utf8"));
  await mkdir(outputDirectory, { recursive: true });

  const performanceCenter = layout.performanceTerrace.centerXZ;
  const lagoonClearance =
    minimumDistanceFrom(performanceCenter, layout.lagoon.outlineXZ) -
    layout.performanceTerrace.clearRadius;
  const treeClearances = layout.oliveTrees.map((tree) => ({
    id: tree.id,
    clearance:
      Math.hypot(
        tree.position[0] - performanceCenter[0],
        tree.position[2] - performanceCenter[1]
      ) -
      tree.exclusionRadius -
      layout.performanceTerrace.clearRadius,
  }));

  const lagoonCenter = centroidXZ(layout.lagoon.outlineXZ);
  const cameraMetrics = Object.fromEntries(
    Object.entries(layout.cameraPresets).map(([name, preset]) => {
      const camera = createCamera(preset);
      const project = (position) => {
        const projected = new Vector3(...position).project(camera);
        return { x: round(projected.x), y: round(projected.y) };
      };
      return [
        name,
        {
          label: preset.label,
          preset,
          stage: project([
            performanceCenter[0],
            layout.performanceTerrace.surfaceY,
            performanceCenter[1],
          ]),
          lagoon: project([
            lagoonCenter[0],
            layout.lagoon.surfaceY,
            lagoonCenter[1],
          ]),
          sun: project(layout.sun.position),
          trees: layout.oliveTrees.map((tree) => ({
            id: tree.id,
            projection: project([
              tree.position[0],
              tree.position[1] + tree.height * 0.45,
              tree.position[2],
            ]),
          })),
          mesas: layout.distantMesas.map((mesa) => ({
            id: mesa.id,
            projection: project(mesa.position),
            raised: mesa.topY > layout.performanceTerrace.surfaceY + 4,
          })),
        },
      ];
    })
  );

  const solarSilhouetteClearance = Object.fromEntries(
    Object.entries(layout.cameraPresets).map(([name, preset]) => {
      const camera = createCamera(preset);
      const sunProjection = new Vector3(...layout.sun.position).project(camera);
      const sunHalfWidth =
        projectedWidth(
          camera,
          layout.sun.position,
          layout.sun.visualDiameter
        ) / 2;
      const mesas = layout.distantMesas.map((mesa) => {
        const mesaProjection = new Vector3(...mesa.position).project(camera);
        const mesaHalfWidth =
          projectedWidth(camera, mesa.position, mesa.width) / 2;
        return {
          id: mesa.id,
          horizontalClearance: round(
            Math.abs(mesaProjection.x - sunProjection.x) -
              sunHalfWidth -
              mesaHalfWidth
          ),
        };
      });
      return [name, mesas];
    })
  );

  const band = layout.protectedHeroBand;
  const raisedMesaCount = layout.distantMesas.filter(
    (mesa) => mesa.topY > layout.performanceTerrace.surfaceY + 4
  ).length;
  const checks = [
    {
      name: "walkability",
      passed:
        layout.approach.minimumWidth >= 6 &&
        layout.performanceTerrace.clearRadius >= 5.5,
      evidence: `${layout.approach.minimumWidth.toFixed(1)} m rear-shelf width and ${layout.performanceTerrace.clearRadius.toFixed(2)} m dry performance radius.`,
    },
    {
      name: "clearance",
      passed:
        lagoonClearance >= layout.lagoon.minimumClearanceFromPerformance &&
        treeClearances.every(({ clearance }) => clearance >= 0),
      evidence: `Lagoon clears the performance circle by ${lagoonClearance.toFixed(2)} m; both tree exclusions remain outside it.`,
    },
    {
      name: "sightlines",
      passed: Object.entries(cameraMetrics).every(
        ([cameraName, metric]) =>
          metric.sun.x >= -0.2 &&
          metric.sun.x <= 0.2 &&
          metric.sun.y >= 0.02 &&
          metric.sun.y <= 0.8 &&
          metric.lagoon.x > band.ndcMaxX &&
          metric.trees.every(
            ({ projection }) =>
              projection.x < band.ndcMinX || projection.x > band.ndcMaxX
          ) &&
          solarSilhouetteClearance[cameraName].every(
            ({ horizontalClearance }) => horizontalClearance >= 0.015
          )
      ),
      evidence:
        "All registered cameras keep the sun near center and clear of every mesa silhouette, the lagoon on the right edge, and both olive trunks outside the protected hero band.",
    },
    {
      name: "final-view",
      passed:
        layout.landmass.continuesBeyondRearFrame &&
        raisedMesaCount >= 2 &&
        layout.sun.position[2] <
          Math.min(...layout.distantMesas.map((mesa) => mesa.position[2])) - 20 &&
        Object.values(cameraMetrics).every(
          (metric) =>
            Math.abs(metric.stage.x) <= 0.08 &&
            metric.stage.y >= -0.5 &&
            metric.stage.y <= 0.2 &&
            metric.mesas.filter(
              ({ projection }) =>
                Math.abs(projection.x) <= 0.98 &&
                projection.y >= -0.82 &&
                projection.y <= 0.9
            ).length >= 3
        ),
      evidence: `${raisedMesaCount} mesas rise above the terrace; the sun is ${Math.abs(layout.sun.position[2])} m deep and at least three mesas remain visible in every registered frame.`,
    },
  ];

  const failedChecks = checks.filter((check) => !check.passed);
  if (failedChecks.length > 0) {
    throw new Error(
      `Cloudbreak Gate 1 failed: ${failedChecks.map((check) => check.name).join(", ")}`
    );
  }

  const width = 1920;
  const height = 1080;
  const ink = "#19343e";
  const mutedInk = "#577078";
  const limestone = "#ead8ad";
  const limestoneLight = "#f6e9c7";
  const olive = "#53633f";
  const water = "#83b5c8";
  const sun = "#f7bd55";
  const cloud = "#dfe8e7";
  const panel = "#f7f1df";
  const border = "#b8aa86";

  const plan = { x: 48, y: 116, w: 884, h: 422 };
  const section = { x: 988, y: 116, w: 884, h: 422 };
  const route = { x: 48, y: 590, w: 884, h: 430 };
  const sight = { x: 988, y: 590, w: 884, h: 430 };

  const localMinX = -22;
  const localMaxX = 22;
  const localMinZ = -18;
  const localMaxZ = 52;
  const planX = (x) =>
    plan.x + 36 + ((x - localMinX) / (localMaxX - localMinX)) * (plan.w - 72);
  const planY = (z) =>
    plan.y + 42 + ((localMaxZ - z) / (localMaxZ - localMinZ)) * (plan.h - 78);
  const sectionX = (z) =>
    section.x + 38 + ((52 - z) / (52 - -122)) * (section.w - 76);
  const sectionY = (y) =>
    section.y + 38 + ((18 - y) / (18 - -22)) * (section.h - 76);

  const landmassPoints = layout.landmass.outlineXZ
    .map(([x, z]) => `${round(planX(x), 1)},${round(planY(z), 1)}`)
    .join(" ");
  const lagoonPoints = layout.lagoon.outlineXZ
    .map(([x, z]) => `${round(planX(x), 1)},${round(planY(z), 1)}`)
    .join(" ");
  const clearRadiusPixels =
    (layout.performanceTerrace.clearRadius / (localMaxX - localMinX)) *
    (plan.w - 72);

  const treePlan = layout.oliveTrees
    .map(
      (tree) =>
        `<g><circle cx="${planX(tree.position[0])}" cy="${planY(tree.position[2])}" r="18" fill="${olive}"/><circle cx="${planX(tree.position[0])}" cy="${planY(tree.position[2])}" r="5" fill="${ink}"/><text x="${planX(tree.position[0])}" y="${planY(tree.position[2]) - 25}" class="tiny" text-anchor="middle">OLIVE</text></g>`
    )
    .join("");

  const mesaSection = layout.distantMesas
    .map((mesa, index) => {
      const x = sectionX(mesa.position[2]);
      const halfWidth = Math.max(8, mesa.width * 1.15);
      return `<g><path d="M ${x - halfWidth} ${sectionY(mesa.topY)} Q ${x} ${sectionY(mesa.topY) - 6} ${x + halfWidth} ${sectionY(mesa.topY)} L ${x + halfWidth * 0.58} ${sectionY(mesa.cloudBaseY)} L ${x - halfWidth * 0.55} ${sectionY(mesa.cloudBaseY)} Z" fill="${limestone}" stroke="${border}"/><text x="${x}" y="${sectionY(mesa.topY) - 11}" class="tiny" text-anchor="middle">M${index + 1} · +${mesa.topY.toFixed(1)} m</text>${mesa.waterfall ? `<line x1="${x}" y1="${sectionY(mesa.topY)}" x2="${x}" y2="${sectionY(mesa.cloudBaseY) + 7}" stroke="${water}" stroke-width="3"/>` : ""}</g>`;
    })
    .join("");

  const routeCards = layout.attentionRoute
    .map((stop, index) => {
      const cardWidth = 158;
      const gap = 13;
      const x = route.x + 22 + index * (cardWidth + gap);
      const y = route.y + 75;
      const focus = wrapWords(stop.focus, 21, 4);
      const understanding = wrapWords(stop.understanding, 22, 3);
      const icon = [
        `<path d="M ${x + 35} ${y + 80} L ${x + 79} ${y + 40} L ${x + 123} ${y + 80}" fill="none" stroke="${limestone}" stroke-width="10"/><path d="M ${x + 79} ${y + 78} L ${x + 79} ${y + 42}" stroke="${sun}" stroke-width="3"/>`,
        `<ellipse cx="${x + 79}" cy="${y + 65}" rx="55" ry="19" fill="${limestone}"/><circle cx="${x + 45}" cy="${y + 46}" r="13" fill="${olive}"/><circle cx="${x + 113}" cy="${y + 46}" r="13" fill="${olive}"/>`,
        `<path d="M ${x + 25} ${y + 78} Q ${x + 79} ${y + 42} ${x + 133} ${y + 78}" fill="${limestone}"/><ellipse cx="${x + 111}" cy="${y + 66}" rx="24" ry="10" fill="${water}"/>`,
        `<circle cx="${x + 79}" cy="${y + 35}" r="13" fill="${sun}"/><path d="M ${x + 27} ${y + 80} L ${x + 40} ${y + 50} L ${x + 53} ${y + 80} M ${x + 104} ${y + 80} L ${x + 117} ${y + 43} L ${x + 130} ${y + 80}" fill="${limestone}" stroke="${border}" stroke-width="3"/>`,
        `<path d="M ${x + 25} ${y + 78} L ${x + 79} ${y + 38} L ${x + 133} ${y + 78}" fill="none" stroke="${limestone}" stroke-width="10"/><path d="M ${x + 79} ${y + 36} L ${x + 79} ${y + 76}" stroke="${sun}" stroke-width="3"/>`,
      ][index];
      return `<g><rect x="${x}" y="${y}" width="${cardWidth}" height="306" rx="14" fill="#fffaf0" stroke="${border}"/><circle cx="${x + 22}" cy="${y + 22}" r="13" fill="${sun}"/><text x="${x + 22}" y="${y + 27}" class="number" text-anchor="middle">${stop.stop}</text>${icon}<text x="${x + 15}" y="${y + 117}" class="cardTitle">${escapeXml(stop.title)}</text>${svgLines(focus, x + 15, y + 145, "cardBody", 17)}${svgLines(understanding, x + 15, y + 232, "cardNote", 17)}</g>`;
    })
    .join("");

  const frames = [
    { name: "desktop", x: sight.x + 22, y: sight.y + 100, w: 330, h: 186 },
    { name: "portrait", x: sight.x + 382, y: sight.y + 76, w: 122, h: 217 },
    { name: "landscapePhone", x: sight.x + 534, y: sight.y + 112, w: 320, h: 138 },
  ];

  function renderFrame(frame) {
    const metric = cameraMetrics[frame.name];
    const fx = (x) => frame.x + ((x + 1) / 2) * frame.w;
    const fy = (y) => frame.y + ((1 - y) / 2) * frame.h;
    const mesas = metric.mesas
      .map((mesa, index) => {
        const source = layout.distantMesas[index];
        const x = fx(mesa.projection.x);
        const y = fy(mesa.projection.y);
        const visualWidth = Math.max(5, frame.w * 0.025 * (source.width / 9));
        return `<g><ellipse cx="${x}" cy="${y}" rx="${visualWidth}" ry="${Math.max(3, visualWidth * 0.35)}" fill="${limestone}" stroke="${border}"/><line x1="${x}" y1="${y + 2}" x2="${x}" y2="${Math.min(frame.y + frame.h - 7, y + frame.h * 0.12)}" stroke="${water}" stroke-width="2"/></g>`;
      })
      .join("");
    const trees = metric.trees
      .map(
        ({ projection }) =>
          `<g><line x1="${fx(projection.x)}" y1="${fy(projection.y) + 14}" x2="${fx(projection.x)}" y2="${fy(projection.y) + 3}" stroke="${ink}" stroke-width="3"/><circle cx="${fx(projection.x)}" cy="${fy(projection.y)}" r="${Math.max(5, frame.w * 0.025)}" fill="${olive}"/></g>`
      )
      .join("");
    return `<g><text x="${frame.x + frame.w / 2}" y="${frame.y - 11}" class="frameLabel" text-anchor="middle">${escapeXml(metric.label)} · ${metric.preset.fovDegrees}°</text><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" rx="9" fill="url(#sky)" stroke="${border}"/><path d="M ${frame.x} ${frame.y + frame.h * 0.72} Q ${frame.x + frame.w / 2} ${frame.y + frame.h * 0.59} ${frame.x + frame.w} ${frame.y + frame.h * 0.72}" fill="${cloud}" fill-opacity="0.88"/><path d="M ${frame.x + frame.w * 0.24} ${frame.y + frame.h} L ${frame.x + frame.w * 0.39} ${frame.y + frame.h * 0.68} L ${frame.x + frame.w * 0.61} ${frame.y + frame.h * 0.68} L ${frame.x + frame.w * 0.76} ${frame.y + frame.h}" fill="${limestone}"/><ellipse cx="${fx(metric.stage.x)}" cy="${fy(metric.stage.y)}" rx="${frame.w * 0.22}" ry="${Math.max(7, frame.h * 0.07)}" fill="${limestoneLight}" stroke="${border}"/>${mesas}<circle cx="${fx(metric.sun.x)}" cy="${fy(metric.sun.y)}" r="${Math.max(6, frame.w * 0.027)}" fill="${sun}" filter="url(#glow)"/>${trees}<ellipse cx="${fx(metric.lagoon.x)}" cy="${fy(metric.lagoon.y)}" rx="${Math.max(5, frame.w * 0.045)}" ry="${Math.max(3, frame.h * 0.021)}" fill="${water}"/><rect x="${fx(band.ndcMinX)}" y="${fy(band.ndcMaxY)}" width="${fx(band.ndcMaxX) - fx(band.ndcMinX)}" height="${fy(band.ndcMinY) - fy(band.ndcMaxY)}" fill="none" stroke="${sun}" stroke-dasharray="5 4"/></g>`;
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5edd9"/><stop offset="1" stop-color="#e8deca"/></linearGradient>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9cedb"/><stop offset="0.55" stop-color="#f2dba7"/><stop offset="1" stop-color="#eef1e8"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <style>
      text { font-family: Arial, sans-serif; fill: ${ink}; }
      .title { font-size: 33px; font-weight: 800; letter-spacing: 1.2px; }
      .subtitle { font-size: 17px; fill: ${mutedInk}; }
      .panelTitle { font-size: 20px; font-weight: 800; }
      .small { font-size: 13px; fill: ${mutedInk}; }
      .tiny { font-size: 11px; font-weight: 700; fill: ${ink}; }
      .number { font-size: 13px; font-weight: 800; }
      .cardTitle { font-size: 13px; font-weight: 800; }
      .cardBody { font-size: 11px; fill: ${mutedInk}; }
      .cardNote { font-size: 11px; font-weight: 700; fill: ${olive}; }
      .frameLabel { font-size: 13px; font-weight: 700; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#paper)"/>
  <text x="48" y="51" class="title">OLIVE CLOUDBREAK · GATE 1 · REVISION 2</text>
  <text x="48" y="81" class="subtitle">Measured natural landform · one walk-in shelf · one lagoon · raised distant mesas</text>
  <text x="1872" y="55" text-anchor="end" class="small">ALL DIMENSIONS IN METRES</text>

  <rect x="${plan.x}" y="${plan.y}" width="${plan.w}" height="${plan.h}" rx="18" fill="${panel}" stroke="${border}" stroke-width="2"/>
  <text x="${plan.x + 22}" y="${plan.y + 31}" class="panelTitle">1. Local floor plan</text>
  <text x="${plan.x + plan.w - 22}" y="${plan.y + 31}" class="small" text-anchor="end">LARGER LANDMASS ↑ · FRONT CLIFF / DEEP SKY ↓</text>
  <polygon points="${landmassPoints}" fill="${limestone}" stroke="${border}" stroke-width="2"/>
  <path d="M ${planX(-4)} ${planY(48)} L ${planX(-4)} ${planY(10)} M ${planX(4)} ${planY(48)} L ${planX(4)} ${planY(10)}" stroke="${sun}" stroke-width="2" stroke-dasharray="7 5"/>
  <text x="${planX(0)}" y="${planY(40)}" class="small" text-anchor="middle">8.0 m natural approach</text>
  <circle cx="${planX(performanceCenter[0])}" cy="${planY(performanceCenter[1])}" r="${clearRadiusPixels}" fill="${limestoneLight}" stroke="${sun}" stroke-width="2" stroke-dasharray="7 5"/>
  <text x="${planX(0)}" y="${planY(-1) + 4}" class="tiny" text-anchor="middle">DRY PERFORMANCE · R 5.75</text>
  <polygon points="${lagoonPoints}" fill="${water}" stroke="#4f899d" stroke-width="2"/>
  <path d="M ${planX(layout.lagoon.overflowXZ[0])} ${planY(layout.lagoon.overflowXZ[1])} l 14 14" stroke="${water}" stroke-width="4"/>
  <text x="${planX(12.7)}" y="${planY(-8)}" class="tiny" text-anchor="middle">ONE LAGOON</text>
  ${treePlan}
  <path d="M ${planX(0)} ${planY(48) + 14} l -9 -14 l 18 0 Z" fill="${olive}"/>
  <text x="${planX(0) + 16}" y="${planY(48) + 8}" class="small">ENTRY + EXIT</text>
  <circle cx="${planX(0)}" cy="${planY(30)}" r="7" fill="${ink}"/>
  <path d="M ${planX(0)} ${planY(30)} L ${planX(-14)} ${planY(-12)} M ${planX(0)} ${planY(30)} L ${planX(14)} ${planY(-12)}" stroke="${ink}" stroke-opacity="0.28"/>
  <text x="${planX(0) + 13}" y="${planY(30) + 5}" class="small">Hero camera · 7.8 m</text>
  <circle cx="${planX(layout.scaleFigure.position[0])}" cy="${planY(layout.scaleFigure.position[2])}" r="5" fill="${sun}"/>
  <text x="${planX(layout.scaleFigure.position[0]) - 8}" y="${planY(layout.scaleFigure.position[2]) - 10}" class="small" text-anchor="end">1.75 m scale</text>
  <text x="${plan.x + 22}" y="${plan.y + plan.h - 17}" class="small">The shelf continues beyond the upper frame. Distant mesas are measured in the long section.</text>

  <rect x="${section.x}" y="${section.y}" width="${section.w}" height="${section.h}" rx="18" fill="${panel}" stroke="${border}" stroke-width="2"/>
  <text x="${section.x + 22}" y="${section.y + 31}" class="panelTitle">2. Long section · landmass to far sun</text>
  <path d="M ${sectionX(52)} ${sectionY(0.01)} L ${sectionX(-15)} ${sectionY(0.01)} L ${sectionX(-15)} ${sectionY(-7.5)} C ${sectionX(-1)} ${sectionY(-13)}, ${sectionX(24)} ${sectionY(-10)}, ${sectionX(52)} ${sectionY(-9)} Z" fill="${limestone}" stroke="${border}" stroke-width="2"/>
  <path d="M ${sectionX(52)} ${sectionY(0.01)} L ${sectionX(-15)} ${sectionY(0.01)}" stroke="${sun}" stroke-width="3"/>
  <path d="M ${sectionX(52)} ${sectionY(layout.cloudOcean.averageTopY)} Q ${sectionX(-35)} ${sectionY(-7.5)} ${sectionX(-122)} ${sectionY(layout.cloudOcean.averageTopY)}" fill="none" stroke="${cloud}" stroke-width="20" stroke-linecap="round"/>
  <circle cx="${sectionX(30)}" cy="${sectionY(7.8)}" r="7" fill="${ink}"/>
  <text x="${sectionX(30)}" y="${sectionY(7.8) - 12}" class="tiny" text-anchor="middle">CAMERA +7.8</text>
  <line x1="${sectionX(30)}" y1="${sectionY(7.8)}" x2="${sectionX(layout.sun.position[2])}" y2="${sectionY(layout.sun.position[1])}" stroke="${sun}" stroke-dasharray="7 5"/>
  <circle cx="${sectionX(8)}" cy="${sectionY(1.76)}" r="4" fill="${sun}"/><line x1="${sectionX(8)}" y1="${sectionY(1.76) + 4}" x2="${sectionX(8)}" y2="${sectionY(0.01)}" stroke="${sun}" stroke-width="3"/>
  <text x="${sectionX(8)}" y="${sectionY(1.76) - 9}" class="tiny" text-anchor="middle">1.75 m</text>
  ${mesaSection}
  <circle cx="${sectionX(layout.sun.position[2])}" cy="${sectionY(layout.sun.position[1])}" r="15" fill="${sun}" filter="url(#glow)"/>
  <text x="${sectionX(layout.sun.position[2])}" y="${sectionY(layout.sun.position[1]) - 22}" class="tiny" text-anchor="middle">FAR SUN · Z −115</text>
  <line x1="${sectionX(-15)}" y1="${sectionY(-18)}" x2="${sectionX(-15)}" y2="${sectionY(4)}" stroke="${ink}" stroke-dasharray="5 5"/>
  <text x="${sectionX(-15)}" y="${sectionY(-19)}" class="small" text-anchor="middle">FRONT CLIFF</text>
  <text x="${section.x + 22}" y="${section.y + section.h - 17}" class="small">The terrace is the front lip of one substantial shelf. Three distant mesas rise above it; none are architectural.</text>

  <rect x="${route.x}" y="${route.y}" width="${route.w}" height="${route.h}" rx="18" fill="${panel}" stroke="${border}" stroke-width="2"/>
  <text x="${route.x + 22}" y="${route.y + 31}" class="panelTitle">3. Five-beat attention sequence</text>
  <text x="${route.x + 22}" y="${route.y + 55}" class="small">This fixed-camera background uses an implied physical route and a viewer attention sequence.</text>
  ${routeCards}

  <rect x="${sight.x}" y="${sight.y}" width="${sight.w}" height="${sight.h}" rx="18" fill="${panel}" stroke="${border}" stroke-width="2"/>
  <text x="${sight.x + 22}" y="${sight.y + 31}" class="panelTitle">4. Registered sightline study</text>
  <text x="${sight.x + 22}" y="${sight.y + 55}" class="small">Gold dashed boxes protect the performer. Lagoon stays right; trees frame; sun remains far and central.</text>
  ${frames.map(renderFrame).join("")}
  <text x="${sight.x + 22}" y="${sight.y + sight.h - 68}" class="small">Clearance: lagoon ${lagoonClearance.toFixed(2)} m beyond performance circle · approach ${layout.approach.minimumWidth.toFixed(1)} m wide</text>
  <text x="${sight.x + 22}" y="${sight.y + sight.h - 42}" class="small">Vertical field: ${raisedMesaCount} raised mesas · highest +${Math.max(...layout.distantMesas.map((mesa) => mesa.topY)).toFixed(1)} m · sun Z −${Math.abs(layout.sun.position[2])} m</text>
  <text x="${sight.x + 22}" y="${sight.y + sight.h - 16}" class="small">Spatial read: larger shelf → dry terrace → one lagoon → eroded mesas → far sun</text>
</svg>`;

  await writeFile(svgPath, svg, "utf8");
  await sharp(Buffer.from(svg)).png().toFile(pngPath);

  const sourceDigests = {};
  for (const sourcePath of [layoutPath, designPath]) {
    const buffer = await readFile(sourcePath);
    sourceDigests[path.relative(root, sourcePath).replaceAll("\\", "/")] =
      sha256(buffer);
  }
  const svgBuffer = await readFile(svgPath);
  const pngBuffer = await readFile(pngPath);
  const report = {
    generatedAt: new Date().toISOString(),
    revision: layout.revision,
    layoutPath: path.relative(root, layoutPath).replaceAll("\\", "/"),
    artifacts: {
      svg: {
        path: path.relative(root, svgPath).replaceAll("\\", "/"),
        sha256: sha256(svgBuffer),
      },
      png: {
        path: path.relative(root, pngPath).replaceAll("\\", "/"),
        sha256: sha256(pngBuffer),
      },
    },
    sourceDigests,
    measurements: {
      approachWidth: layout.approach.minimumWidth,
      performanceClearRadius: layout.performanceTerrace.clearRadius,
      lagoonClearance: round(lagoonClearance),
      treeClearances: treeClearances.map((entry) => ({
        id: entry.id,
        clearance: round(entry.clearance),
      })),
      raisedMesaCount,
      highestMesaTopY: Math.max(
        ...layout.distantMesas.map((mesa) => mesa.topY)
      ),
      sunDepthZ: layout.sun.position[2],
    },
    cameraMetrics,
    solarSilhouetteClearance,
    checks,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  process.stdout.write(
    `${JSON.stringify(
      {
        board: pngPath,
        svg: svgPath,
        report: reportPath,
        checks,
      },
      null,
      2
    )}\n`
  );
}
