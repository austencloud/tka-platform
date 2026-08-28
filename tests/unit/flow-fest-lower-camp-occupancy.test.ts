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
    expect(first.audit).toEqual({
      centerVehicleOutsideLoopCount: 0,
      innerRoadsideTentOutsideLoopCount: 0,
      outerTreeLineTentInsideLoopCount: 0,
    });
  });
});
