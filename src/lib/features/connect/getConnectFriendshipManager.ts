import type { IFriendshipManager } from './services/contracts/IFriendshipManager';
import { FriendshipManager } from './services/implementations/FriendshipManager';
import { getConnectPresenceTracker } from './getConnectPresenceTracker';

let instance: IFriendshipManager | null = null;
export function getConnectFriendshipManager(): IFriendshipManager {
  return instance ??= new FriendshipManager(getConnectPresenceTracker());
}
