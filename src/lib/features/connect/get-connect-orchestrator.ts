import { ConnectOrchestrator } from './services/ConnectOrchestrator';
import { getConnectPresenceTracker } from './getConnectPresenceTracker';
import { getConnectSessionManager } from './getConnectSessionManager';
import { getConnectInviteHandler } from './getConnectInviteHandler';
import { getConnectFriendshipManager } from './getConnectFriendshipManager';
import { getLanSyncCoordinator } from '$lib/shared/lan-sync/getLanSyncCoordinator';

let instance: ConnectOrchestrator | null = null;
export function getConnectOrchestrator(): ConnectOrchestrator {
  return instance ??= new ConnectOrchestrator(
    getConnectPresenceTracker(),
    getConnectSessionManager(),
    getConnectInviteHandler(),
    getConnectFriendshipManager(),
    getLanSyncCoordinator()
  );
}
