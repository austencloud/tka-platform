import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  buildNominalFirstFireProcessionPlan,
  isProcessionSightlineBlocked,
} from "../src/lib/features/museum/data/first-fire-procession-plan";
import { MUSEUM_EXHIBIT_SEQUENCES } from "../src/lib/features/museum/data/museum-exhibit-sequences";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

const OUTPUT_DIR = resolve("docs/superpowers/specs/first-fire-cinder-court");
const BOARD_PATH = resolve(OUTPUT_DIR, "first-fire-cinder-court-gate1-board.svg");
const REPORT_PATH = resolve(OUTPUT_DIR, "first-fire-cinder-court-gate1-report.json");
const CATALOG_PATH = resolve("static/data/hero/tnd-base-words.json");
const PLAN_SOURCE_PATH = resolve(
  "src/lib/features/museum/data/first-fire-procession-plan.ts"
);
const SEQUENCE_SOURCE_PATH = resolve(
  "src/lib/features/museum/data/museum-exhibit-sequences.ts"
);

interface CatalogEntry {
  id: string;
  word: string;
  gridMode: string;
  metadata: { familyLabel?: string; handPathId?: string };
  steps: Array<{ letter: string }>;
}

const SEQUENCE_CATALOG = {
  dj: { catalogId: "tnd-split-opp-jdjd", word: "JDJD" },
  ek: { catalogId: "tnd-split-opp-keke", word: "KEKE" },
  fl: { catalogId: "tnd-split-opp-lflf", word: "LFLF" },
} as const;

const COLORS = {
  background: "#100604",
  panel: "#21100c",
  panelRaised: "#2d1710",
  basalt: "#3d302a",
  basaltEdge: "#7d675c",
  floor: "#25150f",
  safe: "#6b4935",
  route: "#ffc45a",
  routeShadow: "#4b2012",
  red: "#f14b24",
  ember: "#a5381e",
  green: "#78d16b",
  water: "#7bc9df",
  text: "#fff3dc",
  muted: "#c9ad99",
  sightline: "#f3d47a",
} as const;

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
  const size = options.size ?? 16;
  const lineHeight = options.lineHeight ?? size * 1.25;
  return `<text x="${x}" y="${y}" fill="${options.fill ?? COLORS.text}" font-family="Inter,Segoe UI,sans-serif" font-size="${size}" font-weight="${options.weight ?? 400}" text-anchor="${options.anchor ?? "start"}">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("")}</text>`;
}

function polyline(points: Array<{ x: number; z: number }>, px: (x: number) => number, pz: (z: number) => number): string {
  return points.map((point) => `${px(point.x)},${pz(point.z)}`).join(" ");
}

const plan = buildNominalFirstFireProcessionPlan();
const hubCentre = {
  x: (plan.hub.minX + plan.hub.maxX) / 2,
  z: (plan.hub.minZ + plan.hub.maxZ) / 2,
};
const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8")) as CatalogEntry[];
const selectedCatalog = plan.shrines.map((shrine) => {
  const expected = SEQUENCE_CATALOG[shrine.id];
  const entry = catalog.find((candidate) => candidate.id === expected.catalogId);
  if (!entry) throw new Error(`Missing First Fire catalog entry ${expected.catalogId}`);
  const live = MUSEUM_EXHIBIT_SEQUENCES[shrine.sequenceId];
  if (!live) throw new Error(`Missing live museum sequence ${shrine.sequenceId}`);
  if (live.word !== entry.word || live.word !== expected.word) {
    throw new Error(
      `${shrine.sequenceId} word drift: expected=${expected.word}, live=${live.word}, catalog=${entry.word}`
    );
  }
  const catalogLetters = entry.steps.map((step) => step.letter).join("");
  if (catalogLetters !== expected.word) {
    throw new Error(`${entry.id} step letters do not spell ${expected.word}`);
  }
  return entry;
});

const width = 1900;
const height = 1260;
const planX = 72;
const planY = 150;
const scale = 14;
const px = (x: number) => planX + x * scale;
const pz = (z: number) => planY + z * scale;

const grid = [
  ...Array.from({ length: 30 }, (_, index) => {
    const x = index * 2;
    return `<line x1="${px(x)}" y1="${pz(0)}" x2="${px(x)}" y2="${pz(44)}"/>`;
  }),
  ...Array.from({ length: 23 }, (_, index) => {
    const z = index * 2;
    return `<line x1="${px(0)}" y1="${pz(z)}" x2="${px(58)}" y2="${pz(z)}"/>`;
  }),
].join("");

