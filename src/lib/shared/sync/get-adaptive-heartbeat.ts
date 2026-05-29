import { AdaptiveHeartbeat } from './services/adaptive-heartbeat';

let instance: AdaptiveHeartbeat | null = null;
export function getAdaptiveHeartbeat(): AdaptiveHeartbeat {
  return instance ??= new AdaptiveHeartbeat();
}
