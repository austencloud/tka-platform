import { PresenceTracker } from './services/PresenceTracker';

let instance: PresenceTracker | null = null;
export function getConnectPresenceTracker(): PresenceTracker {
  return instance ??= new PresenceTracker();
}
