import { describe, expect, it } from "vitest";
import { StartPositionManager } from "$lib/shared/create/services/start-position-manager";
import {
  GridLocation,
  GridMode,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getPlacementGridPoints } from "$lib/shared/pictograph/grid/services/placement-grid-points";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import {
  MotionColor,
  Orientation,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

describe("direct start-position placement", () => {
  const manager = new StartPositionManager();

  it("round-trips through the same schema as a preset", () => {
    const preset = manager
      .getAllStartPositionVariations(GridMode.DIAMOND)
      .find((position) => position.startPosition === GridPosition.ALPHA7);
    expect(preset).toBeDefined();

    const built = manager.createStartPositionFromLocations({
      blueLocation: GridLocation.EAST,
      redLocation: GridLocation.WEST,
      gridMode: GridMode.DIAMOND,
      id: preset!.id,
    });

    expect(built).toEqual(preset);
  });

  it("keeps independent prop types and orientations", () => {
    const built = manager.createStartPositionFromLocations({
      blueLocation: GridLocation.WEST,
      redLocation: GridLocation.WEST,
      gridMode: GridMode.DIAMOND,
      blueOrientation: Orientation.OUT,
      redOrientation: Orientation.CLOCK,
      bluePropType: PropType.TORCH,
      redPropType: PropType.BIGTORCH,
      id: "built-pose",
    });

    expect(built.startPosition).toBe(GridPosition.BETA7);
    expect(built.endPosition).toBe(GridPosition.BETA7);
    expect(built.motions[MotionColor.BLUE]).toMatchObject({
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.WEST,
      startOrientation: Orientation.OUT,
      endOrientation: Orientation.OUT,
      propType: PropType.TORCH,
    });
    expect(built.motions[MotionColor.RED]).toMatchObject({
      startLocation: GridLocation.WEST,
      endLocation: GridLocation.WEST,
      startOrientation: Orientation.CLOCK,
      endOrientation: Orientation.CLOCK,
      propType: PropType.BIGTORCH,
    });
  });

  it("builds Nick's two-torch outward horizontal pose directly", () => {
    const built = manager.createStartPositionFromLocations({
      blueLocation: GridLocation.EAST,
      redLocation: GridLocation.WEST,
      gridMode: GridMode.DIAMOND,
      blueOrientation: Orientation.OUT,
      redOrientation: Orientation.OUT,
      bluePropType: PropType.TORCH,
      redPropType: PropType.TORCH,
      id: "nick-horizontal-torches",
    });

    expect(built.startPosition).toBe(GridPosition.ALPHA7);
    expect(built.motions[MotionColor.BLUE]).toMatchObject({
      startLocation: GridLocation.EAST,
      startOrientation: Orientation.OUT,
      propType: PropType.TORCH,
    });
    expect(built.motions[MotionColor.RED]).toMatchObject({
      startLocation: GridLocation.WEST,
      startOrientation: Orientation.OUT,
      propType: PropType.TORCH,
    });
  });

  it("uses the canonical rendered hand points for both supported grids", () => {
    expect(getPlacementGridPoints(GridMode.DIAMOND)).toEqual([
      { location: GridLocation.NORTH, label: "North", x: 475, y: 331.9 },
      { location: GridLocation.EAST, label: "East", x: 618.1, y: 475 },
      { location: GridLocation.SOUTH, label: "South", x: 475, y: 618.1 },
      { location: GridLocation.WEST, label: "West", x: 331.9, y: 475 },
    ]);

    expect(getPlacementGridPoints(GridMode.BOX)).toEqual([
      {
        location: GridLocation.NORTHEAST,
        label: "Northeast",
        x: 576.2,
        y: 373.8,
      },
      {
        location: GridLocation.SOUTHEAST,
        label: "Southeast",
        x: 576.2,
        y: 576.2,
      },
      {
        location: GridLocation.SOUTHWEST,
        label: "Southwest",
        x: 373.8,
        y: 576.2,
      },
      {
        location: GridLocation.NORTHWEST,
        label: "Northwest",
        x: 373.8,
        y: 373.8,
      },
    ]);
  });
});
