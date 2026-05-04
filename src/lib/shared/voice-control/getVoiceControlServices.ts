import { WakeWordDetector } from './services/implementations/WakeWordDetector';
import { CommandInterpreter } from './services/implementations/CommandInterpreter';
import { CommandDispatcher } from './services/implementations/CommandDispatcher';
import { WebSpeechTTSProvider } from './services/implementations/WebSpeechTTSProvider';
import { NavigationCommandHandler } from './services/implementations/NavigationCommandHandler';
import { SettingsCommandHandler } from './services/implementations/handlers/SettingsCommandHandler';
import { PlaybackCommandHandler } from './services/implementations/handlers/PlaybackCommandHandler';
import { CreateCommandHandler } from './services/implementations/handlers/CreateCommandHandler';
import { SequenceCommandHandler } from './services/implementations/handlers/SequenceCommandHandler';
import { UICommandHandler } from './services/implementations/handlers/UICommandHandler';
import { SearchCommandHandler } from './services/implementations/handlers/SearchCommandHandler';
import { PropCommandHandler } from './services/implementations/handlers/PropCommandHandler';
import { GeneratorCommandHandler } from './services/implementations/handlers/GeneratorCommandHandler';
import { SystemSubInterpreter } from './services/implementations/interpreters/SystemSubInterpreter';
import { GeneratorSubInterpreter } from './services/implementations/interpreters/GeneratorSubInterpreter';
import { CreateSubInterpreter } from './services/implementations/interpreters/CreateSubInterpreter';
import { PlaybackSubInterpreter } from './services/implementations/interpreters/PlaybackSubInterpreter';
import { SettingsSubInterpreter } from './services/implementations/interpreters/SettingsSubInterpreter';
import { SequenceSubInterpreter } from './services/implementations/interpreters/SequenceSubInterpreter';
import { PropSubInterpreter } from './services/implementations/interpreters/PropSubInterpreter';
import { SearchSubInterpreter } from './services/implementations/interpreters/SearchSubInterpreter';
import { UISubInterpreter } from './services/implementations/interpreters/UISubInterpreter';
import { NavigationSubInterpreter } from './services/implementations/interpreters/NavigationSubInterpreter';

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
