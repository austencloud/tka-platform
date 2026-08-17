import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The 3D LED contract (spec 2026-08-16 §5).
 *
 * A capsule keeps the ribbon renderer; a pixel staff routes to the already
 * built POV strip renderer. Both read one materialized pattern on one clock,
 * so 2D and 3D show the same colors at the same instant. These are static
 * assertions because the orchestrator only runs inside a Threlte render loop.
 */
const ORCHESTRATOR = resolve(
  "src/lib/shared/3d/effects/EffectOrchestrator3D.svelte"
);
const source = readFileSync(ORCHESTRATOR, "utf8");

describe("LED 3D routes by device kind", () => {
  it("decides the device from the resolved LED config, not a separate flag", () => {
    expect(source).toMatch(
      /usePixelStaff\s*=\s*resolvedLed\.device\.kind === "pixel-staff"/
    );
  });

  it("no longer carries the orphaned activeStripPattern override", () => {
    expect(source).not.toContain("activeStripPattern");
  });

  it("builds the POV strip renderer for a pixel staff, at the device's LED count", () => {
    expect(source).toMatch(/if \(usePixelStaff\) \{/);
    expect(source).toMatch(
      /new PovStripRenderer3D\(qualityTier, ledCount\)/
    );
  });

  it("keeps the ribbon renderer on the capsule branch", () => {
    const capsuleBranch = source.slice(source.indexOf("if (usePixelStaff) {"));
    const elseIndex = capsuleBranch.indexOf("} else {");
    expect(elseIndex).toBeGreaterThan(0);
    expect(capsuleBranch.slice(elseIndex)).toMatch(
      /new LedRenderer3D\(qualityTier\)/
    );
    expect(capsuleBranch.slice(0, elseIndex)).not.toContain("LedRenderer3D(");
  });

  it("skips the per-tip supersampled ribbon input on a pixel staff", () => {
    expect(source).toMatch(/if \(!usePixelStaff\) \{\s*const color = ledColorAt/);
  });
});

describe("LED 3D shares the 2D pattern and clock", () => {
  it("materializes through the shared cache rather than generating per frame", () => {
    expect(source).toContain("LedPatternMaterializer");
    expect(source).toMatch(
      /_ledPattern\.resolve\(resolvedLed\.pattern, ledCount\)/
    );
    expect(source).not.toContain("materializeGeneratorPattern");
  });

  it("indexes frames with the sampler's own clock helper", () => {
    expect(source).toMatch(
      /patternFrameIndex\(\s*ledElapsedMs,\s*resolvedLed\.cycleDuration,\s*ledStrip\.frameCount/
    );
  });

  it("reads the same time origin the 2D sampler is handed", () => {
    expect(source).toMatch(/const ledElapsedMs = performance\.now\(\);/);
  });

  it("hands the POV renderer that frame index instead of a staff angle", () => {
    expect(source).toMatch(/frameIndex,\s*pattern,\s*cam,\s*now,\s*brightness/);
    expect(source).not.toContain("rotAngle");
  });
});

describe("LED 3D look plumbing", () => {
  it("passes the brightness level through the shared LED helper", () => {
    expect(source).toMatch(
      /ledBrightness = ledBrightnessToFloat\(resolvedLed\.look\.brightness\)/
    );
    expect(source).toMatch(/ledFrame,\s*cam!,\s*now,\s*ledBrightness/);
  });

  it("maps the look's shutter onto the POV ghost fade", () => {
    expect(source).toMatch(
      /shutterToPovPersistence\(\s*resolvedLed\.look\.shutter\s*\)/
    );
    expect(source).not.toContain("povPersistenceDuration");
  });

  it("keeps sprite geometry out of the look", () => {
    // Emitter footprint is photometric and the 3D path does not derive it yet,
    // so the material keeps its own falloff rather than taking one from a look
    // field that no longer exists.
    expect(source).not.toContain("look.glowRadius");
    expect(source).not.toContain("look.trailFadeRate");
    expect(source).not.toContain("look.bloomIntensity");
  });
});

describe("LED 3D disposes on a device change", () => {
  it("keys the live renderers to the device kind and LED count", () => {
    expect(source).toMatch(/syncLedDevice\(resolvedLed\.device\.kind, ledCount\)/);
    expect(source).toMatch(/const key = `\$\{kind\}:\$\{ledCount\}`/);
  });

  it("disposes and clears both renderer families when that key changes", () => {
    const start = source.indexOf("function syncLedDevice");
    expect(start).toBeGreaterThan(0);
    const body = source.slice(start, source.indexOf("\n  }", start));
    for (const renderer of [
      "blueLedRenderer",
      "redLedRenderer",
      "bluePovRenderer",
      "redPovRenderer",
    ]) {
      expect(body).toContain(`${renderer}?.dispose();`);
      expect(body).toContain(`${renderer} = null;`);
    }
  });

  it("still disposes every renderer when the component unmounts", () => {
    const destroy = source.slice(source.indexOf("onDestroy(() => {"));
    for (const renderer of [
      "blueLedRenderer",
      "redLedRenderer",
      "bluePovRenderer",
      "redPovRenderer",
    ]) {
      expect(destroy).toContain(`${renderer}?.dispose();`);
    }
  });
});
