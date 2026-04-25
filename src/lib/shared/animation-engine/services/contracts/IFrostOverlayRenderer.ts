import type { Frost2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { FrostTipInput } from "$lib/shared/effects/renderers/Frost2DRenderer";

export interface IFrostOverlayRenderer {
  initialize(container: HTMLElement, width: number, height: number): boolean;
  resize(width: number, height: number): void;
  renderFrame(params: Frost2DParams, tips: FrostTipInput, dt: number): void;
  clear(): void;
  setVisible(visible: boolean): void;
  setCanvasZIndex(z: number): void;
  dispose(): void;
  isInitialized(): boolean;
  getCanvas(): HTMLCanvasElement | null;
}
