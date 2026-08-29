import { describe, expect, it } from "vitest";
import {
  FLOW_FEST_CAMP_ROAD_ENTRANCE,
  FLOW_FEST_LOWER_CAMPGROUND_LOOP,
  FLOW_FEST_LOWER_CHECK_IN,
  FLOW_FEST_LOWER_ENTRANCE_APRON,
  FLOW_FEST_LOWER_ENTRANCE_APPROACH,
  FLOW_FEST_LOWER_ENTRANCE_BASIS,
  FLOW_FEST_LOWER_GATEHOUSE_SITE,
  FLOW_FEST_LOWER_LOOP_ENTRANCE_INTERIOR,
  FLOW_FEST_LOWER_LOOP_ENTRANCE_TANGENT,
  FLOW_FEST_LOWER_LOOP_ROAD_CROSSING,
} from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";
import {
  FLOW_FEST_ENTRANCE_REFERENCE,
  FLOW_FEST_ENTRANCE_REVIEW_CAMERAS,
  FLOW_FEST_ENTRANCE_VIEW_IDS,
  flowFestEntranceLocalToWorld,
  flowFestEntranceWorldToLocal,
  parseFlowFestEntranceReferenceRequest,
  pointInsideFlowFestEntranceFixtureClearance,
} from "../../src/routes/test/flow-fest-sim/flow-fest-entrance-reference";

