import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildEarthRootObservatoryPlanForGrid,
  earthRootObservatoryFloorSightlineMargin,
  earthRootObservatoryMaximumGrade,
  earthRootObservatoryMinimumRouteSeparation,
  earthRootObservatoryRouteLength,
  earthRootObservatoryViewingSamples,
  isEarthRootObservatorySightlineBlocked,
  isInsideEarthRootObservatoryFinalFrame,
  type EarthRootObservatoryPerformer,
  type EarthRootObservatoryPlan,
  type EarthRootObservatoryStop,
} from "../src/lib/features/museum/data/earth-root-observatory-plan";
import { buildVulcanCaveFloorPlan } from "../src/lib/features/museum/data/vulcan-cave-floor-plan";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

const OUTPUT_DIR = resolve("docs/superpowers/specs/earth-root-observatory");
const BOARD_PATH = resolve(
  OUTPUT_DIR,
  "earth-root-observatory-gate1-amendment-board.svg"
);
const REPORT_PATH = resolve(
  OUTPUT_DIR,
  "earth-root-observatory-gate1-amendment-report.json"
);
const CATALOG_PATH = resolve("static/data/hero/tnd-base-words.json");
const SEQUENCE_SOURCE_PATH = resolve(
  "src/lib/features/museum/data/museum-exhibit-sequences.ts"
);
const ROOM_SOURCE_PATH = resolve(
  "src/lib/features/museum/data/vulcan-cave-floor-plan.ts"
);
const PLAN_SOURCE_PATH = resolve(
  "src/lib/features/museum/data/earth-root-observatory-plan.ts"
);

const COLORS = {
  background: "#101512",
  panel: "#172019",
  panel2: "#1d281f",
  line: "#526257",
  grid: "#2d3b31",
  text: "#f4f0e4",
  muted: "#a9b5aa",
  route: "#88c47b",
  routeGlow: "#3f6f46",
  habitat: "#527f4b",
  moss: "#78875d",
  tree: "#8e6741",
  treeDark: "#4a3525",
  roots: "#6e5438",
  g: "#9bd087",
  h: "#d2b56f",
  i: "#87b6cf",
  sightline: "#f1d47b",
  rejected: "#d16f62",
  invention: "#c596d8",
  literal: "#8db9d4",
  metaphor: "#9bc786",
} as const;

const PREVIOUS_PERFORMER_CENTRES = {
  h: { x: 15, z: 4.8 },
  i: { x: 26.5, z: 10.5 },
} as const;

interface CatalogMotion {
  motionType: string;
  rotationDirection: string;
  turns: number;
}

interface CatalogEntry {
  id: string;
  word: string;
  isCircular: boolean;
  sequenceLength: number;
  metadata: { handPathId: string; familyLabel: string };
  steps: Array<{
    motions: { blue: CatalogMotion; red: CatalogMotion };
  }>;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapWords(value: string, maximumCharacters: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/)) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maximumCharacters) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textLines(
  x: number,
  y: number,
  lines: string[],
  options: {
    size?: number;
    fill?: string;
    weight?: number;
    anchor?: "start" | "middle" | "end";
    lineHeight?: number;
  } = {}
): string {
  const size = options.size ?? 18;
  const lineHeight = options.lineHeight ?? size * 1.25;
  return `<text x="${x}" y="${y}" fill="${options.fill ?? COLORS.text}" font-size="${size}" font-weight="${options.weight ?? 400}" text-anchor="${options.anchor ?? "start"}">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("")}</text>`;
}

function circlePath(cx: number, cy: number, radius: number): string {
  return `M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`;
}

function petalPath(cx: number, cy: number, radius: number): string {
  const r = radius;
  return [
    `M ${cx} ${cy}`,
    `C ${cx - r * 0.15} ${cy - r * 0.55}, ${cx - r * 0.6} ${cy - r * 0.65}, ${cx} ${cy - r}`,
    `C ${cx + r * 0.6} ${cy - r * 0.65}, ${cx + r * 0.15} ${cy - r * 0.2}, ${cx} ${cy}`,
    `C ${cx + r * 0.55} ${cy - r * 0.15}, ${cx + r * 0.65} ${cy - r * 0.6}, ${cx + r} ${cy}`,
    `C ${cx + r * 0.65} ${cy + r * 0.6}, ${cx + r * 0.2} ${cy + r * 0.15}, ${cx} ${cy}`,
    `C ${cx + r * 0.15} ${cy + r * 0.55}, ${cx + r * 0.6} ${cy + r * 0.65}, ${cx} ${cy + r}`,
    `C ${cx - r * 0.6} ${cy + r * 0.65}, ${cx - r * 0.15} ${cy + r * 0.2}, ${cx} ${cy}`,
    `C ${cx - r * 0.55} ${cy + r * 0.15}, ${cx - r * 0.65} ${cy + r * 0.6}, ${cx - r} ${cy}`,
    `C ${cx - r * 0.65} ${cy - r * 0.6}, ${cx - r * 0.2} ${cy - r * 0.15}, ${cx} ${cy}`,
  ].join(" ");
}

