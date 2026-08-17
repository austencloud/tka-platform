import { describe, expect, it, vi } from "vitest";
import { AnimationRenderLoop } from "$lib/shared/animation-engine/services/animation-render-loop";
import type {
  RenderFrameParams,
  RenderLoopConfig,
} from "$lib/shared/animation-engine/services/IAnimationRenderLoop";
import type { IAnimationRenderer } from "$lib/shared/animation-engine/services/IAnimationRenderer";
import type { EffectRendererLike } from "$lib/shared/animation-engine/services/effects/effect-renderer";
import type {
  LedSampler,
  LedSamplerConfig,
} from "$lib/shared/animation-engine/services/led-sampler";
import {
  DEFAULT_LED_CONFIG,
  type LedFrameInput,
  type LedSample,
} from "$lib/shared/animation-engine/domain/types/led-types";
import { DEFAULT_TRAIL_SETTINGS } from "$lib/shared/animation-engine/domain/types/trail-types";
import type { PropState } from "$lib/shared/foundation/domain/types/prop-state";

function prop(angle: number): PropState {
  return {
    centerPathAngle: angle,
    staffRotationAngle: angle,
  } as PropState;
}

function ledSample(propIndex: number): LedSample {
  return {
    x: 100 + propIndex,
    y: 200 + propIndex,
    propIndex,
    ledIndex: 0,
    endpointIndex: 0,
    brightness: 1,
    r: 1,
    g: 1,
    b: 1,
  };
}

function frameParams({
  blueProp,
  redProp,
  blueMotionVisible,
  redMotionVisible,
  additionalLayers = [],
}: {
  blueProp: PropState | null;
  redProp: PropState | null;
  blueMotionVisible: boolean;
  redMotionVisible: boolean;
  additionalLayers?: Array<{
    blueProp: PropState | null;
    redProp: PropState | null;
  }>;
}): RenderFrameParams {
  return {
    stepData: null,
    currentStep: 0,
    trailSettings: DEFAULT_TRAIL_SETTINGS,
    gridVisible: false,
    gridMode: null,
    letter: null,
    props: {
      blueProp,
      redProp,
      additionalLayers,
      bluePropDimensions: { width: 252.8, height: 77.8 },
      redPropDimensions: { width: 252.8, height: 77.8 },
      tunnelSpectrum: false,
    },
    visibility: {
      gridVisible: false,
      propsVisible: true,
      trailsVisible: false,
      blueMotionVisible,
      redMotionVisible,
    },
    isPlaying: true,
    bluePropType: "staff",
    redPropType: "staff",
    tipEffectMap: { "*": { effect: "led" } },
    ledConfig: { ...DEFAULT_LED_CONFIG, enabled: true },
  };
}

function createHarness() {
  const update = vi.fn(
    (
      blueProp: PropState | null,
      redProp: PropState | null,
      config: LedSamplerConfig
    ): LedSample[] => {
      const leds: LedSample[] = [];
      if (blueProp) leds.push(ledSample(0));
      if (redProp) leds.push(ledSample(1));
      config.additionalLayers?.forEach((layer, index) => {
        if (layer.blueProp) leds.push(ledSample(2 + index * 2));
        if (layer.redProp) leds.push(ledSample(3 + index * 2));
      });
      return leds;
    }
  );
  const renderLeds = vi.fn<(input: LedFrameInput) => void>();
  const ledRenderer = {
    isInitialized: () => true,
    renderLeds,
  } as unknown as EffectRendererLike;
  const renderer = {
    renderScene: vi.fn(),
  } as unknown as IAnimationRenderer;
  const loop = new AnimationRenderLoop();

  loop.initialize({
    renderer,
    TrailCapturer: null,
    pathCache: null,
    canvasSize: 500,
    ledSampler: { update } as unknown as LedSampler,
    renderers: { led: ledRenderer },
  } satisfies RenderLoopConfig);

  return { loop, update, renderLeds };
}

describe("AnimationRenderLoop LED motion visibility", () => {
  it("removes a hidden hand and its tunnel copies from the LED frame", () => {
    const blueProp = prop(0);
    const redProp = prop(Math.PI);
    const blueLayerProp = prop(0.5);
    const redLayerProp = prop(2.5);
    const { loop, update, renderLeds } = createHarness();

    loop.renderSync(
      frameParams({
        blueProp,
        redProp,
        blueMotionVisible: false,
        redMotionVisible: true,
        additionalLayers: [{ blueProp: blueLayerProp, redProp: redLayerProp }],
      }),
      100,
      1 / 60
    );

    const [visibleBlue, visibleRed, samplerConfig] = update.mock.calls[0]!;
    expect(visibleBlue).toBeNull();
    expect(visibleRed).toBe(redProp);
    expect(samplerConfig.additionalLayers).toEqual([
      { blueProp: null, redProp: redLayerProp },
    ]);
    expect(renderLeds).toHaveBeenCalledOnce();
    expect(
      renderLeds.mock.calls[0]![0].leds.map((led) => led.propIndex)
    ).toEqual([1, 3]);
  });

  it("submits an empty LED frame when the last visible source is hidden", () => {
    const { loop, renderLeds } = createHarness();

    loop.renderSync(
      frameParams({
        blueProp: prop(0),
        redProp: null,
        blueMotionVisible: false,
        redMotionVisible: true,
      }),
      100,
      1 / 60
    );

    expect(renderLeds).toHaveBeenCalledOnce();
    expect(renderLeds.mock.calls[0]![0].leds).toEqual([]);
  });
});
