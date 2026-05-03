import { FriendshipManager } from './services/implementations/FriendshipManager';
import { getConnectPresenceTracker } from './getConnectPresenceTracker';

let instance: FriendshipManager | null = null;
export function getConnectFriendshipManager(): FriendshipManager {
  return instance ??= new FriendshipManager(getConnectPresenceTracker());
}
