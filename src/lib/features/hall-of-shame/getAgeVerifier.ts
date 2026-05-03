import { AgeVerifier } from './services/implementations/AgeVerifier';

let instance: AgeVerifier | null = null;
export function getAgeVerifier(): AgeVerifier {
  return instance ??= new AgeVerifier();
}
