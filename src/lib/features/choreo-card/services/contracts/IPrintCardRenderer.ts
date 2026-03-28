import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface PrintRenderOptions {
  canvasWidth?: number;
  canvasHeight?: number;
  bleedPx?: number;
  showGrid: boolean;
  showTKA: boolean;
  showWord: boolean;
  includeStartPosition: boolean;
  startPositionLayout?: "row" | "column";
  handPointsVisible: boolean;
  /** Override the default card back theme (e.g. "nightSky", "deepOcean") */
  theme?: string;
  /** Show QR code in an empty grid cell */
  showQRCode?: boolean;
  /** Override prop types (reads from settings when not provided) */
  bluePropType?: PropType;
  redPropType?: PropType;
}

export interface IPrintCardRenderer {
  renderFront(sequence: SequenceData, options: PrintRenderOptions): Promise<HTMLCanvasElement>;
  renderBack(sequence: SequenceData, options: PrintRenderOptions): Promise<HTMLCanvasElement>;
  renderInfoCardFront(theme?: string): Promise<HTMLCanvasElement>;
  renderInfoCardBack(theme?: string): Promise<HTMLCanvasElement>;
}
