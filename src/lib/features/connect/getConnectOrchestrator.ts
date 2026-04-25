import type { IConnectOrchestrator } from './services/contracts/IConnectOrchestrator';
import { ConnectOrchestrator } from './services/implementations/ConnectOrchestrator';
import { getConnectPresenceTracker } from './getConnectPresenceTracker';
import { getConnectSessionManager } from './getConnectSessionManager';
import { getConnectInviteHandler } from './getConnectInviteHandler';
import { getConnectFriendshipManager } from './getConnectFriendshipManager';
import { getLanSyncCoordinator } from '$lib/shared/lan-sync/getLanSyncCoordinator';

let instance: IConnectOrchestrator | null = null;
export function getConnectOrchestrator(): IConnectOrchestrator {
  return instance ??= new ConnectOrchestrator(
    getConnectPresenceTracker(),
    getConnectSessionManager(),
    getConnectInviteHandler(),
    getConnectFriendshipManager(),
    getLanSyncCoordinator()
  );
}
