/**
 * ILibrarySaveService - Orchestrates saving sequences to library
 *
 * Handles the multi-step process of saving a sequence:
 * 1. Generate thumbnail image
 * 2. Upload thumbnail to storage
 * 3. Create any new tags
 * 4. Save sequence to Firestore
 * 5. Refresh library state
 *
 * This service coordinates multiple other services to provide
 * a unified save experience with progress tracking.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { SequenceVisibility } from "../../domain/models/LibrarySequence";

/**
 * Options for saving a sequence to the library
 */
export interface SaveToLibraryOptions {
  /** TKA name (auto-generated from sequence letters) */
  name: string;
  /** Optional custom display name */
  displayName?: string;
  /** Visibility level */
  visibility: SequenceVisibility;
  /** Tag names to apply */
  tags: string[];
  /** Optional notes */
  notes: string;
}

/**
 * Progress update during save operation
 */
export interface SaveProgress {
  /** Current step (1-6, where 6 is complete) */
  step: number;
  /** Human-readable step label */
  stepLabel: string;
  /** Granular progress for thumbnail rendering */
  renderProgress?: {
    current: number;
    total: number;
  };
}

/**
 * Result of a successful save operation
 */
export interface SaveResult {
  /** The saved sequence ID */
  sequenceId: string;
  /** URL of the uploaded thumbnail (if successful) */
  thumbnailUrl?: string;
}

/**
 * Save step definitions for UI display
 */
export const SAVE_STEPS = [
  { step: 1, icon: "fa-image", label: "Creating thumbnail" },
  { step: 2, icon: "fa-cloud-upload-alt", label: "Uploading preview" },
  { step: 3, icon: "fa-tags", label: "Creating tags" },
  { step: 4, icon: "fa-save", label: "Saving to library" },
  { step: 5, icon: "fa-sync", label: "Syncing data" },
] as const;

/**
 * ILibrarySaveService - Orchestrates the save-to-library workflow
 */
export interface ILibrarySaveService {
  /**
   * Save a sequence to the user's library
   *
   * @param sequence - The sequence data to save
   * @param options - Save options (name, visibility, tags, etc.)
   * @param onProgress - Callback for progress updates
   * @returns Save result with sequence ID and optional thumbnail URL
   * @throws Error if critical steps fail (Firestore save)
   */
  saveSequence(
    sequence: SequenceData,
    options: SaveToLibraryOptions,
    onProgress?: (progress: SaveProgress) => void
  ): Promise<SaveResult>;

  /**
   * Get the step label with dynamic content (e.g., beat progress)
   *
   * @param step - Current step number
   * @param renderProgress - Optional render progress for step 1
   * @returns Human-readable step label
   */
  getStepLabel(
    step: number,
    renderProgress?: { current: number; total: number }
  ): string;
}
