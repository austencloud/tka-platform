import { describe, expect, it, vi } from "vitest";
import { AnimationRenderLoop } from "../animation-render-loop";
import type {
  RenderFrameParams,
  RenderLoopConfig,
} from "../IAnimationRenderLoop";
import type {
  ITrailOverlayCanvas,
  TrailOverlayRenderParams,
} from "../ITrailOverlayCanvas";
import {
  DEFAULT_TRAIL_SETTINGS,
  TrackingMode,
} from "../../domain/types/trail-types";
import type { IAnimationRenderer } from "../IAnimationRenderer";

function frameParams(propType: string): RenderFrameParams {
  return {
    stepData: null,
    currentStep: 0,
    trailSettings: {
      ...DEFAULT_TRAIL_SETTINGS,
      trackingMode: TrackingMode.BOTH_ENDS,
    },
    gridVisible: false,
    gridMode: null,
    letter: null,
    props: {
      blueProp: { centerPathAngle: 0, staffRotationAngle: 0 },
      redProp: null,
      additionalLayers: [],
      bluePropDimensions: { width: 252.8, height: 77.8 },
      redPropDimensions: { width: 252.8, height: 77.8 },
      tunnelSpectrum: false,
    },
    visibility: {
      gridVisible: false,
      propsVisible: true,
      trailsVisible: true,
      blueMotionVisible: true,
      redMotionVisible: false,
    },
    isPlaying: true,
    bluePropType: propType,
    redPropType: "staff",
    tipEffectMap: { "*": { effect: "trails" } },
  };
}

describe("AnimationRenderLoop prop identity trail barrier", () => {
  it("suppresses the exact type-change frame even before async swap signals arrive", () => {
    const trailFrames: TrailOverlayRenderParams[] = [];
    const trailOverlay = {
      renderFrame: (params: TrailOverlayRenderParams) =>
        trailFrames.push(params),
      setVisible: vi.fn(),
      clear: vi.fn(),
      clearBuffers: vi.fn(),
      resize: vi.fn(),
      setCanvasZIndex: vi.fn(),
      dispose: vi.fn(),
    } as unknown as ITrailOverlayCanvas;
    const renderer = {
      renderScene: vi.fn(),
      isBluePropCrossfadeInProgress: () => false,
      isRedPropCrossfadeInProgress: () => false,
    } as unknown as IAnimationRenderer;

    const loop = new AnimationRenderLoop();
    loop.initialize({
      renderer,
      TrailCapturer: null,
      pathCache: null,
      canvasSize: 500,
      renderers: { trails: trailOverlay as never },
    } satisfies RenderLoopConfig);

    loop.renderSync(frameParams("staff"), 100, 1 / 60);
    loop.renderSync(frameParams("fan"), 116, 1 / 60);
    loop.renderSync(frameParams("fan"), 132, 1 / 60);

    expect(trailFrames).toHaveLength(3);
    expect(trailFrames[0]?.bluePropSwapSuppressed).toBe(false);
    expect(trailFrames[1]?.bluePropSwapSuppressed).toBe(true);
    expect(trailFrames[1]?.redPropSwapSuppressed).toBe(false);
    expect(trailFrames[2]?.bluePropSwapSuppressed).toBe(false);
  });
});
