import { PublicVideoLoader } from './services/implementations/PublicVideoLoader';

let instance: PublicVideoLoader | null = null;
export function getPublicVideoLoader(): PublicVideoLoader {
  return instance ??= new PublicVideoLoader();
}
