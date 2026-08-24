#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const projectRoot = resolve(import.meta.dirname, "..");
const specRoot = resolve(
  projectRoot,
  "docs/superpowers/specs/blossom-recomposition-r1"
);
const planPath = resolve(specRoot, "blossom-composition-plan.json");
const familyManifestPath = resolve(
  projectRoot,
  "scripts/blossom-plantfactory-family.json"
);
const evidenceRoot = resolve(specRoot, "evidence");
const svgPath = resolve(evidenceRoot, "blossom-composition-plan.svg");
const pngPath = resolve(evidenceRoot, "blossom-composition-plan.png");
const validationPath = resolve(
  evidenceRoot,
  "blossom-composition-validation.json"
);
const plan = JSON.parse(await readFile(planPath, "utf8"));
const familyManifest = JSON.parse(await readFile(familyManifestPath, "utf8"));

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function corridorHalfWidth(y) {
  const corridor = plan.primarySightline;
  const span = corridor.to[1] - corridor.from[1];
  const progress = Math.max(0, Math.min(1, (y - corridor.from[1]) / span));
  return (
    corridor.halfWidthNear +
    (corridor.halfWidthFar - corridor.halfWidthNear) * progress
  );
}

function outsideSightline(x, y, clearance = 0) {
  return Math.abs(x) - clearance > corridorHalfWidth(y);
}

