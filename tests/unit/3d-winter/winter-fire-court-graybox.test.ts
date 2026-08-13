import { describe, expect, it } from "vitest";
import layout from "../../../scripts/winter-fire-court-graybox-r1.json";

type Point2 = readonly [number, number];

const distance = (left: Point2, right: Point2) =>
  Math.hypot(left[0] - right[0], left[1] - right[1]);

const ellipseRadiusAt = (
  center: Point2,
  radiusX: number,
  radiusZ: number,
  point: Point2
) => {
  const angle = Math.atan2(point[1] - center[1], point[0] - center[0]);
  return (
    (radiusX * radiusZ) /
    Math.hypot(radiusZ * Math.cos(angle), radiusX * Math.sin(angle))
  );
};

describe("Winter fire-court graybox revision", () => {
  it("authors the approved ten-friend gathering without crowd drift", () => {
    expect(layout.friends).toHaveLength(layout.requirements.friendCount);
    expect(
      layout.friends.filter(({ role }) => role === "spinner")
    ).toHaveLength(layout.requirements.spinnerCount);
    expect(layout.friends.filter(({ role }) => role === "seated")).toHaveLength(
      layout.requirements.seatedCount
    );
    expect(
      layout.friends.filter(({ role }) => role === "standing")
    ).toHaveLength(layout.requirements.standingCount);
    expect(layout.furnishings).not.toHaveProperty("benchSegments");
    expect(layout.furnishings).not.toHaveProperty("propRack");
  });

  it("keeps all three spinners inside the court with safe spacing", () => {
    const spinners = layout.friends.filter(({ role }) => role === "spinner");
    const center = layout.court.center as Point2;

    for (const spinner of spinners) {
      const position = spinner.position as Point2;
      const normalizedDistance = Math.hypot(
        (position[0] - center[0]) / layout.court.radiusX,
        (position[1] - center[1]) / layout.court.radiusZ
      );
      expect(normalizedDistance).toBeLessThan(0.72);
    }

    for (let left = 0; left < spinners.length; left += 1) {
      for (let right = left + 1; right < spinners.length; right += 1) {
        expect(
          distance(
            spinners[left].position as Point2,
            spinners[right].position as Point2
          )
        ).toBeGreaterThanOrEqual(
          layout.requirements.minimumSpinnerSpacingMetres
        );
      }
    }
  });

  it("faces every performer toward the audience side of the court", () => {
    const spinners = layout.friends.filter(({ role }) => role === "spinner");

    for (const spinner of spinners) {
      expect(spinner.facingDegrees).toBe(layout.court.performerFacingDegrees);
    }
  });

  it("holds the audience outside the fire court edge", () => {
    const center = layout.court.center as Point2;
    const audience = layout.friends.filter(({ role }) => role === "standing");

    for (const friend of audience) {
      const position = friend.position as Point2;
      const radialDistance = distance(center, position);
      const courtRadius = ellipseRadiusAt(
        center,
        layout.court.radiusX,
        layout.court.radiusZ,
        position
      );
      expect(radialDistance - courtRadius).toBeGreaterThanOrEqual(
        layout.requirements.minimumStandingCourtEdgeClearanceMetres
      );
    }
  });

  it("turns every audience member toward the performance core", () => {
    const center = layout.court.center as Point2;
    const audience = layout.friends.filter(({ role }) => role !== "spinner");

    for (const friend of audience) {
      const expectedFacing = Math.atan2(
        center[0] - friend.position[0],
        center[1] - friend.position[1]
      );
      const authoredFacing = (friend.facingDegrees * Math.PI) / 180;
      const angularError = Math.abs(
        Math.atan2(
          Math.sin(authoredFacing - expectedFacing),
          Math.cos(authoredFacing - expectedFacing)
        )
      );
      expect(angularError).toBeLessThan((2 * Math.PI) / 180);
    }
  });

  it("keeps the fire court separate from the frozen pond", () => {
    const courtPondClearance =
      distance(layout.court.center as Point2, layout.pond.center as Point2) -
      layout.court.radiusX -
      layout.pond.radiusX;
    expect(courtPondClearance).toBeGreaterThanOrEqual(
      layout.requirements.minimumCourtPondClearanceMetres
    );
  });

  it("connects the court entry to the primary lodge route", () => {
    const route = layout.paths.find(
      ({ id }) => id === "fire-court-to-lodge-spur"
    );
    expect(route).toBeDefined();
    expect(route).toHaveProperty("connectsToPathId", "stage-to-lodge");

    const [courtEntry, , routeConnection] = route!.points;
    const courtEdge = [
      layout.court.center[0] + layout.court.radiusX,
      layout.court.center[1],
    ] as Point2;
    expect(distance(courtEntry as Point2, courtEdge)).toBeLessThanOrEqual(
      layout.requirements.maximumCourtEntryPathGapMetres
    );
    expect(distance(routeConnection as Point2, [-6, -9])).toBeLessThanOrEqual(
      layout.requirements.maximumPrimaryRouteConnectionGapMetres
    );
    expect(layout.furnishings.routeLanterns).toHaveLength(3);
    expect(layout).not.toHaveProperty("practiceWing");
  });
});
