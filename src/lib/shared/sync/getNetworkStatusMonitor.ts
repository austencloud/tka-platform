import { NetworkStatusMonitor } from './services/implementations/NetworkStatusMonitor';

let instance: NetworkStatusMonitor | null = null;
export function getNetworkStatusMonitor(): NetworkStatusMonitor {
  return instance ??= new NetworkStatusMonitor();
}
