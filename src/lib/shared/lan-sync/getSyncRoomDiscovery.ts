import type { ISyncRoomDiscovery } from './services/contracts/ISyncRoomDiscovery';
import { SyncRoomDiscovery } from './services/implementations/SyncRoomDiscovery';

let instance: ISyncRoomDiscovery | null = null;
export function getSyncRoomDiscovery(): ISyncRoomDiscovery {
  return instance ??= new SyncRoomDiscovery();
}
