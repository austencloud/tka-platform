import { AgeVerifier } from './services/age-verifier';

let instance: AgeVerifier | null = null;
export function getAgeVerifier(): AgeVerifier {
  return instance ??= new AgeVerifier();
}
