import type { IAgeVerifier } from './services/contracts/IAgeVerifier';
import { AgeVerifier } from './services/implementations/AgeVerifier';

let instance: IAgeVerifier | null = null;
export function getAgeVerifier(): IAgeVerifier {
  return instance ??= new AgeVerifier();
}
