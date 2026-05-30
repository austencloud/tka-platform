/**
 * CommandInterpreter
 *
 * Orchestrates a chain of sub-interpreters to parse raw voice transcript text
 * into structured VoiceCommand objects. Each sub-interpreter handles one command
 * category and is tried in priority order.
 *
 * Chain order (highest to lowest priority):
 * 1. SystemSubInterpreter - exit, help (always wins)
 * 2. GeneratorSubInterpreter - set/toggle/generate params (create module, generate tab)
 * 3. CreateSubInterpreter - undo/redo/save (module-scoped to "create")
 * 4. PlaybackSubInterpreter - play/pause/next (context: sequence loaded)
 * 5. SettingsSubInterpreter - toggle/show/hide settings
 * 6. SequenceSubInterpreter - save-to-library/favorite/share
 * 7. PropSubInterpreter - change prop type
 * 8. SearchSubInterpreter - search/filter/sort (module-scoped to "browse")
 * 9. UISubInterpreter - scroll/back/close/fullscreen
 * 10. NavigationSubInterpreter - go to module/tab (catch-all)
 */

import type { ISubInterpreter } from "./ISubInterpreter";
import type { VoiceCommand, CommandContext } from "../domain/voice-command-types";

export class CommandInterpreter {
  private chain: ISubInterpreter[] = [];

  /**
   * Add sub-interpreters in priority order. The first match wins.
   * Call this during container setup, adding interpreters from highest
   * to lowest priority.
   */
  addInterpreter(interpreter: ISubInterpreter): void {
    this.chain.push(interpreter);
  }

  interpret(rawText: string, context: CommandContext): VoiceCommand {
    const text = rawText.trim().toLowerCase();

    for (const interpreter of this.chain) {
      // Skip module-scoped interpreters when not in their module
      if (interpreter.activeInModules && !interpreter.activeInModules.includes(context.currentModule)) {
        continue;
      }

      const command = interpreter.tryInterpret(text, context);
      if (command) return command;
    }

    // No interpreter matched
    return {
      category: "system",
      action: "unknown",
      target: "",
      rawText,
      confidence: 0,
    };
  }
}
