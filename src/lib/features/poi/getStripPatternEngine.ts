import { StripPatternEngine } from './services/implementations/StripPatternEngine';
import { getImagePatternLoader } from './getImagePatternLoader';

let instance: StripPatternEngine | null = null;
export function getStripPatternEngine(): StripPatternEngine {
  return instance ??= new StripPatternEngine(getImagePatternLoader());
}
