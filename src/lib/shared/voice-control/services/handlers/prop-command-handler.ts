/**
 * PropCommandHandler
 *
 * Executes prop type change voice commands.
 * Delegates to the settings service to update prop types.
 */

import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandResult,
} from "../../domain/voice-command-types";
import { settingsService } from "../../../settings/state/SettingsState.svelte";
import type { PropType } from "../../../pictograph/prop/domain/enums/PropType";
import type { IVoiceCommandHandler } from "../types";

export class PropCommandHandler implements IVoiceCommandHandler {
  readonly supportedCategories: VoiceCommandCategory[] = ["prop"];

  async execute(command: VoiceCommand): Promise<CommandResult> {
    if (command.action !== "change_prop") {
      return { success: false, message: `Unknown prop action: ${command.action}` };
    }

    const propType = command.target as PropType;
    const hand = command.args?.hand as string | undefined;

    if (!propType) {
      return { success: false, message: "No prop type specified" };
    }

    if (hand === "blue") {
      await settingsService.updateSetting("bluePropType", propType);
      return { success: true, message: `Blue prop: ${propType}` };
    }

    if (hand === "red") {
      await settingsService.updateSetting("redPropType", propType);
      return { success: true, message: `Red prop: ${propType}` };
    }

    // Both hands
    await settingsService.updateSetting("bluePropType", propType);
    await settingsService.updateSetting("redPropType", propType);
    return { success: true, message: `Props: ${propType}` };
  }
}
