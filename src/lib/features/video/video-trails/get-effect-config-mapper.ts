import * as effectConfigMapper from './services/effect-config-mapper';

export function getEffectConfigMapper(): typeof effectConfigMapper {
  return effectConfigMapper;
}
