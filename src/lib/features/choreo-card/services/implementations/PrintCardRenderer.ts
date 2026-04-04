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

  /** Draw a rounded rectangle path (does not fill or stroke) */
  private roundRectPath(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.closePath();
  }

  /** Fill the canvas with diagonal pinstripes */
  private drawStripes(
    ctx: CanvasRenderingContext2D,
    w: number, h: number,
    accent: string, dark: string,
    stripeWidth: number = 6
  ): void {
    // Fill base with dark color
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, w, h);

    // Draw diagonal accent stripes
    ctx.fillStyle = accent;
    const half = stripeWidth / 2;
    const diagonal = Math.sqrt(w * w + h * h);
    const count = Math.ceil(diagonal / stripeWidth) + 1;

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 4); // 45 degrees

    for (let i = -count; i <= count; i++) {
      const x = i * stripeWidth;
      ctx.fillRect(x, -diagonal / 2, half, diagonal);
    }
    ctx.restore();
  }

  /** Draw the edge glow overlay */
  private drawEdgeGlow(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const glowHeight = h * 0.2;

    // Top glow
    const topGrad = ctx.createLinearGradient(0, 0, 0, glowHeight);
    topGrad.addColorStop(0, "rgba(255, 255, 255, 0.2)");
    topGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, w, glowHeight);

    // Bottom glow
    const botGrad = ctx.createLinearGradient(0, h - glowHeight, 0, h);
    botGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
    botGrad.addColorStop(1, "rgba(255, 255, 255, 0.2)");
    ctx.fillStyle = botGrad;
    ctx.fillRect(0, h - glowHeight, w, glowHeight);
  }

  async renderFront(
    sequence: SequenceData,
    options: PrintRenderOptions
  ): Promise<HTMLCanvasElement> {
    const canvasW = options.canvasWidth ?? MPC_WIDTH;
    const canvasH = options.canvasHeight ?? MPC_HEIGHT;
    const bleed = options.bleedPx ?? MPC_BLEED;
    const contentW = canvasW - bleed * 2;
    const contentH = canvasH - bleed * 2;

    // Resolve element colors
    const accent = options.elementTheme?.accentColor ?? "#999999";
    const dark = options.elementTheme?.darkComplement ?? "#444444";

    // Render the sequence image (keep all existing options)
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

    // Build the card canvas
    const mpcCanvas = document.createElement("canvas");
    mpcCanvas.width = canvasW;
    mpcCanvas.height = canvasH;
    const ctx = mpcCanvas.getContext("2d")!;

    const outerRadius = 12;
    const innerRadius = 8;

    // 1. Clip to rounded outer card shape
    ctx.save();
    this.roundRectPath(ctx, 0, 0, canvasW, canvasH, outerRadius);
    ctx.clip();

    // 2. Draw stripe pattern across entire canvas
    this.drawStripes(ctx, canvasW, canvasH, accent, dark);

    // 3. Draw edge glow overlay
    this.drawEdgeGlow(ctx, canvasW, canvasH);

    // 4. Clip inner content area (rounded rect inside bleed)
    ctx.save();
    this.roundRectPath(ctx, bleed, bleed, contentW, contentH, innerRadius);
    ctx.clip();

    // 5. Fill inner area with white
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bleed, bleed, contentW, contentH);

    // 6. Draw sequence image filling full width of content area
    // Scale to full width so gray header/footer extend edge-to-edge.
    // Vertical overflow is clipped by the inner content area.
    const scale = contentW / sequenceCanvas.width;
    const drawW = contentW;
    const drawH = sequenceCanvas.height * scale;
    const offsetX = bleed;
    const offsetY = bleed + (contentH - drawH) / 2;

    ctx.drawImage(sequenceCanvas, offsetX, offsetY, drawW, drawH);

    ctx.restore(); // inner clip
    ctx.restore(); // outer clip

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
