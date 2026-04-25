import type { IStripPatternEngine } from './services/contracts/IStripPatternEngine';
import { StripPatternEngine } from './services/implementations/StripPatternEngine';
import { getImagePatternLoader } from './getImagePatternLoader';

let instance: IStripPatternEngine | null = null;
export function getStripPatternEngine(): IStripPatternEngine {
  return instance ??= new StripPatternEngine(getImagePatternLoader());
}
