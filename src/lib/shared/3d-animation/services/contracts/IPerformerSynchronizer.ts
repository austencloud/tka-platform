/**
 * IPerformerSynchronizer Contract
 *
 * Manages beat synchronization across N performers.
 * Supports master/follower relationships with configurable beat offsets,
 * allowing performers to play the same sequence at different phases.
 *
 * Use cases:
 * - Canon/round: Followers offset by N steps behind master
 * - Complementary: Followers offset to fill in gaps
 * - Synchronized: All performers on same beat (offset = 0)
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Unique identifier for a performer in the sync group
 */
export type PerformerId = string;

/**
 * Beat offset range (typically -8 to +8 for an 8-beat sequence)
 */
export interface OffsetRange {
  min: number;
  max: number;
}

/**
 * Configuration for a single performer in the sync group
 */
export interface PerformerSyncConfig {
  /** Unique performer identifier */
  id: PerformerId;
  /** Beat offset from master (-8 to +8 typically) */
  stepOffset: number;
  /** Whether this performer follows the master */
  followsMaster: boolean;
}

/**
 * Current sync state for a performer
 */
export interface PerformerSyncState {
  /** Performer identifier */
  id: PerformerId;
  /** Current beat index (after offset applied) */
  currentStep: number;
  /** Sub-beat progress (0-1) */
  stepProgress: number;
  /** Whether currently synced to master */
  isSynced: boolean;
}

/**
 * Callback for sync state changes
 */
export type SyncStateChangeCallback = (states: PerformerSyncState[]) => void;

/**
 * Callback for beat events
 */
export type StepEventCallback = (
  performerId: PerformerId,
  stepIndex: number
) => void;

// ============================================================================
// Interface
// ============================================================================

export interface IPerformerSynchronizer {
  // =========================================================================
  // State Accessors
  // =========================================================================

  /**
   * Whether synchronization is enabled
   */
  readonly isSyncEnabled: boolean;

  /**
   * Current master performer ID
   */
  readonly masterId: PerformerId;

  /**
   * Number of performers in the sync group
   */
  readonly performerCount: number;

  /**
   * Allowed beat offset range
   */
  readonly offsetRange: OffsetRange;

  // =========================================================================
  // Performer Management
  // =========================================================================

  /**
   * Add a performer to the sync group
   * First performer added becomes the default master
   *
   * @param id - Unique performer identifier
   * @param initialOffset - Initial beat offset (default 0)
   */
  addPerformer(id: PerformerId, initialOffset?: number): void;

  /**
   * Remove a performer from the sync group
   * If master is removed, first remaining performer becomes master
   *
   * @param id - Performer to remove
   */
  removePerformer(id: PerformerId): void;

  /**
   * Get configuration for a specific performer
   */
  getPerformerConfig(id: PerformerId): PerformerSyncConfig | null;

  /**
   * Get all performer configurations
   */
  getAllPerformerConfigs(): PerformerSyncConfig[];

  // =========================================================================
  // Sync Control
  // =========================================================================

  /**
   * Enable synchronization
   * All followers will immediately sync to master's current beat
   */
  enableSync(): void;

  /**
   * Disable synchronization
   * Performers continue independently
   */
  disableSync(): void;

  /**
   * Toggle sync on/off
   */
  toggleSync(): void;

  /**
   * Set the master performer
   * All other performers become followers
   *
   * @param id - Performer to make master
   */
  setMaster(id: PerformerId): void;

  // =========================================================================
  // Offset Management
  // =========================================================================

  /**
   * Set beat offset for a specific performer
   * Automatically clamps to valid range
   *
   * @param id - Performer to adjust
   * @param offset - Beat offset from master
   */
  setPerformerOffset(id: PerformerId, offset: number): void;

  /**
   * Increment offset for a performer by 1
   */
  incrementOffset(id: PerformerId): void;

  /**
   * Decrement offset for a performer by 1
   */
  decrementOffset(id: PerformerId): void;

  /**
   * Reset all followers to zero offset
   */
  resetAllOffsets(): void;

  // =========================================================================
  // Beat Calculation
  // =========================================================================

  /**
   * Calculate the beat index for a follower given master's beat
   *
   * @param performerId - Follower performer ID
   * @param masterStep - Current master beat index
   * @param totalSteps - Total steps in the sequence (for wrapping)
   * @returns Calculated beat index for the follower
   */
  calculateFollowerBeat(
    performerId: PerformerId,
    masterStep: number,
    totalSteps: number
  ): number;

  /**
   * Get current sync state for all performers
   */
  getSyncStates(): PerformerSyncState[];

  /**
   * Get sync state for a specific performer
   */
  getSyncState(id: PerformerId): PerformerSyncState | null;

  // =========================================================================
  // Beat Updates
  // =========================================================================

  /**
   * Notify the synchronizer that the master beat has changed.
   * This triggers follower beat updates if sync is enabled.
   *
   * @param masterStep - New master beat index
   * @param totalSteps - Total steps in sequence (for wrapping)
   */
  onMasterBeatChange(masterStep: number, totalSteps: number): void;

  /**
   * Notify the synchronizer that the master playback state changed.
   *
   * @param isPlaying - Whether master is now playing
   */
  onMasterPlayStateChange(isPlaying: boolean): void;

  // =========================================================================
  // Event Subscriptions
  // =========================================================================

  /**
   * Subscribe to sync state changes
   * Called whenever any performer's sync state changes
   *
   * @returns Unsubscribe function
   */
  onSyncStateChange(callback: SyncStateChangeCallback): () => void;

  /**
   * Subscribe to beat events for a specific performer
   * Called when performer reaches a new beat
   *
   * @returns Unsubscribe function
   */
  onStep(callback: StepEventCallback): () => void;

  // =========================================================================
  // Lifecycle
  // =========================================================================

  /**
   * Cleanup resources and subscriptions
   */
  destroy(): void;
}
