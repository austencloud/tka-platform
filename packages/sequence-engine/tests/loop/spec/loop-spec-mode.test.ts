import { describe, expect, it } from "vitest";
import {
  LOOPComponent,
  loopSpecToWire,
  loopSpecFromWire,
  validateLOOPSpec,
  type LOOPSpec,
} from "../../../src/loop/loop-spec.js";

function symmetric(components: Array<[LOOPComponent, { period: number; mode?: "expand" | "overlay" }]>): LOOPSpec {
  const map = new Map(components);
  return { blue: { components: map }, red: { components: map } };
}

describe("ComponentSpec.mode", () => {
  it("round-trips mode through wire format", () => {
    const spec = symmetric([
      [LOOPComponent.ROTATED, { period: 2 }],
      [LOOPComponent.INVERTED, { period: 4, mode: "overlay" }],
    ]);
    const back = loopSpecFromWire(loopSpecToWire(spec));
    expect(back.blue!.components.get(LOOPComponent.INVERTED)!.mode).toBe("overlay");
    expect(back.blue!.components.get(LOOPComponent.ROTATED)!.mode).toBeUndefined();
  });

  it("accepts overlay on INVERTED", () => {
    const spec = symmetric([[LOOPComponent.INVERTED, { period: 4, mode: "overlay" }]]);
    expect(validateLOOPSpec(spec)).toEqual([]);
  });

  it("rejects overlay on location-moving components", () => {
    const spec = symmetric([[LOOPComponent.MIRRORED, { period: 2, mode: "overlay" }]]);
    const errors = validateLOOPSpec(spec);
    expect(errors.some((e) => e.rule === "overlay_legality")).toBe(true);
  });
});
