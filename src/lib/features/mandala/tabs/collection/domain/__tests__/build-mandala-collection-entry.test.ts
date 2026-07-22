import { describe, expect, it } from "vitest";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import { buildMandalaCollectionEntry } from "../build-mandala-collection-entry";

const step = { stepNumber: 1 } as StepData;

describe("buildMandalaCollectionEntry", () => {
  it("keeps the selected variant, path shape, props, and simplified lineage", () => {
    const steps = [step];
    const entry = buildMandalaCollectionEntry(
      {
        steps,
        variant: "blue",
        bluePropType: "club",
        redPropType: "staff",
        pathShape: "linear",
        sequenceWord: "FΨFΨFΨFΨ",
      },
      4
    );

    expect(entry).toMatchObject({
      name: "FΨ",
      variant: "blue",
      bluePropType: "club",
      redPropType: "staff",
      pathShape: "linear",
      source: "sequence",
      sourceWord: "FΨ",
    });
    expect(entry.steps).toEqual([step]);
    expect(entry.steps).not.toBe(steps);
  });

  it("numbers an unnamed mandala from the current collection count", () => {
    const entry = buildMandalaCollectionEntry(
      {
        steps: [],
        variant: "both",
        bluePropType: "staff",
        redPropType: "staff",
        pathShape: "arc",
        sequenceWord: "",
      },
      2
    );

    expect(entry.name).toBe("Mandala #3");
    expect(entry.sourceWord).toBeUndefined();
  });
});
