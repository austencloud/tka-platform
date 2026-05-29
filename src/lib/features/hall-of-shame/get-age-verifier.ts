import { AgeVerifier } from './services/AgeVerifier';

let instance: AgeVerifier | null = null;
export function getAgeVerifier(): AgeVerifier {
  return instance ??= new AgeVerifier();
}
