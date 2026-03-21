/**
 * PrintCardRenderer
 *
 * Orchestrates rendering print-ready card faces (front + back) at MPC
 * specifications (822x1122px at 300 DPI with 36px bleed).
 *
 * Fronts: delegates to ImageComposer, then wraps in bleed canvas.
 * Backs: delegates to CardBackCanvasRenderer.
 * Info cards: delegates to InfoCardCanvasRenderer.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { IImageComposer } from "$lib/shared/render/services/contracts/IImageComposer";
import type { IPrintCardRenderer, PrintRenderOptions } from "../contracts/IPrintCardRenderer";
import type { ICardBackCanvasRenderer } from "../contracts/ICardBackCanvasRenderer";
import type { IInfoCardCanvasRenderer } from "../contracts/IInfoCardCanvasRenderer";
import type { ISequenceToEntryConverter } from "../contracts/ISequenceToEntryConverter";
import type { ILOOPExplainer } from "../contracts/ILOOPExplainer";
import { deriveCardBackData } from "../../components/card-back/card-back-data";


// MPC poker card defaults
const MPC_WIDTH = 822;
const MPC_HEIGHT = 1122;
const MPC_BLEED = 36;
const CONTENT_WIDTH = MPC_WIDTH - MPC_BLEED * 2;   // 750
const CONTENT_HEIGHT = MPC_HEIGHT - MPC_BLEED * 2;  // 1050

export class PrintCardRenderer implements IPrintCardRenderer {
  constructor(
    private readonly imageComposer: IImageComposer,
    private readonly cardBackRenderer: ICardBackCanvasRenderer,
    private readonly infoCardRenderer: IInfoCardCanvasRenderer,
    private readonly sequenceToEntryConverter: ISequenceToEntryConverter,
    private readonly loopExplainer: ILOOPExplainer,
    private readonly theme: string = "nightSky"
  ) {}

  async renderFront(
    sequence: SequenceData,
    options: PrintRenderOptions
  ): Promise<HTMLCanvasElement> {
    const canvasW = options.canvasWidth ?? MPC_WIDTH;
    const canvasH = options.canvasHeight ?? MPC_HEIGHT;
    const bleed = options.bleedPx ?? MPC_BLEED;
    const contentW = canvasW - bleed * 2;
    const contentH = canvasH - bleed * 2;

    const sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, {
      includeStartPosition: options.includeStartPosition,
      startPositionLayout: options.startPositionLayout ?? "column",
      addStepNumbers: true,
      addWord: options.showWord,
      addDifficultyLevel: true,
      stepSize: 300,
      stepScale: 1,
      margin: 0,
      format: "PNG",
      quality: 1,
      scale: 1,
      redVisible: true,
      blueVisible: true,
      addReversalSymbols: true,
      combinedGrids: false,
      userName: "",
      exportDate: "",
      notes: "",
      loopType: sequence.loopType ?? undefined,
      showLoopGlyph: !!sequence.loopType,
      ...(options.bluePropType && { bluePropTypeOverride: options.bluePropType }),
      ...(options.redPropType && { redPropTypeOverride: options.redPropType }),
      visibilityOverrides: {
        showTKA: options.showTKA,
        showGrid: options.showGrid,
        printMode: true,
        darkMode: false,
        handPointVisibility: options.handPointsVisible ? "all" : "none",
        ...(options.bluePropType && { bluePropType: options.bluePropType }),
        ...(options.redPropType && { redPropType: options.redPropType }),
      },
    });

    // Create the final MPC canvas and wrap with bleed
    const mpcCanvas = document.createElement("canvas");
    mpcCanvas.width = canvasW;
    mpcCanvas.height = canvasH;
    const ctx = mpcCanvas.getContext("2d")!;

    // Fill entire canvas with the dominant edge color (for bleed)
    // Sample the corner colors of the rendered sequence
    const seqCtx = sequenceCanvas.getContext("2d")!;
    const edgePixel = seqCtx.getImageData(0, 0, 1, 1).data;
    ctx.fillStyle = `rgb(${edgePixel[0]}, ${edgePixel[1]}, ${edgePixel[2]})`;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Draw the sequence centered in the content area, scaled to fit
    const scaleX = contentW / sequenceCanvas.width;
    const scaleY = contentH / sequenceCanvas.height;
    const scale = Math.min(scaleX, scaleY);
    const drawW = sequenceCanvas.width * scale;
    const drawH = sequenceCanvas.height * scale;
    const offsetX = bleed + (contentW - drawW) / 2;
    const offsetY = bleed + (contentH - drawH) / 2;

    ctx.drawImage(sequenceCanvas, offsetX, offsetY, drawW, drawH);

    return mpcCanvas;
  }

  async renderBack(
    sequence: SequenceData,
    options: PrintRenderOptions
  ): Promise<HTMLCanvasElement> {
    const data = deriveCardBackData(
      sequence,
      this.sequenceToEntryConverter,
      this.loopExplainer
    );

    return this.cardBackRenderer.render(data, {
      width: options.canvasWidth ?? MPC_WIDTH,
      height: options.canvasHeight ?? MPC_HEIGHT,
      bleedPx: options.bleedPx ?? MPC_BLEED,
      theme: options.theme ?? this.theme,
    });
  }

  async renderInfoCardFront(theme?: string): Promise<HTMLCanvasElement> {
    return this.infoCardRenderer.renderFront({
      width: MPC_WIDTH,
      height: MPC_HEIGHT,
      bleedPx: MPC_BLEED,
      theme: theme ?? this.theme,
    });
  }

  async renderInfoCardBack(theme?: string): Promise<HTMLCanvasElement> {
    return this.infoCardRenderer.renderBack({
      width: MPC_WIDTH,
      height: MPC_HEIGHT,
      bleedPx: MPC_BLEED,
      theme: theme ?? this.theme,
    });
  }
}
