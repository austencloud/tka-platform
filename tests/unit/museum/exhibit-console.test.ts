/**
 * The console's two load-bearing claims.
 *
 * 1. The contextual button exists only where there is something to swap. The
 *    absence of a button on the pro-only and anti-only cases is the lesson, so
 *    it has to be derived from the sequence rather than configured — a flag can
 *    disagree with the steps it names.
 * 2. Every change is a transform OF the bound record. The museum never shows a
 *    newly generated variation in a case, which is why the control set has no
 *    "show me a different one" button and why these transforms delegate to the
 *    app's own owner rather than to museum-local maths.
 */
import { describe, it, expect } from "vitest";
import {
  CAVE_PROP_CYCLE,
  CONSOLE_FACE,
  CONSOLE_FOOTPRINT,
  CONSOLE_HEIGHT,
  applyVerb,
  consoleBodyHeight,
  consoleColumnX,
  consoleFaceDrop,
  consoleFaceSize,
  consoleFaceY,
  consoleRowY,
  defaultSettings,
  isHybrid,
  isModified,
  nextProp,
  verbsFor,
} from "../../../src/lib/features/museum/domain/exhibit-console";
import {
  boundSteps,
  effectiveSteps,
} from "../../../src/lib/features/museum/services/exhibit-console-sequence";
import { buildPedestalFace } from "../../../src/lib/features/museum/services/pedestal-face";
import type { StepData } from "../../../src/lib/shared/foundation/domain/models/step-data";
import {
  buildDrownedGalleryLayout,
  CAUSEWAY_Y,
  inRectClosed,
  type ExhibitFixture,
  type WorldRect,
} from "../../../src/lib/features/museum/data/drowned-gallery-terrain";
import { buildVulcanCaveFloorPlan } from "../../../src/lib/features/museum/data/vulcan-cave-floor-plan";

const layout = buildDrownedGalleryLayout(buildVulcanCaveFloorPlan().grid)!;
const consoles = layout.exhibitFixtures.filter(
  (fixture) => fixture.kind === "case-console"
);

const footprint = (fixture: ExhibitFixture): WorldRect => ({
  minX: fixture.centre.x - fixture.size.x / 2,
  maxX: fixture.centre.x + fixture.size.x / 2,
  minZ: fixture.centre.z - fixture.size.z / 2,
  maxZ: fixture.centre.z + fixture.size.z / 2,
});

describe("cave control tier", () => {
  it("gives the hybrid a fourth button and the other two only three", () => {
    // CCCC is the Cave's hybrid: its blue hand is anti while its red hand is
    // pro. AAAA and BBBB have both hands doing the same thing, so there is
    // nothing to swap and no button appears.
    expect(isHybrid(boundSteps("cave-water-seq-a"))).toBe(false);
    expect(isHybrid(boundSteps("cave-water-seq-b"))).toBe(false);
    expect(isHybrid(boundSteps("cave-water-seq-c"))).toBe(true);

    expect(verbsFor(false)).toEqual(["trace", "prop", "reverse"]);
    expect(verbsFor(true)).toEqual(["trace", "prop", "reverse", "swap-hands"]);
  });

  it("never offers more than four buttons", () => {
    // The diegetic constraint IS the design: four large buttons readable at
    // arm's length, not a panel. A set that outgrows this has stopped being an
    // object in a room.
    expect(verbsFor(true).length).toBeLessThanOrEqual(4);
  });

  it("offers no turn control anywhere", () => {
    // Turn values do not exist in the Cave's era. The era gate is on verbs that
    // change the choreography, and this is the one the whole rule was written
    // for.
    for (const hybrid of [false, true]) {
      expect(verbsFor(hybrid)).not.toContain("turns");
    }
  });

  it("cycles between one bilateral and one unilateral prop", () => {
    expect(nextProp("staff")).toBe("fan");
    expect(nextProp("fan")).toBe("staff");
    // An unrecognised prop enters the cycle rather than dead-ending on itself.
    expect(CAVE_PROP_CYCLE).toContain(nextProp("club"));
  });

  it("reports modification only against the performer's bound state", () => {
    const base = defaultSettings("staff");
    expect(isModified(base, "staff")).toBe(false);
    expect(isModified(applyVerb(base, "trace"), "staff")).toBe(true);
    expect(isModified(applyVerb(base, "reverse"), "staff")).toBe(true);
    // Cycling the whole way round is back to bound, not still "modified".
    const twice = applyVerb(applyVerb(base, "prop"), "prop");
    expect(isModified(twice, "staff")).toBe(false);
  });
});

