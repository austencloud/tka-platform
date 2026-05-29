import { FriendshipManager } from './services/friendship-manager';
import { getConnectPresenceTracker } from './get-connect-presence-tracker';

let instance: FriendshipManager | null = null;
export function getConnectFriendshipManager(): FriendshipManager {
  return instance ??= new FriendshipManager(getConnectPresenceTracker());
}
