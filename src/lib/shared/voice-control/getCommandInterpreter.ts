import type { ICommandInterpreter } from './services/contracts/ICommandInterpreter';
import { CommandInterpreter } from './services/implementations/CommandInterpreter';
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

let instance: ICommandInterpreter | null = null;
export function getCommandInterpreter(): ICommandInterpreter {
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
