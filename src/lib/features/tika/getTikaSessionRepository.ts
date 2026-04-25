import type { ITikaSessionRepository } from './services/contracts/ITikaSessionRepository';
import { TikaSessionRepository } from './services/implementations/TikaSessionRepository';

let instance: ITikaSessionRepository | null = null;
export function getTikaSessionRepository(): ITikaSessionRepository {
  return instance ??= new TikaSessionRepository();
}