function performerColor(id: string): string {
  if (id === "g") return COLORS.g;
  if (id === "h") return COLORS.h;
  return COLORS.i;
}

function buildBoard(
  plan: EarthRootObservatoryPlan,
  catalog: CatalogEntry[]
): string {
  const width = 2000;
  const height = 1320;
  const planX = 100;
  const planY = 180;
  const metresToPixels = 27;
  const localX = (x: number) => planX + (x - plan.room.minX) * metresToPixels;
  const localZ = (z: number) => planY + (z - plan.room.minZ) * metresToPixels;
  const pointList = plan.walkPath
    .map((point) => `${localX(point.x)},${localZ(point.z)}`)
    .join(" ");
  const roomWidth = plan.room.maxX - plan.room.minX;
  const roomDepth = plan.room.maxZ - plan.room.minZ;
  const previousCentres = Object.fromEntries(
    Object.entries(PREVIOUS_PERFORMER_CENTRES).map(([id, centre]) => [
      id,
      {
        x: plan.room.minX + (centre.x / 34) * roomWidth,
        z: plan.room.minZ + (centre.z / 24) * roomDepth,
      },
    ])
  ) as Record<"h" | "i", { x: number; z: number }>;
  const treeX = localX(plan.tree.centre.x);
  const treeY = localZ(plan.tree.centre.z);
  const finalStop = plan.stops.find(
    (stop) => stop.id === "recognition-overlook"
  )!;
  const ledgeProof = Object.fromEntries(
    plan.performers
      .filter((performer) => performer.id !== "g")
      .map((performer) => {
        const stop = plan.stops.find(
          (candidate) => candidate.id === `performer-${performer.id}`
        )!;
        const samples = earthRootObservatoryViewingSamples(plan, performer);
        const minimumFloorMargin = Math.min(
          ...samples.map((sample) =>
            earthRootObservatoryFloorSightlineMargin(plan, sample, performer)
          )
        );
        const previous = previousCentres[performer.id as "h" | "i"];
        return [
          performer.id,
          {
            performer,
            oldStopDistance: Math.hypot(
              previous.x - stop.x,
              previous.z - stop.z
            ),
            newStopDistance: Math.hypot(
              performer.centre.x - stop.x,
              performer.centre.z - stop.z
            ),
            minimumFloorMargin,
            samples,
          },
        ];
      })
  ) as Record<
    "h" | "i",
    {
      performer: EarthRootObservatoryPerformer;
      oldStopDistance: number;
      newStopDistance: number;
      minimumFloorMargin: number;
      samples: ReturnType<typeof earthRootObservatoryViewingSamples>;
    }
  >;

  const planGrid = Array.from(
    { length: Math.floor(roomWidth / 2) + 1 },
    (_, index) => {
      const x = planX + index * 2 * metresToPixels;
      return `<line x1="${x}" y1="${planY}" x2="${x}" y2="${planY + roomDepth * metresToPixels}" stroke="${COLORS.grid}"/>`;
    }
  )
    .concat(
      Array.from({ length: Math.floor(roomDepth / 2) + 1 }, (_, index) => {
        const y = planY + index * 2 * metresToPixels;
        return `<line x1="${planX}" y1="${y}" x2="${planX + roomWidth * metresToPixels}" y2="${y}" stroke="${COLORS.grid}"/>`;
      })
    )
    .join("");

  const habitatMassMarks = plan.habitatMasses
    .map((mass) => {
      const x = localX(mass.centre.x);
      const y = localZ(mass.centre.z);
      const fill = mass.density === "moss" ? COLORS.moss : COLORS.habitat;
      const height = mass.maximumElevation - plan.performerFloorElevation;
      return `
        <ellipse cx="${x}" cy="${y}" rx="${mass.radiusX * metresToPixels}" ry="${mass.radiusZ * metresToPixels}" fill="${fill}" fill-opacity="0.3" stroke="${fill}" stroke-width="3" stroke-dasharray="7 5"/>
        ${textLines(x, y - 4, [mass.label, `+${height.toFixed(2)} m`], { size: 11, fill: COLORS.text, anchor: "middle", lineHeight: 14 })}`;
    })
    .join("");

  const previousPositionMarks = Object.entries(previousCentres)
    .map(([id, centre]) => {
      const performer = plan.performers.find((candidate) => candidate.id === id)!;
      const oldX = localX(centre.x);
      const oldY = localZ(centre.z);
      const newX = localX(performer.centre.x);
      const newY = localZ(performer.centre.z);
      const labelX = id === "h" ? oldX - 58 : oldX;
      return `
        <circle cx="${oldX}" cy="${oldY}" r="${performer.habitatRadius * metresToPixels}" fill="none" stroke="${COLORS.rejected}" stroke-width="3" stroke-dasharray="8 7" opacity="0.9"/>
        <line x1="${oldX - 14}" y1="${oldY - 14}" x2="${oldX + 14}" y2="${oldY + 14}" stroke="${COLORS.rejected}" stroke-width="5"/>
        <line x1="${oldX + 14}" y1="${oldY - 14}" x2="${oldX - 14}" y2="${oldY + 14}" stroke="${COLORS.rejected}" stroke-width="5"/>
        <line x1="${oldX}" y1="${oldY}" x2="${newX}" y2="${newY}" stroke="${COLORS.rejected}" stroke-width="3" marker-end="url(#moveArrow)"/>
        ${textLines(labelX, oldY - performer.habitatRadius * metresToPixels - 12, [`OLD ${performer.label}`], { size: 12, fill: COLORS.rejected, anchor: "middle", weight: 700 })}`;
    })
    .join("");

  const movingSightlines = plan.performers
    .map((performer) => {
      const samples = earthRootObservatoryViewingSamples(plan, performer);
      const representativeSamples = [samples[0]!, samples[3]!, samples[6]!];
      const first = samples[0]!;
      const last = samples.at(-1)!;
      return `
        <line x1="${localX(first.x)}" y1="${localZ(first.z)}" x2="${localX(last.x)}" y2="${localZ(last.z)}" stroke="${COLORS.sightline}" stroke-width="14" stroke-linecap="round" opacity="0.26"/>
        ${representativeSamples
          .map(
            (sample) =>
              `<line x1="${localX(sample.x)}" y1="${localZ(sample.z)}" x2="${localX(performer.centre.x)}" y2="${localZ(performer.centre.z)}" stroke="${performerColor(performer.id)}" stroke-width="2" stroke-dasharray="6 6" opacity="0.8"/>`
          )
          .join("")}`;
    })
    .join("");

  const habitatMarks = plan.performers
    .map((performer) => {
      const x = localX(performer.centre.x);
      const y = localZ(performer.centre.z);
      const color = performerColor(performer.id);
      return `
        <circle cx="${x}" cy="${y}" r="${performer.interactionRadius * metresToPixels}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="8 8" opacity="0.7"/>
        <circle cx="${x}" cy="${y}" r="${performer.habitatRadius * metresToPixels}" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="4"/>
        <circle cx="${x}" cy="${y}" r="24" fill="${color}"/>
        <text x="${x}" y="${y + 8}" fill="${COLORS.background}" font-size="25" font-weight="700" text-anchor="middle">${performer.label}</text>`;
    })
    .join("");

  const occluders = plan.occluders
    .map((occluder) => {
      const x = localX(occluder.rect.minX);
      const y = localZ(occluder.rect.minZ);
      const w = (occluder.rect.maxX - occluder.rect.minX) * metresToPixels;
      const h = (occluder.rect.maxZ - occluder.rect.minZ) * metresToPixels;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${COLORS.roots}" stroke="${COLORS.tree}" stroke-width="3"/><text x="${x + w / 2}" y="${y + h / 2}" fill="${COLORS.text}" font-size="12" text-anchor="middle" transform="rotate(90 ${x + w / 2} ${y + h / 2})">ROOT SCREEN</text>`;
    })
    .join("");

  const stopMarks = plan.stops
    .map((stop) => {
      const x = localX(stop.x);
      const y = localZ(stop.z);
      return `<g><circle cx="${x}" cy="${y}" r="19" fill="${COLORS.text}" stroke="${COLORS.background}" stroke-width="4"/><text x="${x}" y="${y + 7}" fill="${COLORS.background}" font-size="20" font-weight="700" text-anchor="middle">${stop.number}</text></g>`;
    })
    .join("");

  const sightlines = [
    plan.tree.centre,
    ...plan.performers.map((performer) => performer.centre),
  ]
    .map(
      (target) =>
        `<line x1="${localX(finalStop.x)}" y1="${localZ(finalStop.z)}" x2="${localX(target.x)}" y2="${localZ(target.z)}" stroke="${COLORS.sightline}" stroke-width="2.5" stroke-dasharray="10 8"/>`
    )
    .join("");

  const performerSectionX = {
    g: 1330,
    h: 1485,
    i: 1640,
  } as const;
  const motionCards = plan.performers
    .map((performer) => {
      const entry = catalog.find(
        (candidate) => candidate.word === performer.label.repeat(4)
      )!;
      const motion = entry.steps[0]!.motions;
      const x = performerSectionX[performer.id];
      const color = performerColor(performer.id);
      const path =
        performer.environmentTrace === "ring"
          ? circlePath(x, 700, 52)
          : performer.environmentTrace === "petal"
            ? petalPath(x, 700, 48)
            : `${circlePath(x, 700, 53)} ${petalPath(x, 700, 38)}`;
      return `
        <g>
          <text x="${x}" y="620" fill="${color}" font-size="30" font-weight="700" text-anchor="middle">${performer.label}</text>
          <path d="${path}" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
          ${textLines(x, 785, [`blue ${motion.blue.motionType} ${motion.blue.rotationDirection}`, `red ${motion.red.motionType} ${motion.red.rotationDirection}`, `4-step circular loop`], { size: 14, fill: COLORS.text, anchor: "middle", lineHeight: 20 })}
        </g>`;
    })
    .join("");

  const routeCards = plan.stops
    .map((stop, index) => {
      const cardWidth = 258;
      const gap = 12;
      const x = 70 + index * (cardWidth + gap);
      const y = 990;
      const focus = wrapWords(stop.focus, 27).slice(0, 3);
      const response = wrapWords(stop.response, 27).slice(0, 4);
      return `
        <g>
          ${index < plan.stops.length - 1 ? `<line x1="${x + cardWidth}" y1="${y + 32}" x2="${x + cardWidth + gap}" y2="${y + 32}" stroke="${COLORS.route}" stroke-width="4" marker-end="url(#arrow)"/>` : ""}
          <circle cx="${x + 25}" cy="${y + 28}" r="20" fill="${COLORS.route}"/>
          <text x="${x + 25}" y="${y + 35}" fill="${COLORS.background}" font-size="20" font-weight="700" text-anchor="middle">${stop.number}</text>
          ${textLines(x + 54, y + 22, wrapWords(stop.title, 22), { size: 18, weight: 700, lineHeight: 22 })}
          ${textLines(x + 10, y + 92, ["SEE", ...focus], { size: 15, fill: COLORS.muted, lineHeight: 20 })}
          ${textLines(x + 10, y + 182, ["CHANGE", ...response], { size: 15, fill: COLORS.text, lineHeight: 20 })}
        </g>`;
    })
    .join("");

  const sectionBaseY = 475;
  const sectionScaleY = 16;
  const elevationY = (value: number) => sectionBaseY - value * sectionScaleY;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Earth Root Observatory Gate 1.1 sightline and habitat amendment</title>
  <desc id="description">Measured floor plan amendment showing rejected and revised performer positions, moving sightline windows, ledge clearance, habitat massing, and the seven-stop route.</desc>
  <defs>
    <marker id="arrow" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" refX="13" refY="7" orient="auto"><path d="M0,0 L14,7 L0,14 Z" fill="${COLORS.route}"/></marker>
    <marker id="moveArrow" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto"><path d="M0,0 L12,6 L0,12 Z" fill="${COLORS.rejected}"/></marker>
    <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <rect width="2000" height="1320" fill="${COLORS.background}"/>
  ${textLines(40, 52, ["EARTH GATE 1.1 · SIGHTLINES + HABITAT"], { size: 32, weight: 700 })}
  ${textLines(40, 84, ["34 × 24 m shell unchanged · H/I moved below the ledge · habitat mass reserved · ready for review · Blender unchanged"], { size: 17, fill: COLORS.muted })}

  <rect x="40" y="110" width="1160" height="760" rx="18" fill="${COLORS.panel}"/>
  ${textLines(70, 148, ["1. AMENDED TOP-DOWN PLAN · OLD POSITIONS REMAIN VISIBLE IN RED"], { size: 22, weight: 700 })}
  <rect x="${planX}" y="${planY}" width="${roomWidth * metresToPixels}" height="${roomDepth * metresToPixels}" fill="${COLORS.panel2}" stroke="${COLORS.text}" stroke-width="5"/>
  ${planGrid}
  <circle cx="${treeX}" cy="${treeY}" r="${plan.tree.rootFieldRadius * metresToPixels}" fill="${COLORS.routeGlow}" fill-opacity="0.18" stroke="${COLORS.roots}" stroke-width="3" stroke-dasharray="12 8"/>
  ${habitatMassMarks}
  <circle cx="${treeX}" cy="${treeY}" r="${plan.tree.trunkRadius * metresToPixels}" fill="${COLORS.treeDark}" stroke="${COLORS.tree}" stroke-width="8"/>
  <text x="${treeX}" y="${treeY - 8}" fill="${COLORS.text}" font-size="24" font-weight="700" text-anchor="middle">HERO TREE</text>
  <text x="${treeX}" y="${treeY + 18}" fill="${COLORS.muted}" font-size="14" text-anchor="middle">breaks roof at +6.5 m</text>
  ${occluders}
  ${movingSightlines}
  ${previousPositionMarks}
  ${habitatMarks}
  <polyline points="${pointList}" fill="none" stroke="${COLORS.routeGlow}" stroke-width="${plan.routeWidth * metresToPixels}" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
  <polyline points="${pointList}" fill="none" stroke="${COLORS.route}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)"/>
  ${sightlines}
  ${stopMarks}
  <rect x="${planX - 8}" y="${localZ((plan.westDoor.min + plan.westDoor.max) / 2) - 34}" width="16" height="68" fill="${COLORS.route}"/>
  ${textLines(planX - 18, localZ((plan.westDoor.min + plan.westDoor.max) / 2) - 42, ["FIRE"], { size: 17, fill: COLORS.route, anchor: "end", weight: 700 })}
  <rect x="${localX((plan.southDoor.min + plan.southDoor.max) / 2) - 34}" y="${planY + roomDepth * metresToPixels - 8}" width="68" height="16" fill="${COLORS.i}"/>
  ${textLines(localX((plan.southDoor.min + plan.southDoor.max) / 2), planY + roomDepth * metresToPixels + 34, ["AIR"], { size: 17, fill: COLORS.i, anchor: "middle", weight: 700 })}
  <line x1="${localX(finalStop.x)}" y1="${localZ(finalStop.z)}" x2="${localX(finalStop.x)}" y2="${localZ(finalStop.z) - 75}" stroke="${COLORS.sightline}" stroke-width="4" marker-end="url(#arrow)"/>
  ${textLines(localX(finalStop.x) - 5, localZ(finalStop.z) + 48, ["FINAL 75° FRAME", "all three + tree"], { size: 14, fill: COLORS.sightline, anchor: "middle", lineHeight: 18 })}
  <line x1="${planX + 24}" y1="${planY + roomDepth * metresToPixels - 28}" x2="${planX + 24 + 5 * metresToPixels}" y2="${planY + roomDepth * metresToPixels - 28}" stroke="${COLORS.text}" stroke-width="5"/>
  ${textLines(planX + 24 + 2.5 * metresToPixels, planY + roomDepth * metresToPixels - 38, ["5 m"], { size: 14, anchor: "middle" })}
  ${textLines(planX + roomWidth * metresToPixels - 10, planY + 28, ["N ↑"], { size: 17, anchor: "end", weight: 700 })}
  ${textLines(1060, 260, ["ROUTE"], { size: 16, fill: COLORS.route, weight: 700 })}
  ${textLines(1060, 288, ["2.4 m clear", `${earthRootObservatoryRouteLength(plan).toFixed(1)} m total`, `${(earthRootObservatoryMaximumGrade(plan) * 100).toFixed(1)}% max grade`], { size: 15, fill: COLORS.muted, lineHeight: 22 })}
  ${textLines(1060, 390, ["HEIGHTS"], { size: 16, fill: COLORS.route, weight: 700 })}
  ${textLines(1060, 418, ["visitor path 0.0 to +0.6 m", "performer floor -2.4 m", "player eye +1.6 m"], { size: 15, fill: COLORS.muted, lineHeight: 22 })}
  ${textLines(1060, 520, ["VISUAL ORDER"], { size: 16, fill: COLORS.route, weight: 700 })}
  ${textLines(1060, 548, ["tree first", "G → H → I", "ensemble last"], { size: 15, fill: COLORS.text, lineHeight: 22 })}
  ${textLines(1060, 642, ["AMENDMENT"], { size: 16, fill: COLORS.rejected, weight: 700 })}
  ${textLines(1060, 670, [`H ${ledgeProof.h.oldStopDistance.toFixed(1)} → ${ledgeProof.h.newStopDistance.toFixed(1)} m`, `I ${ledgeProof.i.oldStopDistance.toFixed(1)} → ${ledgeProof.i.newStopDistance.toFixed(1)} m`, "5 habitat fields", "red = rejected"], { size: 14, fill: COLORS.muted, lineHeight: 21 })}

  <rect x="1220" y="110" width="740" height="410" rx="18" fill="${COLORS.panel}"/>
  ${textLines(1250, 148, ["2. VERTICAL PROOF · ROOM HEIGHT + LOCAL LEDGE CUTAWAYS"], { size: 20, weight: 700 })}
  <path d="M 1250 ${elevationY(0.6)} L 1325 ${elevationY(0.6)} L 1360 ${elevationY(0)} L 1390 ${elevationY(0)} L 1420 ${elevationY(-2.4)} L 1585 ${elevationY(-2.4)}" fill="none" stroke="${COLORS.text}" stroke-width="5"/>
  <path d="M 1245 ${elevationY(6.5)} L 1350 ${elevationY(6.5)} L 1395 ${elevationY(8.5)} L 1455 ${elevationY(8.5)} L 1500 ${elevationY(6.5)} L 1590 ${elevationY(6.5)}" fill="none" stroke="${COLORS.line}" stroke-width="10"/>
  <path d="M 1425 ${elevationY(-2.4)} C 1415 ${elevationY(2)}, 1395 ${elevationY(7)}, 1425 ${elevationY(15)} C 1455 ${elevationY(7)}, 1438 ${elevationY(2)}, 1450 ${elevationY(-2.4)} Z" fill="${COLORS.tree}" stroke="${COLORS.treeDark}" stroke-width="5"/>
  <circle cx="1427" cy="${elevationY(11.5)}" r="52" fill="${COLORS.routeGlow}" opacity="0.65"/>
  ${textLines(1270, 490, ["route 0.0 to +0.6 m", "basin -2.4 m", "roof +6.5 m"], { size: 13, fill: COLORS.muted, lineHeight: 18 })}
  ${textLines(1425, 205, ["tree +15 m"], { size: 13, fill: COLORS.route, anchor: "middle" })}
  <line x1="1615" y1="170" x2="1615" y2="490" stroke="${COLORS.line}" stroke-width="2"/>

  ${textLines(1640, 184, ["H · LOCAL CUTAWAY"], { size: 14, fill: COLORS.h, weight: 700 })}
  <line x1="1645" y1="232" x2="1745" y2="232" stroke="${COLORS.route}" stroke-width="8"/>
  <line x1="1745" y1="232" x2="1745" y2="292" stroke="${COLORS.text}" stroke-width="5"/>
  <line x1="1745" y1="292" x2="1920" y2="292" stroke="${COLORS.text}" stroke-width="5"/>
  <circle cx="1680" cy="205" r="9" fill="${COLORS.route}"/>
  <line x1="1680" y1="214" x2="1680" y2="230" stroke="${COLORS.route}" stroke-width="6"/>
  <circle cx="1880" cy="261" r="10" fill="${COLORS.h}"/>
  <line x1="1880" y1="271" x2="1880" y2="292" stroke="${COLORS.h}" stroke-width="7"/>
  <line x1="1680" y1="205" x2="1880" y2="292" stroke="${COLORS.sightline}" stroke-width="2" stroke-dasharray="7 6"/>
  <circle cx="1745" cy="233" r="5" fill="${COLORS.sightline}"/>
  ${textLines(1638, 320, [`7/7 moving rays clear · foot line +${ledgeProof.h.minimumFloorMargin.toFixed(2)} m above lip`], { size: 12, fill: COLORS.h })}

  ${textLines(1640, 358, ["I · LOCAL CUTAWAY"], { size: 14, fill: COLORS.i, weight: 700 })}
  <line x1="1645" y1="406" x2="1745" y2="406" stroke="${COLORS.route}" stroke-width="8"/>
  <line x1="1745" y1="406" x2="1745" y2="466" stroke="${COLORS.text}" stroke-width="5"/>
  <line x1="1745" y1="466" x2="1920" y2="466" stroke="${COLORS.text}" stroke-width="5"/>
  <circle cx="1680" cy="379" r="9" fill="${COLORS.route}"/>
  <line x1="1680" y1="388" x2="1680" y2="404" stroke="${COLORS.route}" stroke-width="6"/>
  <circle cx="1880" cy="435" r="10" fill="${COLORS.i}"/>
  <line x1="1880" y1="445" x2="1880" y2="466" stroke="${COLORS.i}" stroke-width="7"/>
  <line x1="1680" y1="379" x2="1880" y2="466" stroke="${COLORS.i}" stroke-width="2" stroke-dasharray="7 6"/>
  <circle cx="1745" cy="407" r="5" fill="${COLORS.i}"/>
  ${textLines(1638, 494, [`7/7 moving rays clear · foot line +${ledgeProof.i.minimumFloorMargin.toFixed(2)} m above lip`], { size: 12, fill: COLORS.i })}

  <rect x="1220" y="540" width="740" height="330" rx="18" fill="${COLORS.panel}"/>
  ${textLines(1250, 578, ["3. PERFORMANCE → ENVIRONMENT"], { size: 20, weight: 700 })}
  ${motionCards}
  ${textLines(1775, 614, ["LITERAL"], { size: 14, fill: COLORS.literal, weight: 700 })}
  ${textLines(1775, 638, ["same hand loop", "different prop rotation"], { size: 13, fill: COLORS.muted, lineHeight: 18 })}
  ${textLines(1775, 700, ["METAPHOR"], { size: 14, fill: COLORS.metaphor, weight: 700 })}
  ${textLines(1775, 724, ["ring / petals / both"], { size: 13, fill: COLORS.muted })}
  ${textLines(1775, 766, ["INVENTION"], { size: 14, fill: COLORS.invention, weight: 700 })}
  ${textLines(1775, 790, ["proximity reveals", "visited traces persist", "overlook unifies"], { size: 13, fill: COLORS.muted, lineHeight: 18 })}
  ${textLines(1250, 848, ["GATE 2 RIG QA · body follow uses performer-local hand direction · zero visible arm/body penetration"], { size: 13, fill: COLORS.rejected })}

  <rect x="40" y="890" width="1920" height="390" rx="18" fill="${COLORS.panel}"/>
  ${textLines(70, 934, ["4. NUMBERED ROUTE · WHAT THE PLAYER SEES AND WHAT CHANGES"], { size: 22, weight: 700 })}
  ${routeCards}
  ${textLines(70, 1260, ["The loops remain continuous. Gate 1.1 changes H/I placement and habitat mass only. Blender remains frozen until this amendment is understood and approved."], { size: 16, fill: COLORS.muted })}
</svg>`;
}

const cave = buildVulcanCaveFloorPlan();
const plan = buildEarthRootObservatoryPlanForGrid(cave.grid);
if (!plan) throw new Error("Compiled museum has no Earth room");

const catalog = JSON.parse(
  readFileSync(CATALOG_PATH, "utf8")
) as CatalogEntry[];
const selectedCatalogIds = [
  "tnd-tog-same-gggg",
  "tnd-tog-same-hhhh",
  "tnd-tog-same-iiii",
];
const selectedCatalog = selectedCatalogIds.map((id) => {
  const entry = catalog.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Missing catalog sequence ${id}`);
  return entry;
});

