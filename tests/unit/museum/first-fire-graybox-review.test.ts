import { describe, expect, it } from "vitest";
import { buildFirstFireBlenderContract } from "$lib/features/museum/data/first-fire-blender-contract";
import {
  FIRST_FIRE_NEUTRAL_BLACKOUT_MS,
  advanceFirstFireGrayboxProof,
  createFirstFireGrayboxReviewState,
  displayedFirstFireShrine,
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
    for (const travelled of [30, 120, 205, 285]) {
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
