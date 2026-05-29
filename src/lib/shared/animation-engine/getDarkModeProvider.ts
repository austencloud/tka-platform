import { DarkModeProvider } from './services/dark-mode-provider';

let instance: DarkModeProvider | null = null;
export function getDarkModeProvider(): DarkModeProvider {
  return instance ??= new DarkModeProvider();
}
