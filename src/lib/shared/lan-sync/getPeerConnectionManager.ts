import type { IPeerConnectionManager } from './services/contracts/IPeerConnectionManager';
import { PeerConnectionManager } from './services/implementations/PeerConnectionManager';

let instance: IPeerConnectionManager | null = null;
export function getPeerConnectionManager(): IPeerConnectionManager {
  return instance ??= new PeerConnectionManager();
}
