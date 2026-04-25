import type { IArrangeBeatCalculator } from './services/contracts/IArrangeBeatCalculator';
import { ArrangeBeatCalculator } from './services/implementations/ArrangeBeatCalculator';

let instance: IArrangeBeatCalculator | null = null;
export function getArrangeBeatCalculator(): IArrangeBeatCalculator {
  return instance ??= new ArrangeBeatCalculator();
}
