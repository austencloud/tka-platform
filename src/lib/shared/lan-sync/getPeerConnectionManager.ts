
import { PeerConnectionManager } from './services/implementations/PeerConnectionManager';

let instance: PeerConnectionManager | null = null;
export function getPeerConnectionManager(): PeerConnectionManager {
  return instance ??= new PeerConnectionManager();
}
