/**
 * ThumbnailRenderer
 *
 * Pure render logic: sequence + input -> blob.
 * Extracted from PropAwareThumbnail's renderThumbnailWithProps().
 *
 * Handles:
 * - Loading full sequence data if needed (via PublicSequencesLoader)
 * - Deriving start position if missing (via StartPositionDeriver)
 * - Applying prop type overrides
 * - Rendering via CompositionDispatcher (worker pool with main-thread fallback)
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { CompositionDispatcher } from "$lib/shared/render/services/composition-dispatcher";
import type { StartPositionDeriver } from "$lib/shared/pictograph/shared/services/start-position-deriver";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/public-sequences-loader";
import type { ILOOPDetector } from "$lib/shared/create/services/ILOOPDetector";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { ThumbnailRenderInput, CompositionDefaults } from "$lib/shared/browse/services/thumbnail-key-deriver";
import type { QRCodeGenerator } from "$lib/shared/qr/services/qr-code-generator";

/** Result of a thumbnail render. `qrConsistent` is false only when a QR was
 * requested but its bitmap could not be produced — the orchestrator uses it to
 * avoid caching a QR-less image under a QR cache key. */
export interface ThumbnailRenderResult {
  blob: Blob;
  qrConsistent: boolean;
}

// The QR is drawn scaled into a single grid cell; 256px is crisp at any card
// size the gallery uses and cheap to rasterize.
const QR_BITMAP_SIZE = 256;

export interface RenderOptions {
  /** Beat size in pixels (default: 240) */
  stepSize?: number;

  /** Output format (default: WebP) */
  format?: "WebP" | "PNG" | "JPEG";

  /** Quality for lossy formats 0-1 (default: 0.9) */
  quality?: number;
}
export type RenderProgressCallback = (progress: {
  current: number;
  total: number;
  stage: "preparing" | "rendering" | "finalizing";
}) => void;

const DEFAULT_BEAT_SIZE = 240;
const DEFAULT_FORMAT = "WebP" as const;
const DEFAULT_QUALITY = 0.9;

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

export class ThumbnailRenderer {
  constructor(
    private compositionDispatcher: CompositionDispatcher,
    private startPositionDeriver: StartPositionDeriver,
    private browseLoader: PublicSequencesLoader | null,
    private loopDetector: ILOOPDetector,
    /** Lazy factory (QR generator is browser-only + needs the short-code
     * manager configured first). Absent/throwing → renders without a QR. */
    private qrCodeGeneratorFactory?: () => QRCodeGenerator | null
  ) {}

