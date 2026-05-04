import { StripPatternEngine } from './services/implementations/StripPatternEngine';

let instance: StripPatternEngine | null = null;
export function getStripPatternEngine(): StripPatternEngine {
  return instance ??= new StripPatternEngine();
}
