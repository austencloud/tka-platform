import type { ISessionManager } from './services/contracts/ISessionManager';
import { SessionManager } from './services/implementations/SessionManager';

let instance: ISessionManager | null = null;
export function getConnectSessionManager(): ISessionManager {
  return instance ??= new SessionManager();
}
