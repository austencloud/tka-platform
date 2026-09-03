import { describe, expect, it } from "vitest";
import {
  advanceFlowFestProgress,
  createFlowFestProgress,
  getFlowFestObjective,
  isFlowFestCampEstablishedPhase,
  restoreFlowFestProgress,
} from "$lib/features/flow-fest-sim/state/flow-fest-progress";
import {
  FLOW_FEST_GAMEPLAY_JUMP_FORCE,
  FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER,
  FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND,
} from "$lib/features/flow-fest-sim/domain/flow-fest-simulation-contract";

const FINGERPRINT = "contract-fingerprint";

describe("Flow Fest Thursday progress", () => {
  // Measured off the shipped clips with the same contact-weighted foot-speed
  // method LocomotionAnimator.analyzeClipGait uses, so these are the speeds the
  // animation can actually carry rather than numbers that read well.
  const WALK_CLIP_NATIVE_SPEED = 1.517;
  const RUN_CLIP_NATIVE_SPEED = 3.099;

  it("keeps on-foot speeds inside what the walk and run clips can carry", () => {
    expect(FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND).toBe(1.7);
    expect(FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER).toBe(2.3);
    expect(FLOW_FEST_GAMEPLAY_JUMP_FORCE).toBe(5);

    // Grieve's square-root law splits a speed request between stride length and
    // cadence: the animator authors sqrt(speed / clipSpeed) as stride and caps
    // it at 1.15. Past that cap the surplus lands on playback rate alone and
    // the body skates over its own footfalls. Both tiers stay under the cap,
    // which is the whole reason the run is a second clip and not a faster walk.
    const walkStride = Math.sqrt(
      FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND / WALK_CLIP_NATIVE_SPEED
    );
    const sprintStride = Math.sqrt(
      (FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND *
        FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER) /
        RUN_CLIP_NATIVE_SPEED
    );
    expect(walkStride).toBeLessThan(1.15);
    expect(sprintStride).toBeLessThan(1.15);

    // And sprint has to clear the run tier's crossover, or holding Shift buys a
    // faster walk instead of a run. The band is walk native x 1.15 up to run
    // native x 0.8; above the top of it the pose is entirely run clips.
    const sprintSpeed =
      FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND *
      FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER;
    expect(sprintSpeed).toBeGreaterThan(RUN_CLIP_NATIVE_SPEED * 0.8);
    // The walk stays below the bottom of the band, so unmodified travel is a
    // walk with no run bleeding into it.
    expect(FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND).toBeLessThan(
      WALK_CLIP_NATIVE_SPEED * 1.15
    );
  });

  it("activates the player's tent collision only after camp is established", () => {
    expect(isFlowFestCampEstablishedPhase("make-camp")).toBe(false);
    expect(isFlowFestCampEstablishedPhase("walk-to-festival")).toBe(true);
    expect(isFlowFestCampEstablishedPhase("night-free-roam")).toBe(true);
    expect(isFlowFestCampEstablishedPhase("morning")).toBe(true);
  });

  it.each(["lower-tent", "upper-tent", "car-camp"] as const)(
    "completes the %s arrival without skipping guarded steps",
    (branch) => {
      let state = createFlowFestProgress(FINGERPRINT);
      expect(advanceFlowFestProgress(state, { type: "make-camp" })).toBe(state);

      state = advanceFlowFestProgress(state, { type: "check-in" });
      state = advanceFlowFestProgress(state, { type: "choose-camp", branch });
      state = advanceFlowFestProgress(state, { type: "arrive-at-camp" });
      state = advanceFlowFestProgress(state, { type: "settle-vehicle" });
      if (branch !== "car-camp") {
        expect(state.phase).toBe("walk-home");
        state = advanceFlowFestProgress(state, { type: "reach-camp" });
      }
      expect(state.phase).toBe("make-camp");
      state = advanceFlowFestProgress(state, { type: "make-camp" });
      state = advanceFlowFestProgress(state, { type: "reach-festival" });
      state = advanceFlowFestProgress(state, { type: "begin-night" });
      expect(state.phase).toBe("night-free-roam");
      expect(advanceFlowFestProgress(state, { type: "head-home" })).toBe(state);
      state = advanceFlowFestProgress(state, { type: "join-fire-jam" });
      state = advanceFlowFestProgress(state, { type: "complete-fire-jam" });
      state = advanceFlowFestProgress(state, { type: "head-home" });
      state = advanceFlowFestProgress(state, { type: "return-to-camp" });

      expect(state).toMatchObject({
        branch,
        phase: "morning",
        moment: "dawn",
        fireJamState: "completed",
        contractFingerprint: FINGERPRINT,
      });
      expect(state.completed).toContain("festival-night");
    }
  );

  it("keeps authored vehicle travel untimed", () => {
    let state = createFlowFestProgress(FINGERPRINT);
    state = advanceFlowFestProgress(state, { type: "check-in" });
    state = advanceFlowFestProgress(state, {
      type: "choose-camp",
      branch: "upper-tent",
    });
    const objective = getFlowFestObjective(state);

    expect(objective.title).toBe("Stage the unload leg");
    expect(objective.detail).toContain("exact upper-level unload endpoint");
    expect(JSON.stringify(objective)).not.toMatch(/second|minute|speed/i);
  });

  it("rejects stale or malformed session snapshots", () => {
    const state = createFlowFestProgress(FINGERPRINT);
    expect(restoreFlowFestProgress(state, FINGERPRINT)).toEqual(state);
    expect(restoreFlowFestProgress(state, "new-fingerprint")).toBeNull();
    expect(
      restoreFlowFestProgress(
        { ...state, phase: "teleport-driving" },
        FINGERPRINT
      )
    ).toBeNull();
    expect(
      restoreFlowFestProgress(
        { ...state, phase: "walk-home", branch: null },
        FINGERPRINT
      )
    ).toBeNull();
    expect(
      restoreFlowFestProgress(
        { ...state, phase: "morning", moment: "afternoon" },
        FINGERPRINT
      )
    ).toBeNull();
    expect(
      restoreFlowFestProgress(
        { ...state, phase: "camp-arrival", branch: null },
        FINGERPRINT
      )
    ).toBeNull();
    expect(
      restoreFlowFestProgress(
        { ...state, completed: ["made-up-phase"] },
        FINGERPRINT
      )
    ).toBeNull();
  });

  it("starts over without changing the contract identity", () => {
    const initial = createFlowFestProgress(FINGERPRINT);
    const morning = {
      ...initial,
      phase: "morning" as const,
      moment: "dawn" as const,
      branch: "car-camp" as const,
    };
    expect(advanceFlowFestProgress(morning, { type: "start-over" })).toEqual(
      initial
    );
  });
});
