import { describe, expect, it } from "vitest";
import { migrateEffectsConfig } from "./migrations";

describe("Ghost color migration", () => {
  it("seeds Ghost-owned colors without borrowing Trails colors", () => {
    const migrated = migrateEffectsConfig({
      version: 31,
      trails: {
        blueColor: "#112233",
        redColor: "#445566",
      },
      ghost: {
        intensity: 0.7,
        decay: 6,
        interval: 0.4,
      },
    });

    expect(migrated.ghost.blueColor).toBe("#3b82f6");
    expect(migrated.ghost.redColor).toBe("#ef4444");
    expect(migrated.ghost.blueColor).not.toBe(migrated.trails.blueColor);
  });
});
