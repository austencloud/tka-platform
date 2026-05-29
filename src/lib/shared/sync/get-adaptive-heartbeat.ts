import { AdaptiveHeartbeat } from './services/implementations/AdaptiveHeartbeat';

let instance: AdaptiveHeartbeat | null = null;
export function getAdaptiveHeartbeat(): AdaptiveHeartbeat {
  return instance ??= new AdaptiveHeartbeat();
}
