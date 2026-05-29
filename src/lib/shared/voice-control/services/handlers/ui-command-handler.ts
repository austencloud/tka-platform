/**
 * UICommandHandler
 *
 * Executes UI navigation voice commands: scroll, go back, fullscreen.
 * Uses browser APIs directly for scroll and fullscreen.
 */

import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandResult,
} from "../../domain/voice-command-types";
import type { IVoiceCommandHandler } from "../types";

export class UICommandHandler implements IVoiceCommandHandler {
  readonly supportedCategories: VoiceCommandCategory[] = ["ui"];

  async execute(command: VoiceCommand): Promise<CommandResult> {
    switch (command.action) {
      case "scroll_up":
        window.scrollBy({ top: -400, behavior: "smooth" });
        return { success: true, message: "Scrolled up" };

      case "scroll_down":
        window.scrollBy({ top: 400, behavior: "smooth" });
        return { success: true, message: "Scrolled down" };

      case "go_back":
        history.back();
        return { success: true, message: "Going back" };

      case "confirm":
        return { success: false, message: "No dialog to confirm" };

      case "cancel":
        return { success: false, message: "No dialog to cancel" };

      case "fullscreen":
        return this.toggleFullscreen();

      default:
        return { success: false, message: `Unknown UI action: ${command.action}` };
    }
  }

  private toggleFullscreen(): CommandResult {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      return { success: true, message: "Fullscreen" };
    } else {
      document.exitFullscreen().catch(() => {});
      return { success: true, message: "Exited fullscreen" };
    }
  }
}
