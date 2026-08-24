#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import {
  resolveLanternPosition,
  validateBlossomMasterplan,
} from "./blossom-masterplan-rules.mjs";

const projectRoot = resolve(import.meta.dirname, "..");
const specRoot = resolve(
  projectRoot,
  "docs/superpowers/specs/blossom-masterplan-r2"
);
const planPath = resolve(specRoot, "blossom-masterplan-r2.json");
const familyPath = resolve(
  projectRoot,
  "scripts/blossom-plantfactory-family.json"
);
const evidenceRoot = resolve(specRoot, "evidence");
const svgPath = resolve(evidenceRoot, "blossom-masterplan-r2.svg");
const pngPath = resolve(evidenceRoot, "blossom-masterplan-r2.png");
const validationPath = resolve(
  evidenceRoot,
  "blossom-masterplan-validation.json"
);

const plan = JSON.parse(await readFile(planPath, "utf8"));
const family = JSON.parse(await readFile(familyPath, "utf8"));
const validation = validateBlossomMasterplan(plan);
if (!validation.valid) {
  throw new Error(validation.failures.join("\n"));
}

const eligibleCandidateIds = family.jobs
  .filter((job) => job.integrationEligible)
  .map((job) => job.id)
  .sort();
const planCandidateIds = [
  ...plan.grove.assetPolicy.currentlyApprovedCandidates,
].sort();
if (JSON.stringify(eligibleCandidateIds) !== JSON.stringify(planCandidateIds)) {
  throw new Error(
    "The master plan's approved PlantFactory candidates do not match the asset gate"
  );
}

await mkdir(evidenceRoot, { recursive: true });

const board = { width: 1800, height: 1200 };
const visibleBounds = { minX: -48, maxX: 48, minY: -45, maxY: 54 };
const map = { x: 52, y: 170, width: 910, height: 930 };
const scaleX = map.width / (visibleBounds.maxX - visibleBounds.minX);
const scaleY = map.height / (visibleBounds.maxY - visibleBounds.minY);

function mapX(x) {
  return map.x + (x - visibleBounds.minX) * scaleX;
}

