import { MobileConnectionAdapter } from './services/mobile-connection-adapter';
import { getNetworkStatusMonitor } from './get-network-status-monitor';
import { getMessageBatcher } from './get-message-batcher';

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
