/**
 * Explore Loader Service
 *
 * Orchestrates loading of gallery sequences from the sequence index.
 * Handles validation, metadata extraction, and data normalization.
 */

import type { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createSequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import type { IDiscoverLoader } from "../contracts/IDiscoverLoader";
import type { IDiscoverMetadataExtractor } from "../contracts/IDiscoverMetadataExtractor";
import type { ISequenceDifficultyCalculator } from "../contracts/ISequenceDifficultyCalculator";
import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import { createStartPositionData } from "$lib/features/create/shared/domain/factories/createStartPositionData";
import type { LOOPType } from "$lib/features/create/generate/circular/domain/models/circular-models";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";

import {
  GridLocation,
  GridPosition,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createMotionData } from "../../../../../../shared/pictograph/shared/domain/models/MotionData";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "../../../../../../shared/pictograph/shared/domain/enums/pictograph-enums";
// Constants for validation
const MAX_WORD_LENGTH = 200;
const SEQUENCE_INDEX_URL = "/data/sequence-index.json";

interface RawSequenceData {
  word?: string;
  name?: string;
  id?: string;
  thumbnails?: unknown;
  isFavorite?: unknown;
  isCircular?: unknown;
  loopType?: string; // LOOP type for circular sequences
  tags?: unknown;
  metadata?: unknown;
  author?: string;
  gridMode?: unknown;
  difficultyLevel?: unknown;
  sequenceLength?: unknown;
  level?: unknown;
  dateAdded?: unknown;
  propType?: unknown;
  startingPosition?: unknown;
  fullMetadata?: unknown; // Bundled metadata from build script
  metadataBundled?: boolean; // Flag indicating metadata is pre-bundled
  // Owner info (for creator attribution)
  ownerId?: string;
  ownerDisplayName?: string;
  ownerAvatarUrl?: string;
}

export class DiscoverLoader implements IDiscoverLoader {
  // Cache for processed sequences - prevents re-fetching 4.7MB file
  private cachedSequences: SequenceData[] | null = null;
  private isLoading = false;
  private loadPromise: Promise<SequenceData[]> | null = null;

  constructor(
    private metadataExtractor: IDiscoverMetadataExtractor,
    private difficultyCalculator: ISequenceDifficultyCalculator
  ) {}

  async loadSequenceMetadata(): Promise<SequenceData[]> {
    // Return cached data if available
    if (this.cachedSequences) {
      return this.cachedSequences;
    }

    // If already loading, wait for that request to complete (prevents duplicate fetches)
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.isLoading = true;
    this.loadPromise = this.doLoadSequenceMetadata();

    try {
      const sequences = await this.loadPromise;
      this.cachedSequences = sequences;
      return sequences;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async doLoadSequenceMetadata(): Promise<SequenceData[]> {
    try {
      const rawSequences = await this.fetchSequenceIndex();
      const validSequences = await this.processRawSequences(rawSequences);
      return validSequences;
    } catch (error) {
      console.error("Failed to load sequence metadata:", error);
      throw error;
    }
  }

  /**
   * Lazy-load full sequence data including beats (only called when user opens a sequence)
   * This prevents the N+1 query problem during initial gallery load
   *
   * OPTIMIZATION: If metadata was bundled via build script, use it directly.
   * Otherwise, fetch from .meta.json file (fallback for development).
   */
  async loadFullSequenceData(
    sequenceName: string
  ): Promise<SequenceData | null> {
    try {
      // Check if we have bundled metadata in the sequence index cache
      // This would be populated if you run: npm run bundle:metadata
      const cachedSequence = this.sequenceCache.get(sequenceName);

      if (cachedSequence?.fullMetadata) {
        const result = this.createSequenceFromBundledMetadata(cachedSequence);
        return result;
      }

      // Fallback: Fetch metadata from .meta.json file (slower, but works in development)
      const thumbnailPath = `/gallery/${sequenceName}/${sequenceName}.webp`;
      const metadata = await this.metadataExtractor.extractMetadata(
        sequenceName,
        thumbnailPath
      );

      const gridMode = metadata.gridMode || GridMode.BOX;
      const dateAdded = metadata.dateAdded || new Date();
      const difficultyLevel = metadata.difficultyLevel || "beginner";
      const calculatedLevel = this.difficultyStringToLevel(difficultyLevel);

      return createSequenceData({
        id: sequenceName,
        name: this.cleanSequenceName(sequenceName),
        word: sequenceName,
        beats: metadata.beats,
        thumbnails: [thumbnailPath],
        isFavorite: false,
        isCircular: metadata.isCircular || false,
        tags: ["flow", "practice"],
        metadata: { source: "tka_dictionary" },
        author: metadata.author || "Unknown",
        gridMode,
        difficultyLevel,
        sequenceLength: metadata.sequenceLength,
        level: calculatedLevel,
        dateAdded,
        propType: metadata.propType || PropType.STAFF,
        startingPositionGroup: (metadata.startingPosition ||
          "alpha") as GridPositionGroup,
        startPosition: metadata.startPosition,
      });
    } catch (error) {
      console.error(
        `Failed to load full sequence data for ${sequenceName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Cache to store raw sequences for quick lookup during lazy loading
   */
  private sequenceCache = new Map<string, RawSequenceData>();

  /**
   * Create SequenceData from bundled metadata (instant, no HTTP request!)
   */
  private createSequenceFromBundledMetadata(
    rawSeq: RawSequenceData
  ): SequenceData | null {
    try {
      const fullMetadata = rawSeq.fullMetadata as Record<string, unknown>;
      const sequence = (fullMetadata.sequence || []) as unknown[];

      // Parse beats from bundled metadata
      const beats = this.parseBundledBeats(sequence);

      const word = rawSeq.word ?? rawSeq.id ?? "";

      // Extract grid_mode from the metadata object inside the sequence array
      // This is the authoritative source (fullMetadata.sequence[0].grid_mode)
      const metadataEntry = sequence.find(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null && "word" in item
      );
      const gridModeFromMeta = metadataEntry?.grid_mode as string | undefined;
      const gridMode =
        this.parseGridMode(gridModeFromMeta) ??
        this.parseGridMode(rawSeq.gridMode) ??
        GridMode.BOX;
      // Prefer fullMetadata.dateAdded (original birth date) over rawSeq.dateAdded (when added to Scribe)
      const birthDate = fullMetadata.dateAdded as string | undefined;
      const dateAdded = this.parseDate(birthDate) ?? this.parseDate(rawSeq.dateAdded) ?? new Date();
      const difficultyLevel = this.parseDifficulty(rawSeq.difficultyLevel);
      const calculatedLevel = this.difficultyStringToLevel(difficultyLevel);

      // Extract start position (beat 0) from bundled metadata
      const startPosition =
        this.parseStartPosition(sequence, gridMode) ?? undefined;

      return createSequenceData({
        id: word,
        name: this.cleanSequenceName(String(rawSeq.name ?? word)),
        word,
        beats,
        thumbnails: this.parseThumbnails(rawSeq.thumbnails),
        isFavorite: Boolean(rawSeq.isFavorite),
        isCircular: Boolean(rawSeq.isCircular),
        loopType: (rawSeq.loopType as LOOPType) ?? null, // LOOP type for circular sequences
        tags: this.parseTags(rawSeq.tags),
        metadata: this.parseMetadata(rawSeq.metadata),
        author: String(rawSeq.author ?? "Unknown"),
        gridMode,
        difficultyLevel,
        sequenceLength: beats.length,
        level: calculatedLevel,
        dateAdded,
        propType: (rawSeq.propType || "Staff") as PropType,
        startingPositionGroup: (rawSeq.startingPosition ||
          "alpha") as GridPositionGroup,
        startPosition,
        // Owner info for creator attribution
        ownerId: rawSeq.ownerId,
        ownerDisplayName: rawSeq.ownerDisplayName,
        ownerAvatarUrl: rawSeq.ownerAvatarUrl,
      });
    } catch (error) {
      console.error(`Failed to parse bundled metadata:`, error);
      return null;
    }
  }

  /**
   * Parse beats from bundled metadata with full motion data transformation
   * Mirrors the parsing logic from DiscoverMetadataExtractor
   */
  private parseBundledBeats(sequence: unknown[]): BeatData[] {
    const beatObjects = sequence.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    );

    // Filter out metadata entry and start position - only keep actual beats
    const beatItems = beatObjects.filter((item) => {
      // Skip sequence metadata (has 'word' field)
      if ("word" in item) return false;
      // Skip start position (has 'sequence_start_position' or beat === 0)
      if ("sequence_start_position" in item) return false;
      if (item.beat === 0) return false;
      // Must have a letter to be a valid beat
      return Boolean(item.letter);
    });

    return beatItems.map((stepData, index) => {
      // Handle both camelCase (blueAttributes) and snake_case (blue_attributes)
      const blueAttrs = (stepData["blueAttributes"] ||
        stepData["blue_attributes"]) as Record<string, unknown> | undefined;
      const redAttrs = (stepData["redAttributes"] ||
        stepData["red_attributes"]) as Record<string, unknown> | undefined;

      // Helper to get property value in either camelCase or snake_case
      const getAttr = (
        attrs: Record<string, unknown> | undefined,
        camel: string,
        snake: string
      ) => attrs?.[camel] ?? attrs?.[snake];

      return {
        id: `beat-${index + 1}`,
        letter: String(stepData["letter"] || ""),
        startPosition: null,
        endPosition: null,
        motions: {
          [MotionColor.BLUE]: blueAttrs
            ? createMotionData({
                color: MotionColor.BLUE,
                motionType: this.parseMotionType(
                  getAttr(blueAttrs, "motionType", "motion_type")
                ),
                startLocation: this.parseLocation(
                  getAttr(blueAttrs, "startLoc", "start_loc")
                ),
                endLocation: this.parseLocation(
                  getAttr(blueAttrs, "endLoc", "end_loc")
                ),
                startOrientation: this.parseOrientation(
                  getAttr(blueAttrs, "startOri", "start_ori")
                ),
                endOrientation: this.parseOrientation(
                  getAttr(blueAttrs, "endOri", "end_ori")
                ),
                rotationDirection: this.parseRotationDirection(
                  getAttr(blueAttrs, "propRotDir", "prop_rot_dir")
                ),
                turns: this.parseTurns(getAttr(blueAttrs, "turns", "turns")),
                isVisible: true,
                propType: PropType.STAFF,
                arrowLocation:
                  this.parseLocation(
                    getAttr(blueAttrs, "startLoc", "start_loc")
                  ) || GridLocation.NORTH,
                gridMode: GridMode.DIAMOND,
              })
            : undefined,
          [MotionColor.RED]: redAttrs
            ? createMotionData({
                color: MotionColor.RED,
                motionType: this.parseMotionType(
                  getAttr(redAttrs, "motionType", "motion_type")
                ),
                startLocation: this.parseLocation(
                  getAttr(redAttrs, "startLoc", "start_loc")
                ),
                endLocation: this.parseLocation(
                  getAttr(redAttrs, "endLoc", "end_loc")
                ),
                startOrientation: this.parseOrientation(
                  getAttr(redAttrs, "startOri", "start_ori")
                ),
                endOrientation: this.parseOrientation(
                  getAttr(redAttrs, "endOri", "end_ori")
                ),
                rotationDirection: this.parseRotationDirection(
                  getAttr(redAttrs, "propRotDir", "prop_rot_dir")
                ),
                turns: this.parseTurns(getAttr(redAttrs, "turns", "turns")),
                isVisible: true,
                propType: PropType.STAFF,
                arrowLocation:
                  this.parseLocation(
                    getAttr(redAttrs, "startLoc", "start_loc")
                  ) || GridLocation.SOUTH,
                gridMode: GridMode.DIAMOND,
              })
            : undefined,
        },
        beatNumber: Number(stepData["beat"] || index + 1),
        duration: 1.0,
        blueReversal: false,
        redReversal: false,
        isBlank: false,
      } as BeatData;
    });
  }

  /**
   * Parse start position (beat 0) from bundled metadata
   * Returns a StartPositionData structure representing the initial prop positions
   */
  private parseStartPosition(
    sequence: unknown[],
    gridMode: GridMode
  ): StartPositionData | null {
    const beatObjects = sequence.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    );

    // Find start position entry (has 'sequence_start_position' or beat === 0)
    const startPosEntry = beatObjects.find(
      (item) => "sequence_start_position" in item || item.beat === 0
    );

    if (!startPosEntry) return null;

    // Handle both camelCase (blueAttributes) and snake_case (blue_attributes)
    const blueAttrs = (startPosEntry["blueAttributes"] ||
      startPosEntry["blue_attributes"]) as Record<string, unknown> | undefined;
    const redAttrs = (startPosEntry["redAttributes"] ||
      startPosEntry["red_attributes"]) as Record<string, unknown> | undefined;

    // Extract grid position from endPos field (e.g., "alpha1", "beta5")
    const gridPosition = this.parseGridPosition(
      startPosEntry["endPos"] || startPosEntry["end_pos"]
    );

    // Helper to get attribute with camelCase or snake_case fallback
    const getAttr = (
      attrs: Record<string, unknown>,
      camelCase: string,
      snakeCase: string
    ) => attrs[camelCase] ?? attrs[snakeCase];

    return createStartPositionData({
      id: "start-position",
      letter: String(startPosEntry["letter"] || "α") as Letter,
      gridPosition: gridPosition,
      motions: {
        [MotionColor.BLUE]: blueAttrs
          ? createMotionData({
              color: MotionColor.BLUE,
              motionType: this.parseMotionType(
                getAttr(blueAttrs, "motionType", "motion_type")
              ),
              startLocation: this.parseLocation(
                getAttr(blueAttrs, "startLoc", "start_loc")
              ),
              endLocation: this.parseLocation(
                getAttr(blueAttrs, "endLoc", "end_loc")
              ),
              startOrientation: this.parseOrientation(
                getAttr(blueAttrs, "startOri", "start_ori")
              ),
              endOrientation: this.parseOrientation(
                getAttr(blueAttrs, "endOri", "end_ori")
              ),
              rotationDirection: this.parseRotationDirection(
                getAttr(blueAttrs, "propRotDir", "prop_rot_dir")
              ),
              turns: this.parseTurns(blueAttrs["turns"]),
              isVisible: true,
              propType: PropType.STAFF,
              arrowLocation:
                this.parseLocation(
                  getAttr(blueAttrs, "startLoc", "start_loc")
                ) || GridLocation.NORTH,
              gridMode,
            })
          : undefined,
        [MotionColor.RED]: redAttrs
          ? createMotionData({
              color: MotionColor.RED,
              motionType: this.parseMotionType(
                getAttr(redAttrs, "motionType", "motion_type")
              ),
              startLocation: this.parseLocation(
                getAttr(redAttrs, "startLoc", "start_loc")
              ),
              endLocation: this.parseLocation(
                getAttr(redAttrs, "endLoc", "end_loc")
              ),
              startOrientation: this.parseOrientation(
                getAttr(redAttrs, "startOri", "start_ori")
              ),
              endOrientation: this.parseOrientation(
                getAttr(redAttrs, "endOri", "end_ori")
              ),
              rotationDirection: this.parseRotationDirection(
                getAttr(redAttrs, "propRotDir", "prop_rot_dir")
              ),
              turns: this.parseTurns(redAttrs["turns"]),
              isVisible: true,
              propType: PropType.STAFF,
              arrowLocation:
                this.parseLocation(
                  getAttr(redAttrs, "startLoc", "start_loc")
                ) || GridLocation.SOUTH,
              gridMode,
            })
          : undefined,
      },
    });
  }

  // Helper methods for parsing motion attributes
  private parseMotionType(value: unknown): MotionType {
    const typeMap: Record<string, MotionType> = {
      pro: MotionType.PRO,
      anti: MotionType.ANTI,
      static: MotionType.STATIC,
      dash: MotionType.DASH,
      float: MotionType.FLOAT,
    };
    return typeMap[String(value).toLowerCase()] ?? MotionType.STATIC;
  }

  private parseLocation(value: unknown): GridLocation | undefined {
    if (!value) return undefined;
    const locMap: Record<string, GridLocation> = {
      n: GridLocation.NORTH,
      s: GridLocation.SOUTH,
      e: GridLocation.EAST,
      w: GridLocation.WEST,
      ne: GridLocation.NORTHEAST,
      nw: GridLocation.NORTHWEST,
      se: GridLocation.SOUTHEAST,
      sw: GridLocation.SOUTHWEST,
    };
    return locMap[String(value).toLowerCase()];
  }

  private parseOrientation(value: unknown): Orientation {
    const oriMap: Record<string, Orientation> = {
      in: Orientation.IN,
      out: Orientation.OUT,
      clock: Orientation.CLOCK,
      counter: Orientation.COUNTER,
    };
    return oriMap[String(value || "in").toLowerCase()] ?? Orientation.IN;
  }

  private parseRotationDirection(value: unknown): RotationDirection {
    const dirMap: Record<string, RotationDirection> = {
      cw: RotationDirection.CLOCKWISE,
      ccw: RotationDirection.COUNTER_CLOCKWISE,
      no_rot: RotationDirection.NO_ROTATION,
      norotation: RotationDirection.NO_ROTATION, // Handle camelCase variant
    };
    return dirMap[String(value).toLowerCase()] ?? RotationDirection.NO_ROTATION;
  }

  private parseGridPosition(value: unknown): GridPosition | null {
    if (!value) return null;
    const str = String(value).toLowerCase();
    // Check if the string is a valid GridPosition enum value
    const validPositions = Object.values(GridPosition) as string[];
    if (validPositions.includes(str)) {
      return str as GridPosition;
    }
    return null;
  }

  private parseTurns(value: unknown): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  // ============================================================================
  // Data Loading
  // ============================================================================

  private async fetchSequenceIndex(): Promise<RawSequenceData[]> {
    // Allow browser caching - the in-memory cache handles session persistence
    // Browser cache helps when user refreshes the page
    const response = await fetch(SEQUENCE_INDEX_URL);

    if (!response.ok) {
      throw new Error(`Failed to load sequence index: ${response.status}`);
    }

    const data = await response.json();
    return data.sequences || [];
  }

  // ============================================================================
  // Data Processing
  // ============================================================================

  private async processRawSequences(
    rawSequences: RawSequenceData[]
  ): Promise<SequenceData[]> {
    const sequences: SequenceData[] = [];

    for (const rawSeq of rawSequences) {
      const word = this.extractWord(rawSeq);

      if (!this.isValidWord(word)) {
        console.warn(`Skipping invalid sequence: ${word}`);
        continue;
      }

      // Cache the raw sequence for later lazy loading
      this.sequenceCache.set(word, rawSeq);

      try {
        const sequence = await this.createSequenceFromRaw(rawSeq, word);
        sequences.push(sequence);
      } catch (error) {
        const shouldLog = !this.isRoutineError(error);
        if (shouldLog) {
          console.warn(`Failed to process ${word}:`, error);
        }

        // Use fallback sequence creation
        const fallbackSequence = this.createFallbackSequence(rawSeq, word);
        sequences.push(fallbackSequence);
      }
    }

    return sequences;
  }

  // ============================================================================
  // Sequence Creation
  // ============================================================================

  private async createSequenceFromRaw(
    rawSeq: RawSequenceData,
    word: string
  ): Promise<SequenceData> {
    // ⚡ PERFORMANCE FIX: Skip expensive metadata extraction during initial load
    // The sequence-index.json already has all the data we need for the gallery view
    // Full beat data will be loaded lazily when user clicks on a sequence

    const gridMode = this.parseGridMode(rawSeq.gridMode) ?? GridMode.BOX;
    const dateAdded = this.parseDate(rawSeq.dateAdded) ?? new Date();

    // Calculate difficulty from bundled beats if available, otherwise use stored value
    let difficultyLevel: string;
    let calculatedLevel: number;

    if (rawSeq.fullMetadata) {
      // We have bundled metadata - calculate difficulty from actual beat data
      const fullMetadata = rawSeq.fullMetadata as Record<string, unknown>;
      const sequence = (fullMetadata.sequence || []) as unknown[];
      const beats = this.parseBundledBeats(sequence);
      calculatedLevel = this.difficultyCalculator.calculateDifficultyLevel(beats);
      difficultyLevel = this.difficultyCalculator.levelToString(calculatedLevel);
    } else {
      // Fallback to stored difficulty string
      difficultyLevel = this.parseDifficulty(rawSeq.difficultyLevel);
      calculatedLevel = this.difficultyStringToLevel(difficultyLevel);
    }

    return createSequenceData({
      id: word,
      name: this.cleanSequenceName(
        String(rawSeq.name ?? word ?? "Unnamed Sequence")
      ),
      word,
      beats: [], // Empty - will be loaded lazily via loadFullSequenceData()
      thumbnails: this.parseThumbnails(rawSeq.thumbnails),
      isFavorite: Boolean(rawSeq.isFavorite),
      isCircular: Boolean(rawSeq.isCircular),
      loopType: (rawSeq.loopType as LOOPType) ?? null, // LOOP type for circular sequences
      tags: this.parseTags(rawSeq.tags),
      metadata: this.parseMetadata(rawSeq.metadata),
      author: String(rawSeq.author ?? "Unknown"),
      gridMode,
      difficultyLevel,
      sequenceLength: this.parseSequenceLength(rawSeq.sequenceLength),
      level: calculatedLevel,
      dateAdded,
      propType: (rawSeq.propType || "Staff") as PropType,
      startingPositionGroup: (rawSeq.startingPosition ||
        "alpha") as GridPositionGroup,
      // Owner info for creator attribution
      ownerId: rawSeq.ownerId,
      ownerDisplayName: rawSeq.ownerDisplayName,
      ownerAvatarUrl: rawSeq.ownerAvatarUrl,
    });
  }

  private createFallbackSequence(
    rawSeq: RawSequenceData,
    word: string
  ): SequenceData {
    const gridMode = this.parseGridMode(rawSeq.gridMode) ?? GridMode.BOX;
    const dateAdded = this.parseDate(rawSeq.dateAdded) ?? new Date();

    // Calculate difficulty from bundled beats if available, otherwise use stored value
    let difficultyLevel: string;
    let calculatedLevel: number;

    if (rawSeq.fullMetadata) {
      const fullMetadata = rawSeq.fullMetadata as Record<string, unknown>;
      const sequence = (fullMetadata.sequence || []) as unknown[];
      const beats = this.parseBundledBeats(sequence);
      calculatedLevel = this.difficultyCalculator.calculateDifficultyLevel(beats);
      difficultyLevel = this.difficultyCalculator.levelToString(calculatedLevel);
    } else {
      difficultyLevel = this.parseDifficulty(rawSeq.difficultyLevel);
      calculatedLevel = this.difficultyStringToLevel(difficultyLevel);
    }

    return createSequenceData({
      id: word,
      name: this.cleanSequenceName(
        String(rawSeq.name ?? word ?? "Unnamed Sequence")
      ),
      word,
      beats: [],
      thumbnails: this.parseThumbnails(rawSeq.thumbnails),
      isFavorite: Boolean(rawSeq.isFavorite),
      isCircular: Boolean(rawSeq.isCircular),
      loopType: (rawSeq.loopType as LOOPType) ?? null, // LOOP type for circular sequences
      tags: this.parseTags(rawSeq.tags),
      metadata: this.parseMetadata(rawSeq.metadata),
      author: String(rawSeq.author ?? "Unknown"),
      gridMode,
      difficultyLevel,
      sequenceLength: this.parseSequenceLength(rawSeq.sequenceLength),
      level: calculatedLevel, // Use calculated level instead of old stored value
      dateAdded,
      propType: (rawSeq.propType || "Staff") as PropType,
      startingPositionGroup: (rawSeq.startingPosition ||
        "alpha") as GridPositionGroup,
      // Owner info for creator attribution
      ownerId: rawSeq.ownerId,
      ownerDisplayName: rawSeq.ownerDisplayName,
      ownerAvatarUrl: rawSeq.ownerAvatarUrl,
    });
  }

  // ============================================================================
  // Validation
  // ============================================================================

  private extractWord(rawSeq: RawSequenceData): string {
    return rawSeq.word ?? rawSeq.name ?? rawSeq.id ?? "";
  }

  private isValidWord(word: string): boolean {
    return (
      word.length > 0 &&
      word.length <= MAX_WORD_LENGTH &&
      !word.toLowerCase().includes("test")
    );
  }

  private isRoutineError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return errorMessage.includes("No valid version found");
  }

  // ============================================================================
  // Data Parsing Helpers
  // ============================================================================

  private parseThumbnails(value: unknown): string[] {
    return Array.isArray(value) ? (value as string[]) : [];
  }

  private parseTags(value: unknown): string[] {
    return Array.isArray(value) ? (value as string[]) : ["flow", "practice"];
  }

  private parseMetadata(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : { source: "tka_dictionary" };
  }

  private parseGridMode(value: unknown): GridMode | null {
    if (!value) return null;

    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (normalized === "gridmode.diamond" || normalized === "diamond") {
        return GridMode.DIAMOND;
      }
      if (normalized === "gridmode.box" || normalized === "box") {
        return GridMode.BOX;
      }
    }

    return value as GridMode;
  }

  private parseDifficulty(value: unknown): string {
    return typeof value === "string" ? value : "beginner";
  }

  private parseSequenceLength(value: unknown): number {
    return typeof value === "number" ? value : 0;
  }

  /**
   * Convert difficulty string to numeric level for SequenceCard styling
   * This ensures the card uses the NEW calculated difficulty, not old stored values
   */
  private difficultyStringToLevel(difficulty: string): number {
    const normalized = difficulty.toLowerCase();
    switch (normalized) {
      case "beginner":
        return 1;
      case "intermediate":
        return 2;
      case "advanced":
        return 3;
      case "mythic":
        return 4;
      case "legendary":
        return 5;
      default:
        return 1; // Default to beginner
    }
  }

  private parseDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "string") {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  }

  /**
   * Remove " Sequence" suffix from sequence names
   */
  private cleanSequenceName(name: string): string {
    return name.replace(/\s+Sequence$/i, "");
  }
}
