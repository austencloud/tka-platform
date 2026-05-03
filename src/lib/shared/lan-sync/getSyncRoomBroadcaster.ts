import { SyncRoomBroadcaster } from './services/implementations/SyncRoomBroadcaster';

let instance: SyncRoomBroadcaster | null = null;
export function getSyncRoomBroadcaster(): SyncRoomBroadcaster {
  return instance ??= new SyncRoomBroadcaster();
}
