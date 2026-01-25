/**
 * Local Storage Persistence Service
 *
 * Handles data persistence using browser localStorage.
 * This provides a simple persistence layer for sequences and settings.
 */

import type { StepData } from "../../../../create/shared/domain/models/StepData";
import type { StartPositionData } from "../../../../create/shared/domain/models/StartPositionData";
import { createStartPositionData } from "../../../../create/shared/domain/factories/createStartPositionData";
import type { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { safeParseOrNull } from "$lib/shared/validation/validation-utils";
import { SequenceDataSchema } from "$lib/shared/foundation/domain/schemas";

/**
 * Standalone Explore persistence - no interface inheritance needed.
 */
export class ExplorePersister {
  private readonly CACHE_VERSION = "v2.1"; // ✅ ROBUST: Cache versioning
  private readonly SEQUENCES_KEY = `tka-${this.CACHE_VERSION}-sequences`;
  private readonly SEQUENCE_PREFIX = `tka-${this.CACHE_VERSION}-sequence-`;

  /**
   * Normalize steps array to ensure all required properties are present
   */
  private normalizeBeats(steps: unknown[]): StepData[] {
    return steps.map((beat: unknown, index: number) => {
      const stepData = beat as Record<string, unknown>;

      // Handle both old format (with pictographData) and new unified format
      const pictographData = stepData as unknown as PictographData;

      return {
        // Core beat properties
        id: (stepData["id"] as string) || crypto.randomUUID(),
        stepNumber:
          typeof stepData["stepNumber"] === "number"
            ? stepData["stepNumber"]
            : index + 1,
        duration: (stepData["duration"] as number) || 1,
        blueReversal: (stepData["blueReversal"] as boolean) || false,
        redReversal: (stepData["redReversal"] as boolean) || false,
        isBlank: (stepData["isBlank"] as boolean) || false,

        // Pictograph properties (from old pictographData or directly from beat)
        letter:
          (pictographData["letter"] as Letter | null | undefined) ??
          (stepData["letter"] as Letter | null | undefined) ??
          null,
        startPosition:
          (pictographData["startPosition"] as
            | GridPosition
            | null
            | undefined) ??
          (stepData["startPosition"] as GridPosition | null | undefined) ??
          null,
        endPosition:
          (pictographData["endPosition"] as GridPosition | null | undefined) ??
          (stepData["endPosition"] as GridPosition | null | undefined) ??
          null,
        motions:
          (pictographData["motions"] as
            | Record<string, MotionData>
            | null
            | undefined) ??
          (stepData["motions"] as
            | Record<string, MotionData>
            | null
            | undefined) ??
          {},
      };
    });
  }

  /**
   * Normalize a single beat to ensure all required properties are present
   */
  private normalizeBeat(beat: unknown): StepData | undefined {
    if (!beat) return undefined;
    const stepData = beat as Record<string, unknown>;

    // Handle both old format (with pictographData) and new unified format
    const pictographData = stepData as unknown as PictographData;

    return {
      // Core beat properties
      id: (stepData["id"] as string) || crypto.randomUUID(),
      stepNumber: (stepData["stepNumber"] as number) || 1,
      duration: (stepData["duration"] as number) || 1,
      blueReversal: (stepData["blueReversal"] as boolean) || false,
      redReversal: (stepData["redReversal"] as boolean) || false,
      isBlank: (stepData["isBlank"] as boolean) || false,

      // Pictograph properties (from old pictographData or directly from beat)
      letter:
        (pictographData["letter"] as Letter | null | undefined) ??
        (stepData["letter"] as Letter | null | undefined) ??
        null,
      startPosition:
        (pictographData["startPosition"] as GridPosition | null | undefined) ??
        (stepData["startPosition"] as GridPosition | null | undefined) ??
        null,
      endPosition:
        (pictographData["endPosition"] as GridPosition | null | undefined) ??
        (stepData["endPosition"] as GridPosition | null | undefined) ??
        null,
      motions:
        (pictographData["motions"] as
          | Record<string, MotionData>
          | null
          | undefined) ??
        (stepData["motions"] as
          | Record<string, MotionData>
          | null
          | undefined) ??
        {},
    };
  }

  /**
   * Normalize a start position to ensure all required properties are present
   */
  private normalizeStartPosition(
    startPos: unknown
  ): StartPositionData | undefined {
    if (!startPos) return undefined;
    const posData = startPos as Record<string, unknown>;

    // Handle both old format and new unified format - use posData for all accesses
    return createStartPositionData({
      id: (posData["id"] as string) || `start-${crypto.randomUUID()}`,
      letter: (posData["letter"] as Letter | null | undefined) ?? null,
      gridPosition:
        (posData["gridPosition"] as GridPosition | null | undefined) ?? null,
      startPosition:
        (posData["startPosition"] as GridPosition | null | undefined) ?? null,
      endPosition:
        (posData["endPosition"] as GridPosition | null | undefined) ?? null,
      motions:
        (posData["motions"] as Record<string, MotionData> | null | undefined) ??
        {},
    });
  }

  /**
   * Normalize a sequence to ensure all required properties are present
   */
  private normalizeSequence(sequence: unknown): SequenceData {
    const sequenceData = sequence as Record<string, unknown>;
    const startingPosition = this.normalizeStartPosition(
      sequenceData["startingPosition"]
    );
    const startPosition = this.normalizeStartPosition(
      sequenceData["startPosition"]
    );

    const beatsValue = sequenceData["steps"];
    const steps = Array.isArray(beatsValue) ? beatsValue : [];

    const thumbnailsValue = sequenceData["thumbnails"];
    const thumbnails =
      Array.isArray(thumbnailsValue) &&
      thumbnailsValue.every((t): t is string => typeof t === "string")
        ? thumbnailsValue
        : [];

    const tagsValue = sequenceData["tags"];
    const tags =
      Array.isArray(tagsValue) &&
      tagsValue.every((t): t is string => typeof t === "string")
        ? tagsValue
        : [];

    const metadataValue = sequenceData["metadata"];
    const metadata =
      typeof metadataValue === "object" &&
      metadataValue !== null &&
      !Array.isArray(metadataValue)
        ? (metadataValue as Record<string, unknown>)
        : {};

    return {
      ...(sequenceData as object),
      id: (sequenceData["id"] as string) || crypto.randomUUID(),
      name:
        (sequenceData["name"] as string) ||
        (sequenceData["word"] as string) ||
        "",
      word: (sequenceData["word"] as string) || "",
      steps: this.normalizeBeats(steps),
      ...(startingPosition && { startingPosition }),
      ...(startPosition && { startPosition }),
      thumbnails,
      tags,
      isFavorite: (sequenceData["isFavorite"] as boolean) || false,
      isCircular: (sequenceData["isCircular"] as boolean) || false,
      metadata,
    };
  }

  /**
   * Validate sequence data before storage operations
   */
  private isValidSequence(sequence: SequenceData): boolean {
    // ✅ PERMANENT: Validate sequence names to prevent malformed data
    const name = sequence["name"] || sequence["word"] || sequence["id"] || "";

    return (
      name.length > 0 &&
      name.length <= 100 && // Reasonable name length limit
      !name.includes("__") && // No double underscores
      !name.includes("test") // No test sequences
    );
  }

  /**
   * Save a sequence to localStorage
   */
  async saveSequence(sequence: SequenceData): Promise<void> {
    try {
      // ✅ PERMANENT: Validate before saving
      if (!this.isValidSequence(sequence)) {
        console.warn(
          `Skipping invalid sequence: ${sequence["name"] || sequence["id"]}`
        );
        return;
      }

      // ✅ CRITICAL: Validate with Zod schema before saving to prevent invalid data
      const validationResult = safeParseOrNull(
        SequenceDataSchema,
        sequence,
        `sequence ${sequence["id"]} before save`
      );

      if (!validationResult) {
        console.warn(
          `Sequence ${sequence["id"]} failed schema validation, skipping save`
        );
        return;
      }

      // Normalize the sequence to ensure all required fields are present
      const normalizedSequence = this.normalizeSequence(validationResult);

      // Save individual sequence
      const sequenceKey = `${this.SEQUENCE_PREFIX}${sequence["id"]}`;
      localStorage.setItem(sequenceKey, JSON.stringify(normalizedSequence));

      // Update sequence index
      await this.updateSequenceIndex(normalizedSequence);
    } catch (error) {
      console.error("Failed to save sequence:", error);
      throw new Error(
        `Failed to save sequence: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Load a sequence by ID
   */
  loadSequence(id: string): Promise<SequenceData | null> {
    try {
      const sequenceKey = `${this.SEQUENCE_PREFIX}${id}`;
      const data = localStorage.getItem(sequenceKey);

      if (!data) {
        return Promise.resolve(null);
      }

      const sequence: unknown = JSON.parse(data);
      return Promise.resolve(this.validateSequenceData(sequence));
    } catch (error) {
      console.error(`Failed to load sequence ${id}:`, error);
      return Promise.resolve(null);
    }
  }

  /**
   * Load all sequences
   */
  loadAllSequences(): Promise<SequenceData[]> {
    try {
      const indexData = localStorage.getItem(this.SEQUENCES_KEY);
      if (!indexData) {
        return Promise.resolve([]);
      }

      const parsedIndex: unknown = JSON.parse(indexData);
      const sequenceIds =
        Array.isArray(parsedIndex) &&
        parsedIndex.every((id): id is string => typeof id === "string")
          ? parsedIndex
          : [];
      const sequences: SequenceData[] = [];

      for (const id of sequenceIds) {
        const sequenceKey = `${this.SEQUENCE_PREFIX}${id}`;
        const rawData = localStorage.getItem(sequenceKey);

        if (rawData) {
          try {
            const parsedData: unknown = JSON.parse(rawData);
            const validatedSequence = safeParseOrNull(
              SequenceDataSchema,
              parsedData,
              `sequence ${id}`
            );

            if (validatedSequence) {
              const normalizedSequence =
                this.normalizeSequence(validatedSequence);
              if (this.isValidSequence(normalizedSequence)) {
                sequences.push(normalizedSequence);
              }
            }
          } catch (error) {
            console.warn(`Skipping corrupted sequence ${id}:`, error);
          }
        }
      }

      return Promise.resolve(
        sequences.sort((a, b) => {
          // Sort by stored timestamp in metadata if available
          const aSavedAt = a["metadata"]["saved_at"];
          const bSavedAt = b["metadata"]["saved_at"];
          const aDate = new Date(
            typeof aSavedAt === "string" ? aSavedAt : 0
          ).getTime();
          const bDate = new Date(
            typeof bSavedAt === "string" ? bSavedAt : 0
          ).getTime();
          return bDate - aDate;
        })
      );
    } catch (error) {
      console.error("Failed to load sequences:", error);
      return Promise.resolve([]);
    }
  }

  /**
   * Delete a sequence
   */
  async deleteSequence(id: string): Promise<void> {
    try {
      // Remove individual sequence
      const sequenceKey = `${this.SEQUENCE_PREFIX}${id}`;
      localStorage.removeItem(sequenceKey);

      // Update sequence index
      await this.removeFromSequenceIndex(id);
    } catch (error) {
      console.error(`Failed to delete sequence ${id}:`, error);
      throw new Error(
        `Failed to delete sequence: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Update the sequence index with a new or updated sequence
   */
  private updateSequenceIndex(sequence: SequenceData): Promise<void> {
    try {
      const indexData = localStorage.getItem(this.SEQUENCES_KEY);
      let sequenceIds: string[] = [];

      if (indexData) {
        const parsedIndex: unknown = JSON.parse(indexData);
        sequenceIds =
          Array.isArray(parsedIndex) &&
          parsedIndex.every((id): id is string => typeof id === "string")
            ? parsedIndex
            : [];
      }

      // Add sequence ID if not already present
      if (!sequenceIds.includes(sequence["id"])) {
        sequenceIds.push(sequence["id"]);
        localStorage.setItem(this.SEQUENCES_KEY, JSON.stringify(sequenceIds));
      }
    } catch (error) {
      console.error("Failed to update sequence index:", error);
    }
    return Promise.resolve();
  }

  /**
   * Remove a sequence ID from the index
   */
  private removeFromSequenceIndex(id: string): Promise<void> {
    try {
      const indexData = localStorage.getItem(this.SEQUENCES_KEY);
      if (!indexData) return Promise.resolve();

      const parsedIndex: unknown = JSON.parse(indexData);
      const sequenceIds =
        Array.isArray(parsedIndex) &&
        parsedIndex.every(
          (existingId): existingId is string => typeof existingId === "string"
        )
          ? parsedIndex
          : [];
      const filteredIds = sequenceIds.filter((existingId) => existingId !== id);

      localStorage.setItem(this.SEQUENCES_KEY, JSON.stringify(filteredIds));
    } catch (error) {
      console.error("Failed to remove from sequence index:", error);
    }
    return Promise.resolve();
  }

  /**
   * Validate sequence data using Zod schema - replaces 50+ lines of manual validation
   */
  private validateSequenceData(raw: unknown): SequenceData {
    // Use safe parsing to handle corrupted localStorage data gracefully
    const validatedSequence = safeParseOrNull(
      SequenceDataSchema,
      raw,
      "localStorage sequence data"
    );

    if (validatedSequence) {
      // Ensure metadata has persistence timestamps
      const nowIso = new Date().toISOString();
      // After Zod validation, metadata is guaranteed to be Record<string, unknown> due to .default({})
      const existingMetadata = validatedSequence["metadata"] as Record<
        string,
        unknown
      >;
      const savedAt = existingMetadata["saved_at"];
      const metadata: Record<string, unknown> = {
        ...existingMetadata,
        saved_at: typeof savedAt === "string" ? savedAt : nowIso,
        updated_at: nowIso,
      };

      return this.normalizeSequence({
        ...validatedSequence,
        metadata,
      });
    } else {
      throw new Error(
        "Invalid sequence data structure - failed Zod validation"
      );
    }
  }

  /**
   * Get storage usage statistics
   */
  getStorageInfo(): { used: number; available: number; sequences: number } {
    try {
      // Calculate used storage (rough estimate)
      let used = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(`tka-${this.CACHE_VERSION}-`)) {
          // ✅ ROBUST: Only count current version storage
          const value = localStorage.getItem(key);
          used += (key.length + (value?.length ?? 0)) * 2; // UTF-16 encoding
        }
      }

      // Get sequence count
      const indexData = localStorage.getItem(this.SEQUENCES_KEY);
      let sequenceCount = 0;
      if (indexData) {
        const parsedIndex: unknown = JSON.parse(indexData);
        if (Array.isArray(parsedIndex)) {
          sequenceCount = parsedIndex.length;
        }
      }

      return {
        used: Math.round(used / 1024), // KB
        available: 5120, // Rough estimate of 5MB localStorage limit
        sequences: sequenceCount,
      };
    } catch {
      return { used: 0, available: 5120, sequences: 0 };
    }
  }

  /**
   * Clear old cached data and malformed sequences
   */
  clearLegacyCache(): Promise<void> {
    try {
      // Keys to preserve (don't remove these important state keys)
      const preserveKeys = [
        "tka-app-tab-state-v2",
        "tka-modern-web-settings",
        "tka-browse-state-v2",
        "tka-browse-filter-v2",
        "tka-browse-sort-v2",
        "tka-browse-view-v2",
        "tka-browse-scroll-v2",
        "tka-browse-selection-v2",
      ];

      // Clear all old TKA storage keys except preserved ones
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          key.startsWith("tka-") &&
          !key.startsWith(`tka-${this.CACHE_VERSION}-`) &&
          !preserveKeys.includes(key)
        ) {
          keysToRemove.push(key);
        }
      }

      // Remove old keys
      keysToRemove.forEach((key) => {
        localStorage.removeItem(key);
      });

      // Clear session storage as well
      const sessionKeysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("tka-")) {
          sessionKeysToRemove.push(key);
        }
      }

      sessionKeysToRemove.forEach((key) => {
        sessionStorage.removeItem(key);
      });
    } catch (error) {
      console.error("Failed to clear legacy cache:", error);
    }
    return Promise.resolve();
  }
}
