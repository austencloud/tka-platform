/**
 * card-back-job-builder.ts
 *
 * Assembles a `BackJob` (plain data + ImageBitmaps) from a SequenceData on the
 * MAIN THREAD. This is the entry point the renderer (P1.7) and the worker path
 * (Phase 2) call. Everything DOM/SVG/font-dependent — decorations, brand, URL,
 * difficulty badge, loop icons, glyphs, step count, start pictograph — is
 * rasterized to an ImageBitmap HERE. The downstream painter (P1.6) only does
 * gradient fills + a Path2D mandala + drawImage, so it needs no DOM.
 *
 * PROOF MODE: the print path uses getCardBackThemeVisuals(theme) ===
 * getProofModeVisuals(theme): white background gradient, decorationOpacity 0
 * (decorations HIDDEN → null), dark text (#111), single-stop linear-gradient
 * borders. This builder uses getCardBackThemeVisuals exactly as CardBack.svelte
 * does, so colors match.
 *
 * The mandala geometry calculator + the element rasterizers touch the DOM /
 * canvas (and the calculator is browser-only), so all of them are injectable
 * via the `deps` parameter — defaulting to the real implementations — for
 * jsdom-based unit testing.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { MandalaPaths, MandalaPalette } from "$lib/shared/mandala/domain/mandala-types";
import type { MandalaPathOptions } from "$lib/shared/mandala/services/contracts/types";
import {
  MANDALA_STANDARD_TIP_DX,
  DARK_MOTION_BLUE_STROKE,
  DARK_MOTION_BLUE_FILL,
  DARK_MOTION_RED_STROKE,
  DARK_MOTION_RED_FILL,
  DARK_MOTION_PURPLE_STROKE,
  DARK_MOTION_PURPLE_FILL,
  LIGHT_MOTION_BLUE_STROKE,
  LIGHT_MOTION_BLUE_FILL,
  LIGHT_MOTION_RED_STROKE,
  LIGHT_MOTION_RED_FILL,
  LIGHT_MOTION_PURPLE_STROKE,
  LIGHT_MOTION_PURPLE_FILL,
} from "$lib/shared/mandala/domain/mandala-constants";
import { getMandalaGeometryCalculator } from "$lib/shared/mandala/getMandalaGeometryCalculator";
import { LOOPComponent } from "$lib/shared/foundation/domain/models/generation/generate-models";
import { Period } from "$lib/shared/foundation/domain/models/generation/circular-models";
import { resolveLoopDisplay } from "$lib/features/loop-labeler/services/loop-display-resolver";

import type { BackJob, PlacedBitmap } from "./back-job";
import { computeCardBackLayout } from "./card-back-layout";
import { deriveCardBackData } from "../../components/card-back/card-back-data";
import { getCardBackThemeVisuals } from "../../components/card-back/card-back-theme-visuals";
import { parseLinearGradient } from "./gradient-parse";
import {
  rasterizeBrand,
  rasterizeUrl,
  rasterizeDifficultyBadge,
  rasterizeLoopIcon,
  LOOP_ICONS,
} from "./card-back-bitmaps-constant";
import {
  rasterizeTurnGlyph,
  rasterizeReversalGlyph,
  rasterizeStepCount,
  rasterizeStartPosPictograph,
} from "./card-back-bitmaps-percard";
import { rasterizeDecorations } from "./card-back-decorations-svg";

// Bleed: the BackJob bleedPx is 36 logical * scale 2 = 72 (see back-job.ts).
const DEFAULT_BLEED_PX = 72;

/**
 * Canonical LOOP component display order — must match CardBack.svelte
 * LOOP_DISPLAY_ORDER (and card-back-layout.ts).
 */
const LOOP_DISPLAY_ORDER: LOOPComponent[] = [
  LOOPComponent.ROTATED,
  LOOPComponent.MIRRORED,
  LOOPComponent.FLIPPED,
  LOOPComponent.SWAPPED,
  LOOPComponent.INVERTED,
  LOOPComponent.REWOUND,
];

const DARK_MANDALA_PALETTE: MandalaPalette = {
  blueStroke: DARK_MOTION_BLUE_STROKE,
  blueFill: DARK_MOTION_BLUE_FILL,
  redStroke: DARK_MOTION_RED_STROKE,
  redFill: DARK_MOTION_RED_FILL,
  purpleStroke: DARK_MOTION_PURPLE_STROKE,
  purpleFill: DARK_MOTION_PURPLE_FILL,
};

