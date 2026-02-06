/**
 * ISubInterpreter
 *
 * Contract for category-specific voice command interpreters.
 * Each sub-interpreter handles one command category (navigation, settings, playback, etc.)
 * and is tried in priority order by the orchestrating CommandInterpreter.
 */

import type { VoiceCommand, VoiceCommandCategory, CommandContext } from "../../domain/voice-command-types";

export interface ISubInterpreter {
  /** Which command category this interpreter handles */
  readonly category: VoiceCommandCategory;

  /**
   * Module IDs where this interpreter is active.
   * undefined = always active (global commands).
   */
  readonly activeInModules?: string[];

  /**
   * Attempt to interpret the given text as a command in this category.
   * Returns null if the text doesn't match any pattern this interpreter knows.
   */
  tryInterpret(text: string, context: CommandContext): VoiceCommand | null;
}
