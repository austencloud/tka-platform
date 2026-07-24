import { describe, expect, it, vi } from "vitest";
import {
  ExportFrameCompositor,
  type FrameCompositorConfig,
} from "$lib/features/compose/services/export-frame-compositor";

function config(): FrameCompositorConfig {
  return {
    outputWidth: 950,
    outputHeight: 950,
    sourceWidth: 950,
    headerHeight: 0,
    progressBarHeight: 0,
    outputCanvasSize: 950,
    scaleFactor: 1,
    fps: 60,
    showTkaGlyph: false,
    showStepNumbers: false,
    showWordHeader: false,
    showProgressBar: false,
    isDarkMode: true,
    isCompositeMode: false,
    sequenceWord: "",
    difficultyLevel: null,
    loopComponents: null,
    rotationPeriod: undefined,
    inversionPeriod: undefined,
    overlayComponents: null,
    showBluePathLines: false,
    showRedPathLines: false,
    sequenceSteps: [],
  };
}

describe("ExportFrameCompositor mandala stacking", () => {
  it("draws the mandala below the scene and trail overlays", () => {
    const mandala = {
      width: 950,
      height: 950,
      getAttribute: (name: string) =>
        name === "data-animation-layer" ? "mandala" : null,
    } as unknown as HTMLCanvasElement;
    const trails = {
      width: 950,
      height: 950,
      getAttribute: () => null,
    } as unknown as HTMLCanvasElement;
    const host = {
      querySelectorAll: () => [mandala, scene, trails],
    } as unknown as HTMLElement;
    const scene = {
      width: 950,
      height: 950,
      parentElement: host,
      getAttribute: () => null,
    } as unknown as HTMLCanvasElement;

    const drawImage = vi.fn();
    const ctx = {
      fillStyle: "",
      fillRect: vi.fn(),
      drawImage,
    } as unknown as CanvasRenderingContext2D;
    const output = {} as HTMLCanvasElement;
    const compositor = new ExportFrameCompositor(
      config(),
      {} as ConstructorParameters<typeof ExportFrameCompositor>[1],
      {} as ConstructorParameters<typeof ExportFrameCompositor>[2],
    );

    compositor.renderCanvasLayers(ctx, scene, false, 0, output, 0);

    expect(drawImage.mock.calls.map((call) => call[0])).toEqual([
      mandala,
      scene,
      trails,
    ]);
  });
});
