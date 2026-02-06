/**
 * Prop Type Change Service Interface
 *
 * Watches for prop type changes from settings and triggers texture reloading.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";

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
  checkForChanges(settingsService: ISettingsState | null): void;

  /**
   * Clean up resources
   */
  dispose(): void;
}
