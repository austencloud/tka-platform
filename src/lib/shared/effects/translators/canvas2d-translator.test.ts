import { describe, it, expect } from "vitest";
import { resolveZap2D } from "./canvas2d-translator";
import type { ZapIntent } from "../domain/EffectsConfig";

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
