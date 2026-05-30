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
import type { ImageComposer } from "../../../shared/render/services/image-composer";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
import type { RenderCanvas } from "$lib/shared/render/services/types";
import type { PrintRenderOptions } from "./types";
import { renderCardBack } from "./card-back-dom-renderer";
import { renderInfoCardFront, renderInfoCardBack } from "./info-card-canvas-renderer";
import { buildBackJob } from "./card-back/card-back-job-builder";
import { paintBackJob } from "./card-back/card-back-raster";
import { buildCanonicalCardVisibility } from "../domain/canonical-card-visibility";


// MPC poker card defaults
const MPC_WIDTH = 822;
const MPC_HEIGHT = 1122;
const MPC_BLEED = 36;
const CONTENT_WIDTH = MPC_WIDTH - MPC_BLEED * 2;   // 750

const OUTER_RADIUS = 0;
const INNER_RADIUS = 0;

export class PrintCardRenderer {
  constructor(
    private readonly imageComposer: ImageComposer,
    private readonly theme: string = "cosmic"
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
    const accent = options.tndElement?.accentColor ?? "#999999";
    const dark = options.tndElement?.darkComplement ?? "#444444";

    // Source word + pictograph visibility from the canonical locked profile.
    const canonical = buildCanonicalCardVisibility({
      tndElement: options.tndElement,
      bluePropType: options.bluePropType,
      redPropType: options.redPropType,
    });

    // Render the sequence image (keep all existing options)
    const composeOptions: Partial<SequenceExportOptions> = {
      deckCard: { contentWidth: contentW, contentHeight: contentH },
      includeStartPosition: options.includeStartPosition,
      startPositionLayout: options.startPositionLayout ?? "row",
      addStepNumbers: true,
      addWord: canonical.addWord,
      addDifficultyLevel: false,
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
      userName: sequence.author ?? "",
      exportDate: new Date().toISOString(),
      notes: options.notes ?? "",
      showCreatorName: !!options.leftLabel,
      showNotes: !!(options.notes || options.leftLabel || options.rightLabel || options.iconPath),
      showBirthday: false,
      leftLabel: options.leftLabel,
      rightLabel: options.rightLabel,
      iconPath: options.iconPath,
      accentColor: options.tndElement?.accentColor,
      accentTintOpacity: options.tndElement?.cardTintOpacity,
      loopType: sequence.loopType ?? undefined,
      showLoopGlyph: false,
      ...(options.bluePropType && { bluePropTypeOverride: options.bluePropType }),
      ...(options.redPropType && { redPropTypeOverride: options.redPropType }),
      ...(options.deckId && { deckId: options.deckId }),
      ...(options.deckName && { deckName: options.deckName }),
      visibilityOverrides: {
        ...canonical.visibilityOverrides,
        // showMandala stays deck-config (mandala fills in empty cells).
        showMandala: options.showMandala ?? false,
      },
    };

    // Worker front rendering is parked: the worker pipeline crashes on deep
    // $env coupling + missing preparer wiring (see worker-pool-card-rendering
    // spec). Fronts render on the proven main-thread path until a FrontJob
    // (plain-data) worker rebuild lands.
    const sequenceCanvas: RenderCanvas = await this.imageComposer.composeSequenceImage(
      sequence,
      composeOptions,
    );

    // Build the card canvas
    const mpcCanvas = document.createElement("canvas");
    mpcCanvas.width = canvasW;
    mpcCanvas.height = canvasH;
    const ctx = mpcCanvas.getContext("2d")!;

    const outerRadius = OUTER_RADIUS;
    const innerRadius = INNER_RADIUS;

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

    // 6. Draw sequence image - deckCard mode produces exact content dimensions, draw 1:1
    ctx.drawImage(sequenceCanvas, bleed, bleed, contentW, contentH);

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

    // The back currently rasterizes at scale 2 (the DOM renderer's
    // modern-screenshot scale:2) → 1644x2244. Match that with the new BackJob
    // path so the CardPair seam + print output stay pixel-identical in size.
    const scale = 2;
    try {
      const job = await buildBackJob(sequence, {
        width: canvasWidth * scale,
        height: canvasHeight * scale,
        bleedPx: bleedPx * scale,
        theme,
      });
      const off = paintBackJob(job);
      // Convert OffscreenCanvas → HTMLCanvasElement for the CardPair seam.
      const out = document.createElement("canvas");
      out.width = off.width;
      out.height = off.height;
      out.getContext("2d")!.drawImage(off, 0, 0);
      return out;
    } catch (err) {
      console.warn(
        "[PrintCardRenderer] new back path failed, falling back to DOM renderer:",
        err,
      );
      return renderCardBack(sequence, {
        width: canvasWidth,
        height: canvasHeight,
        bleedPx,
        theme,
      });
    }
  }

  async renderInfoCardFront(theme?: string): Promise<HTMLCanvasElement> {
    return renderInfoCardFront({
      width: MPC_WIDTH,
      height: MPC_HEIGHT,
      bleedPx: MPC_BLEED,
      theme: theme ?? this.theme,
    });
  }

  async renderInfoCardBack(theme?: string): Promise<HTMLCanvasElement> {
    return renderInfoCardBack({
      width: MPC_WIDTH,
      height: MPC_HEIGHT,
      bleedPx: MPC_BLEED,
      theme: theme ?? this.theme,
    });
  }
}
