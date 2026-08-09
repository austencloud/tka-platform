/**
 * Drowned Gallery (Three Channels) — Gate 1 measured-plan board + report.
 *
 * Renders the plan board (top-down plan, developed long sections through a
 * dive and through the buoyant shaft, numbered route strip, per-bell moving
 * sightline windows, final doubled frame) and the machine-checked report, all
 * derived from the SAME layout call physics and the graybox consume:
 * buildDrownedGalleryLayout over the compiled Vulcan Cave grid.
 *
 *   pnpm exec tsx scripts/generate-drowned-gallery-board.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildVulcanCaveFloorPlan } from "../src/lib/features/museum/data/vulcan-cave-floor-plan";
import {
  buildDrownedGalleryLayout,
  createDrownedGalleryTerrain,
  bellViewingSamples,
  bellFloorSightlineMargin,
  segmentCrossesRects,
  inRectClosed,
  type BellChannel,
  type DrownedGalleryLayout,
  type Point2,
  type WorldRect,
  BELL_CEILING_Y,
  BELL_FLOOR_Y,
  CAUSEWAY_Y,
  CHANNEL_BED_Y,
  DOME_APEX_Y,
  EYE_ABOVE_FLOOR,
  GALLERY_FLOOR_Y,
  GALLERY_ROOF_Y,
  POOL_BOTTOM_Y,
  ROOF_HEADROOM,
  SHAFT_CEILING_Y,
  SHALLOWS_Y,
  SHELF_Y,
  WATERLINE_Y,
} from "../src/lib/features/museum/data/drowned-gallery-terrain";
import { canonicalJSON } from "../src/lib/shared/foundation/utils/canonical-json";

const OUTPUT_DIR = resolve("docs/superpowers/specs/drowned-gallery");
const BOARD_PATH = resolve(OUTPUT_DIR, "drowned-gallery-gate1-board.svg");
const REPORT_PATH = resolve(OUTPUT_DIR, "drowned-gallery-gate1-report.json");

const plan = buildVulcanCaveFloorPlan();
const grid = plan.grid;
const layout = buildDrownedGalleryLayout(grid);
if (!layout) throw new Error("Drowned gallery layout did not build");
const terrain = createDrownedGalleryTerrain(grid)!;

// ── Measurements ────────────────────────────────────────────────────────────

const grade = (rise: number, run: number) => Math.abs(rise) / run;
const span = (r: WorldRect, axis: "x" | "z") =>
  axis === "x" ? r.maxX - r.minX : r.maxZ - r.minZ;

const descentGrade = grade(
  SHALLOWS_Y - GALLERY_FLOOR_Y,
  span(layout.descentStair, "z")
);
const stairGrades = layout.channels.map((chan) => ({
  id: chan.id,
  grade: grade(
    BELL_FLOOR_Y - GALLERY_FLOOR_Y,
    span(chan.stair, chan.bell.entry === "east" ? "x" : "z")
  ),
}));
// A channel's width is its span PERPENDICULAR to travel. A runs east-west
// (width = z); B runs north-south (width = x); C runs east then north.
const legWidthAxes: Record<string, ("x" | "z")[]> = {
  a: ["z"],
  b: ["x"],
  c: ["z", "x"],
};
const channelWidths = layout.channels.map((chan) => ({
  id: chan.id,
  width: Math.min(
    ...chan.legs.map((leg, i) => span(leg, legWidthAxes[chan.id]![i] ?? "x"))
  ),
}));

// Roof headroom, sampled over every roofed rect the same way the unit test does.
let minHeadroom = Number.POSITIVE_INFINITY;
for (const rect of layout.roofRects) {
  const x = (rect.minX + rect.maxX) / 2;
  for (const z of [rect.minZ + 0.05, (rect.minZ + rect.maxZ) / 2, rect.maxZ - 0.05]) {
    minHeadroom = Math.min(minHeadroom, GALLERY_ROOF_Y - terrain.elevationAt(x, z));
  }
}

// Per-bell moving sightline windows (Earth Gate 1.1 standard) + isolation.
const sightlines = layout.channels.map((chan) => {
  const samples = bellViewingSamples(chan);
  const margins = samples.map((sample) => bellFloorSightlineMargin(chan, sample));
  const blockedSamples = samples.filter((sample) =>
    segmentCrossesRects(sample, chan.bell.shelfAnchor, layout.rockFill)
  ).length;
  const deck = layout.probes.bellDecks[chan.id];
  return {
    bell: chan.id,
    sampleCount: samples.length,
    blockedSamples,
    minimumFloorMargin: Math.min(...margins),
    readDistance: Math.hypot(
      deck.x - chan.bell.shelfAnchor.x,
      deck.z - chan.bell.shelfAnchor.z
    ),
    runMetres: chan.runMetres,
  };
});
const isolation = layout.channels.flatMap((from) =>
  layout.channels
    .filter((to) => to.id !== from.id)
    .map((to) => ({
      from: from.id,
      to: to.id,
      blockedByRock: segmentCrossesRects(
        layout.probes.bellDecks[from.id],
        to.bell.shelfAnchor,
        layout.rockFill
      ),
    }))
);

// Final doubled frame: standing on the apron at the buoyant shaft's rim,
// looking north over the mirror pool toward the three ring niches (the
// proposed finale restaging, Gate 1 open question 2).
const FINAL_FOV_DEG = 75;
const finalCamera: Point2 = {
  x: (layout.buoyantShaft.minX + layout.buoyantShaft.maxX) / 2,
  z: layout.buoyantShaft.minZ - 0.7,
};
const finalTarget: Point2 = layout.probes.pool;
const bearing = (from: Point2, to: Point2) =>
  (Math.atan2(to.x - from.x, from.z - to.z) * 180) / Math.PI;
const inFinalFrame = (target: Point2) => {
  let d = bearing(finalCamera, target) - bearing(finalCamera, finalTarget);
  while (d > 180) d -= 360;
  while (d < -180) d += 360;
  return Math.abs(d) <= FINAL_FOV_DEG / 2;
};
const finalFrame = {
  camera: finalCamera,
  target: finalTarget,
  horizontalFovDegrees: FINAL_FOV_DEG,
  nichesInFrame: layout.alcoves.map((niche, i) => ({
    niche: i,
    inFrame: inFinalFrame(niche),
  })),
  poolInFrame: inFinalFrame(layout.probes.pool),
  waterfallInFrame: inFinalFrame({
    x: (layout.waterfall.minX + layout.waterfall.maxX) / 2,
    z: (layout.waterfall.minZ + layout.waterfall.maxZ) / 2,
  }),
};

// ── Route strip ─────────────────────────────────────────────────────────────

interface RouteStop {
  n: number;
  at: Point2;
  title: string;
  sees: string;
  does: string;
  understands: string;
}

const bellStop = (chan: BellChannel, n: number): RouteStop[] => {
  const letter = chan.id.toUpperCase();
  return [
    {
      n,
      at: chan.mouth,
      title: `Mouth ${letter}`,
      sees: `A dark channel mouth, warm ${letter}-firelight through the water`,
      does: "Chooses this dive (any order; length hints difficulty)",
      understands: `Each mouth leads to one letter`,
    },
    {
      n: n + 1,
      at: layout.probes.bellDecks[chan.id],
      title: `Air-bell ${letter}`,
      sees: `Surface breaks on the stair; one performer at ${sightlines.find((s) => s.bell === chan.id)!.readDistance.toFixed(1)} m under a 3 m ceiling`,
      does: `Watches ${letter} alone, then dives back`,
      understands: `Surfacing = meeting a letter (${letter} of A/B/C)`,
    },
  ];
};

const routeStops: RouteStop[] = [
  {
    n: 1,
    at: { x: (layout.approach.minX + layout.approach.maxX) / 2, z: layout.approach.maxZ - 2 },
    title: "Flooded approach",
    sees: "The ramp wades below the waterline",
    does: "Walks down into the water",
    understands: "This room is entered by descending",
  },
  {
    n: 2,
    at: { x: (layout.descentStair.minX + layout.descentStair.maxX) / 2, z: (layout.descentRoofed.minZ + layout.descentRoofed.maxZ) / 2 },
    title: "Descent",
    sees: "Rock closes overhead; no air anywhere",
    does: "Keeps descending the stair",
    understands: "Pressure — the water owns this space",
  },
  {
    n: 3,
    at: layout.probes.hub,
    title: "Drowned hub",
    sees: "One shaft of light overhead; three glowing mouths + the return",
    does: "Chooses a channel",
    understands: "Light = the way back up; three dives to make",
  },
  ...bellStop(layout.channels[0], 4),
  ...bellStop(layout.channels[1], 6),
  ...bellStop(layout.channels[2], 8),
  {
    n: 10,
    at: { x: (layout.shaftPassageLeg.minX + layout.shaftPassageLeg.maxX) / 2, z: (layout.shaftPassageLeg.minZ + layout.shaftPassageLeg.maxZ) / 2 },
    title: "Shaft passage",
    sees: "A fifth opening glowing cool, not warm",
    does: "Swims/walks the drowned passage north",
    understands: "The dives are done; this is the way onward",
  },
  {
    n: 11,
    at: layout.probes.shaftBottom,
    title: "Buoyant shaft",
    sees: "A glowing water column rising 4.2 m",
    does: "Jumps in and floats up (Gate 2 gravity seam)",
    understands: "Weightlessness — water carries you",
  },
  {
    n: 12,
    at: layout.probes.apron,
    title: "Grotto ring apron",
    sees: "The dome, mirror pool, waterfall, doubled firelight",
    does: "Surfaces over the rim onto the apron",
    understands: "Reflection — the room shows everything twice",
  },
  {
    n: 13,
    at: layout.probes.procession,
    title: "Procession",
    sees: "All three niches doubled in the black pool (finale restaging, Q2)",
    does: "Walks the ring past the doubled frame",
    understands: "A, B, C together, shown twice",
  },
  {
    n: 14,
    at: layout.probes.thresholdOpening,
    title: "Gilded threshold",
    sees: "The carved gold-barred frame to Fire",
    does: "Exits east",
    understands: "Water is complete; Fire is next",
  },
];

// ── SVG board ───────────────────────────────────────────────────────────────

const C = {
  bg: "#0d1418",
  panel: "#13202a",
  line: "#3f5a68",
  grid: "#1d3341",
  text: "#eaf2f4",
  muted: "#9ab4bd",
  rock: "#26333a",
  water: "#1e5f7a",
  waterDeep: "#123c50",
  floor: "#3b6c7e",
  deck: "#c9b280",
  shelf: "#e0c98f",
  route: "#8fd8c9",
  a: "#f2b36b",
  b: "#e88f6a",
  c: "#d86a8a",
  shaft: "#7fd4f2",
  sightline: "#f1d47b",
  gold: "#d9b25c",
} as const;

function esc(v: string): string {
  return v.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const svgParts: string[] = [];
const WIDTH = 2280;
const HEIGHT = 1560;

svgParts.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" font-family="Segoe UI, Arial, sans-serif">`,
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="${C.bg}"/>`,
  `<text x="60" y="64" fill="${C.text}" font-size="34" font-weight="700">The Drowned Gallery — Three Channels · Gate 1 measured plan</text>`,
  `<text x="60" y="96" fill="${C.muted}" font-size="18">Derived live from buildDrownedGalleryLayout (the same call physics and the graybox read). Datums in metres; museum floor = 0, waterline = ${WATERLINE_Y}.</text>`
);

// — Plan panel —
const PLAN_X = 60;
const PLAN_Y = 140;
const bay = layout.bayBounds;
const PLAN_H = 1150;
const M2P = Math.min(880 / (bay.maxX - bay.minX), PLAN_H / (bay.maxZ - bay.minZ));
const px = (x: number) => PLAN_X + (x - bay.minX) * M2P;
const pz = (z: number) => PLAN_Y + (z - bay.minZ) * M2P;
const rect = (r: WorldRect, fill: string, opacity = 1, stroke = "none") =>
  `<rect x="${px(r.minX).toFixed(1)}" y="${pz(r.minZ).toFixed(1)}" width="${((r.maxX - r.minX) * M2P).toFixed(1)}" height="${((r.maxZ - r.minZ) * M2P).toFixed(1)}" fill="${fill}" fill-opacity="${opacity}" stroke="${stroke}"/>`;

svgParts.push(`<text x="${PLAN_X}" y="${PLAN_Y - 34}" fill="${C.text}" font-size="22" font-weight="600">Top-down plan (north up = toward the grotto)</text>`);
svgParts.push(rect({ minX: bay.minX - 1, minZ: bay.minZ - 1, maxX: bay.maxX + 1, maxZ: bay.maxZ + 1 }, C.panel));
// rooms + rock
svgParts.push(rect(layout.gallery, C.rock));
svgParts.push(rect(layout.grotto, C.panel, 1, C.line));
svgParts.push(rect(layout.approach, C.waterDeep, 0.7, C.line));
for (const r of [...layout.approachCorridor, ...layout.galleryCorridor]) svgParts.push(rect(r, C.waterDeep, 0.8));
// grotto bands
svgParts.push(rect(layout.shore, C.shelf, 0.5));
svgParts.push(rect(layout.channel, C.water, 0.8));
svgParts.push(rect(layout.procession, C.floor));
svgParts.push(rect(layout.pool, C.waterDeep));
for (const r of layout.apronPieces) svgParts.push(rect(r, C.floor));
svgParts.push(rect(layout.westWalkway, C.floor));
svgParts.push(rect(layout.eastWalkway, C.floor));
svgParts.push(rect(layout.waterfall, C.shaft, 0.5));
svgParts.push(rect(layout.threshold, C.gold, 0.6));
// gallery voids
svgParts.push(rect(layout.descentStair, C.water, 0.9));
svgParts.push(rect(layout.returnLeg, C.waterDeep));
svgParts.push(rect(layout.hub, C.water, 0.85));
svgParts.push(rect(layout.hubOculus, C.shaft, 0.9, C.text));
const chanColor: Record<string, string> = { a: C.a, b: C.b, c: C.c };
for (const chan of layout.channels) {
  for (const leg of chan.legs) svgParts.push(rect(leg, chanColor[chan.id]!, 0.55));
  svgParts.push(rect(chan.stair, chanColor[chan.id]!, 0.75));
  svgParts.push(rect(chan.bell.deck, C.deck));
  svgParts.push(rect(chan.bell.margin, C.water));
  svgParts.push(rect(chan.bell.shelf, C.shelf));
  svgParts.push(
    `<circle cx="${px(chan.bell.shelfAnchor.x).toFixed(1)}" cy="${pz(chan.bell.shelfAnchor.z).toFixed(1)}" r="7" fill="${chanColor[chan.id]}" stroke="${C.text}" stroke-width="1.5"/>`,
    `<text x="${px(chan.bell.shelfAnchor.x) + 10}" y="${pz(chan.bell.shelfAnchor.z) + 5}" fill="${C.text}" font-size="17" font-weight="700">${chan.id.toUpperCase()}</text>`
  );
  // moving sightline window rays
  for (const sample of bellViewingSamples(chan)) {
    svgParts.push(
      `<line x1="${px(sample.x).toFixed(1)}" y1="${pz(sample.z).toFixed(1)}" x2="${px(chan.bell.shelfAnchor.x).toFixed(1)}" y2="${pz(chan.bell.shelfAnchor.z).toFixed(1)}" stroke="${C.sightline}" stroke-width="1" stroke-opacity="0.55"/>`
    );
  }
}
svgParts.push(rect(layout.shaftPassageLeg, C.shaft, 0.4));
svgParts.push(rect(layout.shaftPassageJog, C.shaft, 0.4));
svgParts.push(rect(layout.buoyantShaft, C.shaft, 0.95, C.text));
// ring niches
layout.alcoves.forEach((n, i) => {
  svgParts.push(
    `<circle cx="${px(n.x).toFixed(1)}" cy="${pz(n.z).toFixed(1)}" r="6" fill="none" stroke="${C.sightline}" stroke-width="2"/>`,
    `<text x="${px(n.x) - 5}" y="${pz(n.z) - 10}" fill="${C.muted}" font-size="13">niche ${i + 1}</text>`
  );
});
// final frame wedge
{
  const camB = bearing(finalCamera, finalTarget);
  const rad = (deg: number) => ((deg) * Math.PI) / 180;
  const ray = (deg: number, len: number) => ({
    x: finalCamera.x + Math.sin(rad(deg)) * len,
    z: finalCamera.z - Math.cos(rad(deg)) * len,
  });
  const l = ray(camB - FINAL_FOV_DEG / 2, 16);
  const r = ray(camB + FINAL_FOV_DEG / 2, 16);
  svgParts.push(
    `<path d="M ${px(finalCamera.x)} ${pz(finalCamera.z)} L ${px(l.x)} ${pz(l.z)} L ${px(r.x)} ${pz(r.z)} Z" fill="${C.sightline}" fill-opacity="0.12" stroke="${C.sightline}" stroke-dasharray="5 4"/>`,
    `<circle cx="${px(finalCamera.x)}" cy="${pz(finalCamera.z)}" r="6" fill="${C.sightline}"/>`
  );
}
// route stops
for (const stop of routeStops) {
  svgParts.push(
    `<circle cx="${px(stop.at.x).toFixed(1)}" cy="${pz(stop.at.z).toFixed(1)}" r="11" fill="${C.bg}" stroke="${C.route}" stroke-width="2"/>`,
    `<text x="${px(stop.at.x).toFixed(1)}" y="${(pz(stop.at.z) + 5).toFixed(1)}" fill="${C.route}" font-size="14" font-weight="700" text-anchor="middle">${stop.n}</text>`
  );
}

// — Developed sections —
type SectionRegion = { from: number; to: number; floorA: number; floorB: number; cover: number | null; label?: string };
function drawSection(
  x0: number,
  y0: number,
  w: number,
  title: string,
  regions: SectionRegion[],
  note: string
) {
  const total = regions.at(-1)!.to;
  const yTop = 3.2;
  const yBot = -5.6;
  const sx = (d: number) => x0 + (d / total) * w;
  const sy = (y: number) => y0 + ((yTop - y) / (yTop - yBot)) * 190;
  svgParts.push(`<text x="${x0}" y="${y0 - 14}" fill="${C.text}" font-size="20" font-weight="600">${esc(title)}</text>`);
  svgParts.push(`<rect x="${x0}" y="${y0}" width="${w}" height="190" fill="${C.panel}"/>`);
  // water body: from floor up to waterline wherever floor < waterline
  for (const r of regions) {
    const path = `M ${sx(r.from)} ${sy(Math.min(r.floorA, WATERLINE_Y))} L ${sx(r.to)} ${sy(Math.min(r.floorB, WATERLINE_Y))} L ${sx(r.to)} ${sy(WATERLINE_Y)} L ${sx(r.from)} ${sy(WATERLINE_Y)} Z`;
    svgParts.push(`<path d="${path}" fill="${C.water}" fill-opacity="0.45"/>`);
  }
  // floor line
  const floorPath = regions
    .map((r, i) => `${i === 0 ? "M" : "L"} ${sx(r.from)} ${sy(r.floorA)} L ${sx(r.to)} ${sy(r.floorB)}`)
    .join(" ");
  svgParts.push(`<path d="${floorPath}" fill="none" stroke="${C.deck}" stroke-width="3"/>`);
  // covers (rock roof / bell ceiling / shaft ceiling)
  for (const r of regions) {
    if (r.cover === null) continue;
    svgParts.push(
      `<line x1="${sx(r.from)}" y1="${sy(r.cover)}" x2="${sx(r.to)}" y2="${sy(r.cover)}" stroke="${C.rock}" stroke-width="7"/>`
    );
  }
  // waterline
  svgParts.push(
    `<line x1="${x0}" y1="${sy(WATERLINE_Y)}" x2="${x0 + w}" y2="${sy(WATERLINE_Y)}" stroke="${C.shaft}" stroke-width="1.5" stroke-dasharray="7 5"/>`,
    `<text x="${x0 + w + 8}" y="${sy(WATERLINE_Y) + 4}" fill="${C.shaft}" font-size="13">waterline ${WATERLINE_Y}</text>`
  );
  // labels
  for (const r of regions) {
    if (!r.label) continue;
    svgParts.push(
      `<text x="${(sx(r.from) + sx(r.to)) / 2}" y="${y0 + 182}" fill="${C.muted}" font-size="13" text-anchor="middle">${esc(r.label)}</text>`
    );
  }
  svgParts.push(`<text x="${x0}" y="${y0 + 218}" fill="${C.muted}" font-size="14">${esc(note)}</text>`);
}

const SEC_X = 1020;
const chanB = layout.channels[1];
const bFlat = chanB.legs[0]!;
const dive: SectionRegion[] = (() => {
  const dDescent = span(layout.descentStair, "z");
  const dLeg = span(layout.returnLeg, "x");
  const dHub = span(layout.hub, "z");
  const dChan = span(bFlat, "z");
  const dStair = span(chanB.stair, "z");
  const dBell = span(chanB.bell.rect, "z");
  let d = 0;
  const seg = (len: number, floorA: number, floorB: number, cover: number | null, label?: string): SectionRegion => {
    const r = { from: d, to: d + len, floorA, floorB, cover, label };
    d += len;
    return r;
  };
  return [
    seg(4, SHALLOWS_Y + 0.4, SHALLOWS_Y, null, "approach"),
    seg(dDescent, SHALLOWS_Y, GALLERY_FLOOR_Y, null, "descent (roof closes)"),
    seg(dLeg, GALLERY_FLOOR_Y, GALLERY_FLOOR_Y, GALLERY_ROOF_Y, "return leg"),
    seg(dHub, GALLERY_FLOOR_Y, GALLERY_FLOOR_Y, GALLERY_ROOF_Y, "hub (oculus overhead)"),
    seg(dChan, GALLERY_FLOOR_Y, GALLERY_FLOOR_Y, GALLERY_ROOF_Y, "channel B"),
    seg(dStair, GALLERY_FLOOR_Y, BELL_FLOOR_Y, BELL_CEILING_Y, "surfacing stair"),
    seg(dBell, BELL_FLOOR_Y, SHELF_Y, BELL_CEILING_Y, "air-bell B (deck · margin · shelf)"),
  ];
})();
drawSection(
  SEC_X,
  180,
  1050,
  "Developed long section — the dive: approach → descent → hub → channel B → air-bell B",
  dive,
  `Rock roof at ${GALLERY_ROOF_Y} sits ${(WATERLINE_Y - GALLERY_ROOF_Y).toFixed(1)} m BELOW the waterline — no air until the bell. Bell ceiling ${BELL_CEILING_Y} = 3.0 m over the dry deck (${BELL_FLOOR_Y}); eye surfaces at ${(BELL_FLOOR_Y + EYE_ABOVE_FLOOR).toFixed(1)}.`
);

const shaftSec: SectionRegion[] = (() => {
  const dHub = span(layout.hub, "z");
  const dLeg = span(layout.shaftPassageLeg, "z");
  const dJog = span(layout.shaftPassageJog, "z");
  const dCorr = layout.galleryCorridor.length
    ? span(layout.galleryCorridor[0]!, "z")
    : 5;
  const dShaft = span(layout.buoyantShaft, "z");
  let d = 0;
  const seg = (len: number, floorA: number, floorB: number, cover: number | null, label?: string): SectionRegion => {
    const r = { from: d, to: d + len, floorA, floorB, cover, label };
    d += len;
    return r;
  };
  return [
    seg(dHub, GALLERY_FLOOR_Y, GALLERY_FLOOR_Y, GALLERY_ROOF_Y, "hub"),
    seg(dLeg, GALLERY_FLOOR_Y, GALLERY_FLOOR_Y, GALLERY_ROOF_Y, "shaft passage"),
    seg(dJog, GALLERY_FLOOR_Y, GALLERY_FLOOR_Y, GALLERY_ROOF_Y, "jog"),
    seg(dCorr, GALLERY_FLOOR_Y, GALLERY_FLOOR_Y, GALLERY_ROOF_Y, "drowned door"),
    seg(dShaft, GALLERY_FLOOR_Y, GALLERY_FLOOR_Y, null, "buoyant shaft ↑"),
    seg(4, CAUSEWAY_Y, CAUSEWAY_Y, DOME_APEX_Y, "apron (ring)"),
    seg(6, POOL_BOTTOM_Y, POOL_BOTTOM_Y, DOME_APEX_Y, "mirror pool"),
  ];
})();
drawSection(
  SEC_X,
  480,
  1050,
  "Developed long section — the rise: hub → drowned passage under the door → buoyant shaft → apron",
  shaftSec,
  `The column rises ${(CAUSEWAY_Y - GALLERY_FLOOR_Y).toFixed(1)} m from gallery depth through the apron's rimmed hole (reduced-gravity float = Gate 2 seam). Falling in from the apron lands in safe water (Q4 recommendation).`
);

// — Route strip —
{
  const x0 = SEC_X;
  let y = 790;
  svgParts.push(`<text x="${x0}" y="${y - 12}" fill="${C.text}" font-size="20" font-weight="600">Numbered route — sees / does / understands</text>`);
  for (const stop of routeStops) {
    svgParts.push(
      `<circle cx="${x0 + 12}" cy="${y + 6}" r="11" fill="none" stroke="${C.route}" stroke-width="2"/>`,
      `<text x="${x0 + 12}" y="${y + 11}" fill="${C.route}" font-size="13" font-weight="700" text-anchor="middle">${stop.n}</text>`,
      `<text x="${x0 + 34}" y="${y + 3}" fill="${C.text}" font-size="15" font-weight="600">${esc(stop.title)}</text>`,
      `<text x="${x0 + 34}" y="${y + 21}" fill="${C.muted}" font-size="13">${esc(`${stop.sees} · ${stop.does} · ${stop.understands}`)}</text>`
    );
    y += 44;
  }
}

// — Sightline + checks table —
{
  const x0 = 60;
  let y = PLAN_Y + PLAN_H + 60;
  svgParts.push(`<text x="${x0}" y="${y}" fill="${C.text}" font-size="20" font-weight="600">Sightline study (moving windows, aimed at the performer floor) · isolation · final frame</text>`);
  y += 28;
  for (const s of sightlines) {
    svgParts.push(
      `<text x="${x0}" y="${y}" fill="${C.text}" font-size="15">Bell ${s.bell.toUpperCase()} — run ${s.runMetres.toFixed(1)} m · ${s.sampleCount} samples, ${s.blockedSamples} blocked · min floor margin ${s.minimumFloorMargin.toFixed(2)} m · read ${s.readDistance.toFixed(1)} m</text>`
    );
    y += 24;
  }
  const isoOk = isolation.every((i) => i.blockedByRock);
  svgParts.push(
    `<text x="${x0}" y="${y}" fill="${C.text}" font-size="15">Bell↔bell isolation: ${isoOk ? "all 6 cross-sightlines blocked by rock" : "VIOLATION — see report"}</text>`
  );
  y += 24;
  svgParts.push(
    `<text x="${x0}" y="${y}" fill="${C.text}" font-size="15">Final frame (${FINAL_FOV_DEG}° from the shaft rim): pool ${finalFrame.poolInFrame ? "in" : "OUT"}, waterfall ${finalFrame.waterfallInFrame ? "in" : "OUT"}, niches ${finalFrame.nichesInFrame.map((n) => (n.inFrame ? "in" : "OUT")).join("/")}</text>`
  );
}

svgParts.push("</svg>");
const svg = svgParts.join("\n");

// ── Checks ──────────────────────────────────────────────────────────────────

const checks = {
  walkability: {
    passed:
      descentGrade <= 0.65 &&
      stairGrades.every((s) => s.grade <= 0.65) &&
      channelWidths.every((c) => c.width >= 2.4),
    descentGrade,
    stairGrades,
    channelWidths,
    routeNote:
      "Headless playtest (drowned-gallery-traversal.test.ts) walks squeeze → descent → hub → all three bells → shaft bottom, then apron → ring → Fire door.",
  },
  clearance: {
    passed: minHeadroom >= ROOF_HEADROOM - 1e-6 && BELL_CEILING_Y - BELL_FLOOR_Y >= 2.9,
    minimumRoofHeadroom: minHeadroom,
    bellCeilingOverDeck: BELL_CEILING_Y - BELL_FLOOR_Y,
    shaftCeilingY: SHAFT_CEILING_Y,
  },
  sightlines: {
    passed:
      sightlines.every((s) => s.blockedSamples === 0 && s.minimumFloorMargin > 0) &&
      isolation.every((i) => i.blockedByRock),
    perBell: sightlines,
    isolation,
  },
  finalView: {
    passed:
      finalFrame.poolInFrame && finalFrame.nichesInFrame.every((n) => n.inFrame),
    ...finalFrame,
  },
};

const report = {
  scene: "drowned-gallery",
  gate: "measured-plan",
  generatedBy: "scripts/generate-drowned-gallery-board.ts",
  layoutSource: "src/lib/features/museum/data/drowned-gallery-terrain.ts",
  datums: {
    WATERLINE_Y,
    SHALLOWS_Y,
    GALLERY_FLOOR_Y,
    GALLERY_ROOF_Y,
    BELL_FLOOR_Y,
    BELL_CEILING_Y,
    CAUSEWAY_Y,
    SHELF_Y,
    CHANNEL_BED_Y,
    POOL_BOTTOM_Y,
    DOME_APEX_Y,
    SHAFT_CEILING_Y,
  },
  openQuestionResolutions: {
    q1_bellsToShaftTopology:
      "The buoyant shaft connects to the HUB as its fifth opening (drowned passage under the north door). Per-bell shaft exits braid the map against 'legibility over maze'; last-bell-only forces an order against structural decision 1 (free choice).",
    q2_ringStaging:
      "PROPOSED: after the dives, the finale restages A/B/C on the three kept ring niches (old shore alcoves) so the mirror pool doubles them from the apron/procession. Performer ANCHORS live in the bells; the restaging mechanism is Gate 2+ runtime work. Needs Austen's call.",
    q3_footprint:
      "SETTLED: cave-water-gallery grows from 13.5 × 24 m to 30 × 30 m interior (minInterior 18×32 → 40×40). Every room the layout engine places after it moved (Earth south door shifted +2.5 m; earth-canyon Blender manifest regenerated; earth-long-terrace pinned span updated). Downstream grayboxes built from pre-move manifests need re-verification at their own gates.",
    q4_shaftFallIn:
      "RECOMMENDED: safe-and-floaty. The rim is a rendered curb, not a blocker; falling in lands in deep water and the Gate 2 gravity seam floats the player back up.",
  },
  routeStops,
  checks,
};

mkdirSync(dirname(BOARD_PATH), { recursive: true });
writeFileSync(BOARD_PATH, `${svg}\n`, "utf8");
writeFileSync(REPORT_PATH, `${canonicalJSON(report)}\n`, "utf8");

const sha = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");
console.log(`Board:  ${BOARD_PATH}`);
console.log(`Report: ${REPORT_PATH}`);
console.log(`board sha256  ${sha(`${svg}\n`)}`);
console.log(`report sha256 ${sha(`${canonicalJSON(report)}\n`)}`);
for (const [name, check] of Object.entries(checks)) {
  console.log(`check ${name}: ${(check as { passed: boolean }).passed ? "PASSED" : "FAILED"}`);
}
