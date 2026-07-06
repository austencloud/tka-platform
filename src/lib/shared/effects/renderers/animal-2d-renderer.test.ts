import { describe, it, expect } from "vitest";
import { Animal2DRenderer } from "./animal-2d-renderer";
import type { Animal2DParams } from "../translators/canvas2d-types";
import { resolveAnimalPalette } from "../domain/animal-palettes";

function params(creature: Animal2DParams["creature"]): Animal2DParams {
  const intent = {
    creature,
    palette: "velvet" as const,
    customColor: "#600018",
    intensity: 0.85,
    width: 0.55,
    bodyLength: 0.55,
    slither: 0.55,
    trackingMode: "both_ends" as const,
  };
  return {
    ...intent,
    resolvedPalette: resolveAnimalPalette(intent),
    baseHalfWidth: 18,
    bodyLengthPx: 300,
    segmentCount: 40,
    slitherAmpPx: 23,
    blendMode: "source-over",
  };
}

// jsdom has no real 2D context; assert the renderer drives the chain without throwing.
function fakeCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  return new Proxy(
    {
      canvas: { width: 400, height: 400 },
      globalAlpha: 1,
      globalCompositeOperation: "source-over",
      createRadialGradient: () => ({ addColorStop: noop }),
      createLinearGradient: () => ({ addColorStop: noop }),
    } as unknown as CanvasRenderingContext2D,
    { get: (t, p) => (p in t ? (t as unknown as Record<string, unknown>)[p as string] : noop), set: () => true },
  );
}

describe("Animal2DRenderer", () => {
  for (const creature of ["snake", "dragon", "caterpillar"] as const) {
    it(`renders ${creature} without throwing`, () => {
      const r = new Animal2DRenderer();
      const ctx = fakeCtx();
      const tips = [{ x: 100, y: 100, end: "A" as const, propIndex: 0, tipIndex: 0, color: "#ffffff" }];
      // Two frames so the follow-chain advances.
      expect(() => r.render(ctx, params(creature), tips, 0.016, 1, false)).not.toThrow();
      tips[0]!.x = 140;
      expect(() => r.render(ctx, params(creature), tips, 0.016, 1, false)).not.toThrow();
      r.dispose();
    });
  }

  it("prunes chain state for emitters absent this frame", () => {
    const r = new Animal2DRenderer();
    const ctx = fakeCtx();
    const tips = [{ x: 100, y: 100, end: "A" as const, propIndex: 0, tipIndex: 0, color: "#ffffff" }];
    r.render(ctx, params("snake"), tips, 0.016, 1, false);
    // No emitters present → the chain for the vanished emitter is dropped, no throw.
    expect(() => r.render(ctx, params("snake"), [], 0.016, 1, false)).not.toThrow();
    r.dispose();
  });
});
