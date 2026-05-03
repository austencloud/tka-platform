import { HallOfShameLoader } from './services/implementations/HallOfShameLoader';
import { getAgeVerifier } from './getAgeVerifier';

let instance: HallOfShameLoader | null = null;
export function getHallOfShameLoader(): HallOfShameLoader {
  return instance ??= new HallOfShameLoader(getAgeVerifier());
}
