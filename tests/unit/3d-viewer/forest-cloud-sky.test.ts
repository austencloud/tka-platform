import { describe, expect, it } from "vitest";
import { createForestAtmosphereAnchor } from "$lib/shared/3d/environments/scenes/forest/forest-atmosphere-profile";

describe("Forest cloud sky", () => {
  it("uses the visible Sun as the cloud-lighting direction", () => {
    for (const id of ["dawn", "day", "goldenHour", "dusk"] as const) {
      const config = createForestAtmosphereAnchor(id).config;

      expect(config.clouds?.enabled).toBe(true);
      expect(config.clouds?.sunDirection).toEqual(config.sun?.direction);
    }
  });

  it("keeps the approved Night Master cloud-free", () => {
    expect(createForestAtmosphereAnchor("night").config.clouds).toBeUndefined();
  });

  it("returns fresh cloud configs for each review anchor", () => {
    const firstDay = createForestAtmosphereAnchor("day").config;
    const secondDay = createForestAtmosphereAnchor("day").config;
    const expectedCoverage = firstDay.clouds!.coverage;

    firstDay.clouds!.coverage = 0;

    expect(secondDay.clouds?.coverage).toBe(expectedCoverage);
  });
});
