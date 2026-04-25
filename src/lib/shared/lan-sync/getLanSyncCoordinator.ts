import type { ILanSyncCoordinator } from './services/contracts/ILanSyncCoordinator';
import { LanSyncCoordinator } from './services/implementations/LanSyncCoordinator';
import { getPeerConnectionManager } from './getPeerConnectionManager';
import { getSyncRoomBroadcaster } from './getSyncRoomBroadcaster';

let instance: ILanSyncCoordinator | null = null;
export function getLanSyncCoordinator(): ILanSyncCoordinator {
  return instance ??= new LanSyncCoordinator(
    getPeerConnectionManager(),
    getSyncRoomBroadcaster()
  );
}
