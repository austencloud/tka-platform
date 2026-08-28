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
  it("uses a game-scale walking pace for the one-square-kilometre festival", () => {
    expect(FLOW_FEST_GAMEPLAY_WALK_SPEED_METERS_PER_SECOND).toBe(4.2);
    expect(FLOW_FEST_GAMEPLAY_SPRINT_MULTIPLIER).toBe(1.8);
    expect(FLOW_FEST_GAMEPLAY_JUMP_FORCE).toBe(5);
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
