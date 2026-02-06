/**
 * Prop Type Change Service Implementation
 *
 * Watches for prop type changes from settings and triggers texture reloading.
 *
 * Uses reactive state ownership - service owns $state, component derives from it.
 */

import type { ISettingsState } from "$lib/shared/settings/services/contracts/ISettingsState";
import type {
  IPropTypeChanger,
  PropTypeChangerState,
} from "../contracts/IPropTypeChanger";

export class PropTypeChanger implements IPropTypeChanger {
  // Reactive state - owned by service
  state = $state<PropTypeChangerState>({
    bluePropType: "staff",
    redPropType: "staff",
    legacyPropType: "staff",
    textureReloadSignal: 0,
  });

  checkForChanges(settingsService: ISettingsState | null): void {
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

  dispose(): void {
    this.state.bluePropType = "staff";
    this.state.redPropType = "staff";
    this.state.legacyPropType = "staff";
    this.state.textureReloadSignal = 0;
  }
}
