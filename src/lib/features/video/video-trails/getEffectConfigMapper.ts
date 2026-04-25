import type { IEffectConfigMapper } from './services/contracts/IEffectConfigMapper';
import { EffectConfigMapper } from './services/implementations/EffectConfigMapper';

let instance: IEffectConfigMapper | null = null;
export function getEffectConfigMapper(): IEffectConfigMapper {
  return instance ??= new EffectConfigMapper();
}
