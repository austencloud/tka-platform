/**
 * SearchCommandHandler
 *
 * Executes search/filter/sort voice commands for the browse module.
 *
 * NOTE: Phase 1 implementation. Deeper integration with browse module state
 * (BrowseFilter, BrowseSorter) can be added when those expose global refs.
 */

import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandResult,
} from "../../domain/voice-command-types";
import type { IVoiceCommandHandler } from "../contracts/types";

export class SearchCommandHandler implements IVoiceCommandHandler {
  readonly supportedCategories: VoiceCommandCategory[] = ["search"];

  async execute(command: VoiceCommand): Promise<CommandResult> {
    switch (command.action) {
      case "search":
        return { success: false, message: `Search not yet connected: "${command.target}"` };

      case "filter":
        return { success: false, message: `Filter not yet connected: "${command.target}"` };

      case "sort":
        return { success: false, message: `Sort not yet connected: "${command.target}"` };

      case "clear_filters":
        return { success: false, message: "Clear filters not yet connected" };

      default:
        return { success: false, message: `Unknown search action: ${command.action}` };
    }
  }
}
