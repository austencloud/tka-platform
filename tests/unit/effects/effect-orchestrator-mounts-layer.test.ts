import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ORCHESTRATOR = resolve("src/lib/shared/3d/effects/EffectOrchestrator3D.svelte");

describe("EffectOrchestrator3D mounts EffectsLayer", () => {
  const source = readFileSync(ORCHESTRATOR, "utf8");

  it("imports EffectsLayer", () => {
    expect(source).toMatch(/import\s+EffectsLayer\s+from\s+"\.\/EffectsLayer\.svelte"/);
  });

  it("renders EffectsLayer in its template", () => {
    expect(source).toMatch(/<EffectsLayer\b/);
  });

  it("passes the prop states EffectsLayer needs", () => {
    const tag = source.slice(source.indexOf("<EffectsLayer"));
    for (const prop of ["bluePropState", "redPropState", "isPlaying", "staffLength", "currentStep"]) {
      expect(tag).toContain(prop);
    }
  });
});
