import { CommandDispatcher } from './services/implementations/CommandDispatcher';
import { NavigationCommandHandler } from './services/implementations/NavigationCommandHandler';
import { SettingsCommandHandler } from './services/implementations/handlers/SettingsCommandHandler';
import { PlaybackCommandHandler } from './services/implementations/handlers/PlaybackCommandHandler';
import { CreateCommandHandler } from './services/implementations/handlers/CreateCommandHandler';
import { SequenceCommandHandler } from './services/implementations/handlers/SequenceCommandHandler';
import { UICommandHandler } from './services/implementations/handlers/UICommandHandler';
import { SearchCommandHandler } from './services/implementations/handlers/SearchCommandHandler';
import { PropCommandHandler } from './services/implementations/handlers/PropCommandHandler';
import { GeneratorCommandHandler } from './services/implementations/handlers/GeneratorCommandHandler';

let instance: CommandDispatcher | null = null;
export function getCommandDispatcher(): CommandDispatcher {
  if (!instance) {
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
    instance = dispatcher;
  }
  return instance;
}
