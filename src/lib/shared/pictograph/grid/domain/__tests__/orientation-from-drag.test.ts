import { describe, expect, it } from "vitest";
import { GridLocation, GridMode } from "../enums/grid-enums";
import { Orientation } from "../../../shared/domain/enums/pictograph-enums";
import {
  DRAG_AIM_DEAD_ZONE,
  aimDirectionsFor,
  orientationFromDrag,
} from "../orientation-from-drag";

/**
 * SVG user space: +x is east, +y is SOUTH. Every vector below is written in
 * that space, so `dy: -FAR` means dragging upward on screen, toward north.
 */
const FAR = 200;

function aim(
  location: GridLocation,
  dx: number,
  dy: number,
  gridMode: GridMode = GridMode.DIAMOND
) {
  return orientationFromDrag({ location, gridMode, dx, dy });
}

describe("orientationFromDrag", () => {
  it("reads a drag from east toward north as counter", () => {
    // The case that defined the feature: press east, pull up, get counter.
    expect(aim(GridLocation.EAST, 0, -FAR)).toBe(Orientation.COUNTER);
  });

  it("reads a drag toward the center as in, and away from it as out", () => {
    expect(aim(GridLocation.EAST, -FAR, 0)).toBe(Orientation.IN);
    expect(aim(GridLocation.EAST, FAR, 0)).toBe(Orientation.OUT);
  });

  it("reads a drag from east toward south as clock", () => {
    expect(aim(GridLocation.EAST, 0, FAR)).toBe(Orientation.CLOCK);
  });

  it("keeps in and out pointing through the center at every cardinal", () => {
    // Toward center is always in; directly away is always out. Written as
    // vectors from each point back through the middle of the grid.
    expect(aim(GridLocation.NORTH, 0, FAR)).toBe(Orientation.IN);
    expect(aim(GridLocation.NORTH, 0, -FAR)).toBe(Orientation.OUT);
    expect(aim(GridLocation.SOUTH, 0, -FAR)).toBe(Orientation.IN);
    expect(aim(GridLocation.WEST, FAR, 0)).toBe(Orientation.IN);
  });

  it("snaps a sloppy diagonal to the nearest of the four", () => {
    // 20° off north from the east point still means counter.
    const dx = FAR * Math.sin((20 * Math.PI) / 180);
    const dy = -FAR * Math.cos((20 * Math.PI) / 180);
    expect(aim(GridLocation.EAST, dx, dy)).toBe(Orientation.COUNTER);
  });

  it("works on the box grid's intercardinal points", () => {
    // Northeast: toward center is southwest.
    expect(
      aim(GridLocation.NORTHEAST, -FAR, FAR, GridMode.BOX)
    ).toBe(Orientation.IN);
    expect(
      aim(GridLocation.NORTHEAST, FAR, -FAR, GridMode.BOX)
    ).toBe(Orientation.OUT);
  });

  it("returns null inside the dead zone so a tap never re-aims", () => {
    expect(aim(GridLocation.EAST, 0, 0)).toBeNull();
    expect(aim(GridLocation.EAST, 0, -(DRAG_AIM_DEAD_ZONE - 1))).toBeNull();
    expect(aim(GridLocation.EAST, 0, -(DRAG_AIM_DEAD_ZONE + 1))).toBe(
      Orientation.COUNTER
    );
  });

  it("returns null at the center, where there is no outward", () => {
    expect(aim(GridLocation.CENTER, 0, -FAR)).toBeNull();
  });
});

describe("aimDirectionsFor", () => {
  it("offers exactly the four orientations the snap can return", () => {
    const directions = aimDirectionsFor(GridLocation.EAST, GridMode.DIAMOND);
    expect(directions.map((d) => d.orientation)).toEqual([
      Orientation.IN,
      Orientation.OUT,
      Orientation.CLOCK,
      Orientation.COUNTER,
    ]);
  });

  it("points each tick where that orientation actually renders", () => {
    const directions = aimDirectionsFor(GridLocation.EAST, GridMode.DIAMOND);
    const byOrientation = new Map(
      directions.map((d) => [d.orientation, d.angle])
    );

    // 0=east, 90=south, 180=west, 270=north.
    expect(byOrientation.get(Orientation.IN)).toBe(180);
    expect(byOrientation.get(Orientation.OUT)).toBe(0);
    expect(byOrientation.get(Orientation.CLOCK)).toBe(90);
    expect(byOrientation.get(Orientation.COUNTER)).toBe(270);
  });

  it("has no directions at the center", () => {
    expect(aimDirectionsFor(GridLocation.CENTER, GridMode.DIAMOND)).toEqual([]);
  });
});
