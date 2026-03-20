import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";

export interface PrintRenderOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  bleedPx?: number;
  showGrid: boolean;
  showTKA: boolean;
  showWord: boolean;
  includeStartPosition: boolean;
  handPointsVisible: boolean;
  /** Override the default card back theme (e.g. "nightSky", "deepOcean") */
  theme?: string;
}

export interface IPrintCardRenderer {
  renderFront(sequence: SequenceData, options: PrintRenderOptions): Promise<HTMLCanvasElement>;
  renderBack(sequence: SequenceData, options: PrintRenderOptions): Promise<HTMLCanvasElement>;
  renderInfoCardFront(theme?: string): Promise<HTMLCanvasElement>;
  renderInfoCardBack(theme?: string): Promise<HTMLCanvasElement>;
}
