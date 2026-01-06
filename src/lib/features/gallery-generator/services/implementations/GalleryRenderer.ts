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
import type { ISequenceRenderer } from "$lib/shared/render/services/contracts/ISequenceRenderer";
import type { IDiscoverLoader } from "$lib/features/discover/gallery/display/services/contracts/IDiscoverLoader";
import type { IStartPositionDeriver } from "$lib/shared/pictograph/shared/services/contracts/IStartPositionDeriver";
import type { SequenceExportOptions } from "$lib/shared/render/domain/models/SequenceExportOptions";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { IGalleryRenderer } from "../contracts/IGalleryRenderer";
import type { BatchRenderResult } from "../../domain/gallery-models";

export interface RenderOptions {
  lightMode: boolean;
  propType?: PropType;
}

export class GalleryRenderer implements IGalleryRenderer {
  constructor(
    private renderService: ISequenceRenderer,
    private loaderService: IDiscoverLoader,
    private startPositionDeriver: IStartPositionDeriver
  ) {}

  async renderSequence(
    sequence: SequenceData,
    lightMode: boolean,
    propType?: PropType
  ): Promise<Blob> {
    const seqName = sequence.word || sequence.name;
    console.log(`[GalleryRenderer] Rendering ${seqName}`);

    // Check if beats need parsing - old format has blueAttributes, modern has motions.blue
    const firstBeatRaw = sequence.beats?.[0] as
      | Record<string, unknown>
      | undefined;
    const needsParsing =
      !sequence.beats?.length ||
      (firstBeatRaw &&
        "blueAttributes" in firstBeatRaw &&
        !firstBeatRaw.motions);

    console.log(
      `[GalleryRenderer] needsParsing=${needsParsing}, beats.length=${sequence.beats?.length}, hasBlueAttributes=${"blueAttributes" in (firstBeatRaw || {})}`
    );

    // Load full sequence data if not loaded OR if beats are in old format
    if (needsParsing) {
      console.log(
        `[GalleryRenderer] Loading full sequence data for ${seqName}...`
      );
      const fullSequence =
        await this.loaderService.loadFullSequenceData(seqName);
      if (fullSequence) {
        console.log(`[GalleryRenderer] fullSequence returned:`, {
          beatsLength: fullSequence.beats?.length,
          hasStartPosition: !!fullSequence.startPosition,
          firstBeatMotions: fullSequence.beats?.[0]?.motions,
          firstBeatMotionsBlue: fullSequence.beats?.[0]?.motions?.blue,
          firstBeatMotionsRed: fullSequence.beats?.[0]?.motions?.red,
        });
        Object.assign(sequence, fullSequence);
        console.log(`[GalleryRenderer] After Object.assign:`, {
          beatsLength: sequence.beats?.length,
          firstBeatMotionsBlue: sequence.beats?.[0]?.motions?.blue,
        });
      } else {
        console.error(
          `[GalleryRenderer] loadFullSequenceData returned null for ${seqName}`
        );
      }
    }

    // Derive start position from first beat if not present OR if the existing one is invalid
    // This is the modern approach: start positions are derived, not stored
    let sequenceWithStartPos = sequence;
    const firstBeat = sequence.beats?.[0];

    // Check if existing start position is valid (has motion data for both hands)
    const existingStartPos = sequence.startPosition;
    const hasValidStartPosition =
      existingStartPos?.motions?.blue &&
      existingStartPos.motions?.red;

    // Check if first beat has valid motion data for derivation
    // Must have both blue and red motions with startLocation defined
    const firstBeatHasValidMotions =
      firstBeat?.motions?.blue?.startLocation &&
      firstBeat?.motions?.red?.startLocation;

    console.log(`[GalleryRenderer] Pre-derivation check:`, {
      hasStartPosition: !!sequence.startPosition,
      hasValidStartPosition,
      hasFirstBeat: !!firstBeat,
      firstBeatHasValidMotions: !!firstBeatHasValidMotions,
      firstBeatBlueStartLoc:
        firstBeat?.motions?.blue?.startLocation ?? "MISSING",
      firstBeatRedStartLoc: firstBeat?.motions?.red?.startLocation ?? "MISSING",
    });

    if (!hasValidStartPosition && firstBeat && firstBeatHasValidMotions) {
      try {
        console.log(`[GalleryRenderer] Calling deriveFromFirstBeat with:`, {
          beatId: firstBeat.id,
          beatLetter: firstBeat.letter,
          motions: firstBeat.motions,
        });
        const derivedStartPos =
          this.startPositionDeriver.deriveFromFirstBeat(firstBeat);
        sequenceWithStartPos = {
          ...sequence,
          startPosition: derivedStartPos,
        };
        console.log(
          `[GalleryRenderer] ✅ Derived start position: gridPosition=${derivedStartPos.gridPosition}`
        );
      } catch (err) {
        console.error(
          `[GalleryRenderer] ❌ Failed to derive start position for ${seqName}:`,
          err
        );
      }
    } else {
      if (hasValidStartPosition) {
        console.log(`[GalleryRenderer] Using existing valid start position`);
      } else if (!firstBeat) {
        console.warn(
          `[GalleryRenderer] Cannot derive start position: no first beat available`
        );
      } else if (!firstBeatHasValidMotions) {
        console.warn(
          `[GalleryRenderer] Cannot derive start position: first beat missing motion data or startLocation`,
          {
            hasBlueMotion: !!firstBeat.motions?.blue,
            hasRedMotion: !!firstBeat.motions?.red,
            blueStartLocation: firstBeat.motions?.blue?.startLocation,
            redStartLocation: firstBeat.motions?.red?.startLocation,
          }
        );
      }
    }

    const showNonRadial = this.requiresNonRadialPoints(sequenceWithStartPos);

    // Final check before rendering
    console.log(`[GalleryRenderer] FINAL CHECK for ${seqName}:`);
    console.log(
      `  - sequenceWithStartPos.startPosition:`,
      sequenceWithStartPos.startPosition
    );
    console.log(
      `  - sequenceWithStartPos.beats.length:`,
      sequenceWithStartPos.beats?.length
    );
    console.log(
      `  - First beat motions.blue:`,
      sequenceWithStartPos.beats?.[0]?.motions?.blue
    );

    const options: Partial<SequenceExportOptions> = {
      beatSize: 240,
      format: "WebP",
      quality: 0.95,
      includeStartPosition: true,
      addBeatNumbers: true,
      addWord: true,
      addDifficultyLevel: true,
      addUserInfo: false,
      addReversalSymbols: true,
      combinedGrids: false,
      beatScale: 1.0,
      margin: 0,
      redVisible: true,
      blueVisible: true,
      scale: 1.0,
      backgroundColor: lightMode ? "#ffffff" : "#1a1a2e",
      // Override prop type if specified
      propTypeOverride: propType,
      visibilityOverrides: {
        showTKA: true,
        showVTG: false,
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

    for (const beat of sequence.beats || []) {
      if (checkOrientations(beat.motions)) return true;
    }

    return false;
  }
}
