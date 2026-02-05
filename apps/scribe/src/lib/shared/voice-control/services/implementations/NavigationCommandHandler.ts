/**
 * NavigationCommandHandler
 *
 * Executes module navigation and tab switching voice commands by
 * delegating to the app's navigation coordinator.
 */

import type { IVoiceCommandHandler } from "../contracts/ICommandDispatcher";
import type {
  VoiceCommand,
  VoiceCommandType,
  CommandResult,
} from "../../domain/voice-command-types";
import { handleModuleChange, handleSectionChange } from "../../../navigation-coordinator/navigation-coordinator.svelte";
import { MODULE_DEFINITIONS } from "../../../navigation/config/module-definitions";
import type { ModuleId } from "../../../navigation/domain/types";

export class NavigationCommandHandler implements IVoiceCommandHandler {
  readonly supportedTypes: VoiceCommandType[] = ["navigate_module", "switch_tab"];

  async execute(command: VoiceCommand): Promise<CommandResult> {
    switch (command.type) {
      case "navigate_module":
        return this.navigateToModule(command.target);
      case "switch_tab":
        return this.switchTab(command.target);
      default:
        return { success: false, message: `Unsupported type: ${command.type}` };
    }
  }

  private async navigateToModule(moduleId: string): Promise<CommandResult> {
    // Validate the module exists
    const moduleDef = MODULE_DEFINITIONS.find((m) => m.id === moduleId);
    if (!moduleDef) {
      return {
        success: false,
        message: `Unknown module: "${moduleId}"`,
      };
    }

    try {
      await handleModuleChange(moduleId as ModuleId);
      console.log(`[HeyTika] Navigated to ${moduleDef.label}`);
      return {
        success: true,
        message: `Navigated to ${moduleDef.label}`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Navigation failed";
      return { success: false, message: msg };
    }
  }

  private switchTab(tabId: string): CommandResult {
    try {
      handleSectionChange(tabId);
      console.log(`[HeyTika] Switched to tab: ${tabId}`);
      return {
        success: true,
        message: `Switched to ${tabId} tab`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Tab switch failed";
      return { success: false, message: msg };
    }
  }
}
