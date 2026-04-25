import type { ITikaMessageExtractor } from './services/contracts/ITikaMessageExtractor';
import { TikaMessageExtractor } from './services/implementations/TikaMessageExtractor';

let instance: ITikaMessageExtractor | null = null;
export function getTikaMessageExtractor(): ITikaMessageExtractor {
  return instance ??= new TikaMessageExtractor();
}
