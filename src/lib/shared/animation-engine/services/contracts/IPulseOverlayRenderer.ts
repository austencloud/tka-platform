import type { Pulse2DParams } from "$lib/shared/effects/translators/canvas2d-types";
import type { PulseTipInput } from "$lib/shared/effects/renderers/Pulse2DRenderer";

export interface IPulseOverlayRenderer {
  initialize(container: HTMLElement, width: number, height: number): boolean;
  resize(width: number, height: number): void;
  renderFrame(params: Pulse2DParams, tips: PulseTipInput[], currentStep: number, dt: number): void;
  clear(): void;
  setVisible(visible: boolean): void;
  setCanvasZIndex(z: number): void;
  dispose(): void;
  isInitialized(): boolean;
  getCanvas(): HTMLCanvasElement | null;
}
