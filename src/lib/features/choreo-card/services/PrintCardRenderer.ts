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
import type { PrintRenderOptions } from "./types";
import { renderCardBack } from "./card-back-dom-renderer";
import { renderInfoCardFront, renderInfoCardBack } from "./info-card-canvas-renderer";
import { buildBackJob } from "./card-back/card-back-job-builder";
import { paintBackJob } from "./card-back/card-back-raster";
import { buildCanonicalCardVisibility } from "../domain/canonical-card-visibility";
import { wrapContentInCardFrame } from "./card-front-frame";


// MPC poker card defaults
const MPC_WIDTH = 822;
const MPC_HEIGHT = 1122;
const MPC_BLEED = 36;
const CONTENT_WIDTH = MPC_WIDTH - MPC_BLEED * 2;   // 750

// Colored frame thickness as a multiple of the print bleed. Must match the
// frame module's BORDER_SCALE — both inset content by round(bleed * 1.3).
const BORDER_SCALE = 2.0;

export class PrintCardRenderer {
  constructor(
    private readonly imageComposer: ImageComposer,
    private readonly theme: string = "cosmic"
  ) {}

  async renderFront(
    sequence: SequenceData,
    options: PrintRenderOptions
  ): Promise<HTMLCanvasElement> {
    const canvasW = options.canvasWidth ?? MPC_WIDTH;
    const canvasH = options.canvasHeight ?? MPC_HEIGHT;
    const bleed = options.bleedPx ?? MPC_BLEED;
    // Border (colored frame) is thicker than the bleed so it stays visible after
    // an imprecise cut. Content insets by `border`, not `bleed`.
    const border = Math.round(bleed * BORDER_SCALE);
    const contentW = canvasW - border * 2;
    const contentH = canvasH - border * 2;

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

    const sequenceCanvas = await this.imageComposer.composeSequenceImage(sequence, composeOptions);

    // Wrap the content in the MPC card frame (stripe border + edge glow +
    // white inner area inset by the colored border). Single source of truth.
    return wrapContentInCardFrame(sequenceCanvas, {
      canvasWidth: canvasW,
      canvasHeight: canvasH,
      bleedPx: bleed,
      accent,
      dark,
    });
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
