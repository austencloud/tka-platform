
import { LanSyncCoordinator } from './services/lan-sync-coordinator';
import { getPeerConnectionManager } from './get-peer-connection-manager';
import { getSyncRoomBroadcaster } from './get-sync-room-broadcaster';

let instance: LanSyncCoordinator | null = null;
export function getLanSyncCoordinator(): LanSyncCoordinator {
  return instance ??= new LanSyncCoordinator(
    getPeerConnectionManager(),
    getSyncRoomBroadcaster()
  );
}
