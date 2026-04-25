import type { IAdaptiveHeartbeat } from './services/contracts/IAdaptiveHeartbeat';
import { AdaptiveHeartbeat } from './services/implementations/AdaptiveHeartbeat';

let instance: IAdaptiveHeartbeat | null = null;
export function getAdaptiveHeartbeat(): IAdaptiveHeartbeat {
  return instance ??= new AdaptiveHeartbeat();
}
