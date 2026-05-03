/**
 * Prop Type Change Service Interface
 *
 * Watches for prop type changes from settings and triggers texture reloading.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { SettingsState } from "$lib/shared/settings/state/SettingsState.svelte";

/**
 * Reactive state owned by the service
 */
export interface PropTypeChangerState {
  bluePropType: string;
  redPropType: string;
  legacyPropType: string;
  /** Increments when textures should be reloaded */
  textureReloadSignal: number;
}

/**
 * Service for handling prop type changes
 */
export interface IPropTypeChanger {
  /**
   * Reactive state - read from component via $derived
   */
  readonly state: PropTypeChangerState;

  /**
   * Check for prop type changes from settings
   * @param settingsService The settings service to read from
   */
  checkForChanges(settingsService: SettingsState | null): void;

  /**
   * Override prop types directly (bypasses settings).
   * Used when the PropContextChip toggles between creator-intent and viewer props.
   */
  overridePropTypes(bluePropType: string, redPropType: string): void;

  /**
   * Clean up resources
   */
  dispose(): void;
}
