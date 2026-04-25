import type { IHallOfShameSubmitter } from './services/contracts/IHallOfShameSubmitter';
import { HallOfShameSubmitter } from './services/implementations/HallOfShameSubmitter';
import { getAgeVerifier } from './getAgeVerifier';

let instance: IHallOfShameSubmitter | null = null;
export function getHallOfShameSubmitter(): IHallOfShameSubmitter {
  return instance ??= new HallOfShameSubmitter(getAgeVerifier());
}
