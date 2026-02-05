/**
 * Voice Control Module ITI Container
 *
 * Provides all services for the "Hey Tika" voice control system:
 * - Wake word detection (Web Speech API)
 * - Command interpretation (regex pattern matching)
 * - Command dispatch (handler routing)
 * - Navigation command handler (module/tab switching)
 */

import { createContainer } from "iti";

import { WakeWordDetector } from "../../voice-control/services/implementations/WakeWordDetector";
import { CommandInterpreter } from "../../voice-control/services/implementations/CommandInterpreter";
import { CommandDispatcher } from "../../voice-control/services/implementations/CommandDispatcher";
import { NavigationCommandHandler } from "../../voice-control/services/implementations/NavigationCommandHandler";

/**
 * Creates the voice control container with all required services.
 * Self-contained - no external dependencies needed.
 *
 * The dispatcher is pre-wired: NavigationCommandHandler is registered
 * at container creation time so it's ready for use immediately.
 */
export function createVoiceControlContainer() {
  const container = createContainer()
    .add({
      wakeWordDetector: () => new WakeWordDetector(),
      commandInterpreter: () => new CommandInterpreter(),
    })
    .add(() => {
      // Create dispatcher and register the navigation handler
      const dispatcher = new CommandDispatcher();
      const navHandler = new NavigationCommandHandler();
      dispatcher.register(navHandler);
      return { commandDispatcher: () => dispatcher };
    });

  return container;
}

export type VoiceControlContainer = ReturnType<typeof createVoiceControlContainer>;
