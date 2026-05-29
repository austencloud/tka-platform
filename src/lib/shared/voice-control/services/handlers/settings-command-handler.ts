import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandResult,
} from "../../domain/voice-command-types";
import { getAnimationVisibilityManager } from "../../../animation-engine/state/animation-visibility-state.svelte";
import { getVisibilityStateManager } from "../../../pictograph/shared/state/visibility-state.svelte";
import { settingsService } from "../../../settings/state/SettingsState.svelte";
import type { IVoiceCommandHandler } from "../contracts/types";
import type { EffectType } from '../../../animation-engine/domain/types/TipEffectTypes';

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
  tndGlyph: { owner: "pictVis", property: "tndGlyph", displayName: "TnD glyph" },
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
    const effectName = command.target.slice("effect:".length) as EffectType;
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
      default:
        return { success: false, message: `Action "${command.action}" not supported for effects` };
    }
  }

  private toggle(route: SettingRoute): CommandResult {
    const newVal = !this.getValue(route);
    return this.set(route, newVal);
  }

  private set(route: SettingRoute, value: boolean): CommandResult {
    const { owner, property, displayName } = route;

    if (owner === "animVis") {
      const mgr = getAnimationVisibilityManager();
      (mgr as unknown as Record<string, unknown>)[property] = value;
    } else if (owner === "pictVis") {
      const mgr = getVisibilityStateManager();
      (mgr as unknown as Record<string, unknown>)[property] = value;
    } else if (owner === "appSettings") {
      settingsService.updateSettings({ [property]: value });
    }

    const status = value ? "ON" : "OFF";
    return { success: true, message: `${displayName}: ${status}` };
  }

  private getValue(route: SettingRoute): boolean {
    const { owner, property } = route;

    if (owner === "animVis") {
      const mgr = getAnimationVisibilityManager();
      return (mgr as unknown as Record<string, unknown>)[property] as boolean;
    } else if (owner === "pictVis") {
      const mgr = getVisibilityStateManager();
      return (mgr as unknown as Record<string, unknown>)[property] as boolean;
    } else if (owner === "appSettings") {
      return (settingsService.settings as unknown as Record<string, unknown>)[property] as boolean;
    }

    return false;
  }
}
