import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("firebase/firestore", () => ({}));
vi.mock("$lib/shared/auth/firebase", () => ({
  getFirestoreInstance: vi.fn().mockResolvedValue({}),
}));

import type { CsvEdge } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { parseCsvEdges } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import { hydrateSequence } from "$lib/features/choreo-card/services/sequence-render-hydrator";
import { buildFlowerSequence } from "$lib/features/lab/vtg-lab/services/build-flower-sequence";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import { getTipPoints } from "$lib/shared/animation-engine/domain/types/prop-tip-points";
import { getDefaultTrailPointConfig } from "$lib/shared/animation-engine/domain/types/trail-point-types";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import baseWords from "../../../../../../static/data/hero/tnd-base-words.json";
import { derivePropRelationship } from "../../domain/prop-relationship";
import {
  flowerPetals,
  type Flower,
  type FlowerStyle,
} from "../../domain/flower-signature";
import type { RotationStyle } from "../../domain/rotation-style";
import {
  classifyRotationStyleMembers,
  representativeRotationStyleMember,
  type RotationStyleArchetype,
} from "../rotation-style-archetypes";
import { resolveFlowerArchetype } from "../flower-archetype";
import { buildBaseIndex, resolveBase } from "../build-realization-sequence";
import {
  buildExactFlowerPhases,
  solvePropRelationshipPhase,
  type FlowerParityTarget,
} from "../solve-prop-relationship-phase";
import { flowerPhaseOrientations } from "../verify-realization-parity";
import { CURVE_MATCH_EPS, curveDistance } from "./curve-distance";
import {
  MODE_FAMILY_ID,
  MODE_ORDER,
  type VtgMode,
} from "../shape-matrix-realizations";

const words = baseWords.map((record) => hydrateSequence(record));
let index: Map<string, SequenceData>;
let edges: CsvEdge[];
let matrices: RotationStyleArchetype[];
let staffTip: { dx: number; dy: number };

function flower(style: FlowerStyle, turns: number, ori: "in" | "out"): Flower {
  return {
    style,
    turns,
    ori,
    grid: "diamond",
    petals: flowerPetals({ style, turns }),
  };
}

function overlayFor(pair: { blue: Flower; red: Flower }): FlowerParityTarget {
  const blueArchetype = resolveFlowerArchetype(matrices, pair.blue.style);
  const redArchetype = resolveFlowerArchetype(matrices, pair.red.style);
  const blueSequence = buildFlowerSequence(
    blueArchetype,
    pair.blue,
    "blue",
    edges,
    PropType.STAFF
  );
  const redSequence = buildFlowerSequence(
    redArchetype,
    pair.red,
    "blue",
    edges,
    PropType.STAFF
  );
  return {
    blue: calculateMandalaGeometry(
      blueSequence.steps,
      undefined,
      undefined,
      { tipEnds: 1, pathShape: "arc" },
      staffTip
    ).blue,
    red: calculateMandalaGeometry(
      redSequence.steps,
      undefined,
      undefined,
      { tipEnds: 1, pathShape: "arc" },
      staffTip
    ).blue,
    tipPoint: staffTip,
    clubTipDx: Math.hypot(staffTip.dx, staffTip.dy),
  };
}

function distances(
  sequence: SequenceData,
  target: FlowerParityTarget
): { blue: number; red: number } {
  const actual = calculateMandalaGeometry(
    sequence.steps,
    undefined,
    undefined,
    { tipEnds: 1, pathShape: "arc" },
    staffTip
  );
  return {
    blue: curveDistance(target.blue, actual.blue),
    red: curveDistance(target.red, actual.red),
  };
}

beforeAll(() => {
  edges = parseCsvEdges(
    readFileSync(
      resolve("static/data/pictographs/DiamondPictographDataframe.csv"),
      "utf8"
    )
  );
  index = buildBaseIndex(words);
  const classified = classifyRotationStyleMembers(words, "diamond");
  matrices = (["iso", "antispin", "hybrid"] as RotationStyle[]).flatMap(
    (style) => {
      const members = classified.get(style) ?? [];
      if (members.length === 0) return [];
      const representative = representativeRotationStyleMember(members);
      const sequence = applyVariationDescriptor(
        representative,
        {
          turnPattern: "0|0",
          turnLabel: "test-archetype",
          gridMode: "diamond",
        },
        edges
      ).sequence;
      return [{ style, byTurn: new Map([["0|0", sequence]]) }];
    }
  );
  const points = getTipPoints(PropType.STAFF).points;
  const source = getDefaultTrailPointConfig(PropType.STAFF, points).right;
  if (source.type !== "tip") throw new Error("Staff right source is not a tip");
  staffTip = points[source.index]!;
});

describe("flower phase orientation search", () => {
  it("searches the complete Level 4 wheel for quarter-turn flowers", () => {
    const orientations = flowerPhaseOrientations({
      blue: flower("pro", 0.25, "out"),
      red: flower("pro", 0.25, "out"),
    });
    expect(orientations).toEqual([
      Orientation.IN,
      Orientation.CLOCK_IN,
      Orientation.CLOCK,
      Orientation.CLOCK_OUT,
      Orientation.OUT,
      Orientation.COUNTER_OUT,
      Orientation.COUNTER,
      Orientation.COUNTER_IN,
    ]);
  });

  it("keeps non-quarter bands on cardinal starts", () => {
    expect(
      flowerPhaseOrientations({
        blue: flower("pro", 1, "out"),
        red: flower("anti", 1, "in"),
      })
    ).toEqual([
      Orientation.IN,
      Orientation.CLOCK,
      Orientation.OUT,
      Orientation.COUNTER,
    ]);
  });
});

