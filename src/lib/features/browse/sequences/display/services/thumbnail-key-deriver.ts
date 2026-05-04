/**
 * ThumbnailKeyDeriver
 *
 * Derives cache keys from thumbnail render inputs using hash comparison.
 * Replaces 13 prev* state variables with a single hash.
 */

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { ThumbnailRenderInput, ThumbnailCacheKey, CompositionDefaults } from "./contracts/types";
import type { ThumbnailVariant } from "./contracts/types";

const GALLERY_DEFAULTS: CompositionDefaults = {
  addWord: true,
  addStepNumbers: true,
  includeStartPosition: true,
  addDifficultyLevel: true,
  addUserInfo: false,
  showCreatorName: true,
  showNotes: true,
  showBirthday: true,
};

const WORDCARD_DEFAULTS: CompositionDefaults = {
  ...GALLERY_DEFAULTS,
  addUserInfo: true,
};

export function deriveKey(input: ThumbnailRenderInput): ThumbnailCacheKey {
  const defaults = getVariantDefaults(input.variant);
  const usesDefaults = checkInputUsesDefaults(input, defaults);

  // Determine effective prop type(s)
  const isCatDog = isCatDogMode(input);
  const propKey = derivePropKey(input, isCatDog);

  // Build cloud path (only meaningful for default settings)
  const mode = input.lightMode ? "light" : "dark";
  // Include sequence ID in cloud path so variations of the same word get separate thumbnails
  const idSuffix = input.sequenceId ? `_${input.sequenceId}` : "";
  const cloudPath = `thumbnails/${input.variant}/${propKey}/${input.sequenceName}${idSuffix}_${mode}.webp`;

  // Compute hash of all inputs that affect visual output
  const hashInput = usesDefaults
    ? {
        seq: input.sequenceName,
        id: input.sequenceId ?? null,
        prop: propKey,
        mode,
        variant: input.variant,
        loop: input.loopType ?? null,
        spl: input.startPositionLayout ?? "column",
      }
    : buildFullHashInput(input);

  const hash = computeHash(hashInput);

  return {
    hash,
    cloudPath,
    inputs: Object.freeze({ ...input }),
    usesDefaults,
    propKey,
  };
}

export function keysEqual(a: ThumbnailCacheKey, b: ThumbnailCacheKey): boolean {
  return a.hash === b.hash;
}

export function getVariantDefaults(variant: ThumbnailVariant): CompositionDefaults {
  return variant === "wordcard" ? WORDCARD_DEFAULTS : GALLERY_DEFAULTS;
}

export function inputUsesDefaults(input: ThumbnailRenderInput): boolean {
  const defaults = getVariantDefaults(input.variant);
  return checkInputUsesDefaults(input, defaults);
}

function isCatDogMode(input: ThumbnailRenderInput): boolean {
  return (
    input.catDogModeEnabled &&
    input.bluePropType !== undefined &&
    input.redPropType !== undefined &&
    input.bluePropType !== input.redPropType
  );
}

function derivePropKey(input: ThumbnailRenderInput, isCatDog: boolean): string {
  if (isCatDog) {
    // Cat-dog: preserve hand positions (blue=left, red=right)
    return `catdog_${input.bluePropType}_${input.redPropType}`;
  }
  // Single prop mode: use blue, fallback to red, fallback to staff
  return input.bluePropType || input.redPropType || PropType.STAFF;
}