const courtShapes = plan.shrines
  .map(
    (shrine) => {
      const gate = plan.gates.find((candidate) => candidate.shrineId === shrine.id)!;
      return `<polygon points="${polyline(shrine.courtPolygon, px, pz)}" fill="${COLORS.panelRaised}" stroke="${COLORS.basaltEdge}" stroke-width="3"/>
      <circle cx="${px(gate.courtThreshold.x)}" cy="${pz(gate.courtThreshold.z)}" r="${(gate.width * scale) / 2}" fill="none" stroke="${COLORS.route}" stroke-width="3" stroke-dasharray="7 5"/>`;
    }
  )
  .join("");

const occluders = plan.occluders
  .map((occluder) => {
    const rect = occluder.rect;
    return `<rect x="${px(rect.minX)}" y="${pz(rect.minZ)}" width="${(rect.maxX - rect.minX) * scale}" height="${(rect.maxZ - rect.minZ) * scale}" rx="5" fill="${COLORS.basalt}" stroke="${COLORS.basaltEdge}" stroke-width="2"/>`;
  })
  .join("");

const routeSections = plan.pathSections
  .filter((section) => !section.id.endsWith("-return"))
  .map((section) => {
    const color = section.kind === "growth-path" ? COLORS.green : COLORS.route;
    const dash = section.kind === "growth-path" ? ' stroke-dasharray="12 7"' : "";
    return `<polyline points="${polyline(section.points, px, pz)}" fill="none" stroke="${COLORS.routeShadow}" stroke-width="${section.width * scale}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>
      <polyline points="${polyline(section.points, px, pz)}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
  })
  .join("");

const fireGuides = [
  ...plan.guidePaths
    .filter((guide) => guide.kind === "torch-field" || guide.kind === "fire-wall")
    .map(
      (guide) => `<polyline points="${polyline(guide.points, px, pz)}" fill="none" stroke="${COLORS.red}" stroke-width="5" stroke-dasharray="3 9" stroke-linecap="round" opacity="0.86"/>`
    ),
  ...plan.gates.map(
    (gate) => `<circle cx="${px(gate.beacon.x)}" cy="${pz(gate.beacon.z)}" r="8" fill="${COLORS.red}"/>`
  ),
].join("");

const shrines = plan.shrines
  .map((shrine, index) => {
    const blocked = isProcessionSightlineBlocked(
      hubCentre,
      shrine.centre,
      plan.occluders
    );
    return `<circle cx="${px(shrine.centre.x)}" cy="${pz(shrine.centre.z)}" r="${shrine.trenchOuterRadius * scale}" fill="#160b08" stroke="${COLORS.red}" stroke-width="8"/>
      <circle cx="${px(shrine.centre.x)}" cy="${pz(shrine.centre.z)}" r="${shrine.habitatRadius * scale}" fill="${COLORS.ember}"/>
      ${text(px(shrine.centre.x), pz(shrine.centre.z) - 2, [shrine.label, SEQUENCE_CATALOG[shrine.id].word], { size: 18, weight: 800, anchor: "middle", lineHeight: 20 })}
      ${text(px(shrine.centre.x), pz(shrine.centre.z) + 56, [`COURT ${index + 1} · ${blocked ? "hidden from hub" : "SIGHTLINE ERROR"}`], { size: 10, fill: COLORS.muted, weight: 700, anchor: "middle" })}`;
  })
  .join("");

const stateCards = [
  ["1 · ARRIVAL", "hub torches", "DJ gate kindles", COLORS.red],
  ["2 · DJ RETURN", "DJ lane cools", "EK gate kindles", COLORS.ember],
  ["3 · EK RETURN", "two coal memories", "FL gate kindles", COLORS.ember],
  ["4 · BLACKOUT", "all red absent", "neutral pause", "#7d7772"],
  ["5 · EARTH", "green crosses hub", "known route transforms", COLORS.green],
] as const;

const storyboard = stateCards
  .map(([label, line1, line2, color], index) => {
    const x = 72 + index * 352;
    return `<rect x="${x}" y="952" width="326" height="220" rx="18" fill="${COLORS.panel}" stroke="${color}" stroke-width="3"/>
      <circle cx="${x + 52}" cy="1010" r="23" fill="${color}" opacity="0.9"/>
      ${text(x + 90, 1004, [label], { size: 17, weight: 800 })}
      ${text(x + 28, 1064, [line1, line2], { size: 15, fill: COLORS.muted, lineHeight: 24 })}
      <path d="M ${x + 30} 1128 C ${x + 110} 1098, ${x + 210} 1156, ${x + 294} 1118" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
  })
  .join("");

