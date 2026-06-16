import * as connectionManager from './services/connection-manager';
export function getConnectionManager(): typeof connectionManager { return connectionManager; }
