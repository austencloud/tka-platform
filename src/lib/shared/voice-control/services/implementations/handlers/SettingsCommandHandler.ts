/**
 * SettingsCommandHandler
 *
 * Executes settings toggle/show/hide voice commands by delegating
 * to the appropriate state manager (animation visibility, pictograph
 * visibility, or app settings).
 */

import type { IVoiceCommandHandler } from "../../contracts/ICommandDispatcher";
import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandResult,
} from "../../../domain/voice-command-types";
import { getAnimationVisibilityManager } from "../../../../animation-engine/state/animation-visibility-state.svelte";
import { getVisibilityStateManager } from "../../../../pictograph/shared/state/visibility-state.svelte";
import { settingsService } from "../../../../settings/state/SettingsState.svelte";

// ============================================================================
// Setting routing: which state manager owns each setting key
// ============================================================================

type SettingOwner = "animVis" | "pictVis" | "appSettings";

interface SettingRoute {
  owner: SettingOwner;
  /** Property name on the state manager */
  property: string;
  /** Human-readable name for feedback messages */
  displayName: string;
}

const SETTING_ROUTES: Record<string, SettingRoute> = {
  // Animation visibility settings
  stepNumbers: { owner: "animVis", property: "stepNumbers", displayName: "step numbers" },
  beatPosition: { owner: "animVis", property: "beatPosition", displayName: "beat position" },
  props: { owner: "animVis", property: "props", displayName: "props" },
  wordHeader: { owner: "animVis", property: "wordHeader", displayName: "word header" },
  progressBar: { owner: "animVis", property: "progressBar", displayName: "progress bar" },
  darkMode: { owner: "animVis", property: "darkMode", displayName: "dark mode" },
  tkaGlyph: { owner: "animVis", property: "tkaGlyph", displayName: "TKA glyph" },
  reversalIndicators: { owner: "animVis", property: "reversalIndicators", displayName: "reversal indicators" },
  blueMotion: { owner: "animVis", property: "blueMotion", displayName: "blue motion" },
  redMotion: { owner: "animVis", property: "redMotion", displayName: "red motion" },

  // Pictograph visibility settings
  showGrid: { owner: "pictVis", property: "showGrid", displayName: "grid" },
  nonRadialPoints: { owner: "pictVis", property: "nonRadialPoints", displayName: "non-radial points" },
  vtgGlyph: { owner: "pictVis", property: "vtgGlyph", displayName: "VTG glyph" },
  elementalGlyph: { owner: "pictVis", property: "elementalGlyph", displayName: "elemental glyph" },
  positionsGlyph: { owner: "pictVis", property: "positionsGlyph", displayName: "positions glyph" },

  // App settings
  musicianMode: { owner: "appSettings", property: "musicianMode", displayName: "musician mode" },
  hapticFeedback: { owner: "appSettings", property: "hapticFeedback", displayName: "haptic feedback" },
  reducedMotion: { owner: "appSettings", property: "reducedMotion", displayName: "reduced motion" },
};

export class SettingsCommandHandler implements IVoiceCommandHandler {
  readonly supportedCategories: VoiceCommandCategory[] = ["settings"];

  async execute(command: VoiceCommand): Promise<CommandResult> {
    // Handle effect:* targets routed through tipEffectMap API
    if (command.target.startsWith("effect:")) {
      return this.handleEffectCommand(command);
    }

    const route = SETTING_ROUTES[command.target];
    if (!route) {
      return { success: false, message: `Unknown setting: "${command.target}"` };
    }

    switch (command.action) {
      case "toggle":
        return this.toggle(route);
      case "show":
        return this.set(route, true);
      case "hide":
        return this.set(route, false);
      default:
        return { success: false, message: `Unknown action: "${command.action}"` };
    }
  }

  private handleEffectCommand(command: VoiceCommand): CommandResult {
    // Target format: "effect:fire" | "effect:charcoal" | "effect:led" | "effect:trails"
    const effectName = command.target.slice("effect:".length) as import("../../../../animation-engine/domain/types/TipEffectTypes").EffectType;
    const mgr = getAnimationVisibilityManager();
    const displayName = effectName.charAt(0).toUpperCase() + effectName.slice(1);

    switch (command.action) {
      case "show":
      case "enable": {
        mgr.setActiveEffect(effectName);
        return { success: true, message: `${displayName}: ON` };
      }
      case "hide":
      case "disable": {
        mgr.setActiveEffect("none");
        return { success: true, message: `${displayName}: OFF` };
      }
      case "toggle": {
        const isActive = mgr.getActiveEffect() === effectName;
        mgr.setActiveEffect(isActive ? "none" : effectName);
        return { success: true, message: `${displayName}: ${isActive ? "OFF" : "ON"}` };
      }
      default:
        return { success: false, message: `Unknown action for effect: "${command.action}"` };
    }
  }

  private toggle(route: SettingRoute): CommandResult {
    const current = this.getValue(route);
    const newValue = !current;
    this.setValue(route, newValue);
    const label = newValue ? "ON" : "OFF";
    return { success: true, message: `${route.displayName}: ${label}` };
  }

  private set(route: SettingRoute, value: boolean): CommandResult {
    this.setValue(route, value);
    const label = value ? "ON" : "OFF";
    return { success: true, message: `${route.displayName}: ${label}` };
  }

  private getValue(route: SettingRoute): boolean {
    switch (route.owner) {
      case "animVis": {
        const mgr = getAnimationVisibilityManager();
        if (route.property === "darkMode") return mgr.isDarkMode();
        return mgr.getVisibility(route.property as any);
      }
      case "pictVis": {
        const mgr = getVisibilityStateManager();
        if (route.property === "showGrid") return mgr.getGridVisibility();
        return mgr.getGlyphVisibility(route.property);
      }
      case "appSettings": {
        const settings = settingsService.settings;
        return !!(settings as unknown as Record<string, unknown>)[route.property];
      }
    }
  }

  private setValue(route: SettingRoute, value: boolean): void {
    switch (route.owner) {
      case "animVis": {
        const mgr = getAnimationVisibilityManager();
        if (route.property === "darkMode") {
          mgr.setDarkMode(value);
        } else {
          mgr.setVisibility(route.property as any, value);
        }
        break;
      }
      case "pictVis": {
        const mgr = getVisibilityStateManager();
        if (route.property === "showGrid") {
          mgr.setGridVisibility(value);
        } else {
          mgr.setGlyphVisibility(route.property, value);
        }
        break;
      }
      case "appSettings": {
        void settingsService.updateSetting(route.property as any, value);
        break;
      }
    }
  }
}
