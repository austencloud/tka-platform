import type { ISVGGenerator } from './services/contracts/ISVGGenerator';
import { SVGGenerator } from './services/implementations/SVGGenerator';

let instance: ISVGGenerator | null = null;
export function getSVGGenerator(): ISVGGenerator {
  return instance ??= new SVGGenerator();
}
