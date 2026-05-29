import { HallOfShameLoader } from './services/hall-of-shame-loader';
import { getAgeVerifier } from './get-age-verifier';

let instance: HallOfShameLoader | null = null;
export function getHallOfShameLoader(): HallOfShameLoader {
  return instance ??= new HallOfShameLoader(getAgeVerifier());
}
