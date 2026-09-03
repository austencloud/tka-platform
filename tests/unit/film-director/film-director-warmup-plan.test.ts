import { describe, expect, it } from "vitest";

import {
  createFilmDirectorWarmupPlan,
  getFilmDirectorWarmupStepCount,
} from "../../../src/routes/test/film-director/_lib/film-director-warmup-plan";

describe("film director warmup plan", () => {
  it("builds and validates every scene before returning to the opening", () => {
    expect(createFilmDirectorWarmupPlan(4)).toEqual([
      0, 1, 2, 3, 0, 1, 2, 3, 0,
    ]);
  });

  it("does not repeat a one-scene film", () => {
    expect(createFilmDirectorWarmupPlan(1)).toEqual([0]);
    expect(createFilmDirectorWarmupPlan(0)).toEqual([]);
    expect(getFilmDirectorWarmupStepCount(1)).toBe(1);
  });

  it("can make a single circuit when a lightweight film requests it", () => {
    expect(createFilmDirectorWarmupPlan(3, 1)).toEqual([0, 1, 2, 0]);
  });

  it("counts the transitions represented by the default plan", () => {
    expect(getFilmDirectorWarmupStepCount(4)).toBe(8);
  });

  it("warms one scene when the film opens on a single scene", () => {
    expect(createFilmDirectorWarmupPlan(24, undefined, 11)).toEqual([11]);
    expect(createFilmDirectorWarmupPlan(24, undefined, 0)).toEqual([0]);
    expect(getFilmDirectorWarmupStepCount(24, 11)).toBe(1);
  });

  it("warms the whole film when the named scene is out of range", () => {
    expect(createFilmDirectorWarmupPlan(3, undefined, 7)).toEqual([
      0, 1, 2, 0, 1, 2, 0,
    ]);
    expect(createFilmDirectorWarmupPlan(3, undefined, -1)).toEqual([
      0, 1, 2, 0, 1, 2, 0,
    ]);
    expect(createFilmDirectorWarmupPlan(3, undefined, null)).toEqual([
      0, 1, 2, 0, 1, 2, 0,
    ]);
  });

  it("still returns nothing for a film with no scenes", () => {
    expect(createFilmDirectorWarmupPlan(0, undefined, 0)).toEqual([]);
  });
});
