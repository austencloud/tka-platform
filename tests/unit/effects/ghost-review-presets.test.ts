import { describe, expect, it } from "vitest";
import { DEFAULT_EFFECTS_CONFIG } from "$lib/shared/effects/domain/defaults";
import {
  GHOST_REVIEW_PRESETS,
  ghostReviewIntentMatches,
  parseGhostPresetVerdicts,
  resolveGhostReviewIntent,
  toggleGhostPresetVerdict,
} from "../../../src/routes/test/ghost-presets/ghost-review-presets";

describe("Ghost preset review candidates", () => {
  it("combines four production presets with four studies", () => {
    expect(GHOST_REVIEW_PRESETS).toHaveLength(8);
    expect(new Set(GHOST_REVIEW_PRESETS.map((preset) => preset.id)).size).toBe(
      8
    );
    expect(
      GHOST_REVIEW_PRESETS.filter((preset) => preset.source === "production")
    ).toHaveLength(4);
    expect(
      GHOST_REVIEW_PRESETS.filter((preset) => preset.source === "study")
    ).toHaveLength(4);
  });

  it("resolves every candidate to a complete, bounded Ghost intent", () => {
    for (const preset of GHOST_REVIEW_PRESETS) {
      const intent = resolveGhostReviewIntent(preset);
      expect(intent.blueColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(intent.redColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(intent.intensity).toBeGreaterThanOrEqual(0);
      expect(intent.intensity).toBeLessThanOrEqual(1);
      expect(intent.decay).toBeGreaterThanOrEqual(1);
      expect(intent.decay).toBeLessThanOrEqual(10);
      expect(intent.interval).toBeGreaterThanOrEqual(0);
      expect(intent.interval).toBeLessThanOrEqual(1);
    }
  });

  it("keeps production presets on the canonical Ghost colors", () => {
    for (const preset of GHOST_REVIEW_PRESETS.filter(
      (candidate) => candidate.source === "production"
    )) {
      const intent = resolveGhostReviewIntent(preset);
      expect(intent.blueColor).toBe(DEFAULT_EFFECTS_CONFIG.ghost.blueColor);
      expect(intent.redColor).toBe(DEFAULT_EFFECTS_CONFIG.ghost.redColor);
    }
  });

  it("covers deliberately different brightness, fade, and density ranges", () => {
    const intents = GHOST_REVIEW_PRESETS.map(resolveGhostReviewIntent);
    const intensities = intents.map((intent) => intent.intensity);
    const fades = intents.map((intent) => intent.decay);
    const densities = intents.map((intent) => intent.interval);

    expect(Math.min(...intensities)).toBeLessThanOrEqual(0.45);
    expect(Math.max(...intensities)).toBe(1);
    expect(Math.min(...fades)).toBeLessThanOrEqual(3);
    expect(Math.max(...fades)).toBe(10);
    expect(Math.min(...densities)).toBeLessThanOrEqual(0.2);
    expect(Math.max(...densities)).toBeGreaterThanOrEqual(0.9);
  });

  it("detects when live tuning has moved off the selected preset", () => {
    const expected = resolveGhostReviewIntent(GHOST_REVIEW_PRESETS[0]!);
    expect(ghostReviewIntentMatches(expected, expected)).toBe(true);
    expect(
      ghostReviewIntentMatches(
        { ...expected, intensity: expected.intensity - 0.05 },
        expected
      )
    ).toBe(false);
  });
});

describe("Ghost preset verdicts", () => {
  it("toggles a verdict off when the same mark is pressed again", () => {
    expect(toggleGhostPresetVerdict(undefined, "favorite")).toBe("favorite");
    expect(toggleGhostPresetVerdict("favorite", "favorite")).toBeUndefined();
  });

  it("replaces one verdict with the other", () => {
    expect(toggleGhostPresetVerdict("favorite", "pass")).toBe("pass");
    expect(toggleGhostPresetVerdict("pass", "favorite")).toBe("favorite");
  });

  it("loads only known preset ids and valid verdicts", () => {
    const knownId = GHOST_REVIEW_PRESETS[0]!.id;
    expect(
      parseGhostPresetVerdicts(
        JSON.stringify({
          [knownId]: "favorite",
          unknown: "pass",
          [GHOST_REVIEW_PRESETS[1]!.id]: "maybe",
        })
      )
    ).toEqual({ [knownId]: "favorite" });
    expect(parseGhostPresetVerdicts("not-json")).toEqual({});
  });
});
