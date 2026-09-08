import { describe, expect, it } from "vitest";
import {
  FLOW_FEST_GATE_QUEUE_SLOTS,
  flowFestGateQueueCars,
  flowFestLowerEntranceWorldToLocal,
  isFlowFestGateArrival,
} from "../../src/routes/test/flow-fest-sim/flow-fest-camp-plan";
import { flowFestCarSpec } from "../../src/lib/features/flow-fest-sim/domain/flow-fest-car";
import {
  flowFestParkedCarModel,
  flowFestParkedCarPaintCount,
} from "../../src/routes/test/flow-fest-sim/flow-fest-parked-car-catalog";
import { FLOW_FEST_DEPARTURES } from "../../src/lib/features/flow-fest-sim/domain/flow-fest-loadout";

describe("Flow Fest gate queue", () => {
  it("lines the cars up on the entrance drive, nearest the gatehouse first", () => {
    const queue = flowFestGateQueueCars(3);
    expect(queue).toHaveLength(3);
    // The surveyed slots sit one metre right of the drive centreline at
    // 18.5, 12.5 and 6.5 m inside the entrance, all nosed at the gatehouse.
    const local = queue.map((car) => flowFestLowerEntranceWorldToLocal(car));
    expect(local.map((point) => Number(point.depth.toFixed(2)))).toEqual([
      18.5, 12.5, 6.5,
    ]);
    local.forEach((point) => expect(point.right).toBeCloseTo(1, 6));
    queue.forEach((car, index) => {
      const slot = FLOW_FEST_GATE_QUEUE_SLOTS[index]!;
      expect(car.x).toBe(slot.x);
      expect(car.z).toBe(slot.z);
      expect(car.headingRadians).toBe(slot.headingRadians);
      expect(car.headingRadians).toBeCloseTo(-2.1881, 3);
      // Every queued car is inside the arrival apron the drive in ends on.
      expect(isFlowFestGateArrival(car)).toBe(true);
      // Real catalogue bodies with a real paint variant each.
      expect(flowFestCarSpec(car.modelId).modelId).toBe(car.modelId);
      expect(car.paintIndex).toBeGreaterThanOrEqual(0);
      expect(car.paintIndex).toBeLessThan(
        flowFestParkedCarPaintCount(flowFestParkedCarModel(car.modelId))
      );
    });
    expect(new Set(queue.map((car) => car.modelId)).size).toBe(3);
  });

  it("matches every departure profile and never exceeds the surveyed slots", () => {
    for (const profile of FLOW_FEST_DEPARTURES) {
      expect(flowFestGateQueueCars(profile.gateQueueCars)).toHaveLength(
        profile.gateQueueCars
      );
    }
    expect(flowFestGateQueueCars(0)).toEqual([]);
    expect(flowFestGateQueueCars(-2)).toEqual([]);
    expect(flowFestGateQueueCars(7)).toHaveLength(
      FLOW_FEST_GATE_QUEUE_SLOTS.length
    );
    // A one-car queue is the front of the three-car queue: the car nearest
    // the gatehouse, not the one nearest the road.
    expect(flowFestGateQueueCars(1)[0]).toEqual(flowFestGateQueueCars(3)[0]);
  });
});