function mapY(y) {
  return map.y + (visibleBounds.maxY - y) * scaleY;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function polygonPoints(points) {
  return points.map(([x, y]) => `${mapX(x)},${mapY(y)}`).join(" ");
}

function polylinePath(points) {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${mapX(x)} ${mapY(y)}`)
    .join(" ");
}

function wrapWords(value, maximumCharacters) {
  const lines = [];
  let line = "";
  for (const word of String(value).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maximumCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function multilineText(
  value,
  x,
  y,
  className,
  maximumCharacters,
  leading = 22
) {
  return `<text class="${className}">${wrapWords(value, maximumCharacters)
    .map(
      (line, index) =>
        `<tspan x="${x}" y="${y + index * leading}">${escapeXml(line)}</tspan>`
    )
    .join("")}</text>`;
}

const grid = [];
for (let x = -40; x <= 40; x += 5) {
  grid.push(
    `<line x1="${mapX(x)}" y1="${map.y}" x2="${mapX(x)}" y2="${map.y + map.height}" class="grid"/>`
  );
  if (x % 10 === 0) {
    grid.push(
      `<text x="${mapX(x)}" y="${map.y + map.height + 22}" class="axis" text-anchor="middle">${x}</text>`
    );
  }
}
for (let y = -35; y <= 50; y += 5) {
  grid.push(
    `<line x1="${map.x}" y1="${mapY(y)}" x2="${map.x + map.width}" y2="${mapY(y)}" class="grid"/>`
  );
  if (y % 10 === 0) {
    grid.push(
      `<text x="${map.x - 12}" y="${mapY(y) + 4}" class="axis" text-anchor="end">${y}</text>`
    );
  }
}

const audienceZones = plan.audience.zones
  .map(
    (zone) => `<g>
      <polygon points="${polygonPoints(zone.polygon)}" class="audienceZone audience-${zone.kind}"/>
      <circle cx="${mapX(zone.viewpoint[0])}" cy="${mapY(zone.viewpoint[1])}" r="5" class="audienceView"/>
      <text x="${mapX(zone.viewpoint[0])}" y="${mapY(zone.viewpoint[1]) - 12}" class="zoneLabel" text-anchor="middle">${escapeXml(zone.label.toUpperCase())} · ${zone.capacity}</text>
    </g>`
  )
  .join("\n");

const viewRays = plan.audience.zones
  .map(
    (zone) =>
      `<line x1="${mapX(zone.viewpoint[0])}" y1="${mapY(zone.viewpoint[1])}" x2="${mapX(0)}" y2="${mapY(0)}" class="viewRay"/>`
  )
  .join("\n");

const paths = plan.circulation.paths
  .filter((path) => path.id !== "bridge-crossing")
  .map(
    (path) => `<g>
      <path d="${polylinePath(path.centerline)}" class="${path.kind === "restricted-service" ? "servicePathShoulder" : "pathShoulder"}" stroke-width="${(path.width + 0.7) * scaleX}"/>
      <path d="${polylinePath(path.centerline)}" class="${path.kind === "restricted-service" ? "servicePath" : "path"}" stroke-width="${path.width * scaleX}"/>
    </g>`
  )
  .join("\n");

const waterPath = polylinePath(plan.water.centerline);
const trees = plan.grove.trees
  .map((tree) => {
    const radius = tree.canopyRadius * scaleX;
    const roleClass =
      tree.ageClass === "mature"
        ? "treeMature"
        : tree.ageClass === "young"
          ? "treeYoung"
          : "treeMiddle";
    return `<g>
      <circle cx="${mapX(tree.position[0])}" cy="${mapY(tree.position[1])}" r="${radius}" class="treeCanopy ${roleClass}"/>
      <circle cx="${mapX(tree.position[0])}" cy="${mapY(tree.position[1])}" r="5.5" class="treeTrunk"/>
    </g>`;
  })
  .join("\n");

const lanterns = plan.lanterns
  .map((lantern) => {
    const position = resolveLanternPosition(plan, lantern);
    return `<g>
      <circle cx="${mapX(position[0])}" cy="${mapY(position[1])}" r="${lantern.padRadius * scaleX}" class="lanternPad"/>
      <circle cx="${mapX(position[0])}" cy="${mapY(position[1])}" r="4" class="lantern"/>
    </g>`;
  })
  .join("\n");

const backgroundGrove = Array.from(
  {
    length: plan.grove.backgroundLayers.reduce(
      (sum, layer) => sum + layer.minimumInstances,
      0
    ),
  },
  (_, index) => {
    const angle = (index / 108) * Math.PI * 2;
    const wobble = ((index * 17) % 9) * 0.42;
    const x = Math.cos(angle) * (41 + wobble);
    const y = 5 + Math.sin(angle) * (45 + wobble);
    return `<circle cx="${mapX(x)}" cy="${mapY(y)}" r="${1.5 + (index % 3) * 0.45}" class="backgroundTree"/>`;
  }
).join("\n");

const fishHabitats = plan.water.fishHabitats
  .map(
    (habitat) => `<g>
      <circle cx="${mapX(habitat.center[0])}" cy="${mapY(habitat.center[1])}" r="${habitat.radius * scaleX}" class="fishHabitat"/>
      <text x="${mapX(habitat.center[0])}" y="${mapY(habitat.center[1]) + 4}" class="micro" text-anchor="middle">KOI</text>
    </g>`
  )
  .join("\n");

const stageX = mapX(plan.stage.center[0] - plan.stage.width / 2);
const stageY = mapY(plan.stage.center[1] + plan.stage.depth / 2);
const stageWidth = plan.stage.width * scaleX;
const stageHeight = plan.stage.depth * scaleY;
const clear = plan.stage.protectedClearance;

const bridgeX = mapX(plan.bridge.center[0] - plan.bridge.width / 2);
const bridgeY = mapY(plan.bridge.center[1] + plan.bridge.length / 2);
const bridgeWidth = plan.bridge.width * scaleX;
const bridgeHeight = plan.bridge.length * scaleY;

const toriiLeft = mapX(plan.torii.center[0] - plan.torii.width / 2);
const toriiRight = mapX(plan.torii.center[0] + plan.torii.width / 2);
const toriiY = mapY(plan.torii.center[1]);

const phases = plan.deliveryPhases
  .map((phase, index) => {
    const y = 873 + index * 38;
    const state = index === 0 ? "ACTIVE GATE" : `PHASE ${phase.id}`;
    return `<g>
      <circle cx="1042" cy="${y - 5}" r="13" class="phaseNumber ${index === 0 ? "phaseActive" : ""}"/>
      <text x="1042" y="${y}" class="phaseNumberText">${phase.id}</text>
      <text x="1068" y="${y - 4}" class="phaseTitle">${escapeXml(phase.name)}</text>
      <text x="1068" y="${y + 14}" class="phaseState">${state}</text>
    </g>`;
  })
  .join("\n");

const inset = { x: 1506, y: 146, width: 220, height: 126 };
const terrain = plan.site.terrainBounds;
const cameraEnvelope = plan.camera.validatedOrbitEnvelope;
const insetX = (x) =>
  inset.x + ((x - terrain.minX) / (terrain.maxX - terrain.minX)) * inset.width;
const insetY = (y) =>
  inset.y + ((terrain.maxY - y) / (terrain.maxY - terrain.minY)) * inset.height;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${board.width}" height="${board.height}" viewBox="0 0 ${board.width} ${board.height}">
<style>
  text { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
  .title { fill:#fff4f4; font-size:34px; font-weight:850; letter-spacing:.4px; }
  .subtitle { fill:#c9bfc8; font-size:15px; }
  .status { fill:#ffca75; font-size:14px; font-weight:800; letter-spacing:1.2px; }
  .panel { fill:#13151d; stroke:#343848; stroke-width:2; }
  .mapPanel { fill:#101921; stroke:#35434e; stroke-width:2; }
  .terrain { fill:#19231f; stroke:#566f60; stroke-width:2; }
  .playable { fill:#253127; stroke:#708b73; stroke-width:2; stroke-dasharray:7 6; }
  .grid { stroke:#4e6657; stroke-width:.8; opacity:.28; }
  .axis { fill:#718079; font-size:11px; }
  .viewRay { stroke:#ffd07d; stroke-width:2; stroke-dasharray:7 7; opacity:.55; }
  .audienceZone { stroke:#d5bf88; stroke-width:2; }
  .audience-seated-lawn { fill:#77874f; fill-opacity:.72; }
  .audience-standing-terrace { fill:#80674f; fill-opacity:.8; }
  .audience-level-viewing-terrace { fill:#8d806b; fill-opacity:.9; }
  .audienceView { fill:#ffd07d; stroke:#17191c; stroke-width:2; }
  .zoneLabel { fill:#fff2d5; font-size:10px; font-weight:800; letter-spacing:.4px; }
  .pathShoulder { fill:none; stroke:#6c5b49; stroke-linecap:round; stroke-linejoin:round; }
  .path { fill:none; stroke:#c8b79c; stroke-linecap:round; stroke-linejoin:round; }
  .servicePathShoulder { fill:none; stroke:#4f4853; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:8 6; }
  .servicePath { fill:none; stroke:#988aa0; stroke-linecap:round; stroke-linejoin:round; stroke-dasharray:8 6; }
  .waterBank { fill:none; stroke:#31483d; stroke-linecap:round; stroke-linejoin:round; }
  .water { fill:none; stroke:#2d7795; stroke-linecap:round; stroke-linejoin:round; }
  .waterPool { fill:#2d7795; stroke:#70c1d4; stroke-width:1.4; }
  .waterHighlight { fill:none; stroke:#70c1d4; stroke-width:2; stroke-dasharray:10 10; opacity:.75; }
  .fishHabitat { fill:#7bd1dc; fill-opacity:.14; stroke:#8bd8df; stroke-width:1.5; stroke-dasharray:4 4; }
  .treeCanopy { fill-opacity:.58; stroke-width:2; }
  .treeMature { fill:#b56f91; stroke:#e2a4c0; }
  .treeMiddle { fill:#966985; stroke:#c893ad; }
  .treeYoung { fill:#765d78; stroke:#ab89ac; }
  .treeTrunk { fill:#4d342f; stroke:#e5c9be; stroke-width:1.5; }
  .backgroundTree { fill:#a76d8c; fill-opacity:.6; stroke:#d8a0bb; stroke-width:.6; }
  .stageClear { fill:#e9b65b; fill-opacity:.08; stroke:#f6c86e; stroke-width:2; stroke-dasharray:8 6; }
  .stage { fill:#6f4434; stroke:#eca66b; stroke-width:3; }
  .stageLine { stroke:#b47b58; stroke-width:1; }
  .bridge { fill:#7b4d39; stroke:#f0b37a; stroke-width:3; }
  .bridgeRail { stroke:#f0b37a; stroke-width:2; }
  .landing { fill:#d5c2a1; fill-opacity:.25; stroke:#dcc69f; stroke-width:1.5; stroke-dasharray:5 4; }
  .torii { stroke:#db514a; stroke-width:7; stroke-linecap:round; }
  .toriiCap { stroke:#f16a60; stroke-width:5; stroke-linecap:round; }
  .lanternPad { fill:#8f826b; stroke:#cbb98f; stroke-width:1; }
  .lantern { fill:#ffd06a; stroke:#fff0b3; stroke-width:1.5; }
  .mapTitle { fill:#fff1e7; font-size:14px; font-weight:800; letter-spacing:1px; }
  .mapNote { fill:#aebbb3; font-size:11px; }
  .micro { fill:#d8e8e5; font-size:9px; font-weight:750; }
  .sectionTitle { fill:#fff1e7; font-size:17px; font-weight:820; }
  .body { fill:#c3c7cf; font-size:14px; }
  .metric { fill:#fff4df; font-size:26px; font-weight:850; }
  .metricLabel { fill:#999fac; font-size:11px; font-weight:700; letter-spacing:.7px; }
  .ruleGood { fill:#79d69f; font-size:13px; font-weight:750; }
  .rulePending { fill:#ffca75; font-size:13px; font-weight:750; }
  .divider { stroke:#343848; stroke-width:1; }
  .legendText { fill:#d5d8de; font-size:12px; }
  .phaseNumber { fill:#363a49; }
  .phaseActive { fill:#d89742; }
  .phaseNumberText { fill:#11141a; font-size:12px; font-weight:850; text-anchor:middle; }
  .phaseTitle { fill:#f2edf2; font-size:13px; font-weight:760; }
  .phaseState { fill:#8f95a1; font-size:9px; font-weight:800; letter-spacing:.9px; }
  .insetTerrain { fill:#1e2b24; stroke:#738b77; stroke-width:1.5; }
  .insetOrbit { fill:#d4974a; fill-opacity:.14; stroke:#f2bb63; stroke-width:1.5; stroke-dasharray:5 4; }
  .insetClearing { fill:#738b77; fill-opacity:.55; }
</style>
<rect width="1800" height="1200" fill="#0a0b10"/>
<text x="50" y="54" class="title">BLOSSOM R2.1 · MOONLIT HANAMI AMPHITHEATER</text>
<text x="50" y="82" class="subtitle">Adversarially corrected spatial gate · physical access, 3D sightlines, performance safety, living water, grove, and full camera envelope</text>
<rect x="1454" y="30" width="296" height="52" rx="12" fill="#2d2418" stroke="#7a5c2f"/>
<text x="1602" y="61" class="status" text-anchor="middle">AWAITING SPATIAL APPROVAL</text>

<rect x="34" y="116" width="950" height="1024" rx="22" class="mapPanel"/>
<text x="52" y="147" class="mapTitle">TOP-DOWN MASTER PLAN · 5 M GRID · NORTH ↑</text>
<text x="720" y="147" class="mapNote">X west/east · Y audience/stage/threshold</text>
<rect x="${mapX(-45)}" y="${mapY(52)}" width="${90 * scaleX}" height="${92 * scaleY}" rx="24" class="terrain"/>
<rect x="${mapX(plan.site.playableClearingBounds.minX)}" y="${mapY(plan.site.playableClearingBounds.maxY)}" width="${(plan.site.playableClearingBounds.maxX - plan.site.playableClearingBounds.minX) * scaleX}" height="${(plan.site.playableClearingBounds.maxY - plan.site.playableClearingBounds.minY) * scaleY}" rx="42" class="playable"/>
${grid.join("\n")}
${backgroundGrove}
${viewRays}
${audienceZones}
${paths}
<path d="${waterPath}" class="waterBank" stroke-width="${(plan.water.surfaceWidth + plan.water.bankTransitionWidth * 2) * scaleY}"/>
<path d="${waterPath}" class="water" stroke-width="${plan.water.surfaceWidth * scaleY}"/>
${plan.water.localWidenings.map((widening) => `<circle cx="${mapX(widening.center[0])}" cy="${mapY(widening.center[1])}" r="${widening.surfaceRadius * scaleX}" class="waterPool"/>`).join("\n")}
<path d="${waterPath}" class="waterHighlight"/>
${fishHabitats}
${trees}
<rect x="${mapX(clear.minX)}" y="${mapY(clear.maxY)}" width="${(clear.maxX - clear.minX) * scaleX}" height="${(clear.maxY - clear.minY) * scaleY}" rx="16" class="stageClear"/>
<rect x="${stageX}" y="${stageY}" width="${stageWidth}" height="${stageHeight}" rx="8" class="stage"/>
${[-4, 0, 4].map((x) => `<line x1="${mapX(x)}" y1="${mapY(4)}" x2="${mapX(x)}" y2="${mapY(-4)}" class="stageLine"/>`).join("\n")}
<text x="${mapX(0)}" y="${mapY(0) + 5}" class="mapTitle" text-anchor="middle">STAGE</text>
${[plan.bridge.southLanding, plan.bridge.northLanding]
  .map(
    (landing) =>
      `<rect x="${mapX(landing.minX)}" y="${mapY(landing.maxY)}" width="${(landing.maxX - landing.minX) * scaleX}" height="${(landing.maxY - landing.minY) * scaleY}" class="landing"/>`
  )
  .join("\n")}
<rect x="${bridgeX}" y="${bridgeY}" width="${bridgeWidth}" height="${bridgeHeight}" rx="6" class="bridge"/>
<line x1="${bridgeX + 4}" y1="${bridgeY}" x2="${bridgeX + 4}" y2="${bridgeY + bridgeHeight}" class="bridgeRail"/>
<line x1="${bridgeX + bridgeWidth - 4}" y1="${bridgeY}" x2="${bridgeX + bridgeWidth - 4}" y2="${bridgeY + bridgeHeight}" class="bridgeRail"/>
<text x="${mapX(plan.bridge.center[0]) - 24}" y="${mapY(plan.bridge.center[1])}" class="zoneLabel" text-anchor="end">CLEAR BRIDGE</text>
<g transform="rotate(${plan.torii.rotationDegrees} ${mapX(plan.torii.center[0])} ${toriiY})">
  <line x1="${toriiLeft}" y1="${toriiY - 19}" x2="${toriiLeft}" y2="${toriiY + 22}" class="torii"/>
  <line x1="${toriiRight}" y1="${toriiY - 19}" x2="${toriiRight}" y2="${toriiY + 22}" class="torii"/>
  <line x1="${toriiLeft - 13}" y1="${toriiY - 22}" x2="${toriiRight + 13}" y2="${toriiY - 22}" class="toriiCap"/>
</g>
<text x="${mapX(plan.torii.center[0])}" y="${toriiY - 35}" class="zoneLabel" text-anchor="middle">TORII THRESHOLD</text>
${lanterns}
<path d="M ${mapX(plan.camera.default.position[0])} ${mapY(plan.camera.default.position[1])} L ${mapX(plan.camera.default.position[0] - 1)} ${mapY(plan.camera.default.position[1] + 2)} L ${mapX(plan.camera.default.position[0] + 1)} ${mapY(plan.camera.default.position[1] + 2)} Z" fill="#f7d27e"/>
<text x="${mapX(plan.camera.default.position[0])}" y="${mapY(plan.camera.default.position[1]) + 26}" class="zoneLabel" text-anchor="middle">DEFAULT CAMERA</text>
<path d="M 934 198 L 934 158 L 926 174 M 934 158 L 942 174" stroke="#f7e8dd" stroke-width="2" fill="none"/>
<text x="934" y="216" class="zoneLabel" text-anchor="middle">N</text>

<rect x="1010" y="116" width="756" height="182" rx="20" class="panel"/>
<text x="1040" y="152" class="sectionTitle">THE SPATIAL HIERARCHY</text>
${multilineText(plan.designThesis, 1040, 181, "body", 50, 19)}
<line x1="1040" y1="245" x2="1476" y2="245" class="divider"/>
<text x="1040" y="266" class="ruleGood">✓ Stage and audience read first</text>
<text x="1040" y="286" class="ruleGood">✓ River threshold · established grove beyond</text>
<rect x="${inset.x}" y="${inset.y}" width="${inset.width}" height="${inset.height}" rx="8" class="insetTerrain"/>
<rect x="${insetX(cameraEnvelope.minX)}" y="${insetY(cameraEnvelope.maxY)}" width="${insetX(cameraEnvelope.maxX) - insetX(cameraEnvelope.minX)}" height="${insetY(cameraEnvelope.minY) - insetY(cameraEnvelope.maxY)}" rx="5" class="insetOrbit"/>
<rect x="${insetX(plan.site.playableClearingBounds.minX)}" y="${insetY(plan.site.playableClearingBounds.maxY)}" width="${insetX(plan.site.playableClearingBounds.maxX) - insetX(plan.site.playableClearingBounds.minX)}" height="${insetY(plan.site.playableClearingBounds.minY) - insetY(plan.site.playableClearingBounds.maxY)}" rx="3" class="insetClearing"/>
<text x="${inset.x + 8}" y="${inset.y + 15}" class="micro">FULL TERRAIN · ORBIT ENVELOPE · CLEARING</text>

<rect x="1010" y="316" width="365" height="224" rx="20" class="panel"/>
<text x="1040" y="352" class="sectionTitle">PEOPLE + MOVEMENT</text>
<text x="1040" y="397" class="metric">${plan.audience.capacity}</text>
<text x="1040" y="418" class="metricLabel">CAPACITY</text>
<text x="1160" y="397" class="metric">${plan.audience.zones.length}</text>
<text x="1160" y="418" class="metricLabel">ZONES</text>
<text x="1265" y="397" class="metric">${validation.measurements.publicPathCount}</text>
<text x="1265" y="418" class="metricLabel">ROUTES</text>
<text x="1040" y="460" class="ruleGood">✓ ${validation.measurements.connectedPublicNodes} physical public nodes connect</text>
<text x="1040" y="486" class="ruleGood">✓ ${validation.measurements.wheelchairBays} wheelchair + companion bays</text>
<text x="1040" y="512" class="ruleGood">✓ Service route separated from public access</text>

<rect x="1392" y="316" width="374" height="224" rx="20" class="panel"/>
<text x="1422" y="352" class="sectionTitle">WATER + CROSSING</text>
<text x="1422" y="397" class="metric">${plan.water.surfaceWidth} m</text>
<text x="1422" y="418" class="metricLabel">RIVER WIDTH</text>
<text x="1562" y="397" class="metric">${plan.bridge.length} m</text>
<text x="1562" y="418" class="metricLabel">BRIDGE SPAN</text>
<text x="1422" y="460" class="ruleGood">✓ Both bridge landings are tree-free</text>
<text x="1422" y="486" class="ruleGood">✓ Bed, banks, shallows, reflections required</text>
<text x="1422" y="512" class="ruleGood">✓ Koi habitats avoid the crossing</text>

<rect x="1010" y="558" width="756" height="218" rx="20" class="panel"/>
<text x="1040" y="594" class="sectionTitle">GROVE + ATMOSPHERE</text>
<text x="1040" y="641" class="metric">${plan.grove.trees.length} + ${validation.measurements.groveBackgroundInstances}</text>
<text x="1040" y="662" class="metricLabel">HERO + BACKGROUND TREES</text>
<text x="1215" y="641" class="metric">${validation.measurements.distinctHeroVariants}</text>
<text x="1215" y="662" class="metricLabel">HERO VARIANTS</text>
<text x="1380" y="641" class="metric">14%</text>
<text x="1380" y="662" class="metricLabel">MAX STAGE PETALS</text>
<text x="1584" y="641" class="metric">20:30</text>
<text x="1584" y="662" class="metricLabel">TIME OF DAY</text>
<text x="1040" y="700" class="ruleGood">✓ PlantFactory only · no Meshy trees · no blob trees</text>
<text x="1040" y="723" class="rulePending">○ Approve nine new variants before grove production</text>
<text x="1040" y="746" class="ruleGood">✓ Petals originate beneath real blossom canopies</text>
<text x="1040" y="769" class="ruleGood">✓ Full moon and wooded berm close the horizon</text>

<rect x="1010" y="794" width="756" height="306" rx="20" class="panel"/>
<text x="1040" y="828" class="sectionTitle">DELIVERY GATES · NOTHING GETS PILED ON</text>
${phases}
<line x1="1392" y1="850" x2="1392" y2="1074" class="divider"/>
<text x="1422" y="875" class="mapTitle">ACCEPTANCE PROOF</text>
<text x="1422" y="912" class="ruleGood">✓ ${validation.measurements.connectedPublicNodes}/${plan.circulation.requiredPublicNodes.length} physical nodes connected</text>
<text x="1422" y="940" class="ruleGood">✓ Bridge center offset ${validation.measurements.bridgeCenterlineOffsetMetres} m</text>
<text x="1422" y="968" class="ruleGood">✓ ${validation.measurements.sightlineRayCount} 3D sightline rays clear</text>
<text x="1422" y="996" class="ruleGood">✓ Orbit envelope ${validation.measurements.cameraEnvelope.minX}…${validation.measurements.cameraEnvelope.maxX} m</text>
<text x="1422" y="1024" class="ruleGood">✓ Koi footprints contained in widened pools</text>
<text x="1422" y="1062" class="rulePending">○ Production locked pending approval</text>

<g transform="translate(52 1122)">
  <circle cx="0" cy="0" r="9" class="treeCanopy treeMature"/><text x="16" y="4" class="legendText">PlantFactory grove</text>
  <line x1="150" y1="0" x2="196" y2="0" class="path" stroke-width="10"/><text x="207" y="4" class="legendText">Public route</text>
  <line x1="320" y1="0" x2="366" y2="0" class="water" stroke-width="14"/><text x="377" y="4" class="legendText">Living river</text>
  <rect x="492" y="-9" width="24" height="18" class="audienceZone audience-seated-lawn"/><text x="526" y="4" class="legendText">Audience</text>
  <line x1="622" y1="0" x2="668" y2="0" class="viewRay"/><text x="679" y="4" class="legendText">Protected sightline</text>
</g>
</svg>`;

const validationEvidence = {
  planId: plan.planId,
  status: "verified-for-spatial-review",
  checkedAt: new Date().toISOString(),
  productionUnlocked: false,
  approvedPlantFactoryCandidates: eligibleCandidateIds,
  ...validation,
};

await writeFile(svgPath, svg);
await sharp(Buffer.from(svg)).png().toFile(pngPath);
await writeFile(
  validationPath,
  `${JSON.stringify(validationEvidence, null, 2)}\n`
);

console.log(
  JSON.stringify(
    {
      plan: planPath.replaceAll("\\", "/"),
      svg: svgPath.replaceAll("\\", "/"),
      png: pngPath.replaceAll("\\", "/"),
      validation: validationEvidence,
    },
    null,
    2
  )
);
