/**
 * PerformerSynchronizer
 *
 * Manages beat synchronization across N performers.
 * Generalizes the AvatarSyncState pattern to support any number of performers
 * with configurable beat offsets and master/follower relationships.
 *
 * @example
 * ```typescript
 * const sync = createPerformerSynchronizer();
 *
 * // Add performers (first becomes master by default)
 * sync.addPerformer("avatar1");
 * sync.addPerformer("avatar2", 2);  // 2 steps ahead
 * sync.addPerformer("avatar3", -2); // 2 steps behind
 *
 * // Enable sync
 * sync.enableSync();
 *
 * // Subscribe to beat updates
 * const unsubscribe = sync.onStep((performerId, beat) => {
 *   avatars[performerId].goToStep(beat);
 * });
 *
 * // In animation loop, notify of master beat changes
 * sync.onMasterBeatChange(masterAvatar.currentStep, masterAvatar.totalSteps);
 * ```
 */

export type PerformerId = string;

export interface OffsetRange {
  min: number;
  max: number;
}

export interface PerformerSyncConfig {
  id: PerformerId;
  stepOffset: number;
  followsMaster: boolean;
}

export interface PerformerSyncState {
  id: PerformerId;
  currentStep: number;
  stepProgress: number;
  isSynced: boolean;
}

export type SyncStateChangeCallback = (states: PerformerSyncState[]) => void;

export type StepEventCallback = (
  performerId: PerformerId,
  stepIndex: number
) => void;