function distance2d(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

invariant(plan.schemaVersion === 1, "Unsupported Blossom plan schema");
invariant(
  ["ready-for-review", "approved"].includes(plan.status),
  "Plan is not at a renderable gate"
);
invariant(
  plan.trees.length === 2,
  "Blossom R1 must contain exactly two major trees"
);
const heroTree = plan.trees.find((tree) => tree.role === "hero");
const secondaryTree = plan.trees.find(
  (tree) => tree.role === "secondary-frame"
);
invariant(heroTree, "Plan is missing its hero tree");
invariant(secondaryTree, "Plan is missing its secondary tree");
invariant(
  familyManifest.selection?.status === "approved",
  "PlantFactory family has no approved selection"
);
invariant(
  heroTree.candidateId === familyManifest.selection.heroCandidateId,
  "Plan hero does not match the approved PlantFactory hero"
);
invariant(
  secondaryTree.candidateId === familyManifest.selection.secondaryCandidateId,
  "Plan secondary tree does not match the approved PlantFactory variation"
);
invariant(
  plan.densityBudget.additionalTrees === 0,
  "The density contract allows unreviewed trees"
);
invariant(
  plan.densityBudget.majorTrees === plan.trees.length,
  "Tree density budget does not match placement count"
);
invariant(
  plan.densityBudget.lanterns === plan.lanterns.length,
  "Lantern density budget does not match placement count"
);
invariant(
  plan.densityBudget.ecologyIslands === plan.ecologyIslands.length,
  "Ecology density budget does not match placement count"
);

for (const tree of plan.trees) {
  const canopyRadius = Math.max(tree.canopyWidth, tree.canopyDepth) / 2;
  invariant(
    distance2d(tree.position, plan.stage.center) - canopyRadius >=
      plan.stage.clearRingRadius,
    `${tree.candidateId} canopy enters the stage clear ring`
  );
  invariant(
    outsideSightline(tree.position[0], tree.position[1], 0.65),
    `${tree.candidateId} trunk enters the primary sightline`
  );
}

for (const lantern of plan.lanterns) {
  invariant(
    distance2d(lantern.position, plan.stage.center) >=
      plan.stage.clearRingRadius,
    `Lantern at ${lantern.position.join(", ")} enters the stage clear ring`
  );
  invariant(
    outsideSightline(lantern.position[0], lantern.position[1], 0.35),
    `Lantern at ${lantern.position.join(", ")} enters the primary sightline`
  );
}

for (const island of plan.ecologyIslands) {
  invariant(
    outsideSightline(island.center[0], island.center[1], island.radiusX),
    `Ecology island at ${island.center.join(", ")} enters the primary sightline`
  );
}

const toriiNearPost = Math.min(
  Math.abs(plan.torii.center[0] - plan.torii.width / 2),
  Math.abs(plan.torii.center[0] + plan.torii.width / 2)
);
invariant(
  toriiNearPost > corridorHalfWidth(plan.torii.center[1]),
  "Torii post enters the primary sightline"
);

const validation = {
  planId: plan.planId,
  status: "verified",
  checkedAt: new Date().toISOString(),
  checks: {
    exactTreeCount: true,
    approvedSelectionParity: true,
    densityBudgetParity: true,
    stageClearance: true,
    trunkSightlines: true,
    lanternSightlines: true,
    ecologySightlines: true,
    toriiSightlines: true,
  },
  measurements: {
    stageDiameter: plan.stage.radius * 2,
    stageClearDiameter: plan.stage.clearRingRadius * 2,
    sightlineWidthNear: plan.primarySightline.halfWidthNear * 2,
    sightlineWidthFar: plan.primarySightline.halfWidthFar * 2,
    treeCount: plan.trees.length,
    lanternCount: plan.lanterns.length,
    ecologyIslandCount: plan.ecologyIslands.length,
  },
};

const board = { width: 1600, height: 1120 };
const map = {
  x: 70,
  y: 128,
  scale: 18,
  width: (plan.bounds.maxX - plan.bounds.minX) * 18,
  height: (plan.bounds.maxY - plan.bounds.minY) * 18,
};

function mapX(x) {
  return map.x + (x - plan.bounds.minX) * map.scale;
}

function mapY(y) {
  return map.y + (plan.bounds.maxY - y) * map.scale;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapWords(value, maximumCharacters) {
  const lines = [];
  let line = "";
  for (const word of String(value).split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maximumCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const grid = [];
for (let x = -20; x <= 20; x += 5) {
  grid.push(
    `<line x1="${mapX(x)}" y1="${map.y}" x2="${mapX(x)}" y2="${map.y + map.height}" class="grid"/>`,
    `<text x="${mapX(x)}" y="${map.y + map.height + 22}" class="axis" text-anchor="middle">${x}</text>`
  );
}
for (let y = -10; y <= 25; y += 5) {
  grid.push(
    `<line x1="${map.x}" y1="${mapY(y)}" x2="${map.x + map.width}" y2="${mapY(y)}" class="grid"/>`,
    `<text x="${map.x - 14}" y="${mapY(y) + 5}" class="axis" text-anchor="end">${y}</text>`
  );
}

const sightline = plan.primarySightline;
const sightlinePolygon = [
  [sightline.from[0] - sightline.halfWidthNear, sightline.from[1]],
  [sightline.from[0] + sightline.halfWidthNear, sightline.from[1]],
  [sightline.to[0] + sightline.halfWidthFar, sightline.to[1]],
  [sightline.to[0] - sightline.halfWidthFar, sightline.to[1]],
]
  .map(([x, y]) => `${mapX(x)},${mapY(y)}`)
  .join(" ");

const ecology = plan.ecologyIslands
  .map(
    (island) =>
      `<ellipse cx="${mapX(island.center[0])}" cy="${mapY(island.center[1])}" rx="${island.radiusX * map.scale}" ry="${island.radiusY * map.scale}" class="ecology"/>`
  )
  .join("\n");

const waterPath = plan.water.centerline
  .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${mapX(x)} ${mapY(y)}`)
  .join(" ");

const trees = plan.trees
  .map((tree, index) => {
    const [x, y] = tree.position;
    const cx = mapX(x);
    const cy = mapY(y);
    const color = tree.role === "hero" ? "#f3a9c5" : "#d889ad";
    return `<g>
      <ellipse cx="${cx}" cy="${cy}" rx="${(tree.canopyWidth * map.scale) / 2}" ry="${(tree.canopyDepth * map.scale) / 2}" fill="${color}" fill-opacity="0.34" stroke="${color}" stroke-width="3" transform="rotate(${-tree.rotationDegrees} ${cx} ${cy})"/>
      <circle cx="${cx}" cy="${cy}" r="9" class="trunk"/>
      <circle cx="${cx - 45}" cy="${cy - 42}" r="15" class="number"/><text x="${cx - 45}" y="${cy - 36}" class="numberText">${index + 1}</text>
      <text x="${cx}" y="${cy + (tree.canopyDepth * map.scale) / 2 + 22}" class="featureLabel" text-anchor="middle">${escapeXml(tree.role === "hero" ? "A · HERO CROWN" : "B · SECONDARY CROWN")}</text>
    </g>`;
  })
  .join("\n");

const lanterns = plan.lanterns
  .map(({ position }, index) => {
    const x = mapX(position[0]);
    const y = mapY(position[1]);
    return `<g><circle cx="${x}" cy="${y}" r="10" class="lanternGlow"/><rect x="${x - 4}" y="${y - 4}" width="8" height="12" rx="2" class="lantern"/><text x="${x + 13}" y="${y + 5}" class="micro">L${index + 1}</text></g>`;
  })
  .join("\n");

const [bridgeX, bridgeY] = plan.bridge.center;
const bridgeWidth = plan.bridge.width * map.scale;
const bridgeLength = plan.bridge.length * map.scale;
const [toriiX, toriiY] = plan.torii.center;

const routeCards = plan.reviewViews
  .map((view, index) => {
    const x = 980 + (index % 2) * 292;
    const y = 650 + Math.floor(index / 2) * 190;
    const bodyLines = wrapWords(view.read, 27)
      .map(
        (line, lineIndex) =>
          `<tspan x="${x + 22}" y="${y + 83 + lineIndex * 21}">${escapeXml(line)}</tspan>`
      )
      .join("");
    return `<g>
      <rect x="${x}" y="${y}" width="270" height="165" rx="18" class="routeCard"/>
      <circle cx="${x + 30}" cy="${y + 31}" r="18" class="number"/>
      <text x="${x + 30}" y="${y + 38}" class="numberText">${view.number}</text>
      <text x="${x + 58}" y="${y + 37}" class="cardTitle">${escapeXml(view.label)}</text>
      <text class="cardBody">${bodyLines}</text>
    </g>`;
  })
  .join("\n");

const section = {
  x: 980,
  y: 150,
  width: 560,
  height: 360,
  depthMin: -10,
  depthMax: 26,
  heightMax: 12,
};

function sectionX(depth) {
  return (
    section.x +
    ((depth - section.depthMin) / (section.depthMax - section.depthMin)) *
      section.width
  );
}

function sectionY(height) {
  return (
    section.y + section.height - (height / section.heightMax) * section.height
  );
}

const sectionTrees = plan.trees
  .map((tree) => {
    const x = sectionX(tree.position[1]);
    const top = sectionY(tree.height);
    const ground = sectionY(0);
    return `<g><line x1="${x}" y1="${ground}" x2="${x}" y2="${top + 48}" class="sectionTrunk"/><ellipse cx="${x}" cy="${top + 50}" rx="55" ry="48" class="sectionCrown"/><text x="${x}" y="${top - 9}" class="micro" text-anchor="middle">${tree.height} m</text></g>`;
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${board.width}" height="${board.height}" viewBox="0 0 ${board.width} ${board.height}">
<style>
  text { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  .title { fill:#f8eee7; font-size:32px; font-weight:800; letter-spacing:.5px; }
  .subtitle { fill:#b9c7c5; font-size:15px; }
  .panel { fill:#111a1b; stroke:#304044; stroke-width:2; }
  .grid { stroke:#2a393a; stroke-width:1; }
  .axis { fill:#7f9290; font-size:12px; }
  .sightline { fill:#7bd7d2; fill-opacity:.11; stroke:#7bd7d2; stroke-opacity:.65; stroke-width:2; stroke-dasharray:8 7; }
  .ecology { fill:#416a52; fill-opacity:.6; stroke:#75a27c; stroke-width:2; }
  .stageClear { fill:none; stroke:#e8c77d; stroke-width:2; stroke-dasharray:9 7; }
  .stage { fill:#5e3c2d; stroke:#d6a86b; stroke-width:4; }
  .stageLine { stroke:#d6a86b; stroke-width:1; opacity:.65; }
  .trunk { fill:#4f332f; stroke:#f1d9cc; stroke-width:2; }
  .water { fill:none; stroke:#3b839d; stroke-opacity:.74; stroke-linecap:round; stroke-linejoin:round; }
  .bridge { fill:#9d5f3e; stroke:#e4b17e; stroke-width:3; }
  .torii { stroke:#d34e46; stroke-width:10; stroke-linecap:round; }
  .toriiCap { stroke:#f06a5b; stroke-width:7; stroke-linecap:round; }
  .lanternGlow { fill:#ffd37b; fill-opacity:.22; stroke:#ffd37b; stroke-width:2; }
  .lantern { fill:#b8aaa0; }
  .featureLabel { fill:#f6dfd1; font-size:13px; font-weight:750; letter-spacing:.7px; }
  .micro { fill:#b9c7c5; font-size:12px; font-weight:650; }
  .number { fill:#f1ba69; }
  .numberText { fill:#1b1b18; font-size:15px; font-weight:850; text-anchor:middle; }
  .sectionGround { stroke:#839187; stroke-width:3; }
  .sectionStage { fill:#6d4936; stroke:#d6a86b; stroke-width:2; }
  .sectionTrunk { stroke:#65505a; stroke-width:10; stroke-linecap:round; }
  .sectionCrown { fill:#d889ad; fill-opacity:.48; stroke:#f0abc8; stroke-width:2; }
  .sectionSight { stroke:#7bd7d2; stroke-width:2; stroke-dasharray:7 6; }
  .routeCard { fill:#192425; stroke:#394a4c; stroke-width:2; }
  .cardTitle { fill:#f7e8dd; font-size:16px; font-weight:750; }
  .cardBody { fill:#b9c7c5; font-size:14px; }
  .budget { fill:#f1ba69; font-size:16px; font-weight:750; }
</style>
<rect width="1600" height="1120" fill="#0a1112"/>
<text x="46" y="50" class="title">BLOSSOM RECOMPOSITION R1 · MEASURED PLACEMENT GATE</text>
<text x="46" y="78" class="subtitle">Two PlantFactory crowns. Protected performer sightline. Water and threshold revealed through orbit, not piled behind the stage.</text>

<rect x="38" y="94" width="900" height="950" rx="22" class="panel"/>
<text x="70" y="120" class="featureLabel">TOP-DOWN PLAN · 5 M GRID</text>
${grid.join("\n")}
<polygon points="${sightlinePolygon}" class="sightline"/>
${ecology}
<path d="${waterPath}" class="water" stroke-width="${plan.water.width * map.scale}"/>
<rect x="${mapX(bridgeX) - bridgeWidth / 2}" y="${mapY(bridgeY) - bridgeLength / 2}" width="${bridgeWidth}" height="${bridgeLength}" rx="8" class="bridge" transform="rotate(${-plan.bridge.rotationDegrees} ${mapX(bridgeX)} ${mapY(bridgeY)})"/>
<circle cx="${mapX(0)}" cy="${mapY(0)}" r="${plan.stage.clearRingRadius * map.scale}" class="stageClear"/>
<circle cx="${mapX(0)}" cy="${mapY(0)}" r="${plan.stage.radius * map.scale}" class="stage"/>
${[-3.4, 0, 3.4].map((x) => `<line x1="${mapX(x)}" y1="${mapY(-4.4)}" x2="${mapX(x)}" y2="${mapY(4.4)}" class="stageLine"/>`).join("\n")}
<text x="${mapX(0)}" y="${mapY(0) + 5}" class="featureLabel" text-anchor="middle">PERFORMANCE DECK · Ø10.5 M</text>
${trees}
${lanterns}
<g transform="rotate(${plan.torii.rotationDegrees} ${mapX(toriiX)} ${mapY(toriiY)})">
  <line x1="${mapX(toriiX) - (plan.torii.width * map.scale) / 2}" y1="${mapY(toriiY) + 24}" x2="${mapX(toriiX) - (plan.torii.width * map.scale) / 2}" y2="${mapY(toriiY) - 24}" class="torii"/>
  <line x1="${mapX(toriiX) + (plan.torii.width * map.scale) / 2}" y1="${mapY(toriiY) + 24}" x2="${mapX(toriiX) + (plan.torii.width * map.scale) / 2}" y2="${mapY(toriiY) - 24}" class="torii"/>
  <line x1="${mapX(toriiX) - (plan.torii.width * map.scale) / 2 - 13}" y1="${mapY(toriiY) - 27}" x2="${mapX(toriiX) + (plan.torii.width * map.scale) / 2 + 13}" y2="${mapY(toriiY) - 27}" class="toriiCap"/>
</g>
<text x="${mapX(toriiX)}" y="${mapY(toriiY) - 44}" class="featureLabel" text-anchor="middle">OFF-AXIS TORII</text>
<path d="M ${mapX(0)} ${mapY(-9)} L ${mapX(-0.8)} ${mapY(-7.4)} L ${mapX(0.8)} ${mapY(-7.4)} Z" fill="#7bd7d2"/>
<text x="${mapX(0)}" y="${mapY(-9) + 29}" class="micro" text-anchor="middle">DEFAULT VIEW · CAMERA CONTINUES 16 M FRONT</text>
<text x="${mapX(0)}" y="${mapY(18)}" class="micro" text-anchor="middle">PROTECTED NEGATIVE SPACE · 8.8 → 10.6 M</text>

<rect x="960" y="94" width="610" height="470" rx="22" class="panel"/>
<text x="990" y="125" class="featureLabel">LONG SECTION · DEFAULT VIEW HEIGHTS</text>
${[0, 3, 6, 9, 12].map((height) => `<line x1="${section.x}" y1="${sectionY(height)}" x2="${section.x + section.width}" y2="${sectionY(height)}" class="grid"/><text x="${section.x - 10}" y="${sectionY(height) + 4}" class="axis" text-anchor="end">${height}m</text>`).join("\n")}
<line x1="${section.x}" y1="${sectionY(0)}" x2="${section.x + section.width}" y2="${sectionY(0)}" class="sectionGround"/>
<rect x="${sectionX(-plan.stage.radius)}" y="${sectionY(plan.stage.deckTop)}" width="${sectionX(plan.stage.radius) - sectionX(-plan.stage.radius)}" height="${sectionY(0) - sectionY(plan.stage.deckTop)}" class="sectionStage"/>
<circle cx="${sectionX(0)}" cy="${sectionY(plan.stage.deckTop + plan.stage.performerHeight)}" r="8" fill="#f6dfd1"/><line x1="${sectionX(0)}" y1="${sectionY(plan.stage.deckTop + plan.stage.performerHeight) + 8}" x2="${sectionX(0)}" y2="${sectionY(plan.stage.deckTop)}" stroke="#f6dfd1" stroke-width="4"/>
${sectionTrees}
<g><line x1="${sectionX(plan.torii.center[1])}" y1="${sectionY(0)}" x2="${sectionX(plan.torii.center[1])}" y2="${sectionY(plan.torii.height)}" class="torii"/><line x1="${sectionX(plan.torii.center[1]) - 22}" y1="${sectionY(plan.torii.height)}" x2="${sectionX(plan.torii.center[1]) + 22}" y2="${sectionY(plan.torii.height)}" class="toriiCap"/></g>
<line x1="${section.x}" y1="${sectionY(11.5)}" x2="${sectionX(18)}" y2="${sectionY(2.3)}" class="sectionSight"/>
<text x="${section.x + 10}" y="${sectionY(11.5) - 8}" class="micro">DEFAULT CAMERA CONTINUES 16 M LEFT · 11.5 M HIGH</text>
<text x="${sectionX(0)}" y="${sectionY(0) + 28}" class="micro" text-anchor="middle">STAGE</text>
<text x="${sectionX(plan.torii.center[1])}" y="${sectionY(0) + 28}" class="micro" text-anchor="middle">TORII</text>

<rect x="960" y="585" width="610" height="459" rx="22" class="panel"/>
<text x="990" y="620" class="featureLabel">ORBIT STORY · WHAT ENTERS THE FRAME</text>
${routeCards}
<text x="990" y="1020" class="budget">DENSITY CEILING · 2 TREES · 3 LANTERNS · 1 BRIDGE</text>
<text x="990" y="1042" class="budget">1 TORII · 5 PLANTING ISLANDS · 0 EXTRA TREES</text>
</svg>`;

await writeFile(svgPath, svg);
await sharp(Buffer.from(svg)).png().toFile(pngPath);
await writeFile(validationPath, `${JSON.stringify(validation, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      plan: planPath.replaceAll("\\", "/"),
      svg: svgPath.replaceAll("\\", "/"),
      png: pngPath.replaceAll("\\", "/"),
      validation,
    },
    null,
    2
  )
);