function pointInsidePolygon(
  point: { x: number; z: number },
  polygon: ReadonlyArray<{ x: number; z: number }>
): boolean {
  let inside = false;
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const start = polygon[index]!;
    const end = polygon[previous]!;
    const crosses =
      start.z > point.z !== end.z > point.z &&
      point.x <
        ((end.x - start.x) * (point.z - start.z)) / (end.z - start.z) + start.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToPolyline(
  point: { x: number; z: number },
  line: ReadonlyArray<{ x: number; z: number }>
): number {
  return Math.min(
    ...line.slice(1).map((end, index) => {
      const start = line[index]!;
      const deltaX = end.x - start.x;
      const deltaZ = end.z - start.z;
      const lengthSquared = deltaX * deltaX + deltaZ * deltaZ;
      const progress = Math.min(
        1,
        Math.max(
          0,
          ((point.x - start.x) * deltaX + (point.z - start.z) * deltaZ) /
            lengthSquared
        )
      );
      return Math.hypot(
        point.x - (start.x + deltaX * progress),
        point.z - (start.z + deltaZ * progress)
      );
    })
  );
}

function segmentIntersection(
  firstStart: { x: number; z: number },
  firstEnd: { x: number; z: number },
  secondStart: { x: number; z: number },
  secondEnd: { x: number; z: number }
): { x: number; z: number } | null {
  const first = {
    x: firstEnd.x - firstStart.x,
    z: firstEnd.z - firstStart.z,
  };
  const second = {
    x: secondEnd.x - secondStart.x,
    z: secondEnd.z - secondStart.z,
  };
  const cross = first.x * second.z - first.z * second.x;
  if (Math.abs(cross) < 1e-9) return null;
  const offset = {
    x: secondStart.x - firstStart.x,
    z: secondStart.z - firstStart.z,
  };
  const firstProgress = (offset.x * second.z - offset.z * second.x) / cross;
  const secondProgress = (offset.x * first.z - offset.z * first.x) / cross;
  if (
    firstProgress < -1e-9 ||
    firstProgress > 1 + 1e-9 ||
    secondProgress < -1e-9 ||
    secondProgress > 1 + 1e-9
  ) {
    return null;
  }
  return {
    x: firstStart.x + first.x * firstProgress,
    z: firstStart.z + first.z * firstProgress,
  };
}

function pointKey(point: { x: number; z: number }): string {
  return `${point.x.toFixed(4)}:${point.z.toFixed(4)}`;
}

describe("Flow Fest entrance reference", () => {
  it("registers the four fixed Street View comparison cameras", () => {
    expect(
      FLOW_FEST_ENTRANCE_REVIEW_CAMERAS.map((camera) => camera.id)
    ).toEqual(FLOW_FEST_ENTRANCE_VIEW_IDS);
    expect(
      new Set(
        FLOW_FEST_ENTRANCE_REVIEW_CAMERAS.map((camera) =>
          camera.positionWorld.join(":")
        )
      ).size
    ).toBe(4);
    expect(
      FLOW_FEST_ENTRANCE_REVIEW_CAMERAS.every(
        (camera, index) =>
          camera.horizontalFovDegrees ===
          FLOW_FEST_ENTRANCE_REFERENCE.views[index]?.sourceView.fovDegrees
      )
    ).toBe(true);
  });

  it("keeps the model registered to the shared entrance coordinate authority", () => {
    expect(flowFestEntranceLocalToWorld({ right: 0, depth: 0 })).toEqual(
      FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.entranceWorld
    );
    const localGatehouse =
      FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.gatehouse.localCenter;
    const worldGatehouse = flowFestEntranceLocalToWorld(localGatehouse);
    expect(flowFestEntranceWorldToLocal(worldGatehouse)).toMatchObject({
      right: expect.closeTo(localGatehouse.right, 5),
      depth: expect.closeTo(localGatehouse.depth, 5),
    });
    expect(
      pointInsideFlowFestEntranceFixtureClearance(worldGatehouse, 3.5)
    ).toBe(true);
    expect(
      pointInsideFlowFestEntranceFixtureClearance({ x: 360, z: -20 }, 3.5)
    ).toBe(false);
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.coordinateAuthority.roadFeatureObjectId
    ).toBe(3019609);
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.coordinateAuthority.entranceLandmarkId
    ).toBe("camp-road-entrance");
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.registration.roadSnapOffsetMeters
    ).toBeLessThan(1);
    expect(FLOW_FEST_ENTRANCE_REFERENCE.registration.naipRasterObjectId).toBe(
      146870
    );
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.driveInwardUnit.x
    ).toBeLessThan(0);
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.driveInwardUnit.z
    ).toBeLessThan(0);
    expect(FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.fence.rails).toBe(3);
    expect(FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.fence.rightRunMeters).toBe(
      64
    );
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.gatehouse.widthMeters
    ).toBeLessThan(10);
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.gatehouse.ridgeHeightMeters
    ).toBeLessThan(5);
    expect(FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.driveInwardUnit).toEqual(
      FLOW_FEST_LOWER_ENTRANCE_BASIS.driveInwardUnit
    );
    expect(FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.driveRightUnit).toEqual(
      FLOW_FEST_LOWER_ENTRANCE_BASIS.driveRightUnit
    );
    expect(worldGatehouse.x).toBeCloseTo(FLOW_FEST_LOWER_GATEHOUSE_SITE.x, 8);
    expect(worldGatehouse.z).toBeCloseTo(FLOW_FEST_LOWER_GATEHOUSE_SITE.z, 8);
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.views.every(
        (view) =>
          Math.hypot(
            view.camera.targetWorld[0]! - FLOW_FEST_LOWER_GATEHOUSE_SITE.x,
            view.camera.targetWorld[2]! - FLOW_FEST_LOWER_GATEHOUSE_SITE.z
          ) < 0.002
      )
    ).toBe(true);
  });

  it("terminates at one degree-three loop junction and keeps fixtures behind it", () => {
    expect(FLOW_FEST_LOWER_ENTRANCE_APPROACH[0]).toEqual(
      FLOW_FEST_CAMP_ROAD_ENTRANCE
    );
    expect(FLOW_FEST_LOWER_ENTRANCE_APPROACH.at(-1)).toEqual(
      FLOW_FEST_LOWER_LOOP_ROAD_CROSSING
    );
    expect(FLOW_FEST_LOWER_ENTRANCE_APPROACH).toHaveLength(2);
    expect(FLOW_FEST_LOWER_ENTRANCE_APRON[0]).toEqual(
      FLOW_FEST_LOWER_LOOP_ROAD_CROSSING
    );
    expect(FLOW_FEST_LOWER_ENTRANCE_APRON.at(-1)).toEqual(
      FLOW_FEST_LOWER_CHECK_IN
    );

    const intersectionKeys = new Set(
      FLOW_FEST_LOWER_CAMPGROUND_LOOP.slice(1)
        .map((end, index) =>
          segmentIntersection(
            FLOW_FEST_LOWER_ENTRANCE_APPROACH[0]!,
            FLOW_FEST_LOWER_ENTRANCE_APPROACH[1]!,
            FLOW_FEST_LOWER_CAMPGROUND_LOOP[index]!,
            end
          )
        )
        .filter((point): point is { x: number; z: number } => point !== null)
        .map(pointKey)
    );
    expect(intersectionKeys).toEqual(
      new Set([pointKey(FLOW_FEST_LOWER_LOOP_ROAD_CROSSING)])
    );

    const degree = new Map<string, number>();
    const addEdge = (
      start: { x: number; z: number },
      end: { x: number; z: number }
    ) => {
      degree.set(pointKey(start), (degree.get(pointKey(start)) ?? 0) + 1);
      degree.set(pointKey(end), (degree.get(pointKey(end)) ?? 0) + 1);
    };
    FLOW_FEST_LOWER_CAMPGROUND_LOOP.slice(1).forEach((end, index) =>
      addEdge(FLOW_FEST_LOWER_CAMPGROUND_LOOP[index]!, end)
    );
    addEdge(
      FLOW_FEST_LOWER_ENTRANCE_APPROACH[0]!,
      FLOW_FEST_LOWER_ENTRANCE_APPROACH[1]!
    );
    expect(degree.get(pointKey(FLOW_FEST_LOWER_LOOP_ROAD_CROSSING))).toBe(3);
    expect(
      FLOW_FEST_LOWER_CAMPGROUND_LOOP.slice(1, -1).every(
        (point) => degree.get(pointKey(point)) === 2
      )
    ).toBe(true);

    const gatehouseOffset = {
      x:
        FLOW_FEST_LOWER_GATEHOUSE_SITE.x - FLOW_FEST_LOWER_LOOP_ROAD_CROSSING.x,
      z:
        FLOW_FEST_LOWER_GATEHOUSE_SITE.z - FLOW_FEST_LOWER_LOOP_ROAD_CROSSING.z,
    };
    expect(
      gatehouseOffset.x * FLOW_FEST_LOWER_LOOP_ENTRANCE_INTERIOR.x +
        gatehouseOffset.z * FLOW_FEST_LOWER_LOOP_ENTRANCE_INTERIOR.z
    ).toBeCloseTo(14, 8);
    expect(
      gatehouseOffset.x * FLOW_FEST_LOWER_LOOP_ENTRANCE_TANGENT.x +
        gatehouseOffset.z * FLOW_FEST_LOWER_LOOP_ENTRANCE_TANGENT.z
    ).toBeCloseTo(0, 8);
    expect(
      pointInsidePolygon(
        FLOW_FEST_LOWER_GATEHOUSE_SITE,
        FLOW_FEST_LOWER_CAMPGROUND_LOOP
      )
    ).toBe(true);
    expect(
      pointInsidePolygon(
        FLOW_FEST_LOWER_CHECK_IN,
        FLOW_FEST_LOWER_CAMPGROUND_LOOP
      )
    ).toBe(true);

    const gatehouse = FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.gatehouse;
    const requiredRoadClearance =
      1.9 + Math.hypot(gatehouse.widthMeters, gatehouse.depthMeters) / 2 + 2;
    expect(
      distanceToPolyline(
        FLOW_FEST_LOWER_GATEHOUSE_SITE,
        FLOW_FEST_LOWER_CAMPGROUND_LOOP
      )
    ).toBeGreaterThan(requiredRoadClearance);
    expect(
      Math.hypot(
        FLOW_FEST_LOWER_CHECK_IN.x - FLOW_FEST_LOWER_GATEHOUSE_SITE.x,
        FLOW_FEST_LOWER_CHECK_IN.z - FLOW_FEST_LOWER_GATEHOUSE_SITE.z
      )
    ).toBeGreaterThan(gatehouse.widthMeters / 2 + 2);
    expect(
      distanceToPolyline(
        FLOW_FEST_LOWER_GATEHOUSE_SITE,
        FLOW_FEST_LOWER_ENTRANCE_APRON
      ) - FLOW_FEST_ENTRANCE_REFERENCE.siteLayout.driveway.loopHalfWidthMeters
    ).toBeLessThan(3);
    expect(
      pointInsideFlowFestEntranceFixtureClearance(FLOW_FEST_LOWER_CHECK_IN, 0)
    ).toBe(true);
  });

  it("locks every view to one inspected panorama without storing its imagery", () => {
    const panoramaIds = new Set(
      FLOW_FEST_ENTRANCE_REFERENCE.views.map(
        (view) => view.sourceView.panoramaId
      )
    );
    expect(panoramaIds).toEqual(
      new Set([FLOW_FEST_ENTRANCE_REFERENCE.sourceReference.panoramaId])
    );
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.sourceReference.storagePolicy
    ).toContain("not copied into the repository");
    expect(
      FLOW_FEST_ENTRANCE_REFERENCE.views.every(
        (view) =>
          view.expectedScreenRegions.length > 0 &&
          view.baselineDiscrepancies.length > 0
      )
    ).toBe(true);
  });

  it("parses valid and unknown capture-view requests deterministically", () => {
    const valid = parseFlowFestEntranceReferenceRequest(
      new URLSearchParams("reference=entrance-road-right")
    );
    expect(valid).toMatchObject({
      enabled: true,
      requestedId: "entrance-road-right",
      view: { id: "entrance-road-right" },
    });

    const unknown = parseFlowFestEntranceReferenceRequest(
      new URLSearchParams("reference=entrance-missing")
    );
    expect(unknown).toEqual({
      enabled: true,
      requestedId: "entrance-missing",
      view: null,
    });
  });
});
