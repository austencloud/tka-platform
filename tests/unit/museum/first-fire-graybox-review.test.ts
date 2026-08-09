import { describe, expect, it } from "vitest";
import { buildFirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";
import {
  FIRST_FIRE_NEUTRAL_BLACKOUT_MS,
  advanceFirstFireGrayboxProof,
  createFirstFireGrayboxReviewState,
  displayedFirstFireShrine,
  firstFireOrbitZoneThresholds,
  updateFirstFireGrayboxReview,
  visibleFirstFireFlameGroups,
} from "../../../src/routes/test/first-fire-graybox/first-fire-graybox-review";

const contract = buildFirstFireBlenderContract();

function runtimeEntry(shrineId: "dj" | "ek" | "fl") {
  const shrine = contract.shrines.find(
    (candidate) => candidate.id === shrineId
  )!;
  return { x: shrine.blenderEntry.x, z: -shrine.blenderEntry.y };
}

function runtimeOrbitPoint(
  shrineId: "dj" | "ek" | "fl",
  travelledDegrees: number
) {
  const shrine = contract.shrines.find(
    (candidate) => candidate.id === shrineId
  )!;
  const direction = Math.sign(shrine.orbitSweepDegrees);
  const radians =
    ((shrine.orbitStartDegrees + direction * travelledDegrees) * Math.PI) / 180;
  return {
    x: shrine.blenderCentre.x + Math.cos(radians) * shrine.orbitRadius,
    z: -shrine.blenderCentre.y + Math.sin(radians) * shrine.orbitRadius,
  };
}

describe("First Fire Cinder Court review interaction", () => {
  it("requires the DJ threshold, accumulated orbit, and a hub return before EK", () => {
    let state = createFirstFireGrayboxReviewState();
    state = updateFirstFireGrayboxReview(state, contract, { x: 0, z: 0 }, 16);
    expect(state.procession.phase).toBe("approach");

    state = updateFirstFireGrayboxReview(
      state,
      contract,
      runtimeEntry("dj"),
      16
    );
    expect(state.procession.phase).toBe("dj-active");
    state = updateFirstFireGrayboxReview(
      state,
      contract,
      runtimeOrbitPoint("dj", 0),
      16
    );
    const djSweep = Math.abs(
      contract.shrines.find((candidate) => candidate.id === "dj")!
        .orbitSweepDegrees
    );
    for (const travelled of [
      djSweep * 0.1,
      djSweep * 0.35,
      djSweep * 0.6,
      djSweep * 0.85,
    ]) {
      state = updateFirstFireGrayboxReview(
        state,
        contract,
        runtimeOrbitPoint("dj", travelled),
        16
      );
    }
    expect(state.procession.phase).toBe("dj-complete");
    expect(state.procession.orbitProgress.dj).toBe(4);

    state = updateFirstFireGrayboxReview(
      state,
      contract,
      runtimeEntry("ek"),
      16
    );
    expect(state.procession.phase).toBe("dj-complete");
    const hub = contract.hub.blenderCentre;
    state = updateFirstFireGrayboxReview(
      state,
      contract,
      { x: hub.x, z: -hub.y },
      16
    );
    expect(state.returnedToHub.dj).toBe(true);
    state = updateFirstFireGrayboxReview(
      state,
      contract,
      runtimeEntry("ek"),
      16
    );
    expect(state.procession.phase).toBe("ek-active");
  });

  it("scales orbit zone gates to each court's authored viewing sweep", () => {
    for (const shrine of contract.shrines) {
      const thresholds = firstFireOrbitZoneThresholds(shrine.orbitSweepDegrees);
      const sweep = Math.min(360, Math.abs(shrine.orbitSweepDegrees));
      expect(thresholds).toHaveLength(4);
      expect(thresholds[3]).toBeLessThan(sweep);
      expect(thresholds[0]).toBeGreaterThan(0);
      for (let index = 1; index < thresholds.length; index += 1) {
        expect(thresholds[index]).toBeGreaterThan(thresholds[index - 1]!);
      }
    }
    // The DJ canyon only offers a 50 degree sweep; a fixed 280 degree final
    // gate could never be reached there.
    expect(firstFireOrbitZoneThresholds(-50)[3]).toBeLessThan(50);
  });

  it("completes every court by walking only its own authored sweep", () => {
    for (const shrine of contract.shrines) {
      let state = createFirstFireGrayboxReviewState();
      while (state.procession.phase !== `${shrine.id}-active`) {
        state = advanceFirstFireGrayboxProof(state);
      }
      const sweep = Math.min(360, Math.abs(shrine.orbitSweepDegrees));
      for (let step = 0; step <= 24; step += 1) {
        state = updateFirstFireGrayboxReview(
          state,
          contract,
          runtimeOrbitPoint(shrine.id, (sweep * step) / 24),
          16
        );
      }
      expect(state.procession.orbitProgress[shrine.id]).toBe(4);
    }
  });

  it("keeps exactly one current performer while completed lanes become coals", () => {
    let state = createFirstFireGrayboxReviewState();
    expect(displayedFirstFireShrine(state.procession.phase)).toBeNull();
    state = advanceFirstFireGrayboxProof(state);
    expect(displayedFirstFireShrine(state.procession.phase)).toBe("dj");
    state = advanceFirstFireGrayboxProof(state);
    expect(state.procession.phase).toBe("dj-complete");
    expect(displayedFirstFireShrine(state.procession.phase)).toBe("dj");
    expect([...visibleFirstFireFlameGroups(state.procession.phase)]).toEqual([
      "field",
      "ek",
    ]);
  });

  it("holds a timed neutral blackout before exposing the green Earth route", () => {
    let state = createFirstFireGrayboxReviewState();
    for (let index = 0; index < 6; index += 1) {
      state = advanceFirstFireGrayboxProof(state);
    }
    expect(state.procession.phase).toBe("fire-extinguished");
    expect(visibleFirstFireFlameGroups(state.procession.phase).size).toBe(0);

    state = updateFirstFireGrayboxReview(
      state,
      contract,
      { x: 0, z: 0 },
      FIRST_FIRE_NEUTRAL_BLACKOUT_MS - 1
    );
    expect(state.procession.phase).toBe("fire-extinguished");
    state = updateFirstFireGrayboxReview(state, contract, { x: 0, z: 0 }, 1);
    expect(state.procession.phase).toBe("growth-complete");
    expect(visibleFirstFireFlameGroups(state.procession.phase).size).toBe(0);
  });
});
