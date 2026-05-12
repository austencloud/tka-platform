import { HallOfShameSubmitter } from './services/HallOfShameSubmitter';
import { getAgeVerifier } from './getAgeVerifier';

let instance: HallOfShameSubmitter | null = null;
export function getHallOfShameSubmitter(): HallOfShameSubmitter {
  return instance ??= new HallOfShameSubmitter(getAgeVerifier());
}
