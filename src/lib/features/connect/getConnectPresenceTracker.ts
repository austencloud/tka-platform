import type { IPresenceTracker } from './services/contracts/IPresenceTracker';
import { PresenceTracker } from './services/implementations/PresenceTracker';

let instance: IPresenceTracker | null = null;
export function getConnectPresenceTracker(): IPresenceTracker {
  return instance ??= new PresenceTracker();
}
