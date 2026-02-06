/**
 * ICommandDispatcher
 *
 * Routes structured VoiceCommand objects to the appropriate handler.
 * Handlers self-register by declaring which command categories they support.
 */

import type {
  VoiceCommand,
  VoiceCommandCategory,
  CommandResult,
} from "../../domain/voice-command-types";

export interface IVoiceCommandHandler {
  /** Which command categories this handler can execute */
  readonly supportedCategories: VoiceCommandCategory[];

  /** Execute a voice command */
  execute(command: VoiceCommand): Promise<CommandResult>;
}

export interface ICommandDispatcher {
  /** Register a handler for its declared command categories */
  register(handler: IVoiceCommandHandler): void;

  /** Route a command to the appropriate handler and return the result */
  dispatch(command: VoiceCommand): Promise<CommandResult>;
}
