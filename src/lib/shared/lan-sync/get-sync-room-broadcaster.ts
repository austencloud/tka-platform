import { SyncRoomBroadcaster } from './services/sync-room-broadcaster';

let instance: SyncRoomBroadcaster | null = null;
export function getSyncRoomBroadcaster(): SyncRoomBroadcaster {
  return instance ??= new SyncRoomBroadcaster();
}