describe("console transforms of the bound record", () => {
  it("returns the record itself when nothing has been pressed", () => {
    const bound = boundSteps("cave-water-seq-c");
    return expect(
      effectiveSteps("cave-water-seq-c", defaultSettings("staff"))
    ).resolves.toBe(bound);
  });

  it("swaps which hand plays which role on the hybrid", async () => {
    const bound = boundSteps("cave-water-seq-c");
    const swapped = await effectiveSteps("cave-water-seq-c", {
      ...defaultSettings("staff"),
      handsSwapped: true,
    });
    expect(swapped).toHaveLength(bound.length);
    // The roles trade places rather than both becoming one thing.
    expect(swapped[0].motions.left.motionType).toBe(
      bound[0].motions.right.motionType
    );
    expect(swapped[0].motions.right.motionType).toBe(
      bound[0].motions.left.motionType
    );
  });

  it("keeps the step count when the path is reversed", async () => {
    const bound = boundSteps("cave-water-seq-a");
    const reversed = await effectiveSteps("cave-water-seq-a", {
      ...defaultSettings("staff"),
      reversed: true,
    });
    expect(reversed).toHaveLength(bound.length);
  });

  it("refuses an unknown binding instead of guessing", () => {
    expect(() => boundSteps("no-such-sequence")).toThrow(/no bound museum/);
  });
});

describe("the shape of the control face", () => {
  it("keeps the whole plate clear of the body it sits on", () => {
    // The plate is tilted, so its near edge hangs below its own centre. When
    // the body was sized to stop just under the plate's CENTRE, that overhang
    // was buried inside the box: the RESTORE handle and the bottom line of any
    // wrapped label were simply not on screen. Nothing about the numbers said
    // so — it only showed up in a frame.
    const drop = consoleFaceDrop(CONSOLE_FOOTPRINT);
    const nearEdge = consoleFaceY(CONSOLE_HEIGHT, CONSOLE_FOOTPRINT) - drop;
    expect(consoleBodyHeight(CONSOLE_HEIGHT, CONSOLE_FOOTPRINT)).toBeLessThan(nearEdge);
  });

  it("stands no taller than the height that names it", () => {
    const farEdge = consoleFaceY(CONSOLE_HEIGHT, CONSOLE_FOOTPRINT) + consoleFaceDrop(CONSOLE_FOOTPRINT);
    expect(farEdge).toBeCloseTo(CONSOLE_HEIGHT, 6);
  });

  it("orders its rows from the far edge to the visitor", () => {
    const { h } = consoleFaceSize(CONSOLE_FOOTPRINT);
    const rows = [
      CONSOLE_FACE.buttonV,
      CONSOLE_FACE.labelV,
      CONSOLE_FACE.restoreBarV,
      CONSOLE_FACE.restoreLabelV,
    ].map((v) => consoleRowY(v, h));
    // Every row sits lower on the plate than the one before it, and all four
    // land on the plate rather than off its end.
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!).toBeLessThan(rows[i - 1]!);
    }
    expect(rows[0]!).toBeLessThan(h / 2);
    expect(rows[rows.length - 1]!).toBeGreaterThan(-h / 2);
  });

  it("spreads four buttons across the plate without running off it", () => {
    const { w } = consoleFaceSize(CONSOLE_FOOTPRINT);
    const xs = [0, 1, 2, 3].map((i) => consoleColumnX(i, 4, w));
    expect(Math.min(...xs)).toBeGreaterThan(-w / 2);
    expect(Math.max(...xs)).toBeLessThan(w / 2);
    // Evenly spaced, so no two labels share a column.
    const pitch = xs[1]! - xs[0]!;
    expect(xs[2]! - xs[1]!).toBeCloseTo(pitch, 9);
    expect(xs[3]! - xs[2]!).toBeCloseTo(pitch, 9);
  });
});

