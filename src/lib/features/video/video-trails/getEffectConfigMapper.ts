import { EffectConfigMapper } from './services/implementations/EffectConfigMapper';

let instance: EffectConfigMapper | null = null;
export function getEffectConfigMapper(): EffectConfigMapper {
  return instance ??= new EffectConfigMapper();
}
