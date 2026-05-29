
import { PeerConnectionManager } from './services/peer-connection-manager';

let instance: PeerConnectionManager | null = null;
export function getPeerConnectionManager(): PeerConnectionManager {
  return instance ??= new PeerConnectionManager();
}
