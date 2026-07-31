/**
 * ThumbnailKeyDeriver
 *
 * Derives cache keys from thumbnail render inputs using hash comparison.
 * Replaces 13 prev* state variables with a single hash.
 */

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";

export type ThumbnailVariant = "gallery" | "wordcard";

/**
 * Increment whenever shared thumbnail raster output changes.
 *
 * This token belongs in every cache identity, including the cloud filename.
 * Otherwise a corrected renderer can keep receiving an older image forever.
 */
export const THUMBNAIL_RENDERER_VERSION = 3;

export interface ThumbnailVisibilitySettings {
  showTKA?: boolean;
  showReversals?: boolean;
  showGrid?: boolean;
  showNonRadialPoints?: boolean;
  handPointVisibility?: "all" | "active" | "none";
  /** Render QR code in an empty cell (if available) */
  showQRCode?: boolean;
  /** Render as hand path visualization (HAND props, float arrows, no TKA) */
  handPathMode?: boolean;
  /** Render sequence mandalas in empty cells */
  showMandala?: boolean;
  /** Show blue motion (prop + arrow). Default: true */
  showBlueMotion?: boolean;
  /** Show red motion (prop + arrow). Default: true */
  showRedMotion?: boolean;
}

export interface ThumbnailRenderInput {
  // Identity
  sequenceName: string;
  /** Unique sequence ID - distinguishes variations with the same word */
  sequenceId?: string;

  // Prop configuration
  bluePropType: PropType | undefined;
  redPropType: PropType | undefined;
  catDogModeEnabled: boolean;

  // Visual mode
  lightMode: boolean;
  variant: ThumbnailVariant;

  // LOOP badge
  loopType?: string | null;
  /** Show the LOOP transform icons in the header strip (default true) */
  showLoopGlyph?: boolean;

  // Composition overrides (undefined = use variant defaults)
  addWord?: boolean;
  addStepNumbers?: boolean;
  includeStartPosition?: boolean;
  startPositionLayout?: "row" | "column";
  addDifficultyLevel?: boolean;
  addUserInfo?: boolean;
  showCreatorName?: boolean;
  showNotes?: boolean;
  showBirthday?: boolean;
  customNotesText?: string;
  userName?: string;

  // Visibility overrides (undefined = use defaults: showTKA=true, showReversals=true, etc.)
  visibility?: ThumbnailVisibilitySettings;

  /** Use 5:7 playing card layout for physical card export (different from lightMode/printMode) */
  cardMode?: boolean;
}

export interface ThumbnailCacheKey {
  /** Raster renderer revision used to isolate incompatible cached images */
  readonly rendererVersion: number;

  /** Hash of all inputs that affect visual output */
  readonly hash: string;

  /** Cloud storage path (for ICloudThumbnailCache) */
  readonly cloudPath: string;

  /** Original inputs (for debugging/logging) */
  readonly inputs: Readonly<ThumbnailRenderInput>;

  /** Whether this uses default composition settings (cacheable to cloud) */
  readonly usesDefaults: boolean;

  /** Effective prop type string (for cloud cache key construction) */
  readonly propKey: string;
}

export interface CompositionDefaults {
  addWord: boolean;
  addStepNumbers: boolean;
  includeStartPosition: boolean;
  addDifficultyLevel: boolean;
  addUserInfo: boolean;
  showCreatorName: boolean;
  showNotes: boolean;
  showBirthday: boolean;
}

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
  // QR is a shareable-but-distinct variant: the Firebase short code is
  // content-hash-deduped globally, so a QR-baked thumbnail is byte-identical for
  // every signed-in user — cacheable, but keyed apart from the no-QR card so a
  // guest's QR-less render can't overwrite it (and vice-versa).
  const qrSuffix = input.visibility?.showQRCode ? "_qr" : "";
  const rendererSuffix = `_r${THUMBNAIL_RENDERER_VERSION}`;
  const cloudPath = `thumbnails/${input.variant}/${propKey}/${input.sequenceName}${idSuffix}${qrSuffix}${rendererSuffix}_${mode}.webp`;

  // Compute hash of all inputs that affect visual output
  const hashInput = {
    renderer: THUMBNAIL_RENDERER_VERSION,
    ...(usesDefaults
      ? {
          seq: input.sequenceName,
          id: input.sequenceId ?? null,
          prop: propKey,
          mode,
          variant: input.variant,
          loop: input.loopType ?? null,
          spl: input.startPositionLayout ?? "row",
          // QR is part of the shareable class now (deterministic short code), so
          // it must discriminate the key — QR-on and QR-off are distinct images.
          qr: input.visibility?.showQRCode ?? false,
        }
      : buildFullHashInput(input)),
  };

  const hash = computeHash(hashInput);

  return {
    rendererVersion: THUMBNAIL_RENDERER_VERSION,
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
  // startPositionLayout: "row" is the default, "column" is non-default
  if (input.startPositionLayout !== undefined && input.startPositionLayout !== "row")
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
  // LOOP glyph strip is on by default; hiding it is a non-default render
  if (input.showLoopGlyph !== undefined && input.showLoopGlyph !== true) return false;
  // userName only matters if addUserInfo is enabled (otherwise it's not displayed)
  const userInfoEnabled = input.addUserInfo ?? defaults.addUserInfo;
  if (userInfoEnabled && input.userName !== undefined && input.userName !== "")
    return false;

  // Visibility settings affect rendered appearance - check if any are non-default
  if (input.visibility) {
    // Canonical (shared-cacheable) visibility values. These MUST match the
    // product defaults in image-composition-state, or every user on default
    // settings keys as "non-default" and the static/cloud tiers + crowd
    // uploads silently die for the whole population (June 2026 incident:
    // showMandala defaulted true in settings but false here — cloud cache
    // starved down to 6 files).
    const defaultVisibility = {
      showTKA: true,
      showReversals: true,
      showGrid: true,
      showNonRadialPoints: false,
      handPointVisibility: "all" as const,
      showQRCode: false, // QR only in viewer/wordcard contexts, never grid cards
      showMandala: true, // Product default: sequence mandalas fill empty cells
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
    // showQRCode is intentionally NOT a disqualifier: the QR is the Firebase
    // short code (content-hash-deduped globally → identical for all signed-in
    // users), so a QR-on render is still a shareable/cacheable class. It's kept
    // distinct from the no-QR card via the `qr` hash field + `_qr` storage path,
    // not by falling out of the shared cache. (Was a disqualifier — that forced
    // every signed-in default-settings card to local-render forever.)
    if (input.visibility.handPathMode !== undefined && input.visibility.handPathMode !== false)
      return false;
    if (input.visibility.showMandala !== undefined && input.visibility.showMandala !== defaultVisibility.showMandala)
      return false;
    if (input.visibility.showBlueMotion !== undefined && input.visibility.showBlueMotion !== true)
      return false;
    if (input.visibility.showRedMotion !== undefined && input.visibility.showRedMotion !== true)
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
    startPositionLayout: input.startPositionLayout ?? "row",
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
    // Sequence mandalas in empty cells
    showMandala: input.visibility?.showMandala,
    // Motion visibility (blue/red hand filtering)
    showBlueMotion: input.visibility?.showBlueMotion,
    showRedMotion: input.visibility?.showRedMotion,
    // LOOP badge
    loop: input.loopType ?? null,
    showLoopGlyph: input.showLoopGlyph,
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
