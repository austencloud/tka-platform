import { SessionManager } from './services/SessionManager';

let instance: SessionManager | null = null;
export function getConnectSessionManager(): SessionManager {
  return instance ??= new SessionManager();
}
