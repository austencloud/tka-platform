import { DarkModeProvider } from './services/implementations/DarkModeProvider';

let instance: DarkModeProvider | null = null;
export function getDarkModeProvider(): DarkModeProvider {
  return instance ??= new DarkModeProvider();
}