describe("where the consoles stand", () => {
  it("gives every case one console and no more", () => {
    expect(consoles).toHaveLength(3);
    expect(new Set(consoles.map((c) => c.caseWord)).size).toBe(3);
  });

  it("binds each console to the sequence its case is bound to", () => {
    for (const station of consoles) {
      expect(station.sequenceId, station.id).toBeTruthy();
      expect(() => boundSteps(station.sequenceId!)).not.toThrow();
    }
  });

  it("stands them on the procession, never over water", () => {
    for (const station of consoles) {
      expect(station.baseY).toBe(CAUSEWAY_Y);
      const rect = footprint(station);
      for (const [x, z] of [
        [rect.minX, rect.minZ],
        [rect.maxX, rect.minZ],
        [rect.minX, rect.maxZ],
        [rect.maxX, rect.maxZ],
      ] as [number, number][]) {
        expect(inRectClosed(layout.procession, x, z), station.id).toBe(true);
      }
    }
  });

  it("leaves the procession's walking width alone", () => {
    // The procession is a walking line first. The console inherits the card
    // sign's depth and z rule precisely so it cannot narrow it further.
    for (const station of consoles) {
      const clear = layout.procession.maxZ - footprint(station).maxZ;
      expect(clear, station.id).toBeGreaterThanOrEqual(1.6);
    }
  });

  it("never overlaps the card sign it stands beside", () => {
    for (const station of consoles) {
      const card = layout.exhibitFixtures.find(
        (f) => f.kind === "case-card" && f.caseWord === station.caseWord
      )!;
      const a = footprint(station);
      const b = footprint(card);
      const overlaps = a.minX < b.maxX && a.maxX > b.minX;
      expect(overlaps, station.id).toBe(false);
    }
  });
});

/**
 * What the pedestal actually DRAWS once a button is pressed.
 *
 * This is the part a graybox cannot show. The performers are boxes, so the only
 * visible consequence of a console press is the figure under their feet — and
 * whether that figure changes is a fact about generated geometry, not about
 * lighting or staging. Proving it here means the answer survives every later
 * change of art direction.
 */
describe("what the face shows after a press", () => {
  // The SVG itself, not the data URI. A percent-encoded URI hides real
  // differences behind escape sequences and invents fake numeric ones out of
  // the escapes themselves.
  const face = (settingsSteps: readonly StepData[] | undefined, prop: string) =>
    buildPedestalFace({
      sequenceId: "cave-water-seq-c",
      propType: prop,
      tint: "#7fd4e8",
      ...(settingsSteps ? { steps: settingsSteps } : {}),
    }).svg;

  it("redraws when the prop changes, because the trace count does", async () => {
    // A staff is held at its centre, so both of its ends draw. A fan is held at
    // one end, so one does. Austen's point exactly: the prop button is not
    // pedagogically empty just because the hand path is unchanged.
    const staff = face(undefined, "staff");
    const fan = face(undefined, "fan");
    expect(staff).not.toBe(fan);
  });

  it("redraws when the hands swap roles", async () => {
    const bound = boundSteps("cave-water-seq-c");
    const swapped = await effectiveSteps("cave-water-seq-c", {
      ...defaultSettings("staff"),
      handsSwapped: true,
    });
    expect(face(bound, "staff")).not.toBe(face(swapped, "staff"));
  });

  it("draws the same figure when the path is reversed, only backwards", async () => {
    // Not a defect — the lesson. Walking a closed path backwards traces the
    // same locus, so the picture is the same and only the ORDER of the strokes
    // changes.
    //
    // Compared as sorted point sets the two faces agree to within a fifth of a
    // unit on a 1024-unit face — floating-point drift in the interpolation, not
    // a different shape. They are not byte-identical because the arcs come out
    // in the opposite sequence, which is exactly what "the same figure, drawn
    // the other way round" means.
    //
    // The consequence is worth stating plainly before anyone tunes this
    // button's feel: in a graybox whose performers are boxes, pressing it
    // changes NOTHING a visitor can see. It needs an animated performer to
    // read at all.
    const bound = boundSteps("cave-water-seq-a");
    const reversed = await effectiveSteps("cave-water-seq-a", {
      ...defaultSettings("staff"),
      reversed: true,
    });
    const points = (svg: string) =>
      (svg.match(/-?\d+\.?\d*/g) ?? []).map(Number).sort((a, b) => a - b);

    const before = points(face(bound, "staff"));
    const after = points(face(reversed, "staff"));
    expect(after).toHaveLength(before.length);
    const worst = before.reduce(
      (max, value, index) => Math.max(max, Math.abs(value - after[index]!)),
      0
    );
    expect(worst).toBeLessThan(0.5);
  });
});
