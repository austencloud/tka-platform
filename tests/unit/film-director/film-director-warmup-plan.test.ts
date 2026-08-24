import { describe, expect, it } from "vitest";

import {
  createFilmDirectorWarmupPlan,
  getFilmDirectorWarmupStepCount,
} from "../../../src/routes/test/film-director/_lib/film-director-warmup-plan";

describe("film director warmup plan", () => {
  it("builds and validates every shot before returning to the opening", () => {
    expect(createFilmDirectorWarmupPlan(4)).toEqual([
      0, 1, 2, 3, 0, 1, 2, 3, 0,
    ]);
  });

  it("does not repeat a one-shot film", () => {
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
});
