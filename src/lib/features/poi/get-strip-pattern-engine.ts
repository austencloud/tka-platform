import { StripPatternEngine } from './services/strip-pattern-engine';

let instance: StripPatternEngine | null = null;
export function getStripPatternEngine(): StripPatternEngine {
  return instance ??= new StripPatternEngine();
}
