import { WakeWordDetector } from './services/wake-word-detector';
import { CommandInterpreter } from './services/command-interpreter';
import { CommandDispatcher } from './services/command-dispatcher';
import { WebSpeechTTSProvider } from './services/web-speech-tts-provider';
import { NavigationCommandHandler } from './services/navigation-command-handler';
import { SettingsCommandHandler } from './services/handlers/settings-command-handler';
import { PlaybackCommandHandler } from './services/handlers/playback-command-handler';
import { CreateCommandHandler } from './services/handlers/create-command-handler';
import { SequenceCommandHandler } from './services/handlers/sequence-command-handler';
import { UICommandHandler } from './services/handlers/ui-command-handler';
import { SearchCommandHandler } from './services/handlers/search-command-handler';
import { PropCommandHandler } from './services/handlers/prop-command-handler';
import { GeneratorCommandHandler } from './services/handlers/generator-command-handler';
import { SystemSubInterpreter } from './services/interpreters/system-sub-interpreter';
import { GeneratorSubInterpreter } from './services/interpreters/generator-sub-interpreter';
import { CreateSubInterpreter } from './services/interpreters/create-sub-interpreter';
import { PlaybackSubInterpreter } from './services/interpreters/playback-sub-interpreter';
import { SettingsSubInterpreter } from './services/interpreters/settings-sub-interpreter';
import { SequenceSubInterpreter } from './services/interpreters/sequence-sub-interpreter';
import { PropSubInterpreter } from './services/interpreters/prop-sub-interpreter';
import { SearchSubInterpreter } from './services/interpreters/search-sub-interpreter';
import { UISubInterpreter } from './services/interpreters/ui-sub-interpreter';
import { NavigationSubInterpreter } from './services/interpreters/navigation-sub-interpreter';

let wakeWordDetector: WakeWordDetector | null = null;
let commandInterpreter: CommandInterpreter | null = null;
let commandDispatcher: CommandDispatcher | null = null;
let ttsProvider: WebSpeechTTSProvider | null = null;

export function getWakeWordDetector(): WakeWordDetector {
  return wakeWordDetector ??= new WakeWordDetector();
}

export function getTTSProvider(): WebSpeechTTSProvider {
  return ttsProvider ??= new WebSpeechTTSProvider();
}

export function getCommandInterpreter(): CommandInterpreter {
  if (!commandInterpreter) {
    commandInterpreter = new CommandInterpreter();
    commandInterpreter.addInterpreter(new SystemSubInterpreter());
    commandInterpreter.addInterpreter(new GeneratorSubInterpreter());
    commandInterpreter.addInterpreter(new CreateSubInterpreter());
    commandInterpreter.addInterpreter(new PlaybackSubInterpreter());
    commandInterpreter.addInterpreter(new SettingsSubInterpreter());
    commandInterpreter.addInterpreter(new SequenceSubInterpreter());
    commandInterpreter.addInterpreter(new PropSubInterpreter());
    commandInterpreter.addInterpreter(new SearchSubInterpreter());
    commandInterpreter.addInterpreter(new UISubInterpreter());
    commandInterpreter.addInterpreter(new NavigationSubInterpreter());
  }
  return commandInterpreter;
}

export function getCommandDispatcher(): CommandDispatcher {
  if (!commandDispatcher) {
    commandDispatcher = new CommandDispatcher();
    commandDispatcher.register(new NavigationCommandHandler());
    commandDispatcher.register(new SettingsCommandHandler());
    commandDispatcher.register(new PlaybackCommandHandler());
    commandDispatcher.register(new CreateCommandHandler());
    commandDispatcher.register(new SequenceCommandHandler());
    commandDispatcher.register(new UICommandHandler());
    commandDispatcher.register(new SearchCommandHandler());
    commandDispatcher.register(new PropCommandHandler());
    commandDispatcher.register(new GeneratorCommandHandler());
  }
  return commandDispatcher;
}
