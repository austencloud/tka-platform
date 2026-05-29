/**
 * Gallery Renderer
 *
 * Renders sequences to image blobs with standardized gallery visibility settings.
 * Supports prop type overrides for generating prop-specific gallery images.
 *
 * Uses StartPositionDeriver to dynamically derive start positions from the first
 * beat of each sequence, rather than relying on stored start position data.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceRenderer } from "$lib/shared/render/services/sequence-renderer";
import type { PublicSequencesLoader } from "$lib/shared/browse/services/PublicSequencesLoader";
import type { StartPositionDeriver } from "$lib/shared/pictograph/shared/services/implementations/StartPositionDeriver";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/sequence-export-options";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { BatchRenderResult } from "../domain/gallery-models";

export interface RenderOptions {
  lightMode: boolean;
  propType?: PropType;
}

export class GalleryRenderer {
  constructor(
    private renderService: SequenceRenderer,
    private loaderService: PublicSequencesLoader,
    private startPositionDeriver: StartPositionDeriver
  ) {}

  async renderSequence(
    sequence: SequenceData,
    lightMode: boolean,
    propType?: PropType
  ): Promise<Blob> {
    const seqName = sequence.word || sequence.name;

    // Check if steps need parsing - old format has blueAttributes, modern has motions.blue
    const firstStepRaw = sequence.steps?.[0] as
      | Record<string, unknown>
      | undefined;
    const needsParsing =
      !sequence.steps?.length ||
      (firstStepRaw &&
        "blueAttributes" in firstStepRaw &&
        !firstStepRaw.motions);

    // Load full sequence data if not loaded OR if steps are in old format
    if (needsParsing) {
      const fullSequence =
        await this.loaderService.loadFullSequenceData(seqName);
      if (fullSequence) {
        Object.assign(sequence, fullSequence);
      } else {
        console.error(
          `[GalleryRenderer] loadFullSequenceData returned null for ${seqName}`
        );
      }
    }

    // Derive start position from first beat if not present OR if the existing one is invalid
    // This is the modern approach: start positions are derived, not stored
    let sequenceWithStartPos = sequence;
    const firstStep = sequence.steps?.[0];

    // Check if existing start position is valid (has motion data for both hands)
    const existingStartPos = sequence.startPosition;
    const hasValidStartPosition =
      existingStartPos?.motions?.blue &&
      existingStartPos.motions?.red;

    // Check if first beat has valid motion data for derivation
    // Must have both blue and red motions with startLocation defined
    const firstStepHasValidMotions =
      firstStep?.motions?.blue?.startLocation &&
      firstStep?.motions?.red?.startLocation;

    if (!hasValidStartPosition && firstStep && firstStepHasValidMotions) {
      try {
        const derivedStartPos =
          this.startPositionDeriver.deriveFromFirstBeat(firstStep);
        sequenceWithStartPos = {
          ...sequence,
          startPosition: derivedStartPos,
        };
      } catch (err) {
        console.error(
          `[GalleryRenderer] ❌ Failed to derive start position for ${seqName}:`,
          err
        );
      }
    } else {
      if (!firstStep) {
        console.warn(
          `[GalleryRenderer] Cannot derive start position: no first beat available`
        );
      } else if (!firstStepHasValidMotions) {
        console.warn(
          `[GalleryRenderer] Cannot derive start position: first beat missing motion data or startLocation`,
          {
            hasBlueMotion: !!firstStep.motions?.blue,
            hasRedMotion: !!firstStep.motions?.red,
            blueStartLocation: firstStep.motions?.blue?.startLocation,
            redStartLocation: firstStep.motions?.red?.startLocation,
          }
        );
      }
    }

    const showNonRadial = this.requiresNonRadialPoints(sequenceWithStartPos);

    const options: Partial<SequenceExportOptions> = {
      stepSize: 240,
      format: "WebP",
      quality: 0.95,
      includeStartPosition: true,
      addStepNumbers: true,
      addWord: true,
      addDifficultyLevel: true,
      addUserInfo: false,
      addReversalSymbols: true,
      combinedGrids: false,
      stepScale: 1.0,
      margin: 0,
      redVisible: true,
      blueVisible: true,
      scale: 1.0,
      backgroundColor: lightMode ? "#ffffff" : "#1a1a2e",
      // Override prop type if specified
      propTypeOverride: propType,
      visibilityOverrides: {
        showTKA: true,
        showTnD: false,
        showElemental: false,
        showPositions: false,
        showReversals: true,
        showNonRadialPoints: showNonRadial,
        showTurnNumbers: true,
        // Dark Mode: dark background, inverted grid, white text/outlines
        darkMode: !lightMode,
      },
    };

    return await this.renderService.renderSequenceToBlob(
      sequenceWithStartPos,
      options
    );
  }

  async renderBatch(
    sequences: SequenceData[],
    lightMode: boolean,
    propType?: PropType
  ): Promise<BatchRenderResult[]> {
    return Promise.all(
      sequences.map(async (sequence) => {
        const name = sequence.word || sequence.name;
        try {
          const blob = await this.renderSequence(sequence, lightMode, propType);
          const imageUrl = URL.createObjectURL(blob);
          return { name, imageUrl, blob, success: true as const };
        } catch (err) {
          return {
            name,
            error: err instanceof Error ? err.message : "Unknown error",
            success: false as const,
          };
        }
      })
    );
  }

  requiresNonRadialPoints(sequence: SequenceData): boolean {
    if (sequence.level && sequence.level >= 3) return true;

    const checkOrientations = (motions: {
      blue?: { startOrientation?: string; endOrientation?: string };
      red?: { startOrientation?: string; endOrientation?: string };
    }) => {
      const { blue, red } = motions;
      return (
        blue?.startOrientation === Orientation.CLOCK ||
        blue?.startOrientation === Orientation.COUNTER ||
        blue?.endOrientation === Orientation.CLOCK ||
        blue?.endOrientation === Orientation.COUNTER ||
        red?.startOrientation === Orientation.CLOCK ||
        red?.startOrientation === Orientation.COUNTER ||
        red?.endOrientation === Orientation.CLOCK ||
        red?.endOrientation === Orientation.COUNTER
      );
    };

    if (
      sequence.startPosition?.motions &&
      checkOrientations(sequence.startPosition.motions)
    ) {
      return true;
    }

    for (const step of sequence.steps || []) {
      if (checkOrientations(step.motions)) return true;
    }

    return false;
  }
}
