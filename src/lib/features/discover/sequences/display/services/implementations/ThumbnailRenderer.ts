/**
 * ThumbnailRenderer
 *
 * Pure render logic: sequence + input → blob.
 * Extracted from PropAwareThumbnail's renderThumbnailWithProps().
 *
 * Handles:
 * - Loading full sequence data if needed (via IDiscoverLoader)
 * - Deriving start position if missing (via IStartPositionDeriver)
 * - Applying prop type overrides
 * - Rendering via ISequenceRenderer pipeline
 */

import { inject, injectable, optional } from "inversify";
import { TYPES } from "$lib/shared/inversify/types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
import type { IDiscoverLoader } from "../contracts/IDiscoverLoader";
import type {
  IThumbnailRenderer,
  RenderOptions,
} from "../contracts/IThumbnailRenderer";
import type {
  ThumbnailRenderInput,
  CompositionDefaults,
} from "../contracts/IThumbnailKeyDeriver";

const DEFAULT_BEAT_SIZE = 240;
const DEFAULT_FORMAT = "WebP" as const;
const DEFAULT_QUALITY = 0.9;

const GALLERY_DEFAULTS: CompositionDefaults = {
  addWord: true,
  addBeatNumbers: true,
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

@injectable()
export class ThumbnailRenderer implements IThumbnailRenderer {
  constructor(
    @inject(TYPES.ISequenceRenderer)
    private sequenceRenderer: ISequenceRenderer,
    @inject(TYPES.IStartPositionDeriver)
    private startPositionDeriver: IStartPositionDeriver,
    @inject(TYPES.IDiscoverLoader)
    @optional()
    private discoverLoader: IDiscoverLoader | null
  ) {}

  async render(
    sequence: SequenceData,
    input: ThumbnailRenderInput,
    options?: RenderOptions
  ): Promise<Blob> {
    // Load full sequence data if needed
    const fullSequence = await this.ensureFullSequenceData(sequence, input.sequenceName);

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

    // Render via ISequenceRenderer
    const blob = await this.sequenceRenderer.renderSequenceToBlob(
      sequenceWithStartPos,
      { ...renderOptions, birthday }
    );

    return blob;
  }

  private async ensureFullSequenceData(
    sequence: SequenceData,
    sequenceName: string
  ): Promise<SequenceData> {
    const hasBeats = sequence.beats && sequence.beats.length > 0;

    if (hasBeats) {
      return sequence;
    }

    // No beat data - try loading from Discover index
    if (!this.discoverLoader) {
      throw new Error(
        `Cannot render thumbnail for "${sequenceName}": sequence has no beat data and IDiscoverLoader is not available.`
      );
    }

    const loadedSequence = await this.discoverLoader.loadFullSequenceData(sequenceName);
    if (!loadedSequence) {
      throw new Error(`Sequence not found: ${sequenceName}`);
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
    const firstBeat = sequence.beats?.[0];
    const firstBeatHasValidMotions =
      firstBeat?.motions?.blue?.startLocation &&
      firstBeat?.motions?.red?.startLocation;

    if (!firstBeat || !firstBeatHasValidMotions) {
      return sequence;
    }

    try {
      const derivedStartPos = this.startPositionDeriver.deriveFromFirstBeat(firstBeat);
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
      beatSize: options?.beatSize ?? DEFAULT_BEAT_SIZE,
      format: options?.format ?? DEFAULT_FORMAT,
      quality: options?.quality ?? DEFAULT_QUALITY,

      // Composition settings (use input or fall back to variant defaults)
      includeStartPosition: input.includeStartPosition ?? defaults.includeStartPosition,
      addBeatNumbers: input.addBeatNumbers ?? defaults.addBeatNumbers,
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

      // Visibility settings
      visibilityOverrides: {
        showTKA: true,
        showVTG: false,
        showElemental: false,
        showPositions: false,
        showReversals: true,
        showTurnNumbers: true,
        darkMode: !input.lightMode,
      },
    };
  }
}
