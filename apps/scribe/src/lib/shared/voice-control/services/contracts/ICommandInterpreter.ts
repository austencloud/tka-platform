/**
 * ICommandInterpreter
 *
 * Parses raw voice transcript text into structured VoiceCommand objects.
 * Uses local regex/pattern matching against the known command vocabulary.
 */

import type { VoiceCommand, CommandContext } from "../../domain/voice-command-types";

export interface ICommandInterpreter {
  /** Parse raw transcript text into a structured command */
  interpret(rawText: string, context: CommandContext): VoiceCommand;
}
