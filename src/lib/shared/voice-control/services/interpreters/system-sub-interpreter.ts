/**
 * SystemSubInterpreter
 *
 * Highest priority interpreter. Handles exit/stop commands and help.
 * Runs first in the chain so "stop" always exits command mode regardless of context.
 */

import type { ISubInterpreter } from "../contracts/ISubInterpreter";
import type { VoiceCommand, VoiceCommandCategory, CommandContext } from "../../domain/voice-command-types";

const EXIT_PHRASES = new Set([
  "stop",
  "stop listening",
  "exit",
  "done",
  "bye",
  "bye tika",
  "goodbye",
  "that's all",
  "thats all",
  "never mind",
  "nevermind",
  "cancel",
  "close",
  "dismiss",
]);

const HELP_PHRASES = new Set([
  "what can i say",
  "what can i say?",
  "help",
  "commands",
  "show commands",
  "show help",
  "voice commands",
  "list commands",
]);

export class SystemSubInterpreter implements ISubInterpreter {
  readonly category: VoiceCommandCategory = "system";

  tryInterpret(text: string, _context: CommandContext): VoiceCommand | null {
    if (EXIT_PHRASES.has(text)) {
      return {
        category: "system",
        action: "exit",
        target: "",
        rawText: text,
        confidence: 1.0,
      };
    }

    if (HELP_PHRASES.has(text)) {
      return {
        category: "system",
        action: "help",
        target: "",
        rawText: text,
        confidence: 1.0,
      };
    }

    return null;
  }
}
