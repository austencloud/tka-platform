import { PropPositionCalculator } from './services/implementations/PropPositionCalculator';

let instance: PropPositionCalculator | null = null;
export function getPropPositionCalculator(): PropPositionCalculator {
  return instance ??= new PropPositionCalculator();
}