  async render(
    sequence: SequenceData,
    input: ThumbnailRenderInput,
    options?: RenderOptions,
    onProgress?: RenderProgressCallback,
    signal?: AbortSignal
  ): Promise<ThumbnailRenderResult> {
    // Load full sequence data if needed (fetches from user's source doc)
    const loadedSequence = await this.ensureFullSequenceData(sequence, input.sequenceName);

    // Resolve loopType: loaded doc -> index fallback -> runtime detection
    let resolvedLoopType = loadedSequence.loopType ?? sequence.loopType ?? null;

    if (!resolvedLoopType && loadedSequence.steps && loadedSequence.steps.length >= 2) {
      try {
        const detection = this.loopDetector.detectLOOPType(loadedSequence);
        resolvedLoopType = detection.loopType;
      } catch {
        // Detection failure is non-fatal - thumbnail renders without badge
      }
    }

    const fullSequence = resolvedLoopType
      ? { ...loadedSequence, loopType: resolvedLoopType }
      : loadedSequence;

    // Derive start position if missing
    const sequenceWithStartPos = this.ensureStartPosition(fullSequence);

    // Build render options
    const renderOptions = this.buildRenderOptions(input, options);

    // Add sequence's birthday for footer display
    // Priority: sequence.birthday (original creation date) > createdAt > dateAdded
    const birthday =
      fullSequence.birthday ??
      fullSequence.createdAt ??
      fullSequence.dateAdded ??
      undefined;

    // Pre-render the QR bitmap on the main thread when requested. The worker
    // pool has no QR generator, so a baked QR must be transferred in. The short
    // code is content-hash-deduped globally, so this bitmap is identical for all
    // signed-in users (safe to share once cached). On any failure we render
    // without a QR and flag the render inconsistent so it isn't cached.
    const wantsQR = input.visibility?.showQRCode === true;
    let qrBitmap: ImageBitmap | null = null;
    if (wantsQR) {
      try {
        const generator = this.qrCodeGeneratorFactory?.();
        if (generator) {
          const qrImage = await generator.generateAsImage(sequenceWithStartPos, QR_BITMAP_SIZE, {
            darkMode: !input.lightMode,
            bluePropType: input.bluePropType,
            redPropType: input.redPropType,
          });
          qrBitmap = await createImageBitmap(qrImage);
        }
      } catch (err) {
        console.debug("[ThumbnailRenderer] QR pre-render failed; rendering without QR:", err);
        qrBitmap = null;
      }
    }

    // Render via CompositionDispatcher (worker pool with main-thread fallback)
    // Explicitly pass loopType in options so it doesn't rely on sequence fallback
    const blob = await this.compositionDispatcher.compose(
      sequenceWithStartPos,
      {
        ...renderOptions,
        birthday,
        loopType: resolvedLoopType ?? undefined,
        showLoopGlyph: undefined,
        // Card mode: use 5:7 playing card layout for physical card export
        cardMode: input.cardMode ?? false,
      },
      onProgress,
      signal,
      qrBitmap,
    );

    // QR-consistent unless a QR was wanted but its bitmap couldn't be produced.
    return { blob, qrConsistent: !wantsQR || qrBitmap !== null };
  }

  private async ensureFullSequenceData(
    sequence: SequenceData,
    sequenceName: string
  ): Promise<SequenceData> {
    const hasSteps = sequence.steps && sequence.steps.length > 0;

    if (hasSteps) {
      return sequence;
    }

    // No step data - try loading from Browse index.
    // Pass sequence.id so the loader can disambiguate when multiple
    // sequences share the same word (e.g. two "FJ" variations).
    if (!this.browseLoader) {
      throw new Error(
        `Cannot render thumbnail for "${sequenceName}": sequence has no step data and PublicSequencesLoader is not available.`
      );
    }

    const loadedSequence = await this.browseLoader.loadFullSequenceData(sequenceName, sequence.id);
    if (!loadedSequence) {
      throw new Error(`Sequence not found: ${sequenceName}`);
    }

    // Check if loaded sequence actually has steps (guards against orphaned data)
    if (!loadedSequence.steps || loadedSequence.steps.length === 0) {
      throw new Error(`ORPHANED_SEQUENCE: "${sequenceName}" exists in index but has no step data`);
    }

    return loadedSequence;
  }

  private ensureStartPosition(sequence: SequenceData): SequenceData {
    const existingStartPos = sequence.startPosition;
    const hasValidStartPosition =
      existingStartPos?.motions?.blue &&
      existingStartPos.motions?.red;

    if (hasValidStartPosition) {
      return sequence;
    }

    // Try to derive from first beat
    const firstStep = sequence.steps?.[0];
    const firstStepHasValidMotions =
      firstStep?.motions?.blue?.startLocation &&
      firstStep?.motions?.red?.startLocation;

    if (!firstStep || !firstStepHasValidMotions) {
      return sequence;
    }

    try {
      const derivedStartPos = this.startPositionDeriver.deriveFromFirstBeat(firstStep);
      return {
        ...sequence,
        startPosition: derivedStartPos,
      };
    } catch (err) {
      console.warn(
        `[ThumbnailRenderer] Failed to derive start position for ${sequence.word || sequence.name}:`,
        err
      );
      return sequence;
    }
  }

