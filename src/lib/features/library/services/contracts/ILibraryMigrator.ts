/**
 * ILibraryMigrationService - IndexedDB to Firestore Migration
 *
 * Service for migrating existing local sequences from IndexedDB (Dexie)
 * to the new Firestore-based library.
 */

/**
 * Result of a migration operation
 */
export interface MigrationResult {
  /** Whether migration completed successfully */
  success: boolean;
  /** Number of sequences migrated */
  migratedCount: number;
  /** Number of sequences skipped (already exist) */
  skippedCount: number;
  /** Number of sequences that failed */
  failedCount: number;
  /** Error messages for failed sequences */
  errors: Array<{ sequenceId: string; error: string }>;
  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Progress callback for migration
 */
export interface MigrationProgress {
  /** Current sequence being migrated */
  currentSequence: number;
  /** Total sequences to migrate */
  totalSequences: number;
  /** Current sequence name */
  currentName?: string;
  /** Percentage complete (0-100) */
  percentComplete: number;
}

/**
 * ILibraryMigrationService - Migration operations
 */
export interface ILibraryMigrationService {
  /**
   * Check if there are local sequences that need migration
   * @returns Number of sequences that can be migrated
   */
  checkForLocalSequences(): Promise<number>;

  /**
   * Check if migration has already been completed
   * @returns Whether migration was previously completed
   */
  hasMigrated(): Promise<boolean>;

  /**
   * Migrate all local sequences to Firestore
   * @param onProgress Optional progress callback
   * @returns Migration result
   */
  migrateLocalSequences(
    onProgress?: (progress: MigrationProgress) => void
  ): Promise<MigrationResult>;

  /**
   * Migrate a single sequence by ID
   * @param localSequenceId The local sequence ID
   * @returns Whether migration succeeded
   */
  migrateSequence(localSequenceId: string): Promise<boolean>;

  /**
   * Mark migration as complete
   * Called after successful migration to prevent re-migration
   */
  markMigrationComplete(): Promise<void>;

  /**
   * Reset migration status (for testing/retry)
   * Allows migration to run again
   */
  resetMigrationStatus(): Promise<void>;

  /**
   * Get list of local sequences available for migration
   * @returns Array of local sequence IDs and names
   */
  getLocalSequences(): Promise<
    Array<{ id: string; name: string; stepCount: number }>
  >;

  /**
   * Check if a specific local sequence was already migrated
   * @param localSequenceId The local sequence ID
   * @returns Whether this sequence was migrated
   */
  isSequenceMigrated(localSequenceId: string): Promise<boolean>;
}
