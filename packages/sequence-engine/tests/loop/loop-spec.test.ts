import { describe, it, expect } from "vitest";
import {
  LOOPComponent,
  type LOOPSpec,
  type ComponentSpec,
  loopSpecToWire,
  loopSpecFromWire,
  loopSpecPeriod,
  loopSpecFromLegacy,
  singleComponent,
  symmetricSpec,
  allActiveComponents,
  isEmptySpec,
  specsAreEqual,
  validateLOOPSpec,
  EMPTY_PROP_SPEC,
} from "../../src/loop/loop-spec.js";

describe("loopSpecToWire / loopSpecFromWire", () => {
  it("round-trips a symmetric spec", () => {
    const components = new Map<LOOPComponent, ComponentSpec>([
      [LOOPComponent.ROTATED, { period: 4 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
    ]);
    const spec: LOOPSpec = symmetricSpec(components);
    const wire = loopSpecToWire(spec);
    const hydrated = loopSpecFromWire(wire);

    expect(hydrated.left!.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
    expect(hydrated.left!.components.get(LOOPComponent.MIRRORED)!.period).toBe(2);
    expect(hydrated.right!.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
    expect(hydrated.right!.components.get(LOOPComponent.MIRRORED)!.period).toBe(2);
  });

  it("round-trips an asymmetric spec", () => {
    const spec: LOOPSpec = {
      left: undefined,
      right: singleComponent(LOOPComponent.ROTATED, 4),
    };
    const wire = loopSpecToWire(spec);
    const hydrated = loopSpecFromWire(wire);

    expect(hydrated.left).toBeUndefined();
    expect(hydrated.right!.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
  });

  it("preserves domain field", () => {
    const spec: LOOPSpec = {
      left: singleComponent(LOOPComponent.MIRRORED, 2, "orientation"),
    };
    const wire = loopSpecToWire(spec);
    const hydrated = loopSpecFromWire(wire);

    expect(hydrated.left!.components.get(LOOPComponent.MIRRORED)!.domain).toBe(
      "orientation",
    );
  });

  it("omits domain when absent", () => {
    const spec: LOOPSpec = {
      left: singleComponent(LOOPComponent.ROTATED, 4),
    };
    const wire = loopSpecToWire(spec);
    expect(wire.left!["rotated"]).toEqual({ period: 4 });
    expect(wire.left!["rotated"].domain).toBeUndefined();
  });
});

describe("loopSpecPeriod", () => {
  it("returns 1 for empty spec", () => {
    expect(loopSpecPeriod({})).toBe(1);
  });

  it("returns single component period", () => {
    const spec: LOOPSpec = symmetricSpec(
      new Map([[LOOPComponent.MIRRORED, { period: 2 }]]),
    );
    expect(loopSpecPeriod(spec)).toBe(2);
  });

  it("returns LCM across props", () => {
    const spec: LOOPSpec = {
      left: singleComponent(LOOPComponent.ROTATED, 4),
      right: singleComponent(LOOPComponent.MIRRORED, 2),
    };
    expect(loopSpecPeriod(spec)).toBe(4);
  });

  it("returns LCM of different periods within one prop", () => {
    const components = new Map<LOOPComponent, ComponentSpec>([
      [LOOPComponent.ROTATED, { period: 4 }],
      [LOOPComponent.INVERTED, { period: 2 }],
    ]);
    const spec: LOOPSpec = { left: { components } };
    expect(loopSpecPeriod(spec)).toBe(4);
  });

  it("handles period 8", () => {
    const spec: LOOPSpec = {
      left: singleComponent(LOOPComponent.ROTATED, 8),
      right: singleComponent(LOOPComponent.MIRRORED, 4),
    };
    expect(loopSpecPeriod(spec)).toBe(8);
  });
});

describe("loopSpecFromLegacy", () => {
  it("parses mirrored_rotated with period 4", () => {
    const spec = loopSpecFromLegacy("mirrored_rotated", 4);
    expect(spec.left!.components.has(LOOPComponent.MIRRORED)).toBe(true);
    expect(spec.left!.components.has(LOOPComponent.ROTATED)).toBe(true);
    expect(spec.left!.components.get(LOOPComponent.MIRRORED)!.period).toBe(4);
    expect(spec.left!.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
    expect(specsAreEqual(spec.left, spec.right)).toBe(true);
  });

  it("parses single component", () => {
    const spec = loopSpecFromLegacy("rotated", 2);
    expect(spec.left!.components.size).toBe(1);
    expect(spec.left!.components.has(LOOPComponent.ROTATED)).toBe(true);
  });

  it("parses mirrored_rotated_inverted_swapped", () => {
    const spec = loopSpecFromLegacy("mirrored_rotated_inverted_swapped", 2);
    expect(spec.left!.components.size).toBe(4);
    expect(spec.left!.components.has(LOOPComponent.MIRRORED)).toBe(true);
    expect(spec.left!.components.has(LOOPComponent.ROTATED)).toBe(true);
    expect(spec.left!.components.has(LOOPComponent.INVERTED)).toBe(true);
    expect(spec.left!.components.has(LOOPComponent.SWAPPED)).toBe(true);
  });

  it("parses rewound", () => {
    const spec = loopSpecFromLegacy("rewound", 2);
    expect(spec.left!.components.size).toBe(1);
    expect(spec.left!.components.has(LOOPComponent.REWOUND)).toBe(true);
  });
});

describe("helper constructors", () => {
  it("singleComponent builds correct PropLOOPSpec", () => {
    const prop = singleComponent(LOOPComponent.ROTATED, 4);
    expect(prop.components.size).toBe(1);
    expect(prop.components.get(LOOPComponent.ROTATED)!.period).toBe(4);
  });

  it("symmetricSpec shares both props", () => {
    const components = new Map<LOOPComponent, ComponentSpec>([
      [LOOPComponent.MIRRORED, { period: 2 }],
    ]);
    const spec = symmetricSpec(components);
    expect(spec.left).toBe(spec.right);
  });

  it("allActiveComponents merges with max period", () => {
    const spec: LOOPSpec = {
      left: singleComponent(LOOPComponent.ROTATED, 2),
      right: singleComponent(LOOPComponent.ROTATED, 4),
    };
    const active = allActiveComponents(spec);
    expect(active.get(LOOPComponent.ROTATED)!.period).toBe(4);
  });

  it("isEmptySpec is true for no components", () => {
    expect(isEmptySpec({})).toBe(true);
    expect(isEmptySpec({ left: EMPTY_PROP_SPEC })).toBe(true);
  });

  it("isEmptySpec is false when components exist", () => {
    expect(
      isEmptySpec({ left: singleComponent(LOOPComponent.ROTATED, 2) }),
    ).toBe(false);
  });
});

describe("specsAreEqual", () => {
  it("equal when both undefined", () => {
    expect(specsAreEqual(undefined, undefined)).toBe(true);
  });

  it("not equal when one undefined", () => {
    expect(
      specsAreEqual(singleComponent(LOOPComponent.ROTATED, 2), undefined),
    ).toBe(false);
  });

  it("equal with same components and periods", () => {
    const a = singleComponent(LOOPComponent.ROTATED, 4);
    const b = singleComponent(LOOPComponent.ROTATED, 4);
    expect(specsAreEqual(a, b)).toBe(true);
  });

  it("not equal with different periods", () => {
    const a = singleComponent(LOOPComponent.ROTATED, 2);
    const b = singleComponent(LOOPComponent.ROTATED, 4);
    expect(specsAreEqual(a, b)).toBe(false);
  });
});

describe("validateLOOPSpec", () => {
  it("passes valid spec", () => {
    const spec = symmetricSpec(
      new Map([[LOOPComponent.MIRRORED, { period: 2 }]]),
    );
    expect(validateLOOPSpec(spec)).toHaveLength(0);
  });

  it("catches period < 2", () => {
    const spec: LOOPSpec = {
      left: singleComponent(LOOPComponent.ROTATED, 1),
    };
    const errors = validateLOOPSpec(spec);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.rule).toBe("minimum_period");
  });

  it("catches REWOUND composing with other components", () => {
    const components = new Map<LOOPComponent, ComponentSpec>([
      [LOOPComponent.REWOUND, { period: 2 }],
      [LOOPComponent.MIRRORED, { period: 2 }],
    ]);
    const spec: LOOPSpec = { left: { components } };
    const errors = validateLOOPSpec(spec);
    expect(errors.some((e) => e.rule === "rewound_exclusivity")).toBe(true);
  });

  it("catches SWAPPED asymmetry", () => {
    const spec: LOOPSpec = {
      left: singleComponent(LOOPComponent.SWAPPED, 2),
      right: singleComponent(LOOPComponent.ROTATED, 2),
    };
    const errors = validateLOOPSpec(spec);
    expect(errors.some((e) => e.rule === "swapped_symmetry")).toBe(true);
  });

  it("catches SWAPPED period mismatch", () => {
    const spec: LOOPSpec = {
      left: singleComponent(LOOPComponent.SWAPPED, 2),
      right: singleComponent(LOOPComponent.SWAPPED, 4),
    };
    const errors = validateLOOPSpec(spec);
    expect(errors.some((e) => e.rule === "swapped_symmetry")).toBe(true);
  });
});