function checkInputUsesDefaults(
  input: ThumbnailRenderInput,
  defaults: CompositionDefaults
): boolean {
  // If any setting is defined and differs from default, not using defaults
  if (input.addWord !== undefined && input.addWord !== defaults.addWord)
    return false;
  if (
    input.addStepNumbers !== undefined &&
    input.addStepNumbers !== defaults.addStepNumbers
  )
    return false;
  if (
    input.includeStartPosition !== undefined &&
    input.includeStartPosition !== defaults.includeStartPosition
  )
    return false;
  // startPositionLayout: "column" is the default, "row" is non-default
  if (input.startPositionLayout !== undefined && input.startPositionLayout !== "column")
    return false;
  if (
    input.addDifficultyLevel !== undefined &&
    input.addDifficultyLevel !== defaults.addDifficultyLevel
  )
    return false;
  if (input.addUserInfo !== undefined && input.addUserInfo !== defaults.addUserInfo)
    return false;
  if (
    input.showCreatorName !== undefined &&
    input.showCreatorName !== defaults.showCreatorName
  )
    return false;
  if (input.showNotes !== undefined && input.showNotes !== defaults.showNotes)
    return false;
  if (input.showBirthday !== undefined && input.showBirthday !== defaults.showBirthday)
    return false;
  // Any custom text means not using defaults
  if (input.customNotesText !== undefined) return false;
  // userName only matters if addUserInfo is enabled (otherwise it's not displayed)
  const userInfoEnabled = input.addUserInfo ?? defaults.addUserInfo;
  if (userInfoEnabled && input.userName !== undefined && input.userName !== "")
    return false;

  // Visibility settings affect rendered appearance - check if any are non-default
  if (input.visibility) {
    // Default values for visibility
    const defaultVisibility = {
      showTKA: true,
      showReversals: true,
      showGrid: true,
      showNonRadialPoints: false,
      handPointVisibility: "all" as const,
      showQRCode: false, // QR codes only enabled in choreo card context
    };
    // If any visibility setting differs from default, not using defaults
    if (input.visibility.showTKA !== undefined && input.visibility.showTKA !== defaultVisibility.showTKA)
      return false;
    if (input.visibility.showReversals !== undefined && input.visibility.showReversals !== defaultVisibility.showReversals)
      return false;
    if (input.visibility.showGrid !== undefined && input.visibility.showGrid !== defaultVisibility.showGrid)
      return false;
    if (input.visibility.showNonRadialPoints !== undefined && input.visibility.showNonRadialPoints !== defaultVisibility.showNonRadialPoints)
      return false;
    if (input.visibility.handPointVisibility !== undefined && input.visibility.handPointVisibility !== defaultVisibility.handPointVisibility)
      return false;
    if (input.visibility.showQRCode !== undefined && input.visibility.showQRCode !== defaultVisibility.showQRCode)
      return false;
    if (input.visibility.handPathMode !== undefined && input.visibility.handPathMode !== false)
      return false;
  }

  return true;
}

function buildFullHashInput(input: ThumbnailRenderInput): object {
  // Include all fields that affect visual output
  //
  // CANONICAL (excluded from hash) - these are overlays that don't affect base pictograph:
  // - showTKA, showReversals: text/symbol overlays
  //
  // INCLUDED in hash - these affect the rendered appearance:
  // - showGrid, handPointVisibility, showNonRadialPoints: grid dot visibility
  //   (User wants to toggle these and see thumbnails update)
  return {
    seq: input.sequenceName,
    id: input.sequenceId ?? null,
    blue: input.bluePropType,
    red: input.redPropType,
    catDog: input.catDogModeEnabled,
    light: input.lightMode,
    variant: input.variant,
    addWord: input.addWord,
    addStepNumbers: input.addStepNumbers,
    includeStartPosition: input.includeStartPosition,
    startPositionLayout: input.startPositionLayout ?? "column",
    addDifficultyLevel: input.addDifficultyLevel,
    addUserInfo: input.addUserInfo,
    showCreatorName: input.showCreatorName,
    showNotes: input.showNotes,
    showBirthday: input.showBirthday,
    customNotesText: input.customNotesText,
    userName: input.userName,
    // Grid visibility settings - user wants these to update thumbnails
    showGrid: input.visibility?.showGrid,
    handPointVisibility: input.visibility?.handPointVisibility,
    showNonRadialPoints: input.visibility?.showNonRadialPoints,
    // QR code in empty cell
    showQRCode: input.visibility?.showQRCode,
    // Hand path visualization mode
    handPathMode: input.visibility?.handPathMode,
    // LOOP badge
    loop: input.loopType ?? null,
    // EXCLUDED: showTKA, showReversals - these are canonical (always ON)
  };
}

function computeHash(obj: object): string {
  // Sort keys for deterministic output
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  // Simple hash - good enough for cache keys
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
