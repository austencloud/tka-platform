import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildEarthLongTerracePlanForGrid,
  earthLongTerraceApparentBodyHeightDegrees,
  earthLongTerraceHorizontalFovDegrees,
  earthLongTerraceMaximumGrade,
  earthLongTerraceMinimumFloorMargin,
  earthLongTerraceRouteLength,
  earthLongTerraceViewingSamples,
  isEarthLongTerraceBodyInsideFinalFrame,
  isEarthLongTerraceSightlineBlocked,
  type EarthLongTerracePerformer,
  type EarthLongTerracePlan,
} from "../src/lib/features/museum/data/earth-long-terrace-plan";
import { buildVulcanCaveFloorPlan } from "../src/lib/features/museum/data/vulcan-cave-floor-plan";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

const OUTPUT_DIR = resolve("docs/superpowers/specs/earth-long-terrace");
const BOARD_PATH = resolve(OUTPUT_DIR, "earth-long-terrace-gate1-board.svg");
const REPORT_PATH = resolve(OUTPUT_DIR, "earth-long-terrace-gate1-report.json");
const CATALOG_PATH = resolve("static/data/hero/tnd-base-words.json");
const SEQUENCE_SOURCE_PATH = resolve(
  "src/lib/features/museum/data/museum-exhibit-sequences.ts"
);
const ROOM_SOURCE_PATH = resolve(
  "src/lib/features/museum/data/vulcan-cave-floor-plan.ts"
);
const PLAN_SOURCE_PATH = resolve(
  "src/lib/features/museum/data/earth-long-terrace-plan.ts"
);

