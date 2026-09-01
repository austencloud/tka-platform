import { describe, expect, it } from "vitest";
import {
  minimumInlineControlsHeight,
  selectOptionControlsPresentation,
} from "$lib/features/create/construct/option-picker/services/option-controls-presentation";

describe("Construct option controls presentation", () => {
  it("keeps controls inline in a tall narrow pane", () => {
    expect(
      selectOptionControlsPresentation({
        hasControls: true,
        wideInlineEligible: false,
        containerHeight: 1847,
        hasTurnRows: true,
      })
    ).toBe("compact-inline");
  });

  it("uses disclosure only when the option surface would become too short", () => {
    const withoutTurns = minimumInlineControlsHeight(false);
    const withTurns = minimumInlineControlsHeight(true);

    expect(withoutTurns).toBe(424);
    expect(withTurns).toBe(560);

    expect(
      selectOptionControlsPresentation({
        hasControls: true,
        wideInlineEligible: false,
        containerHeight: withoutTurns - 1,
        hasTurnRows: false,
      })
    ).toBe("disclosed");
    expect(
      selectOptionControlsPresentation({
        hasControls: true,
        wideInlineEligible: false,
        containerHeight: withoutTurns,
        hasTurnRows: false,
      })
    ).toBe("compact-inline");
    expect(
      selectOptionControlsPresentation({
        hasControls: true,
        wideInlineEligible: false,
        containerHeight: withTurns - 1,
        hasTurnRows: true,
      })
    ).toBe("disclosed");
    expect(
      selectOptionControlsPresentation({
        hasControls: true,
        wideInlineEligible: false,
        containerHeight: withTurns,
        hasTurnRows: true,
      })
    ).toBe("compact-inline");
  });

  it("preserves the full desktop header when its width contract is met", () => {
    expect(
      selectOptionControlsPresentation({
        hasControls: true,
        wideInlineEligible: true,
        containerHeight: 360,
        hasTurnRows: true,
      })
    ).toBe("wide-inline");
  });

  it("renders no settings surface when the host exposes no controls", () => {
    expect(
      selectOptionControlsPresentation({
        hasControls: false,
        wideInlineEligible: false,
        containerHeight: 1200,
        hasTurnRows: false,
      })
    ).toBe("hidden");
  });
});
