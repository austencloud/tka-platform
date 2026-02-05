/**
 * CommandDispatcher
 *
 * Routes VoiceCommand objects to registered handlers based on command type.
 * Handlers self-register by declaring which types they support.
 */

import type {
  ICommandDispatcher,
  IVoiceCommandHandler,
} from "../contracts/ICommandDispatcher";
import type { VoiceCommand, CommandResult } from "../../domain/voice-command-types";

export class CommandDispatcher implements ICommandDispatcher {
  private handlers = new Map<string, IVoiceCommandHandler>();

  register(handler: IVoiceCommandHandler): void {
    for (const type of handler.supportedTypes) {
      if (this.handlers.has(type)) {
        console.warn(
          `[HeyTika] Overwriting handler for command type "${type}"`
        );
      }
      this.handlers.set(type, handler);
    }
  }

  async dispatch(command: VoiceCommand): Promise<CommandResult> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      console.warn(
        `[HeyTika] No handler registered for command type "${command.type}"`
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