const LIGHT_MANDALA_PALETTE: MandalaPalette = {
  blueStroke: LIGHT_MOTION_BLUE_STROKE,
  blueFill: LIGHT_MOTION_BLUE_FILL,
  redStroke: LIGHT_MOTION_RED_STROKE,
  redFill: LIGHT_MOTION_RED_FILL,
  purpleStroke: LIGHT_MOTION_PURPLE_STROKE,
  purpleFill: LIGHT_MOTION_PURPLE_FILL,
};

export interface BuildBackJobOptions {
  width: number;
  height: number;
  bleedPx: number;
  theme: string;
}

/**
 * Rasterizer + geometry dependencies, injectable for tests. Each defaults to
 * the real implementation. The calculator factory is invoked lazily inside
 * buildBackJob (it throws on the server), so a test that supplies its own
 * `calculatePaths` never triggers the browser-only guard.
 */
export interface BuildBackJobDeps {
  rasterizeBrand: typeof rasterizeBrand;
  rasterizeUrl: typeof rasterizeUrl;
  rasterizeDifficultyBadge: typeof rasterizeDifficultyBadge;
  rasterizeLoopIcon: typeof rasterizeLoopIcon;
  rasterizeTurnGlyph: typeof rasterizeTurnGlyph;
  rasterizeReversalGlyph: typeof rasterizeReversalGlyph;
  rasterizeStepCount: typeof rasterizeStepCount;
  rasterizeStartPosPictograph: typeof rasterizeStartPosPictograph;
  rasterizeDecorations: typeof rasterizeDecorations;
  /** Produce mandala geometry. Mirrors SequenceMandala's calculator.calculate call. */
  calculatePaths: (
    steps: SequenceData["steps"],
    bluePropType: string | undefined,
    redPropType: string | undefined,
    pathOptions: MandalaPathOptions | undefined,
    tipOverride: { dx: number; dy: number },
  ) => MandalaPaths;
}

const realDeps: BuildBackJobDeps = {
  rasterizeBrand,
  rasterizeUrl,
  rasterizeDifficultyBadge,
  rasterizeLoopIcon,
  rasterizeTurnGlyph,
  rasterizeReversalGlyph,
  rasterizeStepCount,
  rasterizeStartPosPictograph,
  rasterizeDecorations,
  calculatePaths: (steps, blue, red, pathOptions, tipOverride) =>
    getMandalaGeometryCalculator().calculate(
      (steps ?? []) as never,
      blue,
      red,
      pathOptions,
      tipOverride,
    ),
};

/**
 * Build a `BackJob` for `sequence` at `opts` dimensions/theme.
 *
 * @param sequence The sequence to render the card back for.
 * @param opts     width/height in px (e.g. 1644×2244), bleedPx, theme name.
 * @param deps     Injectable rasterizer/geometry deps (defaults to real impls).
 */
