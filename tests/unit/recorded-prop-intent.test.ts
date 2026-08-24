import { describe, expect, it } from "vitest";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  captureActivePropConfig,
  resolveRecordedPropConfig,
} from "$lib/shared/foundation/services/recorded-prop-intent";
import { hydrate } from "$lib/shared/foundation/services/sequence-hydrator";

describe("recorded prop intent resolution", () => {
  it("prefers creatorIntent over the legacy intendedProp field", () => {
    const sequence = {
      creatorIntent: {
        propConfig: {
          bluePropType: PropType.BUUGENG,
          redPropType: PropType.BUUGENG,
          catDogMode: false,
        },
      },
      intendedProp: {
        bluePropType: PropType.STAFF,
        redPropType: PropType.STAFF,
        catDogMode: false,
      },
    } as SequenceData;

    expect(resolveRecordedPropConfig(sequence)).toEqual({
      bluePropType: PropType.BUUGENG,
      redPropType: PropType.BUUGENG,
      catDogMode: false,
    });
  });

  it("falls back to intendedProp when creatorIntent has no propConfig", () => {
    const sequence = {
      creatorIntent: { effortTimeline: null },
      intendedProp: {
        bluePropType: PropType.CLUB,
        redPropType: PropType.CLUB,
        catDogMode: false,
      },
    } as SequenceData;

    expect(resolveRecordedPropConfig(sequence)).toEqual({
      bluePropType: PropType.CLUB,
      redPropType: PropType.CLUB,
      catDogMode: false,
    });
  });

  it("returns null when no intent is recorded, leaving the caller in visitor context", () => {
    expect(resolveRecordedPropConfig(null)).toBeNull();
    expect(resolveRecordedPropConfig({} as SequenceData)).toBeNull();
  });

  it("treats a half-valid recording as no recording rather than guessing the other hand", () => {
    const sequence = {
      creatorIntent: {
        propConfig: {
          bluePropType: PropType.FAN,
          redPropType: "not-a-prop",
          catDogMode: false,
        },
      },
    } as unknown as SequenceData;

    expect(resolveRecordedPropConfig(sequence)).toBeNull();
  });

  it("infers cat-dog for a mixed pair even when the recorded flag says false", () => {
    const sequence = {
      creatorIntent: {
        propConfig: {
          bluePropType: PropType.BUUGENG,
          redPropType: PropType.CLUB,
          catDogMode: false,
        },
      },
    } as SequenceData;

    expect(resolveRecordedPropConfig(sequence)).toEqual({
      bluePropType: PropType.BUUGENG,
      redPropType: PropType.CLUB,
      catDogMode: true,
    });
  });

  it("ignores per-motion prop types, which public-index hydration bakes to staff", () => {
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

    expect(resolveRecordedPropConfig(sequence)).toBeNull();
  });
});

describe("publication-moment capture from active settings", () => {
  it("captures the per-color pair and infers cat-dog for a mixed pair", () => {
    expect(
      captureActivePropConfig({
        bluePropType: PropType.BUUGENG,
        redPropType: PropType.CLUB,
        catDogMode: false,
      })
    ).toEqual({
      bluePropType: PropType.BUUGENG,
      redPropType: PropType.CLUB,
      catDogMode: true,
    });
  });

  it("falls back to the legacy single propType field, then staff", () => {
    expect(captureActivePropConfig({ propType: PropType.FAN })).toEqual({
      bluePropType: PropType.FAN,
      redPropType: PropType.FAN,
      catDogMode: false,
    });
    expect(captureActivePropConfig({})).toEqual({
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
      catDogMode: false,
    });
  });
});

describe("hydration does not fabricate prop intent", () => {
  it("keeps propConfig absent when only an effort timeline exists", () => {
    const hydrated = hydrate({
      id: "seq",
      word: "AB",
      steps: [],
      effortTimeline: { version: 1, phrases: [] },
    } as unknown as SequenceData);

    expect(hydrated.creatorIntent).toBeDefined();
    expect(hydrated.creatorIntent?.propConfig).toBeUndefined();
    expect(resolveRecordedPropConfig(hydrated)).toBeNull();
  });
});
