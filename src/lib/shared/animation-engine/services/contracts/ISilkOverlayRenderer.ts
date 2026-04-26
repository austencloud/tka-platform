import type { Silk2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { SilkTipInput } from "$lib/shared/effects/renderers/Silk2DRenderer";

export interface ISilkOverlayRenderer {
  initialize(container: HTMLElement, width: number, height: number): boolean;
  resize(width: number, height: number): void;
  renderFrame(params: Silk2DParams, tips: SilkTipInput, dt: number, loopDetected?: boolean): void;
  clear(): void;
  setVisible(visible: boolean): void;
  setCanvasZIndex(z: number): void;
  dispose(): void;
  isInitialized(): boolean;
  getCanvas(): HTMLCanvasElement | null;
}