  private buildRenderOptions(
    input: ThumbnailRenderInput,
    options?: RenderOptions
  ) {
    const defaults =
      input.variant === "wordcard" ? WORDCARD_DEFAULTS : GALLERY_DEFAULTS;

    // Hand path sequences have HAND props baked into their data - don't override
    const isHandPath = input.visibility?.handPathMode ?? false;

    // Determine prop mode
    const isCatDog =
      input.catDogModeEnabled &&
      input.bluePropType &&
      input.redPropType &&
      input.bluePropType !== input.redPropType;

    return {
      stepSize: options?.stepSize ?? DEFAULT_BEAT_SIZE,
      format: options?.format ?? DEFAULT_FORMAT,
      quality: options?.quality ?? DEFAULT_QUALITY,

      // Composition settings (use input or fall back to variant defaults)
      includeStartPosition: input.includeStartPosition ?? defaults.includeStartPosition,
      startPositionLayout: input.startPositionLayout ?? "row",
      addStepNumbers: input.addStepNumbers ?? defaults.addStepNumbers,
      addWord: input.addWord ?? defaults.addWord,
      addDifficultyLevel: input.addDifficultyLevel ?? defaults.addDifficultyLevel,
      addUserInfo: input.addUserInfo ?? defaults.addUserInfo,
      userName: input.userName ?? "",

      // Footer controls
      showCreatorName: input.showCreatorName ?? defaults.showCreatorName,
      showNotes: input.showNotes ?? defaults.showNotes,
      showBirthday: input.showBirthday ?? defaults.showBirthday,
      customNotesText: input.customNotesText,

      // Always include reversal symbols
      addReversalSymbols: true,

      // Background based on light mode
      backgroundColor: input.lightMode ? "#ffffff" : "#1a1a2e",

      // Prop overrides - hand path mode uses HAND props baked into the data,
      // so skip user prop overrides that would clobber PropType.HAND.
      // CRITICAL: Always fall back to PropType.STAFF when input prop types are
      // undefined/null. Without this, hasPropOverride is false in ImageComposer
      // and the motion's intrinsic propType is used (e.g., "fan" from when the
      // sequence was created), while the cache key says "staff" (from
      // ThumbnailKeyDeriver's identical fallback). This mismatch causes wrong-prop
      // images to be cached and served.
      // Motion visibility - controls which hand's motion (prop + arrow) is rendered
      blueVisible: input.visibility?.showBlueMotion ?? true,
      redVisible: input.visibility?.showRedMotion ?? true,

      propTypeOverride: isHandPath ? undefined : (isCatDog ? undefined : (input.bluePropType || input.redPropType || PropType.STAFF)),
      bluePropTypeOverride: isHandPath ? undefined : (isCatDog ? (input.bluePropType || PropType.STAFF) : undefined),
      redPropTypeOverride: isHandPath ? undefined : (isCatDog ? (input.redPropType || PropType.STAFF) : undefined),

      // Visibility settings - respect user preferences from input
      visibilityOverrides: {
        showTKA: input.visibility?.showTKA ?? true, // Default ON, user can toggle
        showTnD: false, // Never shown in thumbnails
        showElemental: false, // Never shown in thumbnails
        showPositions: false, // Never shown in thumbnails
        showReversals: input.visibility?.showReversals ?? true, // Default ON, user can toggle
        showTurnNumbers: input.visibility?.showTKA ?? true, // Follows TKA setting
        darkMode: !input.lightMode,
        // Grid settings respect user preferences - they affect visible dots
        showGrid: input.visibility?.showGrid ?? true,
        handPointVisibility: input.visibility?.handPointVisibility ?? "all",
        showNonRadialPoints: input.visibility?.showNonRadialPoints ?? false,
        // QR code in empty cell (if enabled)
        showQRCode: input.visibility?.showQRCode ?? false,
        // Hand path visualization mode
        handPathMode: input.visibility?.handPathMode ?? false,
        // LOOP mandalas in empty cells
        showMandala: input.visibility?.showMandala ?? false,
      },
    };
  }
}
