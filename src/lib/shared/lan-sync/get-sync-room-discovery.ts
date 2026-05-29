
import { SyncRoomDiscovery } from './services/sync-room-discovery';

let instance: SyncRoomDiscovery | null = null;
export function getSyncRoomDiscovery(): SyncRoomDiscovery {
  return instance ??= new SyncRoomDiscovery();
}
