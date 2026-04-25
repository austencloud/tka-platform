import type { IDarkModeProvider } from './services/contracts/IDarkModeProvider';
import { DarkModeProvider } from './services/implementations/DarkModeProvider';

let instance: IDarkModeProvider | null = null;
export function getDarkModeProvider(): IDarkModeProvider {
  return instance ??= new DarkModeProvider();
}
