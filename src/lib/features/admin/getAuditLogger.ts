import { browser } from '$app/environment';
import type { IAuditLogger } from './services/contracts/IAuditLogger';
import { AuditLogger } from './services/implementations/AuditLogger';

let instance: IAuditLogger | null = null;

export function getAuditLogger(): IAuditLogger {
	if (!browser) throw new Error('getAuditLogger() is browser-only');
	return instance ??= new AuditLogger();
}
