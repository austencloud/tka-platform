import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeRng } from "$lib/shared/foundation/utils/seeded-rng";
import { parseFlowFestRuntimeContract } from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";
import {
  allFlowFestCampPlanLines,
  createFlowFestCampPlan,
  flowFestCampPlanLineToRuntimeSegment,
  FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY,
} from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";
import { deriveFlowFestLowerCampOccupancy } from "../../src/routes/test/flow-fest-sim/flow-fest-lower-camp-occupancy";

const contract = parseFlowFestRuntimeContract(
  JSON.parse(
    readFileSync(
      "static/data/flow-fest-sim/gate2-runtime-contract.json",
      "utf8"
    )
  )
);
const plan = createFlowFestCampPlan(contract, "car-camp");
const loop = plan.internalDrives.find(
  (drive) => drive.id === "lower-campground-loop"
)!;
const routes = allFlowFestCampPlanLines(plan).map(
  flowFestCampPlanLineToRuntimeSegment
);

describe("Flow Fest lower campground occupancy", () => {
  it("derives deterministic car, roadside, and tree-line bands from the loop", () => {
    const first = deriveFlowFestLowerCampOccupancy({
      rng: makeRng(20260828),
      loop,
      routes,
    });
    const second = deriveFlowFestLowerCampOccupancy({
      rng: makeRng(20260828),
      loop,
      routes,
    });

    expect(first).toEqual(second);
    expect(first.centerVehicles).toHaveLength(
      FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.centerVehicleCount
    );
    expect(first.centerTents).toHaveLength(
      FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.centerTentCount
    );
    expect(first.innerRoadsideTents).toHaveLength(
      FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.innerRoadsideTentCount
    );
    expect(first.outerTreeLineTents).toHaveLength(
      FLOW_FEST_LOWER_CAMPGROUND_OCCUPANCY.outerTreeLineTentCount
    );
    expect(first.audit).toMatchObject({
      centerVehicleOutsideLoopCount: 0,
      centerVehicleAisleIntrusionCount: 0,
      innerRoadsideTentOutsideLoopCount: 0,
      outerTreeLineTentInsideLoopCount: 0,
    });
    expect(first.audit.centerVehicleEmptyStallCount).toBeGreaterThan(0);
  });

  it("parks the middle in rows with mixed bodies, mixed facing, and tents off tailgates", () => {
    const layout = deriveFlowFestLowerCampOccupancy({
      rng: makeRng(20260828),
      loop,
      routes,
    });
    const rows = new Set(layout.centerVehicles.map((car) => car.row));
    expect(rows.size).toBe(3);
    expect(
      new Set(layout.centerVehicles.map((car) => car.modelId)).size
    ).toBeGreaterThanOrEqual(5);
    expect(
      layout.centerVehicles.filter((car) => car.facing === "backed-in").length
    ).toBeGreaterThan(0);
    expect(
      layout.centerVehicles.filter((car) => car.crooked).length
    ).toBe(3);
    for (const row of rows) {
      const rowCars = layout.centerVehicles
        .filter((car) => car.row === row)
        .sort((first, second) => first.stall - second.stall);
      for (let index = 1; index < rowCars.length; index += 1) {
        expect(rowCars[index]!.modelId).not.toBe(rowCars[index - 1]!.modelId);
      }
    }
    for (const tent of layout.centerTents) {
      const nearestCar = Math.min(
        ...layout.centerVehicles.map((car) =>
          Math.hypot(car.x - tent.x, car.z - tent.z)
        )
      );
      expect(nearestCar).toBeGreaterThanOrEqual(3.2);
      expect(nearestCar).toBeLessThan(4.8);
    }
  });
});
