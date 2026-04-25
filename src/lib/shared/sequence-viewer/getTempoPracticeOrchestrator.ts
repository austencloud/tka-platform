import { TempoPracticeOrchestrator } from './services/implementations/TempoPracticeOrchestrator';

let instance: TempoPracticeOrchestrator | null = null;
export function getTempoPracticeOrchestrator(): TempoPracticeOrchestrator {
  return instance ??= new TempoPracticeOrchestrator();
}
