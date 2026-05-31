/**
 * build-front-compose-options
 *
 * Single source of truth for the card-FRONT compose options + frame geometry.
 * `PrintCardRenderer.renderFront`, the composition worker (via the parity
 * harness), and any future print path all call this one builder, so the
 * main-thread and worker renders are byte-identical by construction instead of
 * by hand-mirrored option objects (which drift).
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
import type { PrintRenderOptions } from "./types";
import { buildCanonicalCardVisibility } from "../domain/canonical-card-visibility";

// MPC poker card defaults (822x1122 at 300 DPI with 36px bleed).
const MPC_WIDTH = 822;
const MPC_HEIGHT = 1122;
const MPC_BLEED = 36;

// Colored frame thickness as a multiple of the print bleed. MUST match
// card-front-frame.ts BORDER_SCALE — both inset content by round(bleed * scale).
const BORDER_SCALE = 2.0;

/** Concrete frame geometry/colors for `wrapContentInCardFrame`. */
export interface FrontCardFrame {
  canvasWidth: number;
  canvasHeight: number;
  bleedPx: number;
  accent: string;
  dark: string;
}

export interface FrontComposeResult {
  composeOptions: Partial<SequenceExportOptions>;
  frame: FrontCardFrame;
}

/**
 * Build the front compose options + frame from a sequence and its print
 * options. `exportDate` is injected so a parity caller can pass ONE timestamp to
 * both the main and worker renders (pixel parity); production defaults it to
 * now.
 */
export function buildFrontComposeOptions(
  sequence: SequenceData,
  options: PrintRenderOptions,
  exportDate: string = new Date().toISOString(),
): FrontComposeResult {
  const canvasW = options.canvasWidth ?? MPC_WIDTH;
  const canvasH = options.canvasHeight ?? MPC_HEIGHT;
  const bleed = options.bleedPx ?? MPC_BLEED;
  // Border (colored frame) is thicker than the bleed so it stays visible after
  // an imprecise cut. Content insets by `border`, not `bleed`.
  const border = Math.round(bleed * BORDER_SCALE);
  const contentW = canvasW - border * 2;
  const contentH = canvasH - border * 2;

  const accent = options.tndElement?.accentColor ?? "#999999";
  const dark = options.tndElement?.darkComplement ?? "#444444";

  // Source word + pictograph visibility from the canonical locked profile.
  const canonical = buildCanonicalCardVisibility({
    tndElement: options.tndElement,
    bluePropType: options.bluePropType,
    redPropType: options.redPropType,
  });

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
    exportDate,
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

  return {
    composeOptions,
    frame: { canvasWidth: canvasW, canvasHeight: canvasH, bleedPx: bleed, accent, dark },
  };
}
