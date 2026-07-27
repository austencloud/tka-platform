import { describe, expect, it } from "vitest";
import {
  LOOPComponent,
  loopSpecFromLegacyRhythm,
} from "../../src/loop/loop-spec.js";

function periods(
  loopType: string,
  rotationPeriod: number
): Map<string, number> {
  const spec = loopSpecFromLegacyRhythm(loopType, rotationPeriod);
  return new Map(
    [...(spec.blue?.components ?? [])].map(([component, componentSpec]) => [
      component,
      componentSpec.period,
    ])
  );
}

describe("loopSpecFromLegacyRhythm", () => {
  it("applies quartered rhythm only to rotation in a composite LOOP", () => {
    expect(periods("mirrored_rotated_inverted_swapped", 4)).toEqual(
      new Map([
        [LOOPComponent.ROTATED, 4],
        [LOOPComponent.MIRRORED, 2],
        [LOOPComponent.SWAPPED, 2],
        [LOOPComponent.INVERTED, 2],
      ])
    );
  });

  it("keeps non-rotational transforms halved for a quartered request", () => {
    expect(periods("mirrored_inverted_swapped", 4)).toEqual(
      new Map([
        [LOOPComponent.MIRRORED, 2],
        [LOOPComponent.SWAPPED, 2],
        [LOOPComponent.INVERTED, 2],
      ])
    );
  });

  it("keeps every transform halved for a halved request", () => {
    expect(periods("mirrored_rotated_inverted_swapped", 2)).toEqual(
      new Map([
        [LOOPComponent.ROTATED, 2],
        [LOOPComponent.MIRRORED, 2],
        [LOOPComponent.SWAPPED, 2],
        [LOOPComponent.INVERTED, 2],
      ])
    );
  });

  it("keeps rewound as a two-pass cycle", () => {
    expect(periods("rewound", 4)).toEqual(
      new Map([[LOOPComponent.REWOUND, 2]])
    );
  });
});
