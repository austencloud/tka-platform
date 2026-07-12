import { describe, expect, it } from "vitest";
import {
  generateLOOPType,
  parseLoopComponents,
  isImplementedCombo,
  canExtendCombo,
  buildLoopSpec,
  expanderMultiplier,
} from "$lib/shared/create/services/loop-type-utils";
import { LOOPType } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";

const C = LOOPComponent;

describe("generateLOOPType", () => {
  it("maps every single component to its strict type", () => {
    expect(generateLOOPType(new Set([C.ROTATED]))).toBe(LOOPType.ROTATED);
    expect(generateLOOPType(new Set([C.MIRRORED]))).toBe(LOOPType.MIRRORED);
    expect(generateLOOPType(new Set([C.FLIPPED]))).toBe(LOOPType.FLIPPED);
    expect(generateLOOPType(new Set([C.SWAPPED]))).toBe(LOOPType.SWAPPED);
    expect(generateLOOPType(new Set([C.INVERTED]))).toBe(LOOPType.INVERTED);
    expect(generateLOOPType(new Set([C.REWOUND]))).toBe(LOOPType.STRICT_REWOUND);
  });

  it("maps the implemented triples, including mirrored+swapped+inverted", () => {
    expect(
      generateLOOPType(new Set([C.MIRRORED, C.INVERTED, C.ROTATED]))
    ).toBe(LOOPType.MIRRORED_INVERTED_ROTATED);
    expect(
      generateLOOPType(new Set([C.MIRRORED, C.ROTATED, C.SWAPPED]))
    ).toBe(LOOPType.MIRRORED_ROTATED_SWAPPED);
    expect(
      generateLOOPType(new Set([C.MIRRORED, C.SWAPPED, C.INVERTED]))
    ).toBe(LOOPType.MIRRORED_SWAPPED_INVERTED);
  });

  it("returns null for unmapped combos instead of silently coercing to ROTATED", () => {
    // The bug this locks out: mirrored+flipped+rewound used to bounce to ROTATED.
    expect(
      generateLOOPType(new Set([C.MIRRORED, C.FLIPPED, C.REWOUND]))
    ).toBeNull();
    // flipped and rewound combine with nothing
    expect(generateLOOPType(new Set([C.FLIPPED, C.MIRRORED]))).toBeNull();
    expect(generateLOOPType(new Set([C.REWOUND, C.ROTATED]))).toBeNull();
    // rotated+inverted+swapped has no implemented type (only as part of All Four)
    expect(
      generateLOOPType(new Set([C.ROTATED, C.INVERTED, C.SWAPPED]))
    ).toBeNull();
  });

  it("keeps the legacy ROTATED default for the empty set", () => {
    expect(generateLOOPType(new Set())).toBe(LOOPType.ROTATED);
  });

  it("round-trips every implemented combo through parseLoopComponents", () => {
    const combos: LOOPComponent[][] = [
      [C.ROTATED],
      [C.MIRRORED],
      [C.FLIPPED],
      [C.SWAPPED],
      [C.INVERTED],
      [C.REWOUND],
      [C.MIRRORED, C.INVERTED],
      [C.ROTATED, C.INVERTED],
      [C.SWAPPED, C.INVERTED],
      [C.MIRRORED, C.ROTATED],
      [C.MIRRORED, C.SWAPPED],
      [C.ROTATED, C.SWAPPED],
      [C.MIRRORED, C.INVERTED, C.ROTATED],
      [C.MIRRORED, C.ROTATED, C.SWAPPED],
      [C.MIRRORED, C.SWAPPED, C.INVERTED],
      [C.MIRRORED, C.ROTATED, C.INVERTED, C.SWAPPED],
    ];

    for (const combo of combos) {
      const input = new Set(combo);
      const loopType = generateLOOPType(input);
      expect(loopType, combo.join("+")).not.toBeNull();
      const parsed = parseLoopComponents(loopType);
      expect(parsed, combo.join("+")).toEqual(input);
    }
  });
});

