import { describe, expect, it } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import {
  parsePropsFromURL,
  parsePropTypeFromURLValue,
} from "$lib/shared/navigation/services/sequence-encoder";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { resolveScanPropConfig } from "$lib/shared/qr/services/scan-prop-resolver";

describe("scan prop resolution", () => {
  it("accepts compact and full-value prop parameters from printed cards", () => {
    expect(parsePropsFromURL(new URLSearchParams("bp=P&rp=fan"))).toEqual({
      bluePropType: PropType.POI,
      redPropType: PropType.FAN,
    });
    expect(parsePropTypeFromURLValue("not-a-prop")).toBeUndefined();
  });

  it("keeps the highest-priority per-scan values for each hand", () => {
    const sequence = {
      intendedProp: {
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
        catDogMode: false,
      },
    } as SequenceData;

    expect(
      resolveScanPropConfig(
        sequence,
        {
          bluePropType: "P",
          redPropType: PropType.CLUB,
          catDogMode: true,
        },
        { bluePropType: PropType.FAN, redPropType: PropType.FAN }
      )
    ).toEqual({
      bluePropType: PropType.POI,
      redPropType: PropType.CLUB,
      catDogMode: true,
    });
  });

  it("recovers historical prop data from sequence motions", () => {
    const sequence = {
      steps: [
        {
          motions: {
            blue: { propType: PropType.TRIAD },
            red: { propType: PropType.BUUGENG },
          },
        },
      ],
    } as SequenceData;

    expect(resolveScanPropConfig(sequence)).toEqual({
      bluePropType: PropType.TRIAD,
      redPropType: PropType.BUUGENG,
      catDogMode: false,
    });
  });
});
