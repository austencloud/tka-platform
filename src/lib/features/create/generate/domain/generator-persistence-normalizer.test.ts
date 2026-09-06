import { describe, expect, it } from "vitest";
import { normalizePersistedGenerationConfig } from "./generator-persistence-normalizer";

describe("normalizePersistedGenerationConfig", () => {
  it("clamps a persisted level 4 (SKEWED) down to the available max", () => {
    // Level 4 pictograph data does not exist yet (MAX_AVAILABLE_LEVEL in
    // config-mapper.ts). A config saved before that gate existed — old
    // localStorage, an old Firestore favorite — can still carry level: 4.
    // It must degrade to level 3 instead of round-tripping into a build
    // request the generator can't fulfill.
    const result = normalizePersistedGenerationConfig({
      mode: "freeform",
      length: 8,
      level: 4,
    });
    expect(result.level).toBe(3);
  });

  it("leaves an in-range level untouched", () => {
    const result = normalizePersistedGenerationConfig({ level: 2 });
    expect(result.level).toBe(2);
  });

  it("clamps a level below 1 up to 1", () => {
    const result = normalizePersistedGenerationConfig({ level: 0 });
    expect(result.level).toBe(1);
  });

  it("leaves a config with no level field alone", () => {
    const result = normalizePersistedGenerationConfig({ mode: "freeform" });
    expect(result.level).toBeUndefined();
  });

  it("returns {} for non-record input without throwing", () => {
    expect(normalizePersistedGenerationConfig(null)).toEqual({});
    expect(normalizePersistedGenerationConfig(undefined)).toEqual({});
    expect(normalizePersistedGenerationConfig("skewed")).toEqual({});
  });
});
