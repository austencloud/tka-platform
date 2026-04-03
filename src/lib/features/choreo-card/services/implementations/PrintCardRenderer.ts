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
import type { ICardBackDomRenderer } from "../contracts/ICardBackDomRenderer";
import type { IInfoCardCanvasRenderer } from "../contracts/IInfoCardCanvasRenderer";
import type { ISequenceToEntryConverter } from "../contracts/ISequenceToEntryConverter";
import type { ILOOPExplainer } from "../contracts/ILOOPExplainer";


// MPC poker card defaults
const MPC_WIDTH = 822;
const MPC_HEIGHT = 1122;
const MPC_BLEED = 36;
const CONTENT_WIDTH = MPC_WIDTH - MPC_BLEED * 2;   // 750
const CONTENT_HEIGHT = MPC_HEIGHT - MPC_BLEED * 2;  // 1050

export class PrintCardRenderer implements IPrintCardRenderer {
  constructor(
    private readonly imageComposer: IImageComposer,
    private readonly cardBackDomRenderer: ICardBackDomRenderer,
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
      userName: "Austen Cloud",
      exportDate: new Date().toISOString(),
      notes: "Created with TKA Composer",
      customNotesText: "Created with TKA Composer",
      showCreatorName: true,
      showNotes: true,
      showBirthday: true,
      loopType: sequence.loopType ?? undefined,
      showLoopGlyph: !!sequence.loopType,
      ...(options.bluePropType && { bluePropTypeOverride: options.bluePropType }),
      ...(options.redPropType && { redPropTypeOverride: options.redPropType }),
      visibilityOverrides: {
        showTKA: options.showTKA,
        showGrid: options.showGrid,
        showQRCode: options.showQRCode ?? false,
        printMode: true,
        darkMode: false,
        handPointVisibility: options.handPointsVisible ? "all" : "none",
        ...(options.bluePropType && { bluePropType: options.bluePropType }),
        ...(options.redPropType && { redPropType: options.redPropType }),
      },
    });

    // Wrap in MPC canvas with bleed
    const mpcCanvas = document.createElement("canvas");
    mpcCanvas.width = canvasW;
    mpcCanvas.height = canvasH;
    const mpcCtx = mpcCanvas.getContext("2d")!;

    // 1. Fill bleed area with neutral gray (cutting guide)
    mpcCtx.fillStyle = "#808080";
    mpcCtx.fillRect(0, 0, canvasW, canvasH);

    // 2. Fill content area with white
    mpcCtx.fillStyle = "#ffffff";
    mpcCtx.fillRect(bleed, bleed, contentW, contentH);

    // 3. Center sequence in content area with consistent inner margin
    const innerMargin = 24;
    const availW = contentW - innerMargin * 2;
    const availH = contentH - innerMargin * 2;

    const scaleX = availW / sequenceCanvas.width;
    const scaleY = availH / sequenceCanvas.height;
    const scale = Math.min(scaleX, scaleY);
    const drawW = sequenceCanvas.width * scale;
    const drawH = sequenceCanvas.height * scale;
    const offsetX = bleed + innerMargin + (availW - drawW) / 2;
    const offsetY = bleed + innerMargin + (availH - drawH) / 2;

    mpcCtx.drawImage(sequenceCanvas, offsetX, offsetY, drawW, drawH);

    return mpcCanvas;
  }

  async renderBack(
    sequence: SequenceData,
    options: PrintRenderOptions
  ): Promise<HTMLCanvasElement> {
    const canvasWidth = options.canvasWidth ?? MPC_WIDTH;
    const canvasHeight = options.canvasHeight ?? MPC_HEIGHT;
    const bleedPx = options.bleedPx ?? MPC_BLEED;
    const theme = options.theme ?? this.theme;

    return this.cardBackDomRenderer.render(sequence, {
      width: canvasWidth,
      height: canvasHeight,
      bleedPx,
      theme,
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