export async function buildBackJob(
  sequence: SequenceData,
  opts: BuildBackJobOptions,
  deps: Partial<BuildBackJobDeps> = {},
): Promise<BackJob> {
  const d = { ...realDeps, ...deps };

  // 1) Derive shared data + theme visuals (proof mode in the print path).
  const data = deriveCardBackData(sequence);
  const visuals = getCardBackThemeVisuals(opts.theme);

  // 2) Layout boxes from the CSS-equivalent cqi positions.
  const cqi = opts.width / 100;
  const layout = computeCardBackLayout(data, {
    width: opts.width,
    height: opts.height,
    cqi,
  });

  // 3) Parse the proof-mode single-layer gradients.
  const borderGradient = parseLinearGradient(visuals.borderGradient);
  const bgGradient = parseLinearGradient(visuals.background);

  // 4) Dark-mode flag — matches CardBack.svelte `isDarkTheme`
  //    (proof mode sets textColor "#111111" → light).
  const darkMode = !visuals.textColor || visuals.textColor === "#ffffff";

  // 5) Mandala geometry. Mirror SequenceMandala EXACTLY: pathShape "arc" yields
  //    undefined pathOptions; bluePropType/redPropType undefined; tip dx is the
  //    standard tip (no animation, no tipDx override on the card back).
  const pathOptions: MandalaPathOptions | undefined = undefined; // pathShape "arc"
  const mandalaPaths = d.calculatePaths(
    sequence.steps,
    undefined,
    undefined,
    pathOptions,
    { dx: MANDALA_STANDARD_TIP_DX, dy: 0 },
  );

  // Size the mandala to FILL its layout box. renderMandalaToCanvas (P1.6)
  // translates to (offsetX + size/2, offsetY + size/2) and scales the geometry
  // by size/(maxExtent*1.05), so passing the square box width as `size` plus
  // the box top-left as offset centers + fits the mandala in the box. The box
  // is square (computeCardBackLayout: w === h), so width is the faithful size.
  const mandalaOptions: BackJob["mandalaOptions"] = {
    size: layout.mandala.w,
    style: "stroke",
    show: "both",
    palette: darkMode ? DARK_MANDALA_PALETTE : LIGHT_MANDALA_PALETTE,
    tipDx: MANDALA_STANDARD_TIP_DX,
    offsetX: layout.mandala.x,
    offsetY: layout.mandala.y,
  };

  // 6) Decorations: hidden in proof mode (decorationOpacity 0) → null.
  const decorationOpacity = visuals.decorationOpacity ?? 1;
  let decorations: BackJob["decorations"] = null;
  if (decorationOpacity !== 0) {
    const decoBitmap = await d.rasterizeDecorations(opts.theme, opts.width, opts.height);
    decorations = decoBitmap ? { bitmap: decoBitmap, opacity: decorationOpacity } : null;
  }

  // 7) Pre-rasterize + place every element. Independent rasterizations run
  //    concurrently; results are placed into their layout boxes.
  const activeLoop = LOOP_DISPLAY_ORDER.filter((c) => data.loopComponents.has(c));
  const loopDisplay = resolveLoopDisplay(sequence);

  const hasStartPos = !!sequence.startPosition;

  const [
    brandBmp,
    urlBmp,
    badgeBmp,
    turnBmp,
    reversalBmp,
    stepCountBmp,
    startPosBmp,
    loopBmps,
  ] = await Promise.all([
    d.rasterizeBrand(opts.theme),
    d.rasterizeUrl(opts.theme),
    d.rasterizeDifficultyBadge(data.level.number),
    d.rasterizeTurnGlyph(data.turnGlyphEntries),
    d.rasterizeReversalGlyph(data.reversalSequence, data.reversalPeriod),
    d.rasterizeStepCount(data.stepCount, undefined, undefined, visuals.textMutedColor),
    hasStartPos
      ? d.rasterizeStartPosPictograph(sequence.startPosition, darkMode)
      : Promise.resolve(null),
    Promise.all(
      activeLoop.map((comp) => {
        // Mirror CardBack.svelte node-selection exactly:
        //   ROTATED  → always quartered (fa-arrows-spin) — comp === ROTATED.
        //   INVERTED → quartered only when inversionPeriod === QUARTERED.
        //   SWAPPED  → SwapIcon (handled inside rasterizeLoopIcon).
        const quarteredRot = comp === LOOPComponent.ROTATED;
        const quarteredInv =
          comp === LOOPComponent.INVERTED &&
          loopDisplay.inversionPeriod === Period.QUARTERED;
        const color = LOOP_ICONS[comp]?.color ?? "#ffffff";
        return d.rasterizeLoopIcon(comp, color, { quarteredRot, quarteredInv });
      }),
    ),
  ]);

  const bitmaps: PlacedBitmap[] = [
    { kind: "brand", bitmap: brandBmp, placement: layout.brand },
    { kind: "url-ornament", bitmap: urlBmp, placement: layout.url },
    { kind: "difficulty-badge", bitmap: badgeBmp, placement: layout.levelBadge },
    { kind: "turn-glyph", bitmap: turnBmp, placement: layout.topLeftGlyph },
    { kind: "reversal-glyph", bitmap: reversalBmp, placement: layout.topRightGlyph },
    { kind: "step-count", bitmap: stepCountBmp, placement: layout.stepCount },
  ];

  if (startPosBmp) {
    bitmaps.push({
      kind: "start-pos-pictograph",
      bitmap: startPosBmp,
      placement: layout.startPos,
    });
  }

  loopBmps.forEach((bitmap, i) => {
    const placement = layout.loopRow.items[i];
    if (!placement) return;
    bitmaps.push({ kind: "loop-icon", bitmap, placement });
  });

  // 8) Assemble.
  return {
    width: opts.width,
    height: opts.height,
    bleedPx: opts.bleedPx ?? DEFAULT_BLEED_PX,
    borderGradient,
    bgGradient,
    decorations,
    mandalaPaths,
    mandalaOptions,
    bitmaps,
  };
}