const sectionBaseY = 770;
const sy = (elevation: number) => sectionBaseY - elevation * 25;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">
  <title id="title">First Fire Cinder Court measured Gate 1 floor plan</title>
  <desc id="description">A measured 58 by 44 metre floor plan, vertical section, sequence evidence, and five-state storyboard for the reimagined First Fire room.</desc>
  <rect width="${width}" height="${height}" fill="${COLORS.background}"/>
  ${text(72, 58, ["FIRST FIRE · THE CINDER COURT"], { size: 30, weight: 850 })}
  ${text(72, 92, ["GATE 1 MEASURED CONTRACT · isolated review shell · 1 m units"], { size: 16, fill: COLORS.muted, weight: 650 })}

  <rect x="48" y="118" width="880" height="700" rx="20" fill="${COLORS.panel}"/>
  ${text(72, 144, ["1 · FLOOR PLAN · WATER → RETURNING HUB → DJ → EK → FL → EARTH"], { size: 17, weight: 800 })}
  <g stroke="#4b3025" stroke-width="1" opacity="0.55">${grid}</g>
  <rect x="${px(0)}" y="${pz(0)}" width="${58 * scale}" height="${44 * scale}" fill="${COLORS.floor}" stroke="${COLORS.basaltEdge}" stroke-width="5"/>
  ${courtShapes}
  <rect x="${px(plan.hub.minX)}" y="${pz(plan.hub.minZ)}" width="${(plan.hub.maxX - plan.hub.minX) * scale}" height="${(plan.hub.maxZ - plan.hub.minZ) * scale}" rx="24" fill="${COLORS.safe}" fill-opacity="0.72" stroke="${COLORS.route}" stroke-width="3"/>
  ${occluders}
  ${routeSections}
  ${fireGuides}
  ${shrines}
  ${text(px(hubCentre.x), pz(hubCentre.z) + 6, ["RETURNING HUB", "13 m ember cairn"], { size: 17, weight: 850, anchor: "middle", lineHeight: 20 })}
  <rect x="${px(0) - 10}" y="${pz(20)}" width="20" height="${4 * scale}" fill="${COLORS.water}"/>
  ${text(px(0) - 18, pz(22), ["WATER"], { size: 14, fill: COLORS.water, weight: 800, anchor: "end" })}
  <rect x="${px(58) - 10}" y="${pz(32)}" width="20" height="${4 * scale}" fill="${COLORS.green}"/>
  ${text(px(58) + 18, pz(34), ["EARTH"], { size: 14, fill: COLORS.green, weight: 800 })}
  <line x1="${px(3)}" y1="${pz(42)}" x2="${px(8)}" y2="${pz(42)}" stroke="${COLORS.text}" stroke-width="5"/>
  ${text(px(5.5), pz(41.1), ["5 m"], { size: 12, anchor: "middle" })}

  <rect x="952" y="118" width="900" height="330" rx="20" fill="${COLORS.panel}"/>
  ${text(980, 153, ["2 · MEASURED CONTRACT"], { size: 19, weight: 800 })}
  ${text(980, 198, ["SHELL", "58 × 44 m isolated candidate", "Water (0,22) · Earth (58,34)", "4 m transition clearances"], { size: 15, fill: COLORS.muted, lineHeight: 24 })}
  ${text(1260, 198, ["NAVIGATION", "3.5 m hub + throat lanes", "one shared throat per court", "basalt owns collision", "fire never blocks the player"], { size: 15, fill: COLORS.muted, lineHeight: 24 })}
  ${text(1550, 198, ["FIRE BUDGET", "72 field torches", "54 court perimeter cues", "126 static anchors total", "1 detailed hero fire maximum"], { size: 15, fill: COLORS.muted, lineHeight: 24 })}
  ${text(980, 350, ["SIGHTLINE PROOF"], { size: 14, fill: COLORS.sightline, weight: 800 })}
  ${text(980, 382, plan.shrines.map((shrine) => `${shrine.label} hidden from hub: ${isProcessionSightlineBlocked(hubCentre, shrine.centre, plan.occluders) ? "PASS" : "FAIL"}`), { size: 15, lineHeight: 24 })}

  <rect x="952" y="470" width="900" height="348" rx="20" fill="${COLORS.panel}"/>
  ${text(980, 505, ["3 · VERTICAL SECTION · HUB TO ONE ROCK-ISOLATED COURT"], { size: 19, weight: 800 })}
  <path d="M 1000 ${sy(0)} L 1150 ${sy(0)} L 1190 ${sy(0.3)} L 1360 ${sy(0.3)} L 1400 ${sy(0)} L 1600 ${sy(0)}" fill="none" stroke="${COLORS.safe}" stroke-width="24" stroke-linejoin="round"/>
  <path d="M 1120 ${sy(0)} L 1165 ${sy(7.2)} L 1210 ${sy(0)}" fill="${COLORS.basalt}" stroke="${COLORS.basaltEdge}" stroke-width="3"/>
  <circle cx="1460" cy="${sy(1.2)}" r="34" fill="${COLORS.red}" opacity="0.8"/>
  <line x1="1030" y1="${sy(1.7)}" x2="1470" y2="${sy(1.7)}" stroke="${COLORS.sightline}" stroke-width="2" stroke-dasharray="8 6"/>
  ${text(1010, sy(1.7) - 12, ["player eye 1.7 m"], { size: 12, fill: COLORS.sightline })}
  ${text(1165, sy(7.2) - 12, ["basalt 6.4–8.4 m"], { size: 13, anchor: "middle", fill: COLORS.muted })}
  ${text(1460, sy(4.3), ["performer +", "engulfing fire"], { size: 14, anchor: "middle", weight: 750 })}
  ${text(980, 796, ["The beacon reads from the hub. The performer does not. The player crosses the bent throat before the court opens."], { size: 14, fill: COLORS.muted })}

  <rect x="48" y="840" width="1804" height="100" rx="18" fill="${COLORS.panelRaised}"/>
  ${text(72, 868, ["4 · EXACT LIVE MOTION SOURCES"], { size: 17, weight: 800 })}
  ${text(72, 892, plan.shrines.map((shrine, index) => `${shrine.label}  ${SEQUENCE_CATALOG[shrine.id].word}  ${shrine.sequenceId}  ${selectedCatalog[index]!.id}  ${selectedCatalog[index]!.metadata.familyLabel ?? ""}`), { size: 12, fill: COLORS.muted, lineHeight: 18 })}
  ${text(980, 870, ["Live word parity: PASS", "Catalog fingerprints: LOCKED", "Visible runtime path diagnostics: Gate 0 capture pending"], { size: 13, fill: COLORS.sightline, lineHeight: 18 })}

  ${storyboard}
  ${text(72, 1224, ["Gate 1 proves measured intent. The next Blender pass must preserve this returning-hub topology and may not mutate the live cave shell."], { size: 14, fill: COLORS.muted })}
