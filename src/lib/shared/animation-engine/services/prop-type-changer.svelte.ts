/**
 * Prop Type Change Service Implementation
 *
 * Watches for prop type changes from settings and triggers texture reloading.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { SettingsState } from "$lib/shared/settings/state/settings-state.svelte";
export interface PropTypeChangerState {
  bluePropType: string;
  redPropType: string;
  legacyPropType: string;
  textureReloadSignal: number;
}

export class PropTypeChanger {
  // Reactive state - owned by service
  state = $state<PropTypeChangerState>({
    bluePropType: "staff",
    redPropType: "staff",
    legacyPropType: "staff",
    textureReloadSignal: 0,
  });

  checkForChanges(settingsService: SettingsState | null): void {
    if (!settingsService) return;

    const settings = settingsService.currentSettings;
    const newBluePropType =
      settings.bluePropType || settings.propType || "staff";
    const newRedPropType = settings.redPropType || settings.propType || "staff";

    if (
      newBluePropType !== this.state.bluePropType ||
      newRedPropType !== this.state.redPropType
    ) {
      // Update reactive state - component will react via $derived/$effect
      this.state.bluePropType = newBluePropType;
      this.state.redPropType = newRedPropType;
      this.state.legacyPropType = newBluePropType; // Legacy compatibility

      // Signal texture reload needed
      this.state.textureReloadSignal++;
    }
  }

  overridePropTypes(bluePropType: string, redPropType: string): void {
    if (
      bluePropType !== this.state.bluePropType ||
      redPropType !== this.state.redPropType
    ) {
      this.state.bluePropType = bluePropType;
      this.state.redPropType = redPropType;
      this.state.legacyPropType = bluePropType;
      this.state.textureReloadSignal++;
    }
  }

  dispose(): void {
    this.state.bluePropType = "staff";
    this.state.redPropType = "staff";
    this.state.legacyPropType = "staff";
    this.state.textureReloadSignal = 0;
  }
}
