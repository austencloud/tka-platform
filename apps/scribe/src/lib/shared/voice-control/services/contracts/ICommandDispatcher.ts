/**
 * ICommandDispatcher
 *
 * Routes structured VoiceCommand objects to the appropriate handler.
 * Handlers self-register by declaring which command types they support.
 */

import type {
  VoiceCommand,
  VoiceCommandType,
  CommandResult,
} from "../../domain/voice-command-types";

export interface IVoiceCommandHandler {
  /** Which command types this handler can execute */
  readonly supportedTypes: VoiceCommandType[];

  /** Execute a voice command */
  execute(command: VoiceCommand): Promise<CommandResult>;
}

export interface ICommandDispatcher {
  /** Register a handler for its declared command types */
  register(handler: IVoiceCommandHandler): void;

  /** Route a command to the appropriate handler and return the result */
  dispatch(command: VoiceCommand): Promise<CommandResult>;
}
