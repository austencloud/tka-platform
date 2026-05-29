import { TempoPracticeOrchestrator } from './services/tempo-practice-orchestrator';

let instance: TempoPracticeOrchestrator | null = null;
export function getTempoPracticeOrchestrator(): TempoPracticeOrchestrator {
  return instance ??= new TempoPracticeOrchestrator();
}
