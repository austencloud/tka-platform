import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INK_PALETTES } from "$lib/shared/3d/effects/ink/ink-palettes";
import {
  Ink2DRenderer,
  resolveInkStrokeWidth,
} from "$lib/shared/effects/renderers/ink-2d-renderer";
import type { EmitterTip } from "$lib/shared/effects/renderers/emitter-tip";
import type { Ink2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import { resolveInk2D } from "$lib/shared/effects/translators/canvas2d-translator";
import type { InkIntent } from "$lib/shared/effects/domain/effects-config";

function makeParams(overrides: Partial<Ink2DParams> = {}): Ink2DParams {
  return {
    ambientEmission: 0,
    motionEmission: 1,
    intensity: 0.6,
    palette: "watercolor",
    customColor: "#4080c0",
    viscosity: 0.3,
    splatterIntensity: 0.1,
    trackingMode: "both_ends",
    resolvedPalette: INK_PALETTES.watercolor,
    blendMode: "source-over",
    effectiveAmbient: 0,
    ambientSpawnRate: 2,
    motionSpawnRate: 60,
    motionReferenceSpeed: 3,
    strokeWidthMin: 2,
    strokeWidthMax: 18,
    opacityMax: 0.4,
    lifetimeSeconds: 1.65,
    maxPointsPerTip: 64,
    strokeLengthPx: 240,
    stampScaleMin: 0.3,
    stampScaleMax: 1.2,
    gravityPx: 36,
    strokeGravityPx: 0,
    breakStretchMax: 80,
    dropletPoolSize: 512,
    dropletMaxAge: 1.5,
    ...overrides,
  };
}

function makeTip(x: number, y: number): EmitterTip {
  return {
    x,
    y,
    propIndex: 0,
    tipIndex: 0,
    end: "A",
    color: "#4080c0",
  };
}

function makeContext(): CanvasRenderingContext2D {
  return {
    canvas: { width: 800, height: 600 },
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

class FakeOffscreenCanvas {
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  getContext(): OffscreenCanvasRenderingContext2D {
    const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
    return {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => gradient),
      getImageData: vi.fn(
        () =>
          ({
            data: new Uint8ClampedArray(this.width * this.height * 4),
          }) as ImageData
      ),
      putImageData: vi.fn(),
      fillStyle: "",
    } as unknown as OffscreenCanvasRenderingContext2D;
  }
}

describe("Ink2DRenderer", () => {
  beforeEach(() => {
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns slow pressure into a wider stroke and scales it with the canvas", () => {
    const params = makeParams();

    const slow = resolveInkStrokeWidth(params, 0, 1);
    const fast = resolveInkStrokeWidth(params, 1000, 1);

    expect(slow).toBeGreaterThan(fast * 2.5);
    expect(resolveInkStrokeWidth(params, 0, 2)).toBeCloseTo(slow * 2);
  });

  it("resolves separate Watercolor mark and droplet physics", () => {
    const intent: InkIntent = {
      ambientEmission: 0.1,
      motionEmission: 0.7,
      intensity: 0.5,
      palette: "watercolor",
      customColor: "#4080c0",
      viscosity: 0.1,
      splatterIntensity: 0.1,
      trackingMode: "both_ends",
    };

    const watercolor = resolveInk2D(intent);
    expect(watercolor.strokeWidthMax).toBe(18);
    expect(watercolor.strokeLengthPx).toBe(240);
    expect(watercolor.strokeGravityPx).toBe(0);
    expect(watercolor.gravityPx).toBeGreaterThan(0);

    const india = resolveInk2D({ ...intent, palette: "india" });
    expect(india.strokeLengthPx).toBe(420);
    expect(india.strokeGravityPx).toBe(india.gravityPx);
  });

  it("builds a continuous filled ribbon with clipped granulation", () => {
    const renderer = new Ink2DRenderer();
    const context = makeContext();
    const params = makeParams({ splatterIntensity: 0, gravityPx: 0 });

    for (let frame = 0; frame < 24; frame++) {
      renderer.render(context, params, [makeTip(100 + frame * 8, 300)], 1 / 60);
    }

    expect(vi.mocked(context.fill).mock.calls.length).toBeGreaterThan(20);
    expect(vi.mocked(context.drawImage).mock.calls.length).toBeGreaterThan(0);
    expect(vi.mocked(context.stroke).mock.calls.length).toBeGreaterThan(0);
  });

  it("bounds visible history by scaled path length", () => {
    const renderer = new Ink2DRenderer();
    const context = makeContext();
    const params = makeParams({
      splatterIntensity: 0,
      gravityPx: 0,
      strokeGravityPx: 0,
      strokeLengthPx: 240,
    });

    for (let frame = 0; frame < 100; frame++) {
      renderer.render(
        context,
        params,
        [makeTip(100 + frame * 10, 300)],
        1 / 60
      );
    }

    expect(renderer.getDiagnostics().maxPathLength).toBeLessThanOrEqual(240.01);
  });

  it("keeps a seamless LOOP connected across its playback boundary", () => {
    const renderer = new Ink2DRenderer();
    const context = makeContext();
    const params = makeParams({
      motionSpawnRate: 600,
      splatterIntensity: 0,
      gravityPx: 0,
      lifetimeSeconds: 10,
      strokeLengthPx: 2000,
    });

    for (let frame = 0; frame < 12; frame++) {
      renderer.render(context, params, [makeTip(100 + frame * 8, 300)], 1 / 60);
    }
    const beforeBoundary = renderer.getDiagnostics();

    renderer.render(context, params, [makeTip(196, 300)], 1 / 60, 1, {
      loopDetected: true,
      isSeamlesslyLoopable: true,
    });

    const afterBoundary = renderer.getDiagnostics();
    expect(beforeBoundary.pointCount).toBeGreaterThan(0);
    expect(afterBoundary.detachedStrokeCount).toBe(0);
    expect(afterBoundary.pointCount).toBeGreaterThanOrEqual(
      beforeBoundary.pointCount
    );
  });

  it("preserves the old mark without bridging a freeform reset", () => {
    const renderer = new Ink2DRenderer();
    const context = makeContext();
    const params = makeParams({
      motionSpawnRate: 600,
      splatterIntensity: 0,
      gravityPx: 0,
      lifetimeSeconds: 10,
      strokeLengthPx: 2000,
    });

    for (let frame = 0; frame < 12; frame++) {
      renderer.render(context, params, [makeTip(100 + frame * 8, 300)], 1 / 60);
    }
    const beforeBoundary = renderer.getDiagnostics();

    renderer.render(context, params, [makeTip(700, 300)], 1 / 60, 1, {
      loopDetected: true,
      isSeamlesslyLoopable: false,
    });
    renderer.render(context, params, [makeTip(708, 300)], 1 / 60);

    const afterBoundary = renderer.getDiagnostics();
    expect(beforeBoundary.pointCount).toBeGreaterThan(0);
    expect(afterBoundary.detachedStrokeCount).toBe(1);
    expect(afterBoundary.pointCount).toBeGreaterThan(0);
    expect(afterBoundary.maxPathLength).toBeLessThan(300);
  });

  it("keeps the Watercolor mark on its path while dense ink strands sag", () => {
    const watercolorRenderer = new Ink2DRenderer();
    const watercolor = makeParams({
      effectiveAmbient: 1,
      ambientSpawnRate: 60,
      motionSpawnRate: 0,
      splatterIntensity: 0,
      gravityPx: 36,
      strokeGravityPx: 0,
    });
    watercolorRenderer.render(
      makeContext(),
      watercolor,
      [makeTip(100, 300)],
      1 / 60
    );
    watercolorRenderer.render(
      makeContext(),
      watercolor,
      [makeTip(100, 300)],
      1 / 60
    );
    for (let frame = 0; frame < 30; frame++) {
      watercolorRenderer.render(makeContext(), watercolor, [], 1 / 60);
    }

    const watercolorTip = watercolorRenderer.getDiagnostics().tips[0];
    expect(watercolorTip?.oldestY).toBeCloseTo(300);

    const denseRenderer = new Ink2DRenderer();
    const dense = makeParams({
      palette: "india",
      resolvedPalette: INK_PALETTES.india,
      opacityMax: 1,
      effectiveAmbient: 1,
      ambientSpawnRate: 60,
      motionSpawnRate: 0,
      splatterIntensity: 0,
      gravityPx: 36,
      strokeGravityPx: 36,
      lifetimeSeconds: 3,
      strokeLengthPx: 420,
    });
    denseRenderer.render(makeContext(), dense, [makeTip(100, 300)], 1 / 60);
    denseRenderer.render(makeContext(), dense, [makeTip(100, 300)], 1 / 60);
    for (let frame = 0; frame < 30; frame++) {
      denseRenderer.render(makeContext(), dense, [], 1 / 60);
    }

    expect(denseRenderer.getDiagnostics().tips[0]?.oldestY).toBeGreaterThan(
      304
    );
  });

  it("keeps watercolor non-additive while preserving neon's additive material", () => {
    const watercolorRenderer = new Ink2DRenderer();
    const watercolorContext = makeContext();
    const watercolorAssignments: GlobalCompositeOperation[] = [];
    let watercolorComposite: GlobalCompositeOperation = "source-over";
    Object.defineProperty(watercolorContext, "globalCompositeOperation", {
      get: () => watercolorComposite,
      set: (value: GlobalCompositeOperation) => {
        watercolorAssignments.push(value);
        watercolorComposite = value;
      },
    });

    const watercolor = makeParams({ splatterIntensity: 0, gravityPx: 0 });
    watercolorRenderer.render(
      watercolorContext,
      watercolor,
      [makeTip(100, 300)],
      1 / 60
    );
    watercolorRenderer.render(
      watercolorContext,
      watercolor,
      [makeTip(180, 300)],
      1 / 60
    );

    expect(watercolorAssignments).toContain("source-over");
    expect(watercolorAssignments).not.toContain("lighter");

    const neonRenderer = new Ink2DRenderer();
    const neonContext = makeContext();
    const neonAssignments: GlobalCompositeOperation[] = [];
    let neonComposite: GlobalCompositeOperation = "source-over";
    Object.defineProperty(neonContext, "globalCompositeOperation", {
      get: () => neonComposite,
      set: (value: GlobalCompositeOperation) => {
        neonAssignments.push(value);
        neonComposite = value;
      },
    });
    const neon = makeParams({
      palette: "neon",
      resolvedPalette: INK_PALETTES.neon,
      opacityMax: 1,
      splatterIntensity: 0,
      gravityPx: 0,
    });
    neonRenderer.render(neonContext, neon, [makeTip(100, 300)], 1 / 60);
    neonRenderer.render(neonContext, neon, [makeTip(180, 300)], 1 / 60);

    expect(neonAssignments).toContain("lighter");
  });

  it("gives dense ink a wet reflection without making it additive", () => {
    const renderer = new Ink2DRenderer();
    const context = makeContext();
    const assignments: GlobalCompositeOperation[] = [];
    let composite: GlobalCompositeOperation = "source-over";
    Object.defineProperty(context, "globalCompositeOperation", {
      get: () => composite,
      set: (value: GlobalCompositeOperation) => {
        assignments.push(value);
        composite = value;
      },
    });
    const india = makeParams({
      palette: "india",
      resolvedPalette: INK_PALETTES.india,
      opacityMax: 1,
      splatterIntensity: 0,
      gravityPx: 0,
    });

    renderer.render(context, india, [makeTip(100, 300)], 1 / 60);
    renderer.render(context, india, [makeTip(180, 300)], 1 / 60);

    expect(assignments).toContain("screen");
    expect(assignments).not.toContain("lighter");
  });

  it("turns an acceleration spike into bounded velocity-driven splatter", () => {
    const quietRenderer = new Ink2DRenderer();
    const quietContext = makeContext();
    const quiet = makeParams({
      motionSpawnRate: 0,
      splatterIntensity: 0,
      gravityPx: 0,
    });
    quietRenderer.render(quietContext, quiet, [makeTip(100, 300)], 1 / 60);
    quietRenderer.render(quietContext, quiet, [makeTip(220, 300)], 1 / 60);
    expect(vi.mocked(quietContext.arc)).not.toHaveBeenCalled();

    const loudRenderer = new Ink2DRenderer();
    const loudParams = makeParams({
      motionSpawnRate: 0,
      splatterIntensity: 1,
      gravityPx: 0,
      dropletPoolSize: 3,
    });
    loudRenderer.render(makeContext(), loudParams, [makeTip(100, 300)], 1 / 60);
    loudRenderer.render(makeContext(), loudParams, [makeTip(220, 300)], 1 / 60);

    const finalContext = makeContext();
    loudRenderer.render(finalContext, loudParams, [], 1 / 60);
    expect(vi.mocked(finalContext.arc).mock.calls.length).toBe(6);
  });
});
