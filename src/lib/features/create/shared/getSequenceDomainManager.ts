import { browser } from '$app/environment';
import { SequenceDomainManager } from './services/implementations/SequenceDomainManager';

let instance: SequenceDomainManager | null = null;

export function getSequenceDomainManager(): SequenceDomainManager {
	if (!browser) throw new Error('getSequenceDomainManager() is browser-only');
	return instance ??= new SequenceDomainManager();
}