</svg>`;

mkdirSync(dirname(BOARD_PATH), { recursive: true });
writeFileSync(BOARD_PATH, svg, "utf8");

const report = {
  schemaVersion: 1,
  sceneId: "first-fire-cinder-court",
  gate: 1,
  status: "ready-for-review",
  approval: null,
  room: {
    width: 58,
    depth: 44,
    waterDoor: plan.westDoor,
    earthDoor: plan.eastDoor,
    hub: plan.hub,
  },
  route: {
    safeWidth: Math.min(...plan.pathSections.map((section) => section.width)),
    sections: plan.pathSections.map(({ id, kind, width }) => ({
      id,
      kind,
      width,
    })),
    sharedThroats: plan.gates.map((gate) => ({
      shrineId: gate.shrineId,
      centre: gate.courtThreshold,
      width: gate.width,
    })),
  },
  checks: {
    shell: plan.room.maxX - plan.room.minX === 58 && plan.room.maxZ - plan.room.minZ === 44,
    doorClearance: plan.westDoor.max - plan.westDoor.min >= 3.5 && plan.eastDoor.max - plan.eastDoor.min >= 3.5,
    oneSharedThroatPerCourt: plan.shrines.every((shrine) =>
      JSON.stringify(shrine.entry) === JSON.stringify(shrine.exit)
    ),
    performersHiddenFromHub: Object.fromEntries(
      plan.shrines.map((shrine) => [
        shrine.id,
        isProcessionSightlineBlocked(hubCentre, shrine.centre, plan.occluders),
      ])
    ),
    detailedHeroFireBudget: plan.torchBudget.maximumDetailedShrines,
    fireGuidesOwnNoCollision: plan.guidePaths.every(
      (guide) => guide.collision === false
    ),
    redAbsentBeforeGreen:
      plan.guidePaths.find((guide) => guide.kind === "green-growth")?.state ===
      "extinguished",
  },
  performers: plan.shrines.map((shrine) => ({
    id: shrine.id,
    performerId: shrine.performerId,
    sequenceId: shrine.sequenceId,
    catalogId: SEQUENCE_CATALOG[shrine.id].catalogId,
    word: SEQUENCE_CATALOG[shrine.id].word,
    centre: shrine.centre,
  })),
  sourceDigests: {
    planContract: sha256(readFileSync(PLAN_SOURCE_PATH)),
    sequenceBinding: sha256(readFileSync(SEQUENCE_SOURCE_PATH)),
    catalog: sha256(readFileSync(CATALOG_PATH)),
    board: sha256(svg),
  },
  sequenceFingerprints: selectedCatalog.map((entry, index) => ({
    performerId: plan.shrines[index]!.performerId,
    sequenceId: plan.shrines[index]!.sequenceId,
    catalogId: entry.id,
    liveWordParity: MUSEUM_EXHIBIT_SEQUENCES[plan.shrines[index]!.sequenceId]!.word === entry.word,
    fingerprint: sha256(canonicalJSON(entry)),
  })),
};

writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Wrote ${BOARD_PATH}`);
console.log(`Wrote ${REPORT_PATH}`);
