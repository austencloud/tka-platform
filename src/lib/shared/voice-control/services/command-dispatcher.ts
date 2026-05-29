/**
 * CommandDispatcher
 *
 * Routes VoiceCommand objects to registered handlers based on command category.
 * Handlers self-register by declaring which categories they support.
 */

import type { VoiceCommand, CommandResult } from "../domain/voice-command-types";
import type { IVoiceCommandHandler } from "./contracts/types";

export class CommandDispatcher {
  private handlers = new Map<string, IVoiceCommandHandler>();

  register(handler: IVoiceCommandHandler): void {
    for (const category of handler.supportedCategories) {
      if (this.handlers.has(category)) {
        console.warn(
          `[HeyTika] Overwriting handler for category "${category}"`
        );
      }
      this.handlers.set(category, handler);
    }
  }

  async dispatch(command: VoiceCommand): Promise<CommandResult> {
    const handler = this.handlers.get(command.category);
    if (!handler) {
      console.warn(
        `[HeyTika] No handler registered for category "${command.category}"`
      );
      return {
        success: false,
        message: `Unknown command: "${command.rawText}"`,
      };
    }

    try {
      return await handler.execute(command);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Command execution failed";
      console.error(`[HeyTika] Handler error for "${command.rawText}":`, error);
      return { success: false, message };
    }
  }
}
