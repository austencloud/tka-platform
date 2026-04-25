import type { IHallOfShameVoter } from './services/contracts/IHallOfShameVoter';
import { HallOfShameVoter } from './services/implementations/HallOfShameVoter';
import { getAgeVerifier } from './getAgeVerifier';

let instance: IHallOfShameVoter | null = null;
export function getHallOfShameVoter(): IHallOfShameVoter {
  return instance ??= new HallOfShameVoter(getAgeVerifier());
}
