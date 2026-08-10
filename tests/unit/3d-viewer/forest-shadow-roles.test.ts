import { describe, expect, it } from "vitest";
import { resolveForestShadowRole } from "$lib/shared/3d/environments/scenes/forest/forest-shadow-roles";

describe("Forest shadow roles", () => {
  it("lets the terrain receive local contact shadows without casting", () => {
    expect(resolveForestShadowRole("terrain")).toEqual({
      cast: false,
      receive: true,
    });
    expect(resolveForestShadowRole("camp-shelf")).toEqual({
      cast: false,
      receive: true,
    });
  });

  it("keeps the authored woodland out of the moon shadow pass", () => {
    expect(resolveForestShadowRole("tree")).toEqual({
      cast: false,
      receive: false,
    });
    expect(resolveForestShadowRole(undefined)).toEqual({
      cast: false,
      receive: false,
    });
  });
});
