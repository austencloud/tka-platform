import { HallOfShameSubmitter } from './services/hall-of-shame-submitter';
import { getAgeVerifier } from './get-age-verifier';

let instance: HallOfShameSubmitter | null = null;
export function getHallOfShameSubmitter(): HallOfShameSubmitter {
  return instance ??= new HallOfShameSubmitter(getAgeVerifier());
}