describe("exact flower parity", () => {
  const pairs = [
    {
      blue: flower("pro", 0.25, "out"),
      red: flower("pro", 0.25, "out"),
    },
    {
      blue: flower("pro", 0.75, "out"),
      red: flower("pro", 0.75, "out"),
    },
    {
      blue: flower("anti", 0.75, "in"),
      red: flower("anti", 0.75, "out"),
    },
  ] satisfies Array<{ blue: Flower; red: Flower }>;

  it("accepts only sequences whose two trails match the clicked flowers", () => {
    let accepted = 0;
    for (const pair of pairs) {
      const target = overlayFor(pair);
      for (const handMode of MODE_ORDER) {
        const base = resolveBase(
          index,
          handMode,
          pair.blue.style,
          pair.red.style
        );
        if (!base) continue;
        const phases = buildExactFlowerPhases(base, pair, edges, target);
        expect(
          phases.length,
          `${handMode} should preserve ${pair.blue.style}/${pair.blue.turns} × ${pair.red.style}/${pair.red.turns}`
        ).toBeGreaterThan(0);
        for (const phase of phases) {
          const distance = distances(phase.sequence, target);
          expect(distance.blue).toBeLessThanOrEqual(CURVE_MATCH_EPS);
          expect(distance.red).toBeLessThanOrEqual(CURVE_MATCH_EPS);
          accepted++;
        }
      }
    }
    expect(accepted).toBeGreaterThan(0);
  });

  it("rejects relationship-only matches that change the selected flower", () => {
    for (const pair of pairs.slice(1)) {
      const base = resolveBase(index, "QS", pair.blue.style, pair.red.style);
      if (!base) throw new Error("Missing QS base");
      expect(
        solvePropRelationshipPhase(base, pair, "TS", edges, overlayFor(pair))
      ).toBeNull();
    }
  });

  it("classifies every returned target exactly and deterministically", () => {
    const pair = pairs[0]!;
    const target = overlayFor(pair);
    for (const targetMode of MODE_ORDER as readonly VtgMode[]) {
      for (const handMode of MODE_ORDER) {
        const base = resolveBase(index, handMode, "pro", "pro");
        if (!base) continue;
        const first = solvePropRelationshipPhase(
          base,
          pair,
          targetMode,
          edges,
          target
        );
        const second = solvePropRelationshipPhase(
          base,
          pair,
          targetMode,
          edges,
          target
        );
        expect(second?.blueOrientation).toBe(first?.blueOrientation);
        expect(second?.redOrientation).toBe(first?.redOrientation);
        if (!first) continue;
        const relationship = derivePropRelationship(first.sequence, pair);
        expect(relationship.kind).toBe("full");
        if (relationship.kind === "full") {
          expect(relationship.element.familyId).toBe(
            MODE_FAMILY_ID[targetMode]
          );
        }
      }
    }
  }, 30_000);

  it("keeps every hand relationship available for quarter-turn flowers", () => {
    const pair = pairs[0]!;
    const target = overlayFor(pair);
    const table: Record<string, string[]> = {};
    for (const handMode of MODE_ORDER) {
      const base = resolveBase(index, handMode, "pro", "pro");
      if (!base) continue;
      table[handMode] = [
        ...new Set(
          buildExactFlowerPhases(base, pair, edges, target).map((phase) => {
            const relationship = derivePropRelationship(phase.sequence, pair);
            return relationship.kind === "full"
              ? relationship.element.familyId
              : relationship.kind;
          })
        ),
      ];
    }
    expect(table).toEqual({
      SS: ["quarter-same"],
      TS: ["tog-same", "split-same"],
      QS: ["quarter-same"],
      SO: ["quarter-opp"],
      TO: ["tog-opp", "split-opp"],
      QO: ["quarter-opp"],
    });

    const splitSameBase = resolveBase(index, "SS", "pro", "pro");
    if (!splitSameBase) throw new Error("Missing SS pro/pro base");
    expect(
      solvePropRelationshipPhase(splitSameBase, pair, "TS", edges, target)
    ).toBeNull();
  });

  it("does not invent timed relationships for unequal turns or Float", () => {
    const base = resolveBase(index, "SS", "pro", "pro");
    if (!base) throw new Error("Missing SS pro/pro base");
    const emptyTarget: FlowerParityTarget = {
      blue: [],
      red: [],
      clubTipDx: 0,
    };
    const unequal = {
      blue: flower("pro", 0.25, "out"),
      red: flower("pro", 1, "out"),
    };
    const floating = {
      blue: {
        style: "float",
        turns: "fl",
        ori: "in",
        grid: "diamond",
        petals: 0,
      },
      red: {
        style: "float",
        turns: "fl",
        ori: "out",
        grid: "diamond",
        petals: 0,
      },
    } satisfies { blue: Flower; red: Flower };

    expect(
      solvePropRelationshipPhase(base, unequal, "SS", edges, emptyTarget)
    ).toBeNull();
    expect(
      solvePropRelationshipPhase(base, floating, "SS", edges, emptyTarget)
    ).toBeNull();
  });
});
