import { browser } from '$app/environment';
import { AuditLogger } from './services/implementations/AuditLogger';

let instance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
	if (!browser) throw new Error('getAuditLogger() is browser-only');
	return instance ??= new AuditLogger();
}
