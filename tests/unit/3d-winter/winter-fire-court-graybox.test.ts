import { describe, expect, it } from "vitest";
import layout from "../../../scripts/winter-fire-court-graybox-r1.json";

type Point2 = readonly [number, number];

const distance = (left: Point2, right: Point2) =>
  Math.hypot(left[0] - right[0], left[1] - right[1]);

const pointToSegmentDistance = (point: Point2, start: Point2, end: Point2) => {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const lengthSquared = dx * dx + dz * dz;
  const amount = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / lengthSquared
    )
  );
  return distance(point, [start[0] + dx * amount, start[1] + dz * amount]);
};

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
    expect(
      layout.friends.filter(({ role }) => role === "rack-tender")
    ).toHaveLength(layout.requirements.rackTenderCount);
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

  it("holds the audience outside the fire court edge", () => {
    const center = layout.court.center as Point2;
    const audience = layout.friends.filter(({ role }) => role !== "spinner");

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
        layout.requirements.minimumAudienceCourtEdgeClearanceMetres
      );
    }
  });

  it("places the arrival spine between the court and frozen pond", () => {
    const primaryPath = layout.paths.find(
      ({ id }) => id === "south-entry-to-lodge"
    );
    expect(primaryPath).toBeDefined();

    const courtCenter = layout.court.center as Point2;
    const pathPoints = primaryPath!.points.map(([x, z]) => [x, z] as Point2);
    const pathDistance = Math.min(
      ...pathPoints
        .slice(1)
        .map((point, index) =>
          pointToSegmentDistance(courtCenter, pathPoints[index], point)
        )
    );
    const pathEdgeClearance =
      pathDistance - layout.court.radiusX - primaryPath!.width / 2;
    expect(pathEdgeClearance).toBeGreaterThanOrEqual(
      layout.requirements.minimumPrimaryPathCourtClearanceMetres
    );

    const courtPondClearance =
      distance(layout.court.center as Point2, layout.pond.center as Point2) -
      layout.court.radiusX -
      layout.pond.radiusX;
    expect(courtPondClearance).toBeGreaterThanOrEqual(
      layout.requirements.minimumCourtPondClearanceMetres
    );
  });

  it("attaches the indoor practice wing to the existing lodge", () => {
    const lodgeLeft = layout.lodge.center[0] - layout.lodge.footprint[0] / 2;
    const wingRight =
      layout.practiceWing.center[0] + layout.practiceWing.footprint[0] / 2;
    const overlap = wingRight - lodgeLeft;

    expect(overlap).toBeGreaterThanOrEqual(
      layout.requirements.minimumPracticeWingAttachmentOverlapMetres
    );
    expect(layout.practiceWing.wallHeight).toBeGreaterThan(4);
  });
});
