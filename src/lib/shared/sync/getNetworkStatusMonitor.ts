import type { INetworkStatusMonitor } from './services/contracts/INetworkStatusMonitor';
import { NetworkStatusMonitor } from './services/implementations/NetworkStatusMonitor';

let instance: INetworkStatusMonitor | null = null;
export function getNetworkStatusMonitor(): INetworkStatusMonitor {
  return instance ??= new NetworkStatusMonitor();
}
