import { TikaSessionFormatter } from './services/implementations/TikaSessionFormatter';

let instance: TikaSessionFormatter | null = null;
export function getTikaSessionFormatter(): TikaSessionFormatter {
  return instance ??= new TikaSessionFormatter();
}
