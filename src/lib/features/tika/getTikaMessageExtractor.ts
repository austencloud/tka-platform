import { TikaMessageExtractor } from './services/implementations/TikaMessageExtractor';

let instance: TikaMessageExtractor | null = null;
export function getTikaMessageExtractor(): TikaMessageExtractor {
  return instance ??= new TikaMessageExtractor();
}
