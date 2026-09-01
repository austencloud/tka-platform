import { beforeEach, describe, expect, it } from "vitest";
import { createGenerationConfigState } from "./generate-config.svelte";

beforeEach(() => localStorage.clear());

describe("Generate config compatibility", () => {
  it("normalizes literal blue/red turn lanes and clears them on reset", () => {
    const state = createGenerationConfigState({
      turnPattern: { blue: [1, 0], red: [0.5] },
    } as never);

    expect(state.config.turnPattern).toEqual({
      left: [1, 0],
      right: [0.5],
    });

    state.resetConfig();
    expect(state.config.turnPattern).toBeNull();
  });
});
