import { MobileConnectionAdapter } from './services/implementations/MobileConnectionAdapter';
import { getNetworkStatusMonitor } from './getNetworkStatusMonitor';
import { getMessageBatcher } from './getMessageBatcher';

let instance: MobileConnectionAdapter | null = null;

export function getMobileConnectionAdapter(): MobileConnectionAdapter {
  if (!instance) {
    instance = new MobileConnectionAdapter();
    getNetworkStatusMonitor().onConnectionTypeChange((type) => {
      const isWifi = type === 'wifi' || type === 'ethernet';
      getMessageBatcher().notifyNetworkType(isWifi);
    });
  }
  return instance;
}
