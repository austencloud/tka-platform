import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { FlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import {
  createFlowFestCampPlan,
  FLOW_FEST_CAMDEN_COLLEGE_CORNER_ROAD,
  FLOW_FEST_LOWER_CAMPGROUND_LOOP,
  FLOW_FEST_ORTHOPHOTO_SOURCE,
  FLOW_FEST_PUBLIC_ROAD_SOURCE,
  identifyFlowFestPlanLocation,
} from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";
import {
  createFlowFestMinimapModel,
  flowFestMapHeadingDegrees,
  projectFlowFestWorldPoint,
} from "../../src/routes/test/flow-fest-sim/flow-fest-minimap";

const bounds = { minX: -160, maxX: 380, minZ: -170, maxZ: 40 };

describe("Flow Fest minimap", () => {
  it("projects the measured world frame north-up and clamps off-site points", () => {
    expect(
      projectFlowFestWorldPoint({ x: -160, z: -170 }, bounds, {
        width: 640,
        height: 260,
        padding: 18,
      })
    ).toEqual({ x: 18, y: 18 });
    expect(
      projectFlowFestWorldPoint({ x: 380, z: 40 }, bounds, {
        width: 640,
        height: 260,
        padding: 18,
      })
    ).toEqual({ x: 622, y: 242 });
    expect(
      projectFlowFestWorldPoint({ x: 900, z: -900 }, bounds, {
        width: 640,
        height: 260,
        padding: 18,
      })
    ).toEqual({ x: 622, y: 18 });
  });

  it("keeps the player arrow aligned with the x-east, z-south world frame", () => {
    expect(flowFestMapHeadingDegrees(0)).toBe(180);
    expect(flowFestMapHeadingDegrees(Math.PI / 2)).toBe(90);
    expect(flowFestMapHeadingDegrees(Math.PI)).toBe(0);
    expect(flowFestMapHeadingDegrees(-Math.PI / 2)).toBe(270);
  });

  it("selects the player's actual camping branch for the camp landmark", () => {
    const point = (x: number, z: number) => ({
      x,
      z,
      sourceTerrainY: 0,
      reviewTerrainY: 0,
    });
    const lowerAccess = {
      id: "lower-tent-unload",
      mode: "vehicle" as const,
      widthMeters: 3,
      lengthMeters: 10,
      sourceClasses: ["imagery-interpreted"],
      pathClass: "registered",
      points: [point(340, -20), point(286, -130)],
    };
    const contract = {
      surfaceEvidenceProxy: { activeBoundsWorldMeters: bounds },
      routes: {
        arrivalBranches: {
          "lower-tent": { segments: [lowerAccess] },
          "upper-tent": { segments: [] },
          "car-camp": { segments: [] },
        },
        nightReturnBranches: {
          "lower-tent": { points: [] },
          "upper-tent": { points: [] },
          "car-camp": { points: [] },
        },
      },
      connectorTraces: {
        upperClearingToMiddleEarth: { vertices: [] },
        middleEarthToLowerClearing: { vertices: [] },
      },
      zones: [
        { id: "lower-gate-zone", center: point(340, -20) },
        { id: "lower-tent-zone", center: point(286, -130) },
        { id: "upper-tent-zone", center: point(-62, -74) },
        { id: "car-camp-zone", center: point(255, -130) },
        { id: "west-upper-parking-zone", center: point(-110, -30) },
        { id: "middle-earth-zone", center: point(100, -115) },
        { id: "night-heart-zone", center: point(100, -115) },
      ],
    } as unknown as FlowFestRuntimeContract;

    const model = createFlowFestMinimapModel(contract, "upper-tent");
    const camp = model.landmarks.find(
      (landmark) => landmark.id === "selected-camp"
    );
    const plan = createFlowFestCampPlan(contract, "upper-tent");
    const expected = projectFlowFestWorldPoint({ x: -62, z: -74 }, plan.bounds);

    expect(camp?.point).toEqual(expected);
  });

  it("anchors the plan to ODOT road geometry without upgrading camp paths to official data", () => {
    expect(FLOW_FEST_PUBLIC_ROAD_SOURCE).toMatchObject({
      agency: "Ohio Department of Transportation",
      featureObjectId: 3019609,
      projectedCrs: "EPSG:26916",
    });
    expect(FLOW_FEST_CAMDEN_COLLEGE_CORNER_ROAD.at(0)).toEqual({
      x: -170,
      z: 21,
    });
    expect(FLOW_FEST_CAMDEN_COLLEGE_CORNER_ROAD.at(-1)).toEqual({
      x: 370,
      z: -157.5,
    });

    const point = (x: number, z: number) => ({
      x,
      z,
      sourceTerrainY: 0,
      reviewTerrainY: 0,
    });
    const sharedDrive = {
      id: "lower-tent-unload",
      mode: "vehicle" as const,
      widthMeters: 3,
      lengthMeters: 10,
      sourceClasses: ["interpreted"],
      pathClass: "orthophoto-interpreted",
      points: [point(340, -20), point(300, 10)],
    };
    const contract = {
      surfaceEvidenceProxy: { activeBoundsWorldMeters: bounds },
      routes: {
        arrivalBranches: {
          "lower-tent": { segments: [sharedDrive] },
          "upper-tent": { segments: [sharedDrive] },
          "car-camp": { segments: [sharedDrive] },
        },
      },
      connectorTraces: {
        upperClearingToMiddleEarth: { vertices: [point(-60, -70)] },
        middleEarthToLowerClearing: { vertices: [point(100, -110)] },
      },
      zones: [
        { id: "lower-gate-zone", center: point(340, -20) },
        { id: "lower-tent-zone", center: point(286, -130) },
        { id: "upper-tent-zone", center: point(-62, -74) },
        { id: "car-camp-zone", center: point(255, -130) },
        { id: "west-upper-parking-zone", center: point(-110, -30) },
        { id: "middle-earth-zone", center: point(100, -115) },
      ],
    } as unknown as FlowFestRuntimeContract;
    const plan = createFlowFestCampPlan(contract, "car-camp");

    expect(plan.publicRoads).toHaveLength(1);
    expect(plan.publicRoads[0]?.evidence).toBe("official-road-inventory");
    expect(plan.internalDrives).toHaveLength(4);
    expect(
      plan.internalDrives.every(
        (line) => line.evidence !== "official-road-inventory"
      )
    ).toBe(true);
    expect(
      plan.internalDrives.find((line) => line.id === "lower-campground-loop")
    ).toMatchObject({ evidence: "public-orthophoto" });
    expect(
      plan.internalDrives.some((line) => line.id === "check-in-to-lower-level")
    ).toBe(false);
    expect(
      plan.internalDrives
        .find((line) => line.id === "camp-road-entrance-to-check-in")
        ?.points.at(-1)
    ).toEqual(FLOW_FEST_LOWER_CAMPGROUND_LOOP[0]);
    expect(
      plan.footConnectors.every((line) => line.evidence === "austen-traced")
    ).toBe(true);
    expect(FLOW_FEST_ORTHOPHOTO_SOURCE).toMatchObject({
      agency: "USDA-FSA-APFO",
      acquisitionDate: "2023-05-22",
      groundSampleDistanceMeters: 0.3,
    });
  });

  it("keeps roads, access turns, clearings, and the cornfield in one location model", () => {
    const contract = JSON.parse(
      readFileSync(
        "static/data/flow-fest-sim/gate2-runtime-contract.json",
        "utf8"
      )
    ) as FlowFestRuntimeContract;
    const plan = createFlowFestCampPlan(contract, "lower-tent");

    expect(plan.landmarks.map((landmark) => landmark.id)).toEqual(
      expect.arrayContaining([
        "camp-road-entrance",
        "lower-check-in-gate",
        "west-parking-gate",
        "west-upper-parking",
        "lower-level",
        "south-cornfield",
      ])
    );
    expect(
      plan.regions.find((region) => region.id === "south-crop-field-region")
    ).toMatchObject({
      kind: "crop-field",
      evidence: "austen-observed-topology",
      shape: "polygon",
    });
    expect(
      identifyFlowFestPlanLocation(plan, {
        x: 328.2557337440163,
        z: -98.15506248891917,
      })
    ).toMatchObject({ id: "camp-road-entrance", eyebrow: "Entrance" });
    expect(identifyFlowFestPlanLocation(plan, { x: 170, z: 2 })).toMatchObject({
      id: "odot-camden-college-corner-road",
      label: "Camden College Corner Rd",
      kind: "public-road",
    });
    expect(
      identifyFlowFestPlanLocation(plan, { x: 320, z: -145 })
    ).toMatchObject({
      id: "lower-level",
      label: "Lower level",
    });
  });
});
