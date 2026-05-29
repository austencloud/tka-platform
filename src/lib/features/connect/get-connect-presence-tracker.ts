import { PresenceTracker } from './services/presence-tracker';

let instance: PresenceTracker | null = null;
export function getConnectPresenceTracker(): PresenceTracker {
  return instance ??= new PresenceTracker();
}
