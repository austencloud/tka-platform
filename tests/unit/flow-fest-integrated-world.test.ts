import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditFlowFestIntegratedJourney,
  createFlowFestIntegratedJourney,
  identifyFlowFestIntegratedArea,
  observeFlowFestIntegratedArea,
  restoreFlowFestIntegratedJourney,
  setFlowFestIntegratedJourneyBranch,
} from "$lib/features/flow-fest-sim/domain/flow-fest-integrated-world";
import { computeFlowFestSiteAudioMix } from "$lib/features/flow-fest-sim/domain/flow-fest-site-audio";
import {
  parseFlowFestRuntimeContract,
  type FlowFestBranchId,
  type FlowFestRuntimeContract,
} from "../../src/routes/test/flow-fest-graybox/flow-fest-runtime-contract";

const FINGERPRINT = "gate5-contract";

function readContract(): FlowFestRuntimeContract {
  return parseFlowFestRuntimeContract(
    JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "static/data/flow-fest-sim/gate2-runtime-contract.json"
        ),
        "utf8"
      )
    ) as unknown
  );
}

describe("Flow Fest Gate 5 integrated world", () => {
  it.each<FlowFestBranchId>(["lower-tent", "upper-tent", "car-camp"])(
    "recognizes registered landmarks for the %s branch",
    (branch) => {
      const contract = readContract();
      const campZoneId =
        branch === "lower-tent"
          ? "lower-tent-zone"
          : branch === "upper-tent"
            ? "upper-tent-zone"
            : "car-camp-zone";
      const camp = contract.zones.find((zone) => zone.id === campZoneId)!;
      const lowerGate = contract.zones.find(
        (zone) => zone.id === "lower-gate-zone"
      )!;

      expect(
        identifyFlowFestIntegratedArea(contract, branch, lowerGate.center)
      ).toBe("lower-gate");
      expect(
        identifyFlowFestIntegratedArea(contract, branch, camp.center)
      ).toBe("selected-camp");
      expect(
        identifyFlowFestIntegratedArea(contract, branch, { x: 100, z: -115 })
      ).toBe("festival");
    }
  );

  it("proves entry, exit, re-entry, backtracking, and the camp return", () => {
    let state = createFlowFestIntegratedJourney(FINGERPRINT, "lower-tent");
    for (const area of [
      "lower-gate",
      "transit",
      "selected-camp",
      "transit",
      "festival",
      "transit",
      "selected-camp",
      "transit",
      "festival",
    ] as const) {
      state = observeFlowFestIntegratedArea(state, area);
    }

    expect(auditFlowFestIntegratedJourney(state)).toMatchObject({
      festivalEntries: 2,
      festivalExits: 1,
      backtrackingConfirmed: true,
      festivalReentryConfirmed: true,
      campReturnConfirmed: true,
      completeArrivalNightReturn: true,
    });
  });

  it("restores only the matching source-locked journey", () => {
    let state = createFlowFestIntegratedJourney(FINGERPRINT);
    state = setFlowFestIntegratedJourneyBranch(state, "upper-tent");
    state = observeFlowFestIntegratedArea(state, "lower-gate");
    state = observeFlowFestIntegratedArea(state, "selected-camp");

    expect(restoreFlowFestIntegratedJourney(state, FINGERPRINT)).toEqual(state);
    expect(restoreFlowFestIntegratedJourney(state, "new-contract")).toBeNull();
    expect(
      restoreFlowFestIntegratedJourney(
        { ...state, areaHistory: ["lower-gate", "lower-gate"] },
        FINGERPRINT
      )
    ).toBeNull();
  });

  it("crossfades one site mix from arrival to camp to the fire circle", () => {
    const layout = {
      gateCenter: { x: 340, z: -20 },
      campCenter: { x: 286, z: -130 },
      fireCenter: { x: 89, z: -113.5 },
      ledCircleCenter: { x: 120, z: -103 },
    };

    expect(
      computeFlowFestSiteAudioMix(layout, layout.gateCenter, "not-started", 0.7)
        .dominantLayer
    ).toBe("arrival-field");
    expect(
      computeFlowFestSiteAudioMix(layout, layout.campCenter, "not-started", 0.7)
        .dominantLayer
    ).toBe("camp");
    const fire = computeFlowFestSiteAudioMix(
      layout,
      layout.fireCenter,
      "active",
      0.7
    );
    expect(fire.dominantLayer).toBe("fire-circle");
    expect(fire.fire).toBe(1);
    expect(fire.master).toBe(0.7);
  });
});
