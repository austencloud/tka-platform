import type { IMobileConnectionAdapter } from './services/contracts/IMobileConnectionAdapter';
import { MobileConnectionAdapter } from './services/implementations/MobileConnectionAdapter';
import { getNetworkStatusMonitor } from './getNetworkStatusMonitor';
import { getMessageBatcher } from './getMessageBatcher';

let instance: IMobileConnectionAdapter | null = null;

export function getMobileConnectionAdapter(): IMobileConnectionAdapter {
  if (!instance) {
    instance = new MobileConnectionAdapter();
    getNetworkStatusMonitor().onConnectionTypeChange((type) => {
      const isWifi = type === 'wifi' || type === 'ethernet';
      getMessageBatcher().notifyNetworkType(isWifi);
    });
  }
  return instance;
}
