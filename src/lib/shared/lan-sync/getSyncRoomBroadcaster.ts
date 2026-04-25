import type { ISyncRoomBroadcaster } from './services/contracts/ISyncRoomBroadcaster';
import { SyncRoomBroadcaster } from './services/implementations/SyncRoomBroadcaster';

let instance: ISyncRoomBroadcaster | null = null;
export function getSyncRoomBroadcaster(): ISyncRoomBroadcaster {
  return instance ??= new SyncRoomBroadcaster();
}
