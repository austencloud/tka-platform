import { describe, expect, it } from "vitest";
import {
  FLOW_FEST_ENTRANCE_REFERENCE,
  FLOW_FEST_ENTRANCE_REVIEW_CAMERAS,
  FLOW_FEST_ENTRANCE_VIEW_IDS,
  flowFestEntranceLocalToWorld,
  flowFestEntranceWorldToLocal,
  parseFlowFestEntranceReferenceRequest,
  pointInsideFlowFestEntranceFixtureClearance,
} from "../../src/routes/test/flow-fest-sim/flow-fest-entrance-reference";

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
        (camera) =>
          camera.horizontalFovDegrees >= 50 && camera.horizontalFovDegrees <= 70
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
