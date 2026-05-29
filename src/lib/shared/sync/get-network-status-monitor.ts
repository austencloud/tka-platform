import { NetworkStatusMonitor } from './services/network-status-monitor';

let instance: NetworkStatusMonitor | null = null;
export function getNetworkStatusMonitor(): NetworkStatusMonitor {
  return instance ??= new NetworkStatusMonitor();
}
