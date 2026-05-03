
import { LanSyncCoordinator } from './services/implementations/LanSyncCoordinator';
import { getPeerConnectionManager } from './getPeerConnectionManager';
import { getSyncRoomBroadcaster } from './getSyncRoomBroadcaster';

let instance: LanSyncCoordinator | null = null;
export function getLanSyncCoordinator(): LanSyncCoordinator {
  return instance ??= new LanSyncCoordinator(
    getPeerConnectionManager(),
    getSyncRoomBroadcaster()
  );
}
