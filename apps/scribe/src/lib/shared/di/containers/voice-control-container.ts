/**
 * Voice Control Module ITI Container
 *
 * Provides all services for the "Hey Tika" voice control system:
 * - Wake word detection (Web Speech API)
 * - Command interpretation (chain-of-responsibility sub-interpreters)
 * - Command dispatch (category-based handler routing)
 * - Command handlers (navigation, settings, playback, etc.)
 */

import { createContainer } from "iti";

import { WakeWordDetector } from "../../voice-control/services/implementations/WakeWordDetector";
import { CommandInterpreter } from "../../voice-control/services/implementations/CommandInterpreter";
import { CommandDispatcher } from "../../voice-control/services/implementations/CommandDispatcher";

// Handlers
import { NavigationCommandHandler } from "../../voice-control/services/implementations/NavigationCommandHandler";
import { SettingsCommandHandler } from "../../voice-control/services/implementations/handlers/SettingsCommandHandler";
import { PlaybackCommandHandler } from "../../voice-control/services/implementations/handlers/PlaybackCommandHandler";
import { CreateCommandHandler } from "../../voice-control/services/implementations/handlers/CreateCommandHandler";
import { SequenceCommandHandler } from "../../voice-control/services/implementations/handlers/SequenceCommandHandler";
import { UICommandHandler } from "../../voice-control/services/implementations/handlers/UICommandHandler";
import { SearchCommandHandler } from "../../voice-control/services/implementations/handlers/SearchCommandHandler";
import { PropCommandHandler } from "../../voice-control/services/implementations/handlers/PropCommandHandler";
import { GeneratorCommandHandler } from "../../voice-control/services/implementations/handlers/GeneratorCommandHandler";

// Sub-interpreters (chain order = priority order)
import { SystemSubInterpreter } from "../../voice-control/services/implementations/interpreters/SystemSubInterpreter";
import { GeneratorSubInterpreter } from "../../voice-control/services/implementations/interpreters/GeneratorSubInterpreter";
import { CreateSubInterpreter } from "../../voice-control/services/implementations/interpreters/CreateSubInterpreter";
import { PlaybackSubInterpreter } from "../../voice-control/services/implementations/interpreters/PlaybackSubInterpreter";
import { SettingsSubInterpreter } from "../../voice-control/services/implementations/interpreters/SettingsSubInterpreter";
import { SequenceSubInterpreter } from "../../voice-control/services/implementations/interpreters/SequenceSubInterpreter";
import { PropSubInterpreter } from "../../voice-control/services/implementations/interpreters/PropSubInterpreter";
import { SearchSubInterpreter } from "../../voice-control/services/implementations/interpreters/SearchSubInterpreter";
import { UISubInterpreter } from "../../voice-control/services/implementations/interpreters/UISubInterpreter";
import { NavigationSubInterpreter } from "../../voice-control/services/implementations/interpreters/NavigationSubInterpreter";

/**
 * Creates the voice control container with all required services.
 * Self-contained - no external dependencies needed.
 *
 * The interpreter chain is wired in priority order (first match wins):
 * 1. System - exit/help (highest priority)
 * 2. Generator - set/toggle/generate params (module-scoped to "create", tab-gated to "generate")
 * 3. Create - undo/redo/save (module-scoped to "create")
 * 4. Playback - play/pause/next (context: sequence loaded)
 * 5. Settings - toggle/show/hide settings
 * 6. Sequence - save-to-library/favorite/share
 * 7. Prop - change prop type
 * 8. Search - search/filter/sort (module-scoped to "browse")
 * 9. UI - scroll/back/close/fullscreen
 * 10. Navigation - go to module/tab (lowest priority, catch-all)
 */
export function createVoiceControlContainer() {
  const container = createContainer()
    .add({
      wakeWordDetector: () => new WakeWordDetector(),
    })
    .add(() => {
      // Build the interpreter chain in priority order
      const interpreter = new CommandInterpreter();
      interpreter.addInterpreter(new SystemSubInterpreter());
      interpreter.addInterpreter(new GeneratorSubInterpreter());
      interpreter.addInterpreter(new CreateSubInterpreter());
      interpreter.addInterpreter(new PlaybackSubInterpreter());
      interpreter.addInterpreter(new SettingsSubInterpreter());
      interpreter.addInterpreter(new SequenceSubInterpreter());
      interpreter.addInterpreter(new PropSubInterpreter());
      interpreter.addInterpreter(new SearchSubInterpreter());
      interpreter.addInterpreter(new UISubInterpreter());
      interpreter.addInterpreter(new NavigationSubInterpreter());
      return { commandInterpreter: () => interpreter };
    })
    .add(() => {
      // Create dispatcher and register all handlers
      const dispatcher = new CommandDispatcher();
      dispatcher.register(new NavigationCommandHandler());
      dispatcher.register(new SettingsCommandHandler());
      dispatcher.register(new PlaybackCommandHandler());
      dispatcher.register(new CreateCommandHandler());
      dispatcher.register(new SequenceCommandHandler());
      dispatcher.register(new UICommandHandler());
      dispatcher.register(new SearchCommandHandler());
      dispatcher.register(new PropCommandHandler());
      dispatcher.register(new GeneratorCommandHandler());
      return { commandDispatcher: () => dispatcher };
    });

  return container;
}

export type VoiceControlContainer = ReturnType<typeof createVoiceControlContainer>;