describe("canExtendCombo", () => {
  it("blocks flipped and rewound from joining any other component", () => {
    expect(canExtendCombo(new Set([C.MIRRORED]), C.FLIPPED)).toBe(false);
    expect(canExtendCombo(new Set([C.MIRRORED]), C.REWOUND)).toBe(false);
    expect(canExtendCombo(new Set([C.FLIPPED]), C.MIRRORED)).toBe(false);
    expect(canExtendCombo(new Set([C.REWOUND]), C.ROTATED)).toBe(false);
  });

  it("allows building toward All Four through unmapped intermediates", () => {
    // {rotated, inverted, swapped} maps to nothing itself, but is a subset of
    // All Four — the builder must allow passing through it.
    expect(canExtendCombo(new Set([C.ROTATED, C.INVERTED]), C.SWAPPED)).toBe(true);
    expect(
      isImplementedCombo(new Set([C.ROTATED, C.INVERTED, C.SWAPPED]))
    ).toBe(false);
    expect(
      canExtendCombo(new Set([C.ROTATED, C.INVERTED, C.SWAPPED]), C.MIRRORED)
    ).toBe(true);
  });

  it("allows every component from an empty selection", () => {
    for (const component of [
      C.ROTATED,
      C.MIRRORED,
      C.FLIPPED,
      C.SWAPPED,
      C.INVERTED,
      C.REWOUND,
    ]) {
      expect(canExtendCombo(new Set(), component)).toBe(true);
    }
  });
});

describe("buildLoopSpec", () => {
  it("defaults reproduce today's behavior: rotation at the chosen interval, all other components at interval 2, expand mode", () => {
    const wire = buildLoopSpec(new Set([C.ROTATED, C.MIRRORED, C.INVERTED]), { rotationInterval: 4 });
    expect(wire).not.toBeNull();
    expect(wire!.blue!.rotated).toEqual({ period: 4 });
    expect(wire!.blue!.mirrored).toEqual({ period: 2 });
    expect(wire!.blue!.inverted).toEqual({ period: 2 });
    expect(wire!.red).toEqual(wire!.blue);
  });

  it("carries inversion rhythm + overlay mode", () => {
    const wire = buildLoopSpec(new Set([C.MIRRORED, C.INVERTED]), {
      inversionInterval: 4,
      inversionMode: "overlay",
    });
    expect(wire!.blue!.inverted).toEqual({ period: 4, mode: "overlay" });
  });

  it("returns null for unmapped combos (same gate as generateLOOPType)", () => {
    const wire = buildLoopSpec(new Set([C.MIRRORED, C.FLIPPED, C.REWOUND]), {});
    expect(wire).toBeNull();
  });

  it("expanderMultiplier: overlay does not multiply", () => {
    const wire = buildLoopSpec(new Set([C.ROTATED, C.MIRRORED, C.INVERTED]), {
      rotationInterval: 2, inversionInterval: 4, inversionMode: "overlay",
    })!;
    expect(expanderMultiplier(wire)).toBe(4); // rot x2 * mir x2; overlay inversion contributes x1
  });

  it("expanderMultiplier: rotation absorbed when it shares a period with swap/invert only (engine fuseableAtSamePeriod rule)", () => {
    // ROTATED_INVERTED, both at period 2: the engine's FusedExecutor absorbs
    // the rotation into the single fused stage (spec-executor.ts), so the
    // total multiplier is 2, NOT 4. (Task 4 discovered this — the naive
    // product-of-periods formula double-counts.)
    const wire = buildLoopSpec(new Set([C.ROTATED, C.INVERTED]), {
      rotationInterval: 2,
    })!;
    expect(expanderMultiplier(wire)).toBe(2);
  });

  it("expanderMultiplier: rotation stays a separate stage when mirror/flip shares its period", () => {
    // rot:2 + mir:2 + inv:2 (today's halved MIR): rotate stage x2, fused group x2 = 4.
    const wire = buildLoopSpec(new Set([C.ROTATED, C.MIRRORED, C.INVERTED]), {
      rotationInterval: 2,
    })!;
    expect(expanderMultiplier(wire)).toBe(4);
    // rot:2 + mir:2 + inv:4 (full triple, independent inversion): x2 * x2 * x4 = 16.
    const triple = buildLoopSpec(new Set([C.ROTATED, C.MIRRORED, C.INVERTED]), {
      rotationInterval: 2, inversionInterval: 4,
    })!;
    expect(expanderMultiplier(triple)).toBe(16);
  });
});
