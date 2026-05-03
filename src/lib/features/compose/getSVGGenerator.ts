import { SVGGenerator } from './services/implementations/SVGGenerator';

let instance: SVGGenerator | null = null;
export function getSVGGenerator(): SVGGenerator {
  return instance ??= new SVGGenerator();
}
