import { CommandInterpreter } from './services/command-interpreter';
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

let instance: CommandInterpreter | null = null;
export function getCommandInterpreter(): CommandInterpreter {
  if (!instance) {
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
    instance = interpreter;
  }
  return instance;
}
