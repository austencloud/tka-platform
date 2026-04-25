import type { IHallOfShameLoader } from './services/contracts/IHallOfShameLoader';
import { HallOfShameLoader } from './services/implementations/HallOfShameLoader';
import { getAgeVerifier } from './getAgeVerifier';

let instance: IHallOfShameLoader | null = null;
export function getHallOfShameLoader(): IHallOfShameLoader {
  return instance ??= new HallOfShameLoader(getAgeVerifier());
}
