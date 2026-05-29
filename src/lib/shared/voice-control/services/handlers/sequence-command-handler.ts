/**
 * SequenceCommandHandler
 *
 * Executes sequence operation commands (export, save, share, compose).
 * Uses the global sequence viewer ref to trigger actions on the open viewer.
 * Returns helpful messages when no viewer is open.
 */

import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandResult,
} from "../../domain/voice-command-types";
import { getSequenceViewerRef } from "../../../coordinators/sequence-viewer-ref.svelte";
import type { IVoiceCommandHandler } from "../contracts/types";

export class SequenceCommandHandler implements IVoiceCommandHandler {
  readonly supportedCategories: VoiceCommandCategory[] = ["sequence"];

  async execute(command: VoiceCommand): Promise<CommandResult> {
    const viewer = getSequenceViewerRef();

    if (!viewer) {
      return { success: false, message: "Open a sequence first" };
    }

    switch (command.action) {
      case "export": {
        if (viewer.isInExportMode()) {
          return { success: true, message: "Already in export mode" };
        }
        viewer.enterExportMode();
        return { success: true, message: "Export mode" };
      }

      case "save_to_library": {
        viewer.save();
        return { success: true, message: "Saving sequence" };
      }

      case "share": {
        viewer.share();
        return { success: true, message: "Sharing sequence" };
      }

      case "open_in_create": {
        viewer.openInCompose();
        return { success: true, message: "Opening in compose" };
      }

      case "favorite":
        return { success: false, message: "Favorite not yet available" };

      case "unfavorite":
        return { success: false, message: "Unfavorite not yet available" };

      default:
        return { success: false, message: `Unknown sequence action: ${command.action}` };
    }
  }
}
