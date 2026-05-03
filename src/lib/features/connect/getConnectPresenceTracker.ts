import { PresenceTracker } from './services/implementations/PresenceTracker';

let instance: PresenceTracker | null = null;
export function getConnectPresenceTracker(): PresenceTracker {
  return instance ??= new PresenceTracker();
}
