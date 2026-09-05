import { describe, expect, it } from "vitest";
import {
  canAffordFlowFestCar,
  createFlowFestDefaultLoadout,
  FLOW_FEST_DEPARTURES,
  FLOW_FEST_DRIVING_ENERGY_DRAIN_PERCENT_PER_MINUTE,
  FLOW_FEST_LOADOUT_CARGO_LITRES,
  FLOW_FEST_LOADOUT_ECONOMY,
  flowFestBudgetFor,
  flowFestCargoFits,
  flowFestDaylightLeftLabel,
  flowFestDepartureProfile,
  flowFestDrivingEnergyDrainPercent,
  isFlowFestLoadoutDrivable,
  restoreFlowFestLoadout,
} from "../../src/lib/features/flow-fest-sim/domain/flow-fest-loadout";
import { FLOW_FEST_CAR_CATALOG } from "../../src/lib/features/flow-fest-sim/domain/flow-fest-car";

describe("Flow Fest loadout", () => {
  it("arrives earlier with less rest and later into golden hour with a queue", () => {
    expect(FLOW_FEST_DEPARTURES.map((entry) => entry.id)).toEqual([
      "early",
      "midday",
      "late",
    ]);
    const early = flowFestDepartureProfile("early");
    const midday = flowFestDepartureProfile("midday");
    const late = flowFestDepartureProfile("late");
    expect(early.clockLabel).toBe("THU · 3:05 PM");
    expect(midday.clockLabel).toBe("THU · 4:37 PM");
    expect(late.clockLabel).toBe("THU · 7:48 PM");
    expect([early, midday, late].map((entry) => entry.arrivalMoment)).toEqual([
      "afternoon",
      "afternoon",
      "golden-hour",
    ]);
    expect([early, midday, late].map((entry) => entry.startingEnergyPercent)).toEqual(
      [70, 85, 95]
    );
    expect([early, midday, late].map((entry) => entry.gateQueueCars)).toEqual([
      0, 1, 3,
    ]);
    // Sunset 8:44 PM: 3:05 → 5 h 39 min, 4:37 → 4 h 07 min, 7:48 → 56 min.
    expect(early.daylightLeftMinutes).toBe(339);
    expect(midday.daylightLeftMinutes).toBe(247);
    expect(late.daylightLeftMinutes).toBe(56);
    expect(flowFestDaylightLeftLabel(339)).toBe("5 h 39 min of daylight");
    expect(flowFestDaylightLeftLabel(247)).toBe("4 h 07 min of daylight");
    expect(flowFestDaylightLeftLabel(56)).toBe("56 min of daylight");
    expect(() => flowFestDepartureProfile("noon" as never)).toThrow(
      /Unknown Flow Fest departure/
    );
  });

  it("subtracts the ticket and the car from the savings", () => {
    expect(FLOW_FEST_LOADOUT_ECONOMY).toEqual({ savingsUsd: 4800, ticketUsd: 320 });
    expect(flowFestBudgetFor("ace-hatchback")).toEqual({
      savingsUsd: 4800,
      ticketUsd: 320,
      carUsd: 1800,
      remainingUsd: 2680,
    });
    // $4,480 after the ticket; the camper lists at $4,500.
    expect(flowFestBudgetFor("t2-camper").remainingUsd).toBe(-20);
    expect(canAffordFlowFestCar("t2-camper")).toBe(false);
    expect(
      FLOW_FEST_CAR_CATALOG.filter((spec) => canAffordFlowFestCar(spec.modelId)).map(
        (spec) => spec.modelId
      )
    ).toEqual([
      "fairheaven-sedan",
      "fairheaven-wagon",
      "lightbody-pickup",
      "bokaroo-suv",
      "ace-hatchback",
    ]);
  });

  it("needs room for the wheel and nothing else yet", () => {
    expect(FLOW_FEST_LOADOUT_CARGO_LITRES).toBe(60);
    for (const spec of FLOW_FEST_CAR_CATALOG) {
      expect(flowFestCargoFits(spec.modelId)).toBe(true);
    }
    const loadout = createFlowFestDefaultLoadout();
    expect(loadout).toEqual({
      characterId: "ch01",
      carModelId: "ace-hatchback",
      paintIndex: 0,
      departure: "midday",
      veteran: false,
      props: [],
    });
    expect(isFlowFestLoadoutDrivable(loadout)).toBe(true);
    expect(
      isFlowFestLoadoutDrivable({ ...loadout, carModelId: "t2-camper" })
    ).toBe(false);
  });

  it("restores only loadouts that name a real car, paint, and departure", () => {
    const loadout = createFlowFestDefaultLoadout();
    expect(restoreFlowFestLoadout(loadout)).toEqual(loadout);
    expect(restoreFlowFestLoadout(loadout)).not.toBe(loadout);
    expect(
      restoreFlowFestLoadout({ ...loadout, carModelId: "hovercraft" })
    ).toBeNull();
    // The hatchback has four paints; the camper has none.
    expect(restoreFlowFestLoadout({ ...loadout, paintIndex: 3 })).not.toBeNull();
    expect(restoreFlowFestLoadout({ ...loadout, paintIndex: 4 })).toBeNull();
    expect(
      restoreFlowFestLoadout({ ...loadout, carModelId: "t2-camper", paintIndex: 0 })
    ).not.toBeNull();
    expect(
      restoreFlowFestLoadout({ ...loadout, carModelId: "t2-camper", paintIndex: 1 })
    ).toBeNull();
    expect(restoreFlowFestLoadout({ ...loadout, departure: "noon" })).toBeNull();
    expect(restoreFlowFestLoadout({ ...loadout, characterId: "" })).toBeNull();
    expect(restoreFlowFestLoadout({ ...loadout, props: [7] })).toBeNull();
    expect(restoreFlowFestLoadout(null)).toBeNull();
  });

  it("drains three percent of energy per driving minute", () => {
    expect(FLOW_FEST_DRIVING_ENERGY_DRAIN_PERCENT_PER_MINUTE).toBe(3);
    expect(flowFestDrivingEnergyDrainPercent(5)).toBeCloseTo(0.25, 9);
    expect(flowFestDrivingEnergyDrainPercent(120)).toBe(6);
  });
});
