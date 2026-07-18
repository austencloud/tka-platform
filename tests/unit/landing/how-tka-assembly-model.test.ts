import { describe, expect, it } from "vitest";
import {
  ASSEMBLY_STEPS,
  getInitialAssemblyStep,
  getNextAssemblyStep,
  shouldEnableAssemblyPlayback,
} from "../../../src/routes/landing/components/how-tka-assembly-model";

describe("How TKA assembly model", () => {
  it("keeps the approved six-step order and labels", () => {
    expect(ASSEMBLY_STEPS.map(({ value, label }) => ({ value, label }))).toEqual([
      { value: "grid", label: "The grid" },
      { value: "hands", label: "Place the hands" },
      { value: "props", label: "Add the props" },
      { value: "motion", label: "Add motion" },
      { value: "sequence", label: "Build the sequence" },
      { value: "playback", label: "Play it back" },
    ]);
  });

  it("starts reduced-motion visitors on the completed pictograph", () => {
    expect(getInitialAssemblyStep(false)).toBe("grid");
    expect(getInitialAssemblyStep(true)).toBe("motion");
  });

  it("advances once through the sequence and then stops", () => {
    expect(getNextAssemblyStep("grid")).toBe("hands");
    expect(getNextAssemblyStep("motion")).toBe("sequence");
    expect(getNextAssemblyStep("sequence")).toBe("playback");
    expect(getNextAssemblyStep("playback")).toBeNull();
  });

  it("enables playback only when all three visibility conditions are true", () => {
    expect(
      shouldEnableAssemblyPlayback({
        active: true,
        sectionVisible: true,
        documentVisible: true,
      })
    ).toBe(true);
    expect(
      shouldEnableAssemblyPlayback({
        active: false,
        sectionVisible: true,
        documentVisible: true,
      })
    ).toBe(false);
    expect(
      shouldEnableAssemblyPlayback({
        active: true,
        sectionVisible: false,
        documentVisible: true,
      })
    ).toBe(false);
    expect(
      shouldEnableAssemblyPlayback({
        active: true,
        sectionVisible: true,
        documentVisible: false,
      })
    ).toBe(false);
  });
});