export interface IPerformerSynchronizer {
  readonly isSyncEnabled: boolean;
  readonly masterId: PerformerId;
  readonly performerCount: number;
  readonly offsetRange: OffsetRange;
  addPerformer(id: PerformerId, initialOffset?: number): void;
  removePerformer(id: PerformerId): void;
  getPerformerConfig(id: PerformerId): PerformerSyncConfig | null;
  getAllPerformerConfigs(): PerformerSyncConfig[];
  enableSync(): void;
  disableSync(): void;
  toggleSync(): void;
  setMaster(id: PerformerId): void;
  setPerformerOffset(id: PerformerId, offset: number): void;
  incrementOffset(id: PerformerId): void;
  decrementOffset(id: PerformerId): void;
  resetAllOffsets(): void;
  calculateFollowerBeat(performerId: PerformerId, masterStep: number, totalSteps: number): number;
  getSyncStates(): PerformerSyncState[];
  getSyncState(id: PerformerId): PerformerSyncState | null;
  onMasterBeatChange(masterStep: number, totalSteps: number): void;
  onMasterPlayStateChange(isPlaying: boolean): void;
  onSyncStateChange(callback: SyncStateChangeCallback): () => void;
  onStep(callback: StepEventCallback): () => void;
  destroy(): void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OFFSET_RANGE: OffsetRange = {
  min: -8,
  max: 8,
};

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a PerformerSynchronizer for managing beat sync across N performers.
 *
 * @param offsetRange - Optional custom offset range (default -8 to +8)
 */
export function createPerformerSynchronizer(
  offsetRange: OffsetRange = DEFAULT_OFFSET_RANGE
): IPerformerSynchronizer {
  // =========================================================================
  // State
  // =========================================================================

  let isSyncEnabled = false;
  let masterId: PerformerId = "";
  const performers = new Map<PerformerId, PerformerSyncConfig>();
  const syncStates = new Map<PerformerId, PerformerSyncState>();

  // Event callbacks
  const syncStateCallbacks = new Set<SyncStateChangeCallback>();
  const beatCallbacks = new Set<StepEventCallback>();

  // Track last known beat for change detection
  let lastMasterStep = -1;
  let lastTotalSteps = 0;

  // =========================================================================
  // Helper Functions
  // =========================================================================

  /**
   * Calculate beat with offset and wrapping
   */
  function calculateBeatWithOffset(
    baseBeat: number,
    offset: number,
    totalSteps: number
  ): number {
    if (totalSteps === 0) return 0;
    // Modulo that handles negatives correctly
    return (((baseBeat + offset) % totalSteps) + totalSteps) % totalSteps;
  }

  /**
   * Clamp offset to valid range
   */
  function clampOffset(offset: number): number {
    return Math.max(offsetRange.min, Math.min(offsetRange.max, offset));
  }

  /**
   * Notify all sync state subscribers
   */
  function notifySyncStateChange(): void {
    const states = Array.from(syncStates.values());
    syncStateCallbacks.forEach((cb) => cb(states));
  }

  /**
   * Notify beat subscribers for a specific performer
   */
  function notifyBeat(performerId: PerformerId, beat: number): void {
    beatCallbacks.forEach((cb) => cb(performerId, beat));
  }

  /**
   * Update sync state for a performer
   */
  function updateSyncState(
    performerId: PerformerId,
    beat: number,
    progress: number
  ): void {
    const config = performers.get(performerId);
    if (!config) return;

    syncStates.set(performerId, {
      id: performerId,
      currentStep: beat,
      stepProgress: progress,
      isSynced: isSyncEnabled && config.followsMaster,
    });
  }

  /**
   * Sync all followers to master's current beat
   */
  function syncAllFollowers(masterStep: number, totalSteps: number): void {
    if (!isSyncEnabled) return;

    for (const [id, config] of performers) {
      if (config.followsMaster && id !== masterId) {
        const followerBeat = calculateBeatWithOffset(
          masterStep,
          config.stepOffset,
          totalSteps
        );
        updateSyncState(id, followerBeat, 0);
        notifyBeat(id, followerBeat);
      }
    }

    notifySyncStateChange();
  }

  // =========================================================================
  // IPerformerSynchronizer Implementation
  // =========================================================================

  const synchronizer: IPerformerSynchronizer = {
    // State Accessors
    get isSyncEnabled() {
      return isSyncEnabled;
    },
    get masterId() {
      return masterId;
    },
    get performerCount() {
      return performers.size;
    },
    get offsetRange() {
      return offsetRange;
    },

    // Performer Management
    addPerformer(id: PerformerId, initialOffset = 0): void {
      if (performers.has(id)) return;

      const isFirst = performers.size === 0;
      const config: PerformerSyncConfig = {
        id,
        stepOffset: clampOffset(initialOffset),
        followsMaster: !isFirst, // First performer is master, doesn't follow
      };

      performers.set(id, config);
      syncStates.set(id, {
        id,
        currentStep: 0,
        stepProgress: 0,
        isSynced: false,
      });

      // First performer becomes master
      if (isFirst) {
        masterId = id;
      }

      notifySyncStateChange();
    },

    removePerformer(id: PerformerId): void {
      if (!performers.has(id)) return;

      performers.delete(id);
      syncStates.delete(id);

      // If master was removed, assign new master
      if (id === masterId && performers.size > 0) {
        const firstRemaining = performers.keys().next().value;
        if (firstRemaining) {
          masterId = firstRemaining;
          const config = performers.get(masterId);
          if (config) {
            config.followsMaster = false;
            config.stepOffset = 0;
          }
        }
      }

      if (performers.size === 0) {
        masterId = "";
      }

      notifySyncStateChange();
    },

    getPerformerConfig(id: PerformerId): PerformerSyncConfig | null {
      return performers.get(id) ?? null;
    },

    getAllPerformerConfigs(): PerformerSyncConfig[] {
      return Array.from(performers.values());
    },

    // Sync Control
    enableSync(): void {
      if (isSyncEnabled) return;
      isSyncEnabled = true;

      // Immediately sync all followers
      if (lastTotalSteps > 0) {
        syncAllFollowers(lastMasterStep, lastTotalSteps);
      }

      notifySyncStateChange();
    },

    disableSync(): void {
      if (!isSyncEnabled) return;
      isSyncEnabled = false;

      // Update all states to show not synced
      for (const [id, state] of syncStates) {
        syncStates.set(id, { ...state, isSynced: false });
      }

      notifySyncStateChange();
    },

    toggleSync(): void {
      if (isSyncEnabled) {
        synchronizer.disableSync();
      } else {
        synchronizer.enableSync();
      }
    },

    setMaster(id: PerformerId): void {
      if (!performers.has(id)) return;
      if (id === masterId) return;

      // Old master becomes follower
      const oldMasterConfig = performers.get(masterId);
      if (oldMasterConfig) {
        oldMasterConfig.followsMaster = true;
      }

      // New master
      masterId = id;
      const newMasterConfig = performers.get(id);
      if (newMasterConfig) {
        newMasterConfig.followsMaster = false;
        newMasterConfig.stepOffset = 0;
      }

      // Re-sync if enabled
      if (isSyncEnabled && lastTotalSteps > 0) {
        syncAllFollowers(lastMasterStep, lastTotalSteps);
      }

      notifySyncStateChange();
    },

    // Offset Management
    setPerformerOffset(id: PerformerId, offset: number): void {
      const config = performers.get(id);
      if (!config) return;

      config.stepOffset = clampOffset(offset);

      // Re-sync this performer if sync is enabled
      if (isSyncEnabled && config.followsMaster && lastTotalSteps > 0) {
        const beat = calculateBeatWithOffset(
          lastMasterStep,
          config.stepOffset,
          lastTotalSteps
        );
        updateSyncState(id, beat, 0);
        notifyBeat(id, beat);
        notifySyncStateChange();
      }
    },

    incrementOffset(id: PerformerId): void {
      const config = performers.get(id);
      if (config) {
        synchronizer.setPerformerOffset(id, config.stepOffset + 1);
      }
    },

    decrementOffset(id: PerformerId): void {
      const config = performers.get(id);
      if (config) {
        synchronizer.setPerformerOffset(id, config.stepOffset - 1);
      }
    },

    resetAllOffsets(): void {
      for (const config of performers.values()) {
        if (config.followsMaster) {
          config.stepOffset = 0;
        }
      }

      if (isSyncEnabled && lastTotalSteps > 0) {
        syncAllFollowers(lastMasterStep, lastTotalSteps);
      }
    },

    // Beat Calculation
    calculateFollowerBeat(
      performerId: PerformerId,
      masterStep: number,
      totalSteps: number
    ): number {
      const config = performers.get(performerId);
      if (!config) return masterStep;
      return calculateBeatWithOffset(masterStep, config.stepOffset, totalSteps);
    },

    getSyncStates(): PerformerSyncState[] {
      return Array.from(syncStates.values());
    },

    getSyncState(id: PerformerId): PerformerSyncState | null {
      return syncStates.get(id) ?? null;
    },

    // Beat Updates
    onMasterBeatChange(masterStep: number, totalSteps: number): void {
      // Store for later use (e.g., when sync is enabled or performer is added)
      lastTotalSteps = totalSteps;

      // Only process if beat actually changed
      if (masterStep === lastMasterStep) return;
      lastMasterStep = masterStep;

      // Update master's state
      updateSyncState(masterId, masterStep, 0);
      notifyBeat(masterId, masterStep);

      // Sync followers
      syncAllFollowers(masterStep, totalSteps);
    },

    onMasterPlayStateChange(isPlaying: boolean): void {
      // Currently just for notification - could be extended to pause/play followers
      // This hook exists for future expansion (e.g., pausing all when master pauses)
    },

    // Event Subscriptions
    onSyncStateChange(callback: SyncStateChangeCallback): () => void {
      syncStateCallbacks.add(callback);
      return () => syncStateCallbacks.delete(callback);
    },

    onStep(callback: StepEventCallback): () => void {
      beatCallbacks.add(callback);
      return () => beatCallbacks.delete(callback);
    },

    // Lifecycle
    destroy(): void {
      performers.clear();
      syncStates.clear();
      syncStateCallbacks.clear();
      beatCallbacks.clear();
      isSyncEnabled = false;
      masterId = "";
      lastMasterStep = -1;
      lastTotalSteps = 0;
    },
  };

  return synchronizer;
}
