import { describe, expect, it } from "vitest";
import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  buildPlacementPictographData,
  buildPlacementPrompt,
  calculatePlacementBetaOffsets,
  computeGammaGuideArc,
  getPlacementGuideCoordinates,
} from "$lib/shared/pictograph/grid/services/prop-placement-view-model";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  MotionColor,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

describe("prop placement view model", () => {
  it("selects the prompt for placement, hover, live aiming, and completion", () => {
    const base = {
      disabled: false,
      isComplete: false,
      canAim: true,
      activeColor: MotionColor.BLUE as MotionColor | null,
      dragColor: null as MotionColor | null,
      dragAim: null as Orientation | null,
      hoverColor: null as MotionColor | null,
      blueLocation: null,
      redLocation: null,
      blueNoun: "left prop",
      redNoun: "right prop",
    };

    expect(buildPlacementPrompt(base).text).toBe(
      "Press a point and drag to aim the left prop"
    );
    expect(
      buildPlacementPrompt({
        ...base,
        activeColor: null,
        hoverColor: MotionColor.RED,
      }).text
    ).toBe("Drag to aim the right prop");
    expect(
      buildPlacementPrompt({
        ...base,
        dragColor: MotionColor.BLUE,
        dragAim: Orientation.COUNTER,
      }).text
    ).toBe("Aiming the left prop: Counter");
    expect(
      buildPlacementPrompt({
        ...base,
        isComplete: true,
        activeColor: null,
      }).text
    ).toBe("Drag a prop to aim it");
  });

  it("builds live placement motions without losing preview notation", () => {
    const result = buildPlacementPictographData({
      gridMode: GridMode.DIAMOND,
      blueLocation: GridLocation.NORTH,
      redLocation: GridLocation.SOUTH,
      blueOrientation: Orientation.IN,
      redOrientation: Orientation.OUT,
      bluePropType: PropType.STAFF,
      redPropType: PropType.FAN,
      betaSwapped: false,
      previewPictographData: {
        id: "preview-id",
        letter: "A",
      } as never,
    });

    expect(result.id).toBe("preview-id");
    expect(result.letter).toBe("A");
    expect(result.motions[MotionColor.BLUE]?.startLocation).toBe(
      GridLocation.NORTH
    );
    expect(result.motions[MotionColor.RED]?.endOrientation).toBe(
      Orientation.OUT
    );
  });

  it("mirrors the canonical beta offsets when the pair is swapped", () => {
    const input = {
      gridMode: GridMode.DIAMOND,
      blueLocation: GridLocation.EAST,
      redLocation: GridLocation.EAST,
      blueOrientation: Orientation.IN,
      redOrientation: Orientation.IN,
      bluePropType: PropType.STAFF,
      redPropType: PropType.STAFF,
    };
    const normal = calculatePlacementBetaOffsets({
      ...input,
      betaSwapped: false,
    });
    const swapped = calculatePlacementBetaOffsets({
      ...input,
      betaSwapped: true,
    });

    expect(swapped.blue.x).toBeCloseTo(-normal.blue.x);
    expect(swapped.blue.y).toBeCloseTo(-normal.blue.y);
    expect(swapped.red.x).toBeCloseTo(-normal.red.x);
    expect(swapped.red.y).toBeCloseTo(-normal.red.y);
  });

  it("derives guide coordinates and the gamma arc from canonical grid points", () => {
    const coordinates = getPlacementGuideCoordinates({
      blue: GridLocation.NORTH,
      red: GridLocation.EAST,
    });

    expect(coordinates?.blue.location).toBe(GridLocation.NORTH);
    expect(coordinates?.red.location).toBe(GridLocation.EAST);
    expect(computeGammaGuideArc(coordinates)).toMatch(/^M .+ A 60 60 /);
    expect(computeGammaGuideArc(null)).toBe("");
  });
});
