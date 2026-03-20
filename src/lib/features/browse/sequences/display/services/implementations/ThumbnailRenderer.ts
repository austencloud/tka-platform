/**
 * ThumbnailRenderer
 *
 * Pure render logic: sequence + input → blob.
 * Extracted from PropAwareThumbnail's renderThumbnailWithProps().
 *
 * Handles:
 * - Loading full sequence data if needed (via IBrowseLoader)
 * - Deriving start position if missing (via IStartPositionDeriver)
 * - Applying prop type overrides
 * - Rendering via ISequenceRenderer pipeline
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
import type { IBrowseLoader } from "../contracts/IBrowseLoader";
import type {
  IThumbnailRenderer,
  RenderOptions,
  RenderProgressCallback,
} from "../contracts/IThumbnailRenderer";
import type {
  ThumbnailRenderInput,
  CompositionDefaults,
} from "../contracts/IThumbnailKeyDeriver";
import type { ILOOPDetector } from "$lib/features/create/generate/circular/services/contracts/ILOOPDetector";

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

export class ThumbnailRenderer implements IThumbnailRenderer {
  constructor(
    private sequenceRenderer: ISequenceRenderer,
    private startPositionDeriver: IStartPositionDeriver,
    private browseLoader: IBrowseLoader | null,
    private loopDetector: ILOOPDetector
  ) {}

  async render(
    sequence: SequenceData,
    input: ThumbnailRenderInput,
    options?: RenderOptions,
    onProgress?: RenderProgressCallback
  ): Promise<Blob> {
    // Load full sequence data if needed (fetches from user's source doc)
    const loadedSequence = await this.ensureFullSequenceData(sequence, input.sequenceName);

    // Resolve loopType: loaded doc → index fallback → runtime detection
    let resolvedLoopType = loadedSequence.loopType ?? sequence.loopType ?? null;

    if (!resolvedLoopType && loadedSequence.steps && loadedSequence.steps.length >= 2) {
      try {
        const detection = this.loopDetector.detectLOOPType(loadedSequence);
        resolvedLoopType = detection.loopType;
      } catch {
        // Detection failure is non-fatal — thumbnail renders without badge
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

    // Render via ISequenceRenderer (pass through progress callback)
    // Explicitly pass loopType in options so it doesn't rely on sequence fallback
    const blob = await this.sequenceRenderer.renderSequenceToBlob(
      sequenceWithStartPos,
      { ...renderOptions, birthday, loopType: resolvedLoopType ?? undefined },
      onProgress
    );

    return blob;
  }

  private async ensureFullSequenceData(
    sequence: SequenceData,
    sequenceName: string
  ): Promise<SequenceData> {
    const hasBeats = sequence.steps && sequence.steps.length > 0;

    if (hasBeats) {
      return sequence;
    }

    // No beat data - try loading from Browse index.
    // Pass sequence.id so the loader can disambiguate when multiple
    // sequences share the same word (e.g. two "FJ" variations).
    if (!this.browseLoader) {
      throw new Error(
        `Cannot render thumbnail for "${sequenceName}": sequence has no beat data and IBrowseLoader is not available.`
      );
    }

    const loadedSequence = await this.browseLoader.loadFullSequenceData(sequenceName, sequence.id);
    if (!loadedSequence) {
      throw new Error(`Sequence not found: ${sequenceName}`);
    }

    // Check if loaded sequence actually has steps (guards against orphaned data)
    if (!loadedSequence.steps || loadedSequence.steps.length === 0) {
      throw new Error(`ORPHANED_SEQUENCE: "${sequenceName}" exists in index but has no beat data`);
    }

    return loadedSequence;
  }

  private ensureStartPosition(sequence: SequenceData): SequenceData {
    const existingStartPos = sequence.startPosition;
    const hasValidStartPosition =
      existingStartPos &&
      existingStartPos.motions?.blue &&
      existingStartPos.motions?.red;

    if (hasValidStartPosition) {
      return sequence;
    }

    // Try to derive from first beat
    const firstStep = sequence.steps?.[0];
    const firstBeatHasValidMotions =
      firstStep?.motions?.blue?.startLocation &&
      firstStep?.motions?.red?.startLocation;

    if (!firstStep || !firstBeatHasValidMotions) {
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

      // Prop overrides
      propTypeOverride: isCatDog ? undefined : (input.bluePropType || input.redPropType || undefined),
      bluePropTypeOverride: isCatDog ? input.bluePropType : undefined,
      redPropTypeOverride: isCatDog ? input.redPropType : undefined,

      // Visibility settings - respect user preferences from input
      visibilityOverrides: {
        showTKA: input.visibility?.showTKA ?? true, // Default ON, user can toggle
        showVTG: false, // Never shown in thumbnails
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
      },
    };
  }
}
