
import { SyncRoomDiscovery } from './services/implementations/SyncRoomDiscovery';

let instance: SyncRoomDiscovery | null = null;
export function getSyncRoomDiscovery(): SyncRoomDiscovery {
  return instance ??= new SyncRoomDiscovery();
}
