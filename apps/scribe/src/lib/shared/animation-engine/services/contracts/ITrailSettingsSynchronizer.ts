/**
 * Trail Settings Sync Service Interface
 *
 * Manages synchronization of trail settings between external sources,
 * local state, and the trail capture service.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { TrailSettings } from "../../domain/types/TrailTypes";
import type { ITrailCapturer } from "$lib/features/compose/services/contracts/ITrailCapturer";

/**
 * Callback for triggering re-renders
 */
export type RenderTriggerCallback = () => void;

/**
 * Reactive state owned by the service
 */
export interface TrailSettingsSyncState {
  /** Current settings (synced from external source) */
  syncedSettings: TrailSettings | null;
  /** Increments when a render is needed */
  renderSignal: number;
}

/**
 * Service for syncing trail settings
 */
export interface ITrailSettingsSynchronizer {
  /**
   * Reactive state - read from component via $derived
   */
  readonly state: TrailSettingsSyncState;

  /**
   * Initialize the service with dependencies
   */
  initialize(
    TrailCapturer: ITrailCapturer | null,
    renderTrigger: RenderTriggerCallback
  ): void;

  /**
   * Handle trail settings change - updates service, saves to localStorage if needed
   * @param settings Current trail settings
   * @param hasExternalSettings Whether settings come from external source
   */
  handleSettingsChange(
    settings: TrailSettings,
    hasExternalSettings: boolean
  ): void;

  /**
   * Handle external settings sync - updates local settings from external source
   * @param externalSettings External settings to sync (undefined if not provided)
   */
  handleExternalSettingsSync(externalSettings: TrailSettings | undefined): void;

  /**
   * Clean up resources
   */
  dispose(): void;
}
