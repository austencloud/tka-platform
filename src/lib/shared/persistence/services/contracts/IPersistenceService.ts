/**
 * Persistence Service Interface
 *
 * This defines the contract for all persistence operations in your app.
 * Think of this as your "database API" - it abstracts away the complexity
 * of Dexie and provides simple methods for your components to use.
 */

import type { AppSettings } from "../../../settings/domain/AppSettings";
import type { CompleteExploreState } from "../../../../features/discover/shared/domain/models/discover-models";
import type { StartPositionData } from "../../../../features/create/shared/domain/models/StartPositionData";
import type { TabId } from "../../../foundation/ui/UITypes";
import type { SequenceData } from "../../../foundation/domain/models/SequenceData";
import type { UserProject } from "../../domain/models/UserProject";
import type { PictographData } from "../../../pictograph/shared/domain/models/PictographData";

// ============================================================================
// MAIN PERSISTENCE SERVICE
// ============================================================================

export interface IPersistenceService {
  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize the persistence layer
   */
  initialize(): Promise<void>;

  /**
   * Check if persistence is available
   */
  isAvailable(): boolean;

  // ============================================================================
  // SEQUENCE OPERATIONS
  // ============================================================================

  /**
   * Save a sequence to the database
   */
  saveSequence(sequence: SequenceData): Promise<void>;

  /**
   * Load a sequence by ID
   */
  loadSequence(id: string): Promise<SequenceData | null>;

  /**
   * Get all sequences (with optional filtering)
   */
  getAllSequences(filter?: {
    author?: string;
    level?: number;
    isFavorite?: boolean;
    tags?: string[];
  }): Promise<SequenceData[]>;

  /**
   * Delete a sequence
   */
  deleteSequence(id: string): Promise<void>;

  /**
   * Load all sequences from persistent storage
   * (Alias for getAllSequences for compatibility with IPersister interface)
   */
  loadAllSequences(): Promise<SequenceData[]>;

  /**
   * Search sequences by name or word
   */
  searchSequences(query: string): Promise<SequenceData[]>;

  // ============================================================================
  // PICTOGRAPH OPERATIONS
  // ============================================================================

  /**
   * Save a pictograph
   */
  savePictograph(pictograph: PictographData): Promise<void>;

  /**
   * Load a pictograph by ID
   */
  loadPictograph(id: string): Promise<PictographData | null>;

  /**
   * Get pictographs by letter
   */
  getPictographsByLetter(letter: string): Promise<PictographData[]>;

  /**
   * Get all pictographs
   */
  getAllPictographs(): Promise<PictographData[]>;

  // ============================================================================
  // TAB STATE PERSISTENCE
  // ============================================================================

  /**
   * Save the current active tab
   */
  saveActiveTab(tabId: TabId): Promise<void>;

  /**
   * Get the last active tab
   */
  getActiveTab(): Promise<TabId | null>;

  /**
   * Save state for a specific tab
   */
  saveTabState(tabId: TabId, state: unknown): Promise<void>;

  /**
   * Load state for a specific tab
   */
  loadTabState<T = unknown>(tabId: TabId): Promise<T | null>;

  // ============================================================================
  // Discover STATE PERSISTENCE
  // ============================================================================

  /**
   * Save complete Explore state (filters, sorts, scroll position, etc.)
   */
  saveExploreState(state: CompleteExploreState): Promise<void>;

  /**
   * Load Explore state
   */
  loadExploreState(): Promise<CompleteExploreState | null>;

  // ============================================================================
  // SETTINGS PERSISTENCE
  // ============================================================================

  /**
   * Save app settings
   */
  saveSettings(settings: AppSettings): Promise<void>;

  /**
   * Load app settings
   */
  loadSettings(): Promise<AppSettings | null>;

  // ============================================================================
  // USER PROJECTS
  // ============================================================================

  /**
   * Save a user project
   */
  saveProject(project: UserProject): Promise<void>;

  /**
   * Load all user projects
   */
  loadProjects(): Promise<UserProject[]>;

  /**
   * Delete a project
   */
  deleteProject(id: number): Promise<void>;

  // ============================================================================
  // UTILITY OPERATIONS
  // ============================================================================

  /**
   * Export all data for backup
   */
  exportAllData(): Promise<unknown>;

  /**
   * Import data from backup
   */
  importData(data: unknown): Promise<void>;

  /**
   * Clear all data (for development/reset)
   */
  clearAllData(): Promise<void>;

  /**
   * Get storage statistics
   */
  getStorageInfo(): Promise<{
    sequences: number;
    pictographs: number;
    userWork: number;
    projects: number;
    totalSize?: number;
  }>;

  // ============================================================================
  // SEQUENCE STATE PERSISTENCE (for hot module replacement survival)
  // ============================================================================

  /**
   * Save current sequence state for hot module replacement survival
   */
  saveCurrentSequenceState(state: {
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection?: string;
  }): Promise<void>;

  /**
   * Load current sequence state after hot module replacement
   * @param mode - Optional mode to load state for (constructor, generator, assembler)
   * If not provided, loads constructor state by default
   */
  loadCurrentSequenceState(mode?: string): Promise<{
    currentSequence: SequenceData | null;
    selectedStartPosition: StartPositionData | null;
    hasStartPosition: boolean;
    activeBuildSection?: string;
  } | null>;

  /**
   * Clear current sequence state (for clear sequence functionality)
   * @param mode - Optional mode to clear state for (constructor, generator, assembler)
   * If not provided, clears all modes
   */
  clearCurrentSequenceState(mode?: string): Promise<void>;
}
