import type { ITikaSessionFormatter } from './services/contracts/ITikaSessionFormatter';
import { TikaSessionFormatter } from './services/implementations/TikaSessionFormatter';

let instance: ITikaSessionFormatter | null = null;
export function getTikaSessionFormatter(): ITikaSessionFormatter {
  return instance ??= new TikaSessionFormatter();
}
