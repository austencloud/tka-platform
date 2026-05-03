import { TikaSessionRepository } from './services/implementations/TikaSessionRepository';

let instance: TikaSessionRepository | null = null;
export function getTikaSessionRepository(): TikaSessionRepository {
  return instance ??= new TikaSessionRepository();
}
