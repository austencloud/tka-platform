import { HallOfShameVoter } from './services/HallOfShameVoter';
import { getAgeVerifier } from './getAgeVerifier';

let instance: HallOfShameVoter | null = null;
export function getHallOfShameVoter(): HallOfShameVoter {
  return instance ??= new HallOfShameVoter(getAgeVerifier());
}
