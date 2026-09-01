import { describe, expect, it } from "vitest";
import { migrateEffectsConfig } from "./migrations";

describe("Ghost color migration", () => {
  it("seeds Ghost-owned colors without borrowing Trails colors", () => {
    const migrated = migrateEffectsConfig({
      version: 31,
      trails: {
        leftColor: "#112233",
        rightColor: "#445566",
      },
      ghost: {
        intensity: 0.7,
        decay: 6,
        interval: 0.4,
      },
    });

    expect(migrated.ghost.leftColor).toBe("#3b82f6");
    expect(migrated.ghost.rightColor).toBe("#ef4444");
    expect(migrated.ghost.leftColor).not.toBe(migrated.trails.leftColor);
  });
});
