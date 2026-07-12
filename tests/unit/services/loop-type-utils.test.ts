import { describe, expect, it } from "vitest";
import {
  generateLOOPType,
  parseLoopComponents,
  isImplementedCombo,
  canExtendCombo,
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
