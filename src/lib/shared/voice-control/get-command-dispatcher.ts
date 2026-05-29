import { CommandDispatcher } from './services/command-dispatcher';
import { NavigationCommandHandler } from './services/navigation-command-handler';
import { SettingsCommandHandler } from './services/handlers/settings-command-handler';
import { PlaybackCommandHandler } from './services/handlers/playback-command-handler';
import { CreateCommandHandler } from './services/handlers/create-command-handler';
import { SequenceCommandHandler } from './services/handlers/sequence-command-handler';
import { UICommandHandler } from './services/handlers/ui-command-handler';
import { SearchCommandHandler } from './services/handlers/search-command-handler';
import { PropCommandHandler } from './services/handlers/prop-command-handler';
import { GeneratorCommandHandler } from './services/handlers/generator-command-handler';

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
