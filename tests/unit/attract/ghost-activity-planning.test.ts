import { describe, expect, it } from "vitest";
import {
  ACTIVITY_INTENTION_IDS,
  GHOST_ACTIVITIES,
  advanceActivity,
  currentActivityStep,
  scoreActivities,
  startNextActivity,
} from "$lib/shared/attract/domain/activities";
import {
  EMPTY_WORLD,
  type GhostContext,
} from "$lib/shared/attract/domain/intention";
import { createMemory } from "$lib/shared/attract/domain/scoring";
import { ALL_INTENTIONS } from "$lib/shared/attract/intentions";
import { createRng } from "$lib/shared/attract/services/rng";
import { createTrail } from "$lib/shared/attract/services/trail";

function context(seed = 7): GhostContext {
  const rng = createRng(seed);
  const memory = createMemory(
    rng,
    createTrail(() => 0)
  );
  return {
    ...EMPTY_WORLD,
    ...memory,
    moduleId: "create",
    tabId: "construct",
    reachableModules: ["create", "library", "play"],
    available: {
      ...EMPTY_WORLD.available,
      "start-position": 8,
      "nav-module": 3,
    },
  };
}

describe("ghost activity planning", () => {
  it("commits to a coherent plan instead of redrawing after every action", () => {
    const ctx = context();
    const activity = startNextActivity(GHOST_ACTIVITIES, ctx, 0);

    expect(activity?.id).toBe("compose");
    expect(currentActivityStep(ctx.activities)?.intentionId).toBe(
      "overwhelmed"
    );

    advanceActivity(ctx.activities, 1_000);
    expect(ctx.activities.current).toBe(activity);
    expect(currentActivityStep(ctx.activities)?.intentionId).toBe("pick-start");

    advanceActivity(ctx.activities, 2_000);
    expect(currentActivityStep(ctx.activities)?.intentionId).toBe("add-step");
  });

  it("keeps activity eligibility pure so scoring does not move the RNG", () => {
    const scored = context(19);
    const untouched = context(19);
    for (const id of ["a", "b", "c", "d"]) scored.performed.set(id, 1);
    for (const id of ["a", "b", "c", "d"]) untouched.performed.set(id, 1);

    scoreActivities(GHOST_ACTIVITIES, scored, 120_000);

    expect(scored.rng.next()).toBe(untouched.rng.next());
  });

  it("forms an explicit forecast for every candidate before choosing", () => {
    const ctx = context();
    const candidates = scoreActivities(GHOST_ACTIVITIES, ctx, 0);

    expect(candidates.length).toBeGreaterThan(0);
    expect(
      candidates.every(
        ({ definition, prediction }) =>
          prediction.activityId === definition.id &&
          prediction.source === "prior" &&
          prediction.uncertainty === 1
      )
    ).toBe(true);

    const selected = startNextActivity(GHOST_ACTIVITIES, ctx, 0);
    expect(ctx.experience.active?.activityId).toBe(selected?.id);
    expect(ctx.experience.active?.prediction.activityId).toBe(selected?.id);
    expect(ctx.experience.lastPrediction?.prediction.activityId).toBe(
      selected?.id
    );
  });

  it("only leaves explicit interrupts and invitations unplanned", () => {
    const known = new Set(ALL_INTENTIONS.map((intention) => intention.id));
    expect([...ACTIVITY_INTENTION_IDS].filter((id) => !known.has(id))).toEqual(
      []
    );
    expect(
      ALL_INTENTIONS.filter(
        (intention) =>
          !intention.interrupt && !ACTIVITY_INTENTION_IDS.has(intention.id)
      ).map((intention) => intention.id)
    ).toEqual(["offer-the-wheel", "point-it-out", "everything-is-live"]);
  });
});
