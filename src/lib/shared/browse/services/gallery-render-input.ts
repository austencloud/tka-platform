/**
 * Gallery render-input builder
 *
 * Single source of truth for the ThumbnailRenderInput a gallery card produces.
 * Both PropAwareThumbnail (live cards) and the gallery-thumbnail-warmer call
 * this, so the cache key the warmer renders under is byte-identical to the key
 * a live card 404s on. Duplicating this logic in the warmer would risk the
 * key-drift / cache-poisoning class of bug the June 2026 incident was about.
 *
 * The QR / mandala / start-layout gating below MUST stay in lockstep with the
 * canonical defaults in thumbnail-key-deriver.ts (checkInputUsesDefaults) and
 * image-composition-state. See reference_thumbnail_cache_lockstep memory.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type {
  ThumbnailRenderInput,
  ThumbnailVariant,
  ThumbnailVisibilitySettings,
} from "./thumbnail-key-deriver";

/**
 * The subset of the image-composition manager the input builder reads. The live
 * card passes the real manager; the warmer passes a fixed product-defaults
 * source so it populates the SHARED (usesDefaults) cloud cache, not the admin's
 * personal settings.
 */
export interface GalleryCompositionSource {
  getStartPositionLayoutForStepCount(stepCount: number): "row" | "column";
  readonly showQRCode: boolean;
  readonly showMandala: boolean;
}

export interface BuildGalleryRenderInputParams {
  sequence: SequenceData;
  bluePropType?: PropType;
  redPropType?: PropType;
  catDogModeEnabled?: boolean;
  lightMode?: boolean;
  variant?: ThumbnailVariant;
  // Composition overrides (undefined = variant defaults)
  addWord?: boolean;
  addStepNumbers?: boolean;
  includeStartPosition?: boolean;
  startPositionLayout?: "row" | "column";
  addDifficultyLevel?: boolean;
  addUserInfo?: boolean;
  userName?: string;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  customNotesText?: string;
  // Visibility overrides
  visibility?: ThumbnailVisibilitySettings;
  handPathMode?: boolean;
  showBlueMotion?: boolean;
  showRedMotion?: boolean;
  /** Grid cards pass true; the builder still gates on auth + step count. */
  allowQR?: boolean;
  cardMode?: boolean;
  // Ambient state (passed in so this function stays pure/testable)
  compositionManager: GalleryCompositionSource;
  isAuthenticated: boolean;
}

/**
 * Beat count used for QR gating (>1 → a spare cell exists) and start-position
 * layout selection. Mirrors PropAwareThumbnail: steps length wins over the
 * stored sequenceLength; empty steps (Community sequences) fall through to it.
 */
export function galleryStepCount(sequence: SequenceData): number {
  return sequence.steps?.length || sequence.sequenceLength || 4;
}

/**
 * Resolve the effective visibility object for a gallery card. Always returns
 * EXPLICIT showQRCode + showMandala values (never undefined) — the renderer
 * falls back to its own hardcoded defaults on undefined, which can diverge from
 * the user's actual settings while the cache key still reads "defaults",
 * poisoning the shared cloud cache.
 */
export function buildGalleryVisibility(
  p: BuildGalleryRenderInputParams
): ThumbnailVisibilitySettings | undefined {
  const {
    visibility,
    handPathMode = false,
    showBlueMotion = true,
    showRedMotion = true,
    allowQR = true,
    isAuthenticated,
    compositionManager,
  } = p;
  const stepCount = galleryStepCount(p.sequence);

  const needsMotionFilter = showBlueMotion !== true || showRedMotion !== true;
  const motionOverrides = needsMotionFilter ? { showBlueMotion, showRedMotion } : {};

  // Guests get no QR; one-count cards have no spare cell for it.
  const qrAllowed = allowQR && isAuthenticated && stepCount > 1;

  if (visibility) {
    const qrGated = qrAllowed ? visibility : { ...visibility, showQRCode: false };
    return handPathMode || needsMotionFilter || !qrAllowed
      ? { ...qrGated, ...(handPathMode && { handPathMode: true }), ...motionOverrides }
      : qrGated;
  }

  const qr = qrAllowed && compositionManager.showQRCode;
  const mandala = compositionManager.showMandala;
  return {
    showQRCode: qr,
    showMandala: mandala,
    ...(handPathMode && { handPathMode: true }),
    ...motionOverrides,
  };
}

/**
 * Build the full ThumbnailRenderInput for a gallery card. Faithful extraction of
 * the logic previously inline in PropAwareThumbnail so the warmer and the live
 * card produce identical cache keys.
 */
export function buildGalleryRenderInput(
  p: BuildGalleryRenderInputParams
): ThumbnailRenderInput {
  const {
    sequence,
    bluePropType,
    redPropType,
    catDogModeEnabled = false,
    lightMode = false,
    variant = "gallery",
    addWord,
    addStepNumbers,
    includeStartPosition,
    startPositionLayout,
    addDifficultyLevel,
    addUserInfo,
    userName,
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
    cardMode = false,
    compositionManager,
  } = p;

  const stepCount = galleryStepCount(sequence);
  const effectiveStartPositionLayout =
    startPositionLayout ?? compositionManager.getStartPositionLayoutForStepCount(stepCount);

  const sequenceName = sequence.word || sequence.name || "";

  return {
    sequenceName,
    sequenceId: sequence.id,
    bluePropType,
    redPropType,
    catDogModeEnabled,
    lightMode,
    variant,
    loopType: sequence.loopType ?? null,
    addWord,
    addStepNumbers,
    includeStartPosition,
    startPositionLayout: effectiveStartPositionLayout,
    addDifficultyLevel,
    addUserInfo,
    userName,
    showCreatorName,
    showNotes,
    showBirthday,
    customNotesText,
    visibility: buildGalleryVisibility(p),
    cardMode: cardMode || undefined,
  };
}

/**
 * Product-default composition source for the warm pass. Renders target the
 * SHARED (usesDefaults=true) cloud cache: row layout, mandala on. QR is driven
 * per-combo via an explicit visibility override, not this source.
 */
export const DEFAULT_GALLERY_COMPOSITION: GalleryCompositionSource = {
  getStartPositionLayoutForStepCount: () => "row",
  showQRCode: false,
  showMandala: true,
};
