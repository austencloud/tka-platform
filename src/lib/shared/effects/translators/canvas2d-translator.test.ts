import { describe, it, expect } from "vitest";
import { resolveSparkles2D, resolveZap2D } from "./canvas2d-translator";
import type { SparklesIntent, ZapIntent } from "../domain/EffectsConfig";

describe("resolveZap2D — per-hand color", () => {
  it("preserves leftColor and rightColor in the output params", () => {
    const intent: ZapIntent = {
      intensity: 0.7,
      leftColor: "#ff0000",
      rightColor: "#0000ff",
      frequency: 12,
      mode: "arc",
      branching: 0.3,
    };
    const out = resolveZap2D(intent);
    expect(out.leftColor).toBe("#ff0000");
    expect(out.rightColor).toBe("#0000ff");
  });
});

describe("resolveSparkles2D — extended fields", () => {
  it("preserves colorMode, palette, spread, gravity, mode in output params", () => {
    const intent: SparklesIntent = {
      rate: 0.7,
      size: 0.6,
      lifetime: 1.5,
      color: "#67e8f9",
      palette: ["#aaa", "#bbb", "#ccc"],
      colorMode: "palette",
      spread: 12,
      gravity: 0.8,
      mode: "burst",
    };
    const out = resolveSparkles2D(intent);
    expect(out.colorMode).toBe("palette");
    expect(out.palette).toEqual(["#aaa", "#bbb", "#ccc"]);
    expect(out.spread).toBe(12);
    expect(out.gravity).toBe(0.8);
    expect(out.mode).toBe("burst");
    expect(out.poolSize).toBeGreaterThan(0);
    expect(out.baseRadius).toBeGreaterThan(0);
  });
});
