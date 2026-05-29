import { HallOfShameVoter } from './services/hall-of-shame-voter';
import { getAgeVerifier } from './get-age-verifier';

let instance: HallOfShameVoter | null = null;
export function getHallOfShameVoter(): HallOfShameVoter {
  return instance ??= new HallOfShameVoter(getAgeVerifier());
}