const COLORS = {
  background: "#0b1210",
  panel: "#14201a",
  panelRaised: "#1b2a21",
  grid: "#2b3b31",
  text: "#f5f0df",
  muted: "#a8b5aa",
  daylight: "#c6e6d5",
  route: "#a7d885",
  routeShadow: "#365743",
  canyon: "#07100d",
  cliff: "#3c5337",
  root: "#8b6744",
  fern: "#507b4d",
  moss: "#789064",
  g: "#9bd480",
  h: "#e2bd70",
  i: "#8bc5d9",
  sightline: "#f0d57c",
  warning: "#e39472",
  metaphor: "#b79bd5",
  literal: "#83b7d4",
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
    motions: { left: CatalogMotion; right: CatalogMotion };
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

function wrap(value: string, maximumCharacters: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.split(/\s+/)) {
    if (!current) current = word;
    else if (`${current} ${word}`.length <= maximumCharacters)
      current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function text(
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

function performerColor(performer: EarthLongTerracePerformer): string {
  if (performer.id === "g") return COLORS.g;
  if (performer.id === "h") return COLORS.h;
  return COLORS.i;
}

function ringPath(cx: number, cy: number, radius: number): string {
  return `M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`;
}

function petalPath(cx: number, cy: number, radius: number): string {
  return [
    `M ${cx} ${cy}`,
    `C ${cx - radius * 0.25} ${cy - radius * 0.55}, ${cx - radius * 0.5} ${cy - radius * 0.65}, ${cx} ${cy - radius}`,
    `C ${cx + radius * 0.5} ${cy - radius * 0.65}, ${cx + radius * 0.25} ${cy - radius * 0.2}, ${cx} ${cy}`,
    `C ${cx + radius * 0.55} ${cy - radius * 0.25}, ${cx + radius * 0.65} ${cy - radius * 0.5}, ${cx + radius} ${cy}`,
    `C ${cx + radius * 0.65} ${cy + radius * 0.5}, ${cx + radius * 0.2} ${cy + radius * 0.25}, ${cx} ${cy}`,
    `C ${cx + radius * 0.25} ${cy + radius * 0.55}, ${cx + radius * 0.5} ${cy + radius * 0.65}, ${cx} ${cy + radius}`,
    `C ${cx - radius * 0.5} ${cy + radius * 0.65}, ${cx - radius * 0.25} ${cy + radius * 0.2}, ${cx} ${cy}`,
    `C ${cx - radius * 0.55} ${cy + radius * 0.25}, ${cx - radius * 0.65} ${cy + radius * 0.5}, ${cx - radius} ${cy}`,
    `C ${cx - radius * 0.65} ${cy - radius * 0.5}, ${cx - radius * 0.2} ${cy - radius * 0.25}, ${cx} ${cy}`,
  ].join(" ");
}

function motif(
  performer: EarthLongTerracePerformer,
  x: number,
  y: number
): string {
  const color = performerColor(performer);
  if (performer.traceShape === "twin-rings") {
    return `<path d="${ringPath(x - 9, y, 19)} ${ringPath(x + 9, y, 19)}" fill="none" stroke="${color}" stroke-width="4"/>`;
  }
  if (performer.traceShape === "four-petal") {
    return `<path d="${petalPath(x, y, 25)}" fill="none" stroke="${color}" stroke-width="4"/>`;
  }
  return `<path d="${ringPath(x - 7, y, 20)} ${petalPath(x + 7, y, 19)}" fill="none" stroke="${color}" stroke-width="4"/>`;
}

function drawBody(
  x: number,
  floorY: number,
  scale: number,
  color: string
): string {
  const height = 70 * scale;
  const head = 8 * scale;
  const shoulderY = floorY - height + 21 * scale;
  return `<g stroke="${color}" stroke-width="${Math.max(3, 5 * scale)}" stroke-linecap="round" fill="none">
    <circle cx="${x}" cy="${floorY - height + head}" r="${head}" fill="${color}" stroke="none"/>
    <line x1="${x}" y1="${floorY - height + 2 * head}" x2="${x}" y2="${floorY - 25 * scale}"/>
    <line x1="${x}" y1="${shoulderY}" x2="${x - 20 * scale}" y2="${shoulderY - 6 * scale}"/>
    <line x1="${x}" y1="${shoulderY}" x2="${x + 20 * scale}" y2="${shoulderY + 7 * scale}"/>
    <line x1="${x}" y1="${floorY - 25 * scale}" x2="${x - 12 * scale}" y2="${floorY}"/>
    <line x1="${x}" y1="${floorY - 25 * scale}" x2="${x + 12 * scale}" y2="${floorY}"/>
  </g>`;
}

function buildBoard(
  plan: EarthLongTerracePlan,
  catalog: CatalogEntry[]
): string {
  const width = 2200;
  const height = 1500;
  const planX = 120;
  const planY = 176;
  const scale = 31;
  const roomWidth = plan.room.maxX - plan.room.minX;
  const roomDepth = plan.room.maxZ - plan.room.minZ;
  const px = (x: number) => planX + (x - plan.room.minX) * scale;
  const pz = (z: number) => planY + (z - plan.room.minZ) * scale;
  const routePoints = plan.walkPath
    .map((point) => `${px(point.x)},${pz(point.z)}`)
    .join(" ");
  const reveal = plan.stops.find((stop) => stop.id === "trio-reveal")!;
  const final = plan.stops.find((stop) => stop.id === "ensemble-stand")!;
  const samples = earthLongTerraceViewingSamples(plan);
  const rayCount = samples.length * plan.performers.length;
  const minimumMargin = earthLongTerraceMinimumFloorMargin(plan);
  const maximumGrade = earthLongTerraceMaximumGrade(plan);
  const finalSizes = plan.performers.map((performer) =>
    earthLongTerraceApparentBodyHeightDegrees(plan, final, performer)
  );
  const comparisonSizes = plan.performers.map((performer, index) =>
    earthLongTerraceApparentBodyHeightDegrees(
      plan,
      plan.stops[index + 2]!,
      performer
    )
  );

  const grid = [
    ...Array.from({ length: 18 }, (_, index) => {
      const x = planX + index * 2 * scale;
      return `<line x1="${x}" y1="${planY}" x2="${x}" y2="${planY + roomDepth * scale}"/>`;
    }),
    ...Array.from({ length: 13 }, (_, index) => {
      const y = planY + index * 2 * scale;
      return `<line x1="${planX}" y1="${y}" x2="${planX + roomWidth * scale}" y2="${y}"/>`;
    }),
  ].join("");

  const habitat = plan.habitatMasses
    .map((mass) => {
      const fill =
        mass.density === "moss"
          ? COLORS.moss
          : mass.density === "fern"
            ? COLORS.fern
            : COLORS.root;
      return `<ellipse cx="${px(mass.centre.x)}" cy="${pz(mass.centre.z)}" rx="${mass.radiusX * scale}" ry="${mass.radiusZ * scale}" fill="${fill}" fill-opacity="0.3" stroke="${fill}" stroke-width="3" stroke-dasharray="8 6"/>
        ${text(px(mass.centre.x), pz(mass.centre.z), [mass.label], { size: 11, anchor: "middle", fill: COLORS.text, weight: 700 })}`;
    })
    .join("");

  const stages = plan.performers
    .map((performer) => {
      const x = px(performer.centre.x);
      const y = pz(performer.centre.z);
      const color = performerColor(performer);
      return `<circle cx="${x}" cy="${y}" r="${performer.stageRadius * scale}" fill="${color}" fill-opacity="0.13" stroke="${color}" stroke-width="4"/>
        ${motif(performer, x, y)}
        <circle cx="${x}" cy="${y}" r="12" fill="${color}"/>
        ${text(x, y - 54, [performer.label, `stage -4.2 m`], { size: 13, anchor: "middle", fill: color, weight: 700, lineHeight: 17 })}`;
    })
    .join("");

  const interactionZones = plan.interactionZones
    .map((zone) => {
      const performer = plan.performers.find(
        (candidate) => candidate.id === zone.performerId
      )!;
      return `<circle cx="${px(zone.centre.x)}" cy="${pz(zone.centre.z)}" r="${zone.radius * scale}" fill="${performerColor(performer)}" fill-opacity="0.05" stroke="${performerColor(performer)}" stroke-width="2" stroke-dasharray="6 7"/>`;
    })
    .join("");

  const sightlines = [reveal, final]
    .flatMap((source) =>
      plan.performers.map(
        (performer) =>
          `<line x1="${px(source.x)}" y1="${pz(source.z)}" x2="${px(performer.centre.x)}" y2="${pz(performer.centre.z)}" stroke="${COLORS.sightline}" stroke-width="2" stroke-dasharray="8 7" opacity="0.85"/>`
      )
    )
    .join("");

  const stopMarks = plan.stops
    .map(
      (stop) => `<g>
        <circle cx="${px(stop.x)}" cy="${pz(stop.z)}" r="18" fill="${COLORS.text}" stroke="${COLORS.background}" stroke-width="4"/>
        <text x="${px(stop.x)}" y="${pz(stop.z) + 7}" fill="${COLORS.background}" font-size="19" font-weight="800" text-anchor="middle">${stop.number}</text>
      </g>`
    )
    .join("");

  const routeCards = plan.stops
    .map((stop, index) => {
      const cardWidth = 294;
      const x = 52 + index * 307;
      const y = 1084;
      return `<g>
        ${index < plan.stops.length - 1 ? `<line x1="${x + cardWidth}" y1="${y + 28}" x2="${x + cardWidth + 13}" y2="${y + 28}" stroke="${COLORS.route}" stroke-width="4" marker-end="url(#arrow)"/>` : ""}
        <circle cx="${x + 23}" cy="${y + 25}" r="20" fill="${COLORS.route}"/>
        <text x="${x + 23}" y="${y + 32}" fill="${COLORS.background}" font-size="19" font-weight="800" text-anchor="middle">${stop.number}</text>
        ${text(x + 52, y + 20, wrap(stop.title, 23), { size: 17, weight: 700, lineHeight: 20 })}
        ${text(x, y + 78, ["FIRST FOCUS", ...wrap(stop.focus, 30).slice(0, 3)], { size: 13, fill: COLORS.muted, lineHeight: 18 })}
        ${text(x, y + 166, ["EXPERIENCE", ...wrap(stop.experience, 30).slice(0, 4)], { size: 13, fill: COLORS.text, lineHeight: 18 })}
        ${text(x, y + 270, ["ROOM RESPONSE", ...wrap(stop.roomResponse, 30).slice(0, 4)], { size: 13, fill: COLORS.route, lineHeight: 18 })}
      </g>`;
    })
    .join("");

  const sectionFloorY = 438;
  const sectionScale = 11;
  const sy = (elevation: number) => sectionFloorY - elevation * sectionScale;
  const sectionPerformers = plan.performers
    .map((performer, index) => {
      const x = 1535 + index * 155;
      return `<ellipse cx="${x}" cy="${sy(performer.stageElevation)}" rx="52" ry="9" fill="${performerColor(performer)}" fill-opacity="0.2" stroke="${performerColor(performer)}" stroke-width="3"/>
        ${drawBody(x, sy(performer.stageElevation), 0.62, performerColor(performer))}`;
    })
    .join("");

  const motionCards = plan.performers
    .map((performer, index) => {
      const entry = catalog.find(
        (candidate) => candidate.word === performer.label.repeat(4)
      )!;
      const first = entry.steps[0]!.motions;
      const x = 1415 + index * 245;
      const color = performerColor(performer);
      return `<g>
        <rect x="${x}" y="852" width="220" height="154" rx="14" fill="${COLORS.panelRaised}" stroke="${color}" stroke-width="2"/>
        ${text(x + 18, 882, [performer.label], { size: 26, fill: color, weight: 800 })}
        ${motif(performer, x + 170, 880)}
        ${text(x + 18, 918, [`blue ${first.left.rotationDirection}`, `red ${first.right.rotationDirection}`, "same path · same clock"], { size: 13, lineHeight: 19 })}
        ${text(x + 18, 988, [performer.traceMeaning], { size: 11, fill: COLORS.muted })}
      </g>`;
    })
    .join("");

  const eyeFrame = (
    x: number,
    y: number,
    title: string,
    scales: number[],
    sizes: number[]
  ) => `<g>
    <rect x="${x}" y="${y}" width="350" height="238" rx="14" fill="${COLORS.canyon}" stroke="${COLORS.grid}" stroke-width="2"/>
    <path d="M ${x} ${y + 42} L ${x + 350} ${y + 8} L ${x + 350} ${y + 92} L ${x} ${y + 112} Z" fill="${COLORS.daylight}" opacity="0.18"/>
    <path d="M ${x} ${y + 158} C ${x + 85} ${y + 135}, ${x + 245} ${y + 141}, ${x + 350} ${y + 116} L ${x + 350} ${y + 238} L ${x} ${y + 238} Z" fill="${COLORS.cliff}"/>
    ${plan.performers
      .map((performer, index) => {
        const bodyX = x + 82 + index * 94;
        const floorY = y + 178;
        return `<ellipse cx="${bodyX}" cy="${floorY}" rx="${34 * scales[index]!}" ry="${7 * scales[index]!}" fill="${performerColor(performer)}" fill-opacity="0.18"/>
          ${drawBody(bodyX, floorY, scales[index]!, performerColor(performer))}
          ${text(bodyX, y + 212, [`${performer.label} · ${sizes[index]!.toFixed(1)}°`], { size: 11, anchor: "middle", fill: performerColor(performer), weight: 700 })}`;
      })
      .join("")}
    ${text(x + 16, y + 28, [title], { size: 15, weight: 700 })}
    <line x1="${x + 12}" y1="${y + 184}" x2="${x + 338}" y2="${y + 184}" stroke="${COLORS.sightline}" stroke-width="2"/>
    ${text(x + 16, y + 230, ["feet and flat stage surfaces remain visible"], { size: 11, fill: COLORS.sightline })}
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">Earth Long Terrace measured Gate 1 floor plan</title>
  <desc id="description">A measured floor plan, vertical canyon section, eye-level reveal and final ensemble frames, motion translation, metrics, and seven-stop visitor route for the proposed Earth Long Terrace.</desc>
  <defs>
    <marker id="arrow" markerUnits="userSpaceOnUse" markerWidth="15" markerHeight="15" refX="13" refY="7.5" orient="auto"><path d="M0,0 L15,7.5 L0,15 Z" fill="${COLORS.route}"/></marker>
    <linearGradient id="terrace" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#496342"/><stop offset="1" stop-color="#26372d"/></linearGradient>
  </defs>
  <rect width="2200" height="1500" fill="${COLORS.background}"/>
  ${text(42, 48, ["EARTH · LONG TERRACE · GATE 1 FLOOR PLAN"], { size: 31, weight: 800 })}
  ${text(42, 80, ["Measured inside the live 34 × 24 m shell · G/H/I use one continuous clock · proposal only · no Blender work authorized"], { size: 16, fill: COLORS.muted })}

  <rect x="40" y="104" width="1310" height="920" rx="20" fill="${COLORS.panel}"/>
  ${text(72, 144, ["1 · TOP-DOWN PLAN"], { size: 22, weight: 800 })}
  <rect x="${planX}" y="${planY}" width="${roomWidth * scale}" height="${roomDepth * scale}" fill="${COLORS.canyon}" stroke="${COLORS.text}" stroke-width="5"/>
  <g stroke="${COLORS.grid}" stroke-width="1">${grid}</g>
  <rect x="${px(plan.publicTerrace.minX)}" y="${pz(plan.publicTerrace.minZ)}" width="${(plan.publicTerrace.maxX - plan.publicTerrace.minX) * scale}" height="${(plan.publicTerrace.maxZ - plan.publicTerrace.minZ) * scale}" rx="18" fill="url(#terrace)" stroke="${COLORS.routeShadow}" stroke-width="4"/>
  <rect x="${px(plan.traceWall.minX)}" y="${pz(plan.traceWall.minZ)}" width="${(plan.traceWall.maxX - plan.traceWall.minX) * scale}" height="${(plan.traceWall.maxZ - plan.traceWall.minZ) * scale}" fill="${COLORS.metaphor}" fill-opacity="0.2" stroke="${COLORS.metaphor}" stroke-width="3"/>
  ${text((px(plan.traceWall.minX) + px(plan.traceWall.maxX)) / 2, pz(plan.traceWall.minZ) - 9, ["FAR TRACE WALL · retained rings and petals"], { size: 12, anchor: "middle", fill: COLORS.metaphor, weight: 700 })}
  ${habitat}
  <rect x="${px(plan.revealBlocker.minX)}" y="${pz(plan.revealBlocker.minZ)}" width="${(plan.revealBlocker.maxX - plan.revealBlocker.minX) * scale}" height="${(plan.revealBlocker.maxZ - plan.revealBlocker.minZ) * scale}" rx="28" fill="${COLORS.root}" stroke="${COLORS.warning}" stroke-width="4"/>
  ${text((px(plan.revealBlocker.minX) + px(plan.revealBlocker.maxX)) / 2, (pz(plan.revealBlocker.minZ) + pz(plan.revealBlocker.maxZ)) / 2, ["BLIND TURN", "kills Fire + row view"], { size: 13, anchor: "middle", weight: 800, lineHeight: 18 })}
  ${interactionZones}
  ${sightlines}
  ${stages}
  <polyline points="${routePoints}" fill="none" stroke="${COLORS.routeShadow}" stroke-width="${plan.routeWidth * scale}" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  <polyline points="${routePoints}" fill="none" stroke="${COLORS.route}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#arrow)"/>
  ${stopMarks}
  <rect x="${planX - 8}" y="${pz((plan.westDoor.min + plan.westDoor.max) / 2) - 31}" width="16" height="62" fill="${COLORS.warning}"/>
  ${text(planX - 18, pz((plan.westDoor.min + plan.westDoor.max) / 2), ["FROM", "FIRE"], { size: 13, anchor: "end", fill: COLORS.warning, weight: 800, lineHeight: 16 })}
  <rect x="${px((plan.southDoor.min + plan.southDoor.max) / 2) - 31}" y="${planY + roomDepth * scale - 8}" width="62" height="16" fill="${COLORS.i}"/>
  ${text(px((plan.southDoor.min + plan.southDoor.max) / 2), planY + roomDepth * scale + 30, ["TO AIR"], { size: 13, anchor: "middle", fill: COLORS.i, weight: 800 })}
  <line x1="${planX + 28}" y1="${planY + roomDepth * scale - 28}" x2="${planX + 28 + 5 * scale}" y2="${planY + roomDepth * scale - 28}" stroke="${COLORS.text}" stroke-width="5"/>
  ${text(planX + 28 + 2.5 * scale, planY + roomDepth * scale - 39, ["5 m"], { size: 13, anchor: "middle" })}
  ${text(planX + roomWidth * scale - 12, planY + 28, ["N ↑"], { size: 16, anchor: "end", weight: 800 })}
  ${text(1188, 220, ["HERO ORDER"], { size: 14, fill: COLORS.route, weight: 800 })}
  ${text(1188, 249, ["1  synchronized row", "2  daylight canyon", "3  retained traces", "4  lush habitat"], { size: 14, lineHeight: 22 })}
  ${text(1188, 370, ["ROUTE"], { size: 14, fill: COLORS.route, weight: 800 })}
  ${text(1188, 399, [`${earthLongTerraceRouteLength(plan).toFixed(1)} m forward`, "2.4 m clear ribbon", `${(maximumGrade * 100).toFixed(1)}% max grade`, "7 review stops"], { size: 14, lineHeight: 22 })}
  ${text(1188, 526, ["ROW"], { size: 14, fill: COLORS.route, weight: 800 })}
  ${text(1188, 555, ["3.5 m centres", "2.8 m stages", "0.7 m prop gaps", "south-facing"], { size: 14, lineHeight: 22 })}
  ${text(1188, 680, ["SIGHTLINES"], { size: 14, fill: COLORS.sightline, weight: 800 })}
  ${text(1188, 709, [`${samples.length} legal viewpoints`, `${rayCount.toLocaleString()} floor rays`, `+${minimumMargin.toFixed(2)} m worst lip margin`, "no centreline shortcut"], { size: 14, lineHeight: 22 })}
  ${text(1188, 836, ["ELEVATION"], { size: 14, fill: COLORS.route, weight: 800 })}
  ${text(1188, 865, ["terrace -0.6 m", "stages -4.2 m", "canyon -25 m", "eye +1.05 m"], { size: 14, lineHeight: 22 })}

  <rect x="1380" y="104" width="780" height="410" rx="20" fill="${COLORS.panel}"/>
  ${text(1412, 144, ["2 · VERTICAL SECTION · PUBLIC TERRACE TO CANYON"], { size: 20, weight: 800 })}
  <path d="M 1420 ${sy(plan.terraceElevation)} L 1502 ${sy(plan.terraceElevation)} L 1535 ${sy(-7.8)} L 1665 ${sy(-7.8)} L 1700 ${sy(-12.5)} L 1860 ${sy(-12.5)} L 1910 ${sy(-18.5)} L 2090 ${sy(-18.5)}" fill="none" stroke="${COLORS.cliff}" stroke-width="28" stroke-linejoin="round"/>
  <line x1="1420" y1="${sy(plan.terraceElevation)}" x2="1512" y2="${sy(plan.terraceElevation)}" stroke="${COLORS.route}" stroke-width="9"/>
  <circle cx="1460" cy="${sy(plan.terraceElevation + plan.eyeHeight)}" r="8" fill="${COLORS.sightline}"/>
  <line x1="1460" y1="${sy(plan.terraceElevation + plan.eyeHeight)}" x2="1688" y2="${sy(plan.stageElevation)}" stroke="${COLORS.sightline}" stroke-width="2" stroke-dasharray="7 6"/>
  ${sectionPerformers}
  ${text(1420, 486, ["visitor eye +1.05 m"], { size: 12, fill: COLORS.sightline })}
  ${text(1535, 486, ["3.6 m stage drop"], { size: 12, fill: COLORS.muted })}
  ${text(1940, 486, ["shelves continue to -25 m"], { size: 12, fill: COLORS.muted })}

  <rect x="1380" y="534" width="780" height="296" rx="20" fill="${COLORS.panel}"/>
  ${text(1412, 570, ["3 · EYE-LEVEL COMPOSITIONS"], { size: 20, weight: 800 })}
  ${eyeFrame(1412, 586, "STOP 2 · DAYLIGHT REVEAL", [0.62, 0.62, 0.62], comparisonSizes)}
  ${eyeFrame(1780, 586, "STOP 6 · NEAR ENSEMBLE", [0.79, 0.88, 0.9], finalSizes)}

  <rect x="1380" y="850" width="780" height="174" rx="20" fill="${COLORS.panel}"/>
  ${text(1412, 882, ["4 · PERFORMANCE → ENVIRONMENT"], { size: 18, weight: 800 })}
  ${motionCards}

  <rect x="40" y="1048" width="2120" height="412" rx="20" fill="${COLORS.panel}"/>
  ${text(70, 1074, ["5 · PLAYER EXPERIENCE · A → B → C → G → H → I → ENSEMBLE → AIR"], { size: 20, weight: 800 })}
  ${routeCards}
  <rect x="70" y="1420" width="2060" height="24" rx="12" fill="${COLORS.warning}" fill-opacity="0.16"/>
  ${text(1100, 1437, ["CANON RECONCILIATION PROPOSAL · all three stay visible and synchronized; terrace position makes G, then H, then I the closest read before the final ensemble"], { size: 13, anchor: "middle", fill: COLORS.warning, weight: 700 })}
</svg>`;
}

const cave = buildVulcanCaveFloorPlan();
const plan = buildEarthLongTerracePlanForGrid(cave.grid);
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

const samples = earthLongTerraceViewingSamples(plan);
const finalSizes = Object.fromEntries(
  plan.performers.map((performer) => [
    performer.id,
    earthLongTerraceApparentBodyHeightDegrees(
      plan,
      plan.finalCamera.position,
      performer
    ),
  ])
);
const report = {
  schemaVersion: 1,
  sceneId: "earth-long-terrace",
  gate: 1,
  status: "ready-for-review",
  approval: null,
  room: {
    width: plan.room.maxX - plan.room.minX,
    depth: plan.room.maxZ - plan.room.minZ,
    westDoor: plan.westDoor,
    southDoor: plan.southDoor,
  },
  route: {
    width: plan.routeWidth,
    length: earthLongTerraceRouteLength(plan),
    maximumGrade: earthLongTerraceMaximumGrade(plan),
    stops: plan.stops.length,
    retraceRequired: false,
  },
  performers: plan.performers.map((performer) => ({
    id: performer.id,
    performerId: performer.performerId,
    sequenceId: performer.sequenceId,
    centre: performer.centre,
    stageElevation: performer.stageElevation,
    stageDiameter: performer.stageRadius * 2,
    literalMotion: performer.literalMotion,
    traceShape: performer.traceShape,
  })),
  checks: {
    walkability:
      plan.routeWidth >= 2.4 && earthLongTerraceMaximumGrade(plan) <= 1 / 16,
    fireThresholdConcealsTrio: plan.performers.every((performer) =>
      isEarthLongTerraceSightlineBlocked(plan, plan.stops[0]!, performer.centre)
    ),
    revealShowsTrio: plan.performers.every(
      (performer) =>
        !isEarthLongTerraceSightlineBlocked(
          plan,
          plan.stops[1]!,
          performer.centre
        )
    ),
    denseSightlines: {
      intervalMetres: 0.2,
      viewpointCount: samples.length,
      rayCount: samples.length * plan.performers.length,
      allUnobstructed: samples.every((sample) =>
        plan.performers.every(
          (performer) =>
            !isEarthLongTerraceSightlineBlocked(plan, sample, performer.centre)
        )
      ),
      minimumFloorLipMargin: earthLongTerraceMinimumFloorMargin(plan),
    },
    finalFrame: {
      verticalFovDegrees: plan.finalCamera.verticalFovDegrees,
      horizontalFovDegrees: earthLongTerraceHorizontalFovDegrees(
        plan.finalCamera.verticalFovDegrees,
        plan.finalCamera.aspect
      ),
      allBodiesInside: plan.performers.every((performer) =>
        isEarthLongTerraceBodyInsideFinalFrame(plan, performer)
      ),
      apparentBodyHeightDegrees: finalSizes,
    },
  },
  hierarchy: [
    "synchronized G/H/I row",
    "daylight canyon",
    "retained motion traces",
    "lush habitat framing",
  ],
  departuresFromRootObservatory: [
    "removes the central tree as a competing hero",
    "replaces the horseshoe with a forward terrace and diagonal near stand",
    "keeps all three performers visible from the reveal onward",
    "turns south after Fire instead of north",
    "tests the full legal route width instead of selected centreline samples",
  ],
  canonReconciliation:
    "The trio stays synchronized and visible while successive terrace positions make G, H, and I the closest comparison; the final stand enlarges all three together.",
  sourceDigests: {
    roomShell: sha256(readFileSync(ROOM_SOURCE_PATH)),
    planContract: sha256(readFileSync(PLAN_SOURCE_PATH)),
    sequenceBinding: sha256(readFileSync(SEQUENCE_SOURCE_PATH)),
    catalog: sha256(readFileSync(CATALOG_PATH)),
    board: sha256(svg),
  },
  sequenceFingerprints: selectedCatalog.map((entry, index) => ({
    performerId: plan.performers[index]!.performerId,
    sequenceId: plan.performers[index]!.sequenceId,
    catalogId: entry.id,
    fingerprint: sha256(canonicalJSON(entry)),
  })),
};

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Wrote ${BOARD_PATH}`);
console.log(`Wrote ${REPORT_PATH}`);