const svg = buildBoard(plan, selectedCatalog);
mkdirSync(dirname(BOARD_PATH), { recursive: true });
writeFileSync(BOARD_PATH, svg, "utf8");

const stopByPerformer = Object.fromEntries(
  plan.performers.map((performer) => [
    performer.id,
    plan.stops.find((stop) => stop.id === `performer-${performer.id}`)!,
  ])
) as Record<string, EarthRootObservatoryStop>;

const report = {
  schemaVersion: 1,
  sceneId: "earth-root-observatory",
  gate: 1,
  revision: 2,
  amendment: "moving-sightlines-and-habitat-massing",
  room: {
    width: plan.room.maxX - plan.room.minX,
    depth: plan.room.maxZ - plan.room.minZ,
    westDoorWidth: plan.westDoor.max - plan.westDoor.min,
    southDoorWidth: plan.southDoor.max - plan.southDoor.min,
  },
  route: {
    width: plan.routeWidth,
    length: earthRootObservatoryRouteLength(plan),
    maximumGrade: earthRootObservatoryMaximumGrade(plan),
    stops: plan.stops.length,
  },
  checks: {
    walkability:
      plan.routeWidth >= 2.4 &&
      earthRootObservatoryMaximumGrade(plan) <= 1 / 16,
    isolatedCloseReads: Object.fromEntries(
      plan.performers.map((performer) => [
        performer.id,
        Object.fromEntries(
          plan.performers.map((target) => [
            target.id,
            !isEarthRootObservatorySightlineBlocked(
              plan,
              stopByPerformer[performer.id]!,
              target.centre
            ),
          ])
        ),
      ])
    ),
    movingSightlines: Object.fromEntries(
      plan.performers.map((performer) => {
        const samples = earthRootObservatoryViewingSamples(plan, performer);
        return [
          performer.id,
          {
            sampleCount: samples.length,
            allUnobstructed: samples.every(
              (sample) =>
                !isEarthRootObservatorySightlineBlocked(
                  plan,
                  sample,
                  performer.centre
                )
            ),
            minimumFloorMargin: Math.min(
              ...samples.map((sample) =>
                earthRootObservatoryFloorSightlineMargin(
                  plan,
                  sample,
                  performer
                )
              )
            ),
          },
        ];
      })
    ),
    routeSeparation: Object.fromEntries(
      plan.performers.map((performer) => [
        performer.id,
        {
          centreToRoute: earthRootObservatoryMinimumRouteSeparation(
            plan,
            performer.centre
          ),
          habitatToRouteEdge:
            earthRootObservatoryMinimumRouteSeparation(
              plan,
              performer.centre
            ) -
            plan.routeWidth / 2 -
            performer.habitatRadius,
        },
      ])
    ),
    habitatMassing: {
      fieldCount: plan.habitatMasses.length,
      ellipseArea: plan.habitatMasses.reduce(
        (total, mass) => total + Math.PI * mass.radiusX * mass.radiusZ,
        0
      ),
      allBelowRouteDatum: plan.habitatMasses.every(
        (mass) => mass.maximumElevation < 0
      ),
    },
    finalView: Object.fromEntries(
      plan.performers.map((performer) => [
        performer.id,
        {
          unobstructed: !isEarthRootObservatorySightlineBlocked(
            plan,
            plan.finalCamera.position,
            performer.centre
          ),
          insideFrame: isInsideEarthRootObservatoryFinalFrame(
            plan,
            performer.centre
          ),
        },
      ])
    ),
    treeHeroVisibleAtReveal: !isEarthRootObservatorySightlineBlocked(
      plan,
      plan.stops.find((stop) => stop.id === "tree-reveal")!,
      plan.tree.centre,
      false
    ),
  },
  sequenceFingerprints: selectedCatalog.map((entry) => ({
    catalogId: entry.id,
    word: entry.word,
    sha256: sha256(canonicalJSON(entry)),
  })),
  sourceDigests: [
    {
      path: "src/lib/features/museum/data/museum-exhibit-sequences.ts",
      sha256: sha256(readFileSync(SEQUENCE_SOURCE_PATH)),
    },
    {
      path: "src/lib/features/museum/data/vulcan-cave-floor-plan.ts",
      sha256: sha256(readFileSync(ROOM_SOURCE_PATH)),
    },
    {
      path: "src/lib/features/museum/data/earth-root-observatory-plan.ts",
      sha256: sha256(readFileSync(PLAN_SOURCE_PATH)),
    },
  ],
  artifacts: {
    board: "./earth-root-observatory-gate1-amendment-board.svg",
    boardSha256: sha256(svg),
  },
};

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Wrote ${BOARD_PATH}`);
console.log(`Wrote ${REPORT_PATH}`);
