import { SessionManager } from './services/session-manager';

let instance: SessionManager | null = null;
export function getConnectSessionManager(): SessionManager {
  return instance ??= new SessionManager();
}
