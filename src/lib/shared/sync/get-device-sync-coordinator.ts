import { DeviceSyncCoordinator } from './services/implementations/DeviceSyncCoordinator';
import { getPeerConnectionManager } from '$lib/shared/lan-sync/getPeerConnectionManager';
import { getSequenceLocalCache } from './getSequenceLocalCache';
import { getAdaptiveHeartbeat } from './getAdaptiveHeartbeat';
import { getMessageBatcher } from './getMessageBatcher';
import { getMobileConnectionAdapter } from './getMobileConnectionAdapter';

let instance: DeviceSyncCoordinator | null = null;

export function getDeviceSyncCoordinator(): DeviceSyncCoordinator {
  return instance ??= new DeviceSyncCoordinator(
    getPeerConnectionManager(),
    {},
    getSequenceLocalCache(),
    {
      adaptiveHeartbeat: getAdaptiveHeartbeat(),
      messageBatcher: getMessageBatcher(),
      connectionAdapter: getMobileConnectionAdapter(),
    }
  );
}
